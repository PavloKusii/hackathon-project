import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import os from "os";
import { attachAuth, userFromToken } from "./auth.js";
import { appendSession, attachCaseRoutes, hostAllowed, loadCatalog, migrateCaseDeltas, scenarioTimer } from "./cases.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 4000;

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: true } });

app.use(cors());
app.use(express.json({ limit: "512kb" }));

const rooms = new Map();
const sockets = new Map();
let catalog = { publicList: [], byId: new Map() };

function channel(code) {
  return `room:${code}`;
}

function makeCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(6);
  let code = "";
  for (const byte of bytes) {
    code += alphabet[byte % alphabet.length];
  }
  if (rooms.has(code)) return makeCode();
  return code;
}

function lanAddress() {
  const nets = os.networkInterfaces();
  const found = [];
  for (const name of Object.keys(nets)) {
    for (const item of nets[name] || []) {
      const v4 = item.family === "IPv4" || item.family === 4;
      if (!v4 || item.internal) continue;
      found.push(item.address);
    }
  }
  return found.find((address) => address.startsWith("192.168.") || address.startsWith("10.") || /^172\.(1[6-9]|2\d|3[0-1])\./.test(address)) || found[0] || "";
}

async function refreshScenarios() {
  catalog = await loadCatalog();
  return catalog.publicList;
}

function scenarioById(id) {
  return catalog.byId.get(id) || null;
}

function clearVotes(room) {
  for (const guest of room.guests.values()) {
    guest.optionId = null;
  }
}

function onlineCount(room) {
  let online = 0;
  for (const guest of room.guests.values()) {
    if (guest.sockets > 0) online += 1;
  }
  room.peak = Math.max(room.peak || 0, online);
  return online;
}

function talliesFor(room, step) {
  const options = step?.options || [];
  const rows = options.map((option) => ({
    id: option.id,
    title: option.title,
    count: [...room.guests.values()].filter((guest) => guest.optionId === option.id).length,
    deltas: option.deltas || {}
  }));
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return rows.map((row) => ({ ...row, pct: total ? Math.round((row.count / total) * 100) : 0 }));
}

function snapshotStep(room) {
  const scenario = scenarioById(room.scenarioId);
  const step = scenario?.steps?.[room.stepIndex];
  if (!step || room.phase !== "live") return;
  room.archive.push({
    stepIndex: room.stepIndex,
    stepId: step.id,
    prompt: step.prompt,
    options: talliesFor(room, step)
  });
}

function sharedSteps(scenario) {
  if (scenario?.tree) return 1;
  return scenario?.steps?.length || 0;
}

function playerState(room) {
  const scenario = scenarioById(room.scenarioId);
  return {
    code: room.code,
    scenarioId: room.scenarioId,
    stepIndex: room.stepIndex,
    stepCount: sharedSteps(scenario),
    phase: room.phase,
    participantCount: onlineCount(room),
    groupLabel: room.groupLabel || "",
    named: Boolean(room.named),
    endsAt: room.phase === "live" ? (room.endsAt || 0) : 0,
    timerScope: room.phase === "live" ? (room.timerScope || "") : "",
    stepClockPaused: Boolean(room.stepClockPaused),
    timedOut: Boolean(room.timedOut)
  };
}

const roomTimers = new Map();

function armRoomTimer(room) {
  const previous = roomTimers.get(room.code);
  if (previous) clearTimeout(previous);
  room.endsAt = 0;
  room.timerScope = "";
  if (room.phase !== "live") {
    roomTimers.delete(room.code);
    return;
  }
  const marks = [];
  if (room.timeMode === "case" && room.caseEndsAt) marks.push({ at: room.caseEndsAt, scope: "case" });
  if (room.timeMode === "step" && !room.stepClockPaused && room.limitSeconds && room.stepStartedAt) {
    marks.push({ at: room.stepStartedAt + room.limitSeconds * 1000, scope: "step" });
  }
  if (!marks.length) {
    roomTimers.delete(room.code);
    return;
  }
  marks.sort((left, right) => left.at - right.at);
  room.endsAt = marks[0].at;
  room.timerScope = marks[0].scope;
  const wait = Math.max(0, marks[0].at - Date.now());
  const handle = setTimeout(() => {
    finishOnTime(room.code).catch(() => {});
  }, Math.min(wait, 2147483647));
  roomTimers.set(room.code, handle);
}

async function finishOnTime(code) {
  const room = rooms.get(code);
  if (!room || room.phase !== "live") return;
  if (room.endsAt && room.endsAt - Date.now() > 400) {
    armRoomTimer(room);
    broadcast(room);
    return;
  }
  const scenario = scenarioById(room.scenarioId);
  const total = sharedSteps(scenario);
  snapshotStep(room);
  if (room.timeMode === "step" && room.stepIndex < total - 1) {
    room.stepIndex += 1;
    room.stepStartedAt = Date.now();
    clearVotes(room);
    armRoomTimer(room);
    broadcast(room);
    return;
  }
  if (room.timeMode === "step" && scenario?.tree) {
    room.stepClockPaused = true;
    armRoomTimer(room);
    broadcast(room);
    return;
  }
  room.phase = "done";
  room.timedOut = true;
  armRoomTimer(room);
  broadcast(room);
  await persistRoom(room);
}

function hostState(room) {
  const scenario = scenarioById(room.scenarioId);
  const steps = scenario?.steps || [];
  const visible = room.phase === "live" || room.phase === "done";
  const step = visible ? steps[room.stepIndex] : null;
  return {
    ...playerState(room),
    tallies: talliesFor(room, step)
  };
}

function hostArchive(room) {
  return {
    code: room.code,
    scenarioId: room.scenarioId,
    groupLabel: room.groupLabel || "",
    named: Boolean(room.named),
    createdAt: room.createdAt,
    phase: room.phase,
    archive: room.archive
  };
}

function broadcast(room) {
  const players = playerState(room);
  const host = hostState(room);
  const archive = hostArchive(room);
  for (const [id, meta] of sockets) {
    if (meta.code !== room.code) continue;
    if (meta.role === "host") {
      io.to(id).emit("room_state", host);
      io.to(id).emit("host_archive", archive);
    } else {
      io.to(id).emit("room_state", players);
    }
  }
}

function releaseSocket(socket) {
  const meta = sockets.get(socket.id);
  if (!meta) return;
  sockets.delete(socket.id);
  socket.leave(channel(meta.code));
  const room = rooms.get(meta.code);
  if (!room) return;
  if (meta.role === "guest") {
    const guest = room.guests.get(meta.guestId);
    if (guest) guest.sockets = Math.max(0, guest.sockets - 1);
  }
  broadcast(room);
}

async function persistRoom(room) {
  if (room.phase !== "done" || room.persisted) return;
  room.persisted = true;
  const scenario = scenarioById(room.scenarioId);
  await appendSession({
    code: room.code,
    scenarioId: room.scenarioId,
    scenarioTitle: scenario?.title || "",
    scenarioCode: scenario?.code || "",
    groupName: room.groupName,
    groupLabel: room.groupLabel,
    named: room.named,
    hostId: room.hostUserId,
    createdAt: room.createdAt,
    participantPeak: room.peak || 0,
    steps: room.archive
  });
}

app.get("/api/scenarios", async (req, res) => {
  const list = await refreshScenarios();
  res.json({ scenarios: list });
});

app.get("/api/host", (req, res) => {
  res.json({ host: lanAddress() });
});

io.on("connection", (socket) => {
  socket.on("create_room", async ({ scenarioId, groupName, token } = {}) => {
    await migrateCaseDeltas();
    await refreshScenarios();
    const user = await userFromToken(token);
    const scenario = scenarioById(scenarioId);
    if (!user || user.role !== "organizer") {
      socket.emit("room_error", { message: "Групове заняття проводить лише організатор." });
      return;
    }
    if (!scenario || !hostAllowed(user, scenario)) {
      socket.emit("room_error", { message: "Цей кейс не можна відкрити у вашій кімнаті." });
      return;
    }
    releaseSocket(socket);
    const code = makeCode();
    const roomToken = crypto.randomBytes(18).toString("hex");
    const named = String(groupName || "").trim().slice(0, 80);
    const room = {
      code,
      token: roomToken,
      scenarioId: scenario.id,
      stepIndex: 0,
      phase: "lobby",
      guests: new Map(),
      archive: [],
      peak: 0,
      hostUserId: user.id,
      groupName: named,
      named: Boolean(named),
      groupLabel: named || new Intl.DateTimeFormat("uk-UA", { dateStyle: "short", timeStyle: "short" }).format(new Date()),
      createdAt: new Date().toISOString(),
      persisted: false,
      endsAt: 0,
      timerScope: "",
      timedOut: false,
      caseEndsAt: 0,
      stepStartedAt: 0,
      timeMode: "none",
      limitSeconds: 0,
      stepClockPaused: false
    };
    rooms.set(code, room);
    sockets.set(socket.id, { role: "host", code, token: roomToken });
    socket.join(channel(code));
    socket.emit("room_created", { code, token: roomToken, scenarioId: scenario.id, groupLabel: room.groupLabel });
    socket.emit("scenario_payload", scenario);
    broadcast(room);
  });

  socket.on("resume_room", ({ code, token } = {}) => {
    const room = rooms.get(String(code || "").toUpperCase());
    if (!room || room.token !== token) {
      socket.emit("room_error", { message: "Сесію викладача не знайдено. Створіть кімнату знову." });
      return;
    }
    releaseSocket(socket);
    sockets.set(socket.id, { role: "host", code: room.code, token });
    socket.join(channel(room.code));
    const scenario = scenarioById(room.scenarioId);
    socket.emit("room_created", { code: room.code, token, scenarioId: room.scenarioId, groupLabel: room.groupLabel });
    if (scenario) socket.emit("scenario_payload", scenario);
    broadcast(room);
  });

  socket.on("join_room", ({ code, guestId } = {}) => {
    const room = rooms.get(String(code || "").toUpperCase());
    const id = String(guestId || "");
    if (!room) {
      socket.emit("room_error", { message: "Кімнату з таким кодом не знайдено." });
      return;
    }
    if (!id || id.length > 80) {
      socket.emit("room_error", { message: "Не вдалося відкрити анонімний вхід." });
      return;
    }
    if (room.guests.size >= 200 && !room.guests.has(id)) {
      socket.emit("room_error", { message: "Кімната вже заповнена." });
      return;
    }
    const current = sockets.get(socket.id);
    if (current && current.role === "guest" && current.code === room.code && current.guestId === id) {
      const guest = room.guests.get(id);
      const scenario = scenarioById(room.scenarioId);
      socket.emit("joined_room", { code: room.code, scenarioId: room.scenarioId });
      if (scenario) socket.emit("scenario_payload", scenario);
      socket.emit("your_vote", { stepIndex: room.stepIndex, optionId: guest?.optionId || "" });
      socket.emit("room_state", playerState(room));
      return;
    }
    releaseSocket(socket);
    if (!room.guests.has(id)) room.guests.set(id, { optionId: null, sockets: 0 });
    const guest = room.guests.get(id);
    guest.sockets += 1;
    sockets.set(socket.id, { role: "guest", code: room.code, guestId: id });
    socket.join(channel(room.code));
    const scenario = scenarioById(room.scenarioId);
    socket.emit("joined_room", { code: room.code, scenarioId: room.scenarioId });
    if (scenario) socket.emit("scenario_payload", scenario);
    socket.emit("your_vote", { stepIndex: room.stepIndex, optionId: guest.optionId || "" });
    broadcast(room);
  });

  socket.on("advance", async ({ code, token } = {}) => {
    const room = rooms.get(String(code || "").toUpperCase());
    if (!room || room.token !== token) {
      socket.emit("room_error", { message: "Керувати кімнатою може лише викладач цієї сесії." });
      return;
    }
    await refreshScenarios();
    const scenario = scenarioById(room.scenarioId);
    const total = sharedSteps(scenario);
    if (!total) {
      socket.emit("room_error", { message: "У сценарії немає кроків." });
      return;
    }
    if (room.phase === "lobby") {
      const now = Date.now();
      const timer = scenarioTimer(scenario);
      room.phase = "live";
      room.stepIndex = 0;
      room.stepStartedAt = now;
      room.timeMode = timer.mode;
      room.limitSeconds = timer.seconds;
      room.caseEndsAt = timer.mode === "case" ? now + timer.seconds * 1000 : 0;
      room.stepClockPaused = false;
      room.timedOut = false;
      clearVotes(room);
      armRoomTimer(room);
    } else if (room.phase === "live") {
      snapshotStep(room);
      const currentStep = scenario.steps[room.stepIndex];
      const votes = [...room.guests.values()].reduce((counts, guest) => {
        if (guest.optionId) counts.set(guest.optionId, (counts.get(guest.optionId) || 0) + 1);
        return counts;
      }, new Map());
      const selectedOptionId = [...votes.entries()].sort((left, right) => right[1] - left[1])[0]?.[0];
      const selectedOption = currentStep?.options?.find((option) => option.id === selectedOptionId);
      const nextStepId = selectedOption?.nextStepId;
      const nextStepIndex = nextStepId
        ? scenario.steps.findIndex((step) => step.id === nextStepId)
        : -1;
      if (nextStepIndex >= 0) {
        room.stepIndex = nextStepIndex;
        clearVotes(room);
      } else if ((nextStepId && nextStepIndex < 0) || room.stepIndex >= total - 1) {
        room.phase = "done";
      } else {
        room.stepIndex += 1;
        room.stepStartedAt = Date.now();
        clearVotes(room);
      }
      armRoomTimer(room);
    }
    broadcast(room);
    if (room.phase === "done") await persistRoom(room);
  });

  socket.on("submit_vote", ({ code, guestId, optionId } = {}) => {
    const room = rooms.get(String(code || "").toUpperCase());
    const id = String(guestId || "");
    const meta = sockets.get(socket.id);
    if (!room || !meta || meta.role !== "guest" || meta.code !== room.code || meta.guestId !== id) {
      socket.emit("room_error", { message: "Спочатку увійдіть у кімнату." });
      return;
    }
    if (room.phase !== "live") {
      socket.emit("room_error", { message: "Зараз немає відкритого кроку для голосу." });
      return;
    }
    const scenario = scenarioById(room.scenarioId);
    const step = scenario?.steps?.[room.stepIndex];
    const option = step?.options?.find((item) => item.id === optionId);
    if (!option) {
      socket.emit("room_error", { message: "Такого варіанту на цьому кроці немає." });
      return;
    }
    const guest = room.guests.get(id);
    if (!guest) {
      socket.emit("room_error", { message: "Спочатку увійдіть у кімнату." });
      return;
    }
    if (guest.optionId) {
      socket.emit("your_vote", { stepIndex: room.stepIndex, optionId: guest.optionId });
      return;
    }
    guest.optionId = option.id;
    socket.emit("your_vote", { stepIndex: room.stepIndex, optionId: guest.optionId });
    broadcast(room);
  });

  socket.on("disconnect", () => {
    releaseSocket(socket);
  });
});

await refreshScenarios();
await attachAuth(app);
attachCaseRoutes(app, { onChange: refreshScenarios });
httpServer.listen(PORT, "0.0.0.0");
