import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import os from "os";
import { attachAuth, userFromToken } from "./auth.js";
import { upsertSession, upsertRoomResults, ensureRoomResultsFile, attachCaseRoutes, hostAllowed, loadCatalog, migrateCaseDeltas } from "./cases.js";

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
ensureRoomResultsFile().catch((error) => console.error("Failed to initialize room results JSON:", error));

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
    guest.stepId = "";
    guest.completed = false;
    guest.history = guest.history || [];
  }
}

function clearStepResponses(room) {
  for (const guest of room.guests.values()) {
    guest.optionId = null;
    guest.stepId = "";
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

function findScenarioStep(scenario, stepId) {
  if (!scenario) return null;
  const linear = (scenario.steps || []).find((step) => step.id === stepId);
  if (linear) return linear;
  if (!scenario.tree) return null;
  let found = null;
  function visit(node) {
    if (!node || found) return;
    if (node.id === stepId) {
      found = node;
      return;
    }
    for (const option of node.options || []) visit(option.next);
  }
  visit(scenario.tree);
  return found;
}

function aggregateArchive(room) {
  const scenario = scenarioById(room.scenarioId);
  const nodeMap = new Map();
  for (const guest of room.guests.values()) {
    for (let index = 0; index < (guest.history || []).length; index += 1) {
      const entry = guest.history[index];
      const step = findScenarioStep(scenario, entry.stepId);
      if (!step) continue;
      if (!nodeMap.has(step.id)) {
        nodeMap.set(step.id, {
          stepIndex: index,
          stepId: step.id,
          prompt: step.prompt,
          label: step.label || "",
          participants: 0,
          options: (step.options || []).map((option) => ({
            id: option.id,
            title: option.title,
            count: 0,
            deltas: {
              integrity: Number(option.deltas?.integrity || 0),
              trust: Number(option.deltas?.trust || 0),
              reputation: Number((option.deltas?.reputation ?? option.deltas?.trust) || 0),
              effectiveness: Number(option.deltas?.effectiveness || 0)
            }
          }))
        });
      }
      const row = nodeMap.get(step.id);
      row.participants += 1;
      const option = row.options.find((item) => item.id === entry.optionId);
      if (option) option.count += 1;
    }
  }
  return [...nodeMap.values()].map((step) => {
    const total = step.options.reduce((sum, option) => sum + option.count, 0);
    return {
      ...step,
      options: step.options.map((option) => ({
        ...option,
        pct: total ? Math.round((option.count / total) * 100) : 0
      }))
    };
  });
}

function snapshotStep(room) {
  room.archive = aggregateArchive(room);
}

function sharedSteps(scenario) {
  if (scenario?.tree) return 1;
  return scenario?.steps?.length || 0;
}

function playerState(room) {
  const scenario = scenarioById(room.scenarioId);
  const guests = [...room.guests.values()];
  const activeGuests = guests.filter((guest) => guest.sockets > 0 && !guest.completed);
  const answeredOnCurrentStep = activeGuests.filter((guest) => guest.optionId).length;
  const finishedCount = guests.filter((guest) => guest.completed || guest.finishedAt).length;
  const onlineCountValue = guests.filter((guest) => guest.sockets > 0).length;
  const onlineFinishedCount = guests.filter((guest) => guest.sockets > 0 && guest.completed).length;
  return {
    code: room.code,
    scenarioId: room.scenarioId,
    stepIndex: room.stepIndex,
    stepCount: sharedSteps(scenario),
    phase: room.phase,
    participantCount: onlineCount(room),
    finishedCount,
    completedCount: finishedCount,
    activeCount: Math.max(0, onlineCountValue - onlineFinishedCount),
    groupLabel: room.groupLabel || "",
    named: Boolean(room.named),
    endsAt: room.phase === "live" ? (room.endsAt || 0) : 0,
    timerScope: room.phase === "live" ? (room.timerScope || "") : "",
    timerMode: room.timerMode || "none",
    totalDurationSeconds: room.totalDurationSeconds || 0,
    questionDurationSeconds: room.questionDurationSeconds || 0,
    startedAt: room.startedAt || 0,
    questionStartedAt: room.questionStartedAt || 0,
    timeLimitSeconds: room.limitSeconds || 0,
    allAnswered: Boolean(room.allAnsweredNow) || (activeGuests.length > 0 && answeredOnCurrentStep === activeGuests.length),
    stepAdvanced: room.stepAdvanced || 0,
    stepClockPaused: Boolean(room.stepClockPaused),
    timedOut: Boolean(room.timedOut)
  };
}

const roomTimers = new Map();

function advanceStepTimer(room) {
  if (room.phase !== "live" || room.timeMode !== "per_question") return;
  const now = Date.now();
  room.stepStartedAt = now;
  room.questionStartedAt = now;
  const scenario = scenarioById(room.scenarioId);
  if (!scenario?.tree && room.stepIndex < (scenario?.steps?.length || 1) - 1) {
    room.stepIndex += 1;
  }
  room.stepClockPaused = false;
  room.stepAdvanced = (room.stepAdvanced || 0) + 1;
  room.allAnsweredNow = true;
  clearStepResponses(room);
  room.stepStartedAt = Date.now();
  armRoomTimer(room);
  broadcast(room);
  setTimeout(() => {
    if (room.phase !== "live") return;
    room.allAnsweredNow = false;
    broadcast(room);
  }, 100);
}

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
  if (room.timeMode === "whole_case" && room.caseEndsAt) marks.push({ at: room.caseEndsAt, scope: "whole_case" });
  if (room.timeMode === "per_question" && !room.stepClockPaused && room.limitSeconds && room.stepStartedAt) {
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
  if (room.timeMode === "per_question") {
    room.allAnsweredNow = false;
    for (const guest of room.guests.values()) {
      if (guest.sockets > 0 && !guest.optionId) {
        guest.timedOut = true;
        guest.history = guest.history || [];
        const currentStepId = guest.stepId || (scenario?.tree ? scenario.tree.id : scenario?.steps?.[room.stepIndex]?.id);
        if (currentStepId && !guest.history.some((entry) => entry.stepId === currentStepId)) {
          guest.history.push({ stepId: currentStepId, optionId: "", timedOut: true });
        }
      }
    }
    if (scenario?.tree) {
      room.stepStartedAt = Date.now();
      room.stepClockPaused = false;
      room.stepAdvanced = (room.stepAdvanced || 0) + 1;
      clearStepResponses(room);
      armRoomTimer(room);
    } else if (room.stepIndex < total - 1) {
      const now = Date.now();
      room.stepStartedAt = now;
      room.questionStartedAt = now;
      room.stepIndex += 1;
      room.stepAdvanced = (room.stepAdvanced || 0) + 1;
      clearStepResponses(room);
      armRoomTimer(room);
    } else {
      room.phase = "done";
      room.timedOut = true;
      for (const guest of room.guests.values()) {
        if (guest.sockets > 0) {
          guest.completed = true;
          guest.finishedAt = guest.finishedAt || Date.now();
        }
      }
      armRoomTimer(room);
    }
    broadcast(room);
    if (room.phase === "done") await persistRoom(room);
    return;
  }
  if (room.timeMode === "per_question" && scenario?.tree) {
    room.stepClockPaused = false;
  }
  room.phase = "done";
  room.timedOut = true;
  for (const guest of room.guests.values()) {
    guest.timedOut = true;
    guest.completed = true;
    guest.finishedAt = guest.finishedAt || Date.now();
  }
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
    tallies: talliesFor(room, step),
    participants: hostArchive(room).participants,
    archive: aggregateArchive(room)
  };
}

function hostArchive(room) {
  const scenario = scenarioById(room.scenarioId);
  const participants = [...room.guests.entries()].map(([id, guest], index) => {
    const history = (Array.isArray(guest.answers) && guest.answers.length
            ? guest.answers
            : (guest.history || [])
    ).map((entry) => {
      const step = findScenarioStep(scenario, entry.stepId);
      const option = (step?.options || []).find((item) => item.id === entry.optionId);
      const deltas = {
        integrity: Number(option?.deltas?.integrity ?? 0),
        trust: Number(option?.deltas?.trust ?? 0),
        reputation: Number(option?.deltas?.reputation ?? option?.deltas?.trust ?? 0),
        effectiveness: Number(option?.deltas?.effectiveness ?? 0)
      };
      return {
        stepId: entry.stepId,
        prompt: entry.prompt || step?.prompt || "",
        label: step?.label || "",
        optionId: entry.optionId,
        optionTitle: entry.timedOut ? "Час сплив — відповіді не обрано" : (entry.optionTitle || option?.title || ""),
        deltas: entry.deltas && Object.keys(entry.deltas).length ? entry.deltas : deltas
      };
    });
    const scores = guest.scores
        ? {
          integrity: Number(guest.scores.integrity || 0),
          trust: Number(guest.scores.trust || 0),
          reputation: Number(guest.scores.reputation ?? guest.scores.trust ?? 0),
          effectiveness: Number(guest.scores.effectiveness || 0)
        }
        : history.reduce((total, entry) => {
          for (const metric of ["integrity", "trust", "reputation", "effectiveness"]) {
            total[metric] = Math.max(0, Math.min(100, (total[metric] || 0) + Number(entry.deltas?.[metric] || 0)));
          }
          return total;
        }, { integrity: 0, trust: 0, reputation: 0, effectiveness: 0 });
    const negativeChoices = history.filter((entry) =>
        ["integrity", "trust", "reputation", "effectiveness"].some((metric) => Number(entry.deltas?.[metric] || 0) < 0)
    ).length;
    const averageScore = Math.round((scores.integrity + scores.trust + scores.reputation + scores.effectiveness) / 4);
    const verdict = history.length === 0
        ? "Проходження не завершено"
        : negativeChoices >= 3 || averageScore < 60
            ? "Критичні помилки у виборі дій"
            : negativeChoices > 0
                ? "Помірні ризики в окремих рішеннях"
                : "Безпечне/виважене проходження";
    return {
      id,
      name: guest.name && guest.name !== "Гість"
          ? guest.name
          : `Учасник ${index + 1}`,
      history,
      answers: history,
      scores,
      branch: guest.routeLabel
          || history.map((entry) => entry.label).filter(Boolean).join(" → ")
          || (scenario?.tree ? "Гілка кейсу" : "Лінійний маршрут"),
      branchLabel: guest.routeLabel
          || history.map((entry) => entry.label).filter(Boolean).join(" → ")
          || (scenario?.tree ? "Гілка кейсу" : "Лінійний маршрут"),
      routeId: guest.routeId || "",
      status: guest.completed ? "completed" : guest.timedOut ? "timeout" : "in_progress",
      statusLabel: guest.completed ? "Завершено" : guest.timedOut ? "Час вичерпано" : "У процесі",
      averageScore,
      verdict,
      completedAt: guest.finishedAt || null,
      timedOut: Boolean(guest.timedOut)
    };
  });
  return {
    code: room.code,
    scenarioId: room.scenarioId,
    groupLabel: room.groupLabel || "",
    named: Boolean(room.named),
    createdAt: room.createdAt,
    phase: room.phase,
    archive: aggregateArchive(room),
    participants
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
  persistRoomState(room).catch((error) => console.error("Failed to persist room on disconnect:", error));
}

async function persistRoom(room) {
  if (room.phase !== "done" || room.persisted) return;
  room.persisted = true;
  await persistRoomState(room);
}

async function persistRoomState(room) {
  const scenario = scenarioById(room.scenarioId);
  const record = {
    id: room.persistedSessionId,
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
    steps: aggregateArchive(room),
    participants: hostArchive(room).participants,
    phase: room.phase,
    finishedAt: room.phase === "done" ? new Date().toISOString() : null
  };
  await Promise.all([
    upsertSession(record),
    upsertRoomResults(record)
  ]);
}

app.get("/api/scenarios", async (req, res) => {
  const list = await refreshScenarios();
  res.json({ scenarios: list });
});

app.get("/api/host", (req, res) => {
  res.json({ host: lanAddress() });
});

io.on("connection", (socket) => {
  socket.on("create_room", async ({
                                    scenarioId,
                                    groupName,
                                    token,
                                    timerMode,
                                    totalDurationSeconds,
                                    questionDurationSeconds
                                  } = {}) => {
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
      stepClockPaused: false,
      timerMode: ["whole_case", "per_question"].includes(timerMode) ? timerMode : "none",
      totalDurationSeconds: timerMode === "whole_case"
          ? Math.max(1, Math.min(10800, Number(totalDurationSeconds) || 0))
          : 0,
      questionDurationSeconds: timerMode === "per_question"
          ? Math.max(1, Math.min(10800, Number(questionDurationSeconds) || 0))
          : 0,
      startedAt: 0,
      questionStartedAt: 0
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

  socket.on("join_room", ({ code, guestId, name } = {}) => {
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
      socket.emit("your_vote", { stepIndex: room.stepIndex, stepId: guest?.stepId || "", optionId: guest?.optionId || "" });
      socket.emit("room_state", playerState(room));
      broadcast(room);
      return;
    }
    releaseSocket(socket);
    if (!room.guests.has(id)) room.guests.set(id, {
      optionId: null,
      stepId: "",
      completed: false,
      history: [],
      answers: [],
      sockets: 0,
      name: String(name || "Гість").slice(0, 80),
      routeId: "",
      routeLabel: "Лінійний маршрут",
      scores: null,
      finishedAt: null
    });
    const guest = room.guests.get(id);
    if (name) guest.name = String(name).slice(0, 80);
    guest.sockets += 1;
    sockets.set(socket.id, { role: "guest", code: room.code, guestId: id });
    socket.join(channel(room.code));
    const scenario = scenarioById(room.scenarioId);
    socket.emit("joined_room", { code: room.code, scenarioId: room.scenarioId });
    if (scenario) socket.emit("scenario_payload", scenario);
    socket.emit("your_vote", { stepIndex: room.stepIndex, stepId: guest.stepId || "", optionId: guest.optionId || "" });
    broadcast(room);
    persistRoomState(room).catch((error) => console.error("Failed to persist joined participant:", error));
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
      const timer = room.timerMode === "whole_case"
          ? { mode: "whole_case", seconds: room.totalDurationSeconds }
          : room.timerMode === "per_question"
              ? { mode: "per_question", seconds: room.questionDurationSeconds }
              : { mode: "none", seconds: 0 };
      room.phase = "live";
      room.stepIndex = 0;
      room.stepStartedAt = now;
      room.startedAt = now;
      room.questionStartedAt = now;
      room.timeMode = timer.mode;
      room.limitSeconds = timer.seconds;
      room.caseEndsAt = timer.mode === "whole_case" ? now + timer.seconds * 1000 : 0;
      room.endsAt = timer.mode === "whole_case"
          ? room.caseEndsAt
          : timer.mode === "per_question"
              ? now + timer.seconds * 1000
              : 0;
      room.stepClockPaused = false;
      room.timedOut = false;
      room.allAnsweredNow = false;
      room.stepAdvanced = 0;
      clearVotes(room);
      armRoomTimer(room);
    }
    broadcast(room);
    if (room.phase === "done") await persistRoom(room);
  });

  socket.on("finish_room", async ({ code, token } = {}) => {
    const room = rooms.get(String(code || "").toUpperCase());
    if (!room || room.token !== token) {
      socket.emit("room_error", { message: "Керувати кімнатою може лише викладач цієї сесії." });
      return;
    }
    if (room.phase === "done") {
      broadcast(room);
      await persistRoomState(room).catch(() => {});
      return;
    }
    if (room.phase !== "live" && room.phase !== "lobby") {
      socket.emit("room_error", { message: "Сесію вже неможливо завершити." });
      return;
    }
    room.phase = "done";
    room.timedOut = false;
    for (const guest of room.guests.values()) {
      if (guest.sockets > 0) {
        guest.completed = true;
        guest.finishedAt = guest.finishedAt || Date.now();
      }
    }
    room.archive = aggregateArchive(room);
    armRoomTimer(room);
    broadcast(room);
    try {
      await persistRoom(room);
    } catch (error) {
      console.error("Failed to persist finished group room:", error);
      socket.emit("room_error", { message: "Заняття завершено, але підсумки не вдалося зберегти." });
    }
  });

  socket.on("participant_snapshot", ({ code, guestId, name, history, routeId, routeLabel, scores, completed, finishedAt } = {}) => {
    const room = rooms.get(String(code || "").toUpperCase());
    const id = String(guestId || "");
    const meta = sockets.get(socket.id);
    if (!room || !meta || meta.role !== "guest" || meta.code !== room.code || meta.guestId !== id) {
      console.error("participant_snapshot rejected", { code, guestId: id, roomFound: Boolean(room) });
      return;
    }
    let guest = room.guests.get(id);
    if (!guest) {
      guest = {
        optionId: null,
        stepId: "",
        completed: false,
        history: [],
        answers: [],
        sockets: 1,
        name: String(name || "Гість").slice(0, 80),
        routeId: "",
        routeLabel: "Лінійний маршрут",
        scores: null,
        finishedAt: null
      };
      room.guests.set(id, guest);
    }
    if (name) guest.name = String(name).slice(0, 80);
    guest.routeId = String(routeId || guest.routeId || "");
    guest.routeLabel = String(routeLabel || guest.routeLabel || "").slice(0, 200);
    if (completed === true) {
      guest.completed = true;
      guest.finishedAt = Number(finishedAt) || guest.finishedAt || Date.now();
    }
    if (scores && typeof scores === "object") {
      guest.scores = {
        integrity: Number.isFinite(Number(scores.integrity)) ? Math.max(0, Math.min(100, Number(scores.integrity))) : 0,
        trust: Number.isFinite(Number(scores.trust)) ? Math.max(0, Math.min(100, Number(scores.trust))) : 0,
        reputation: Number.isFinite(Number(scores.reputation))
            ? Math.max(0, Math.min(100, Number(scores.reputation)))
            : (Number.isFinite(Number(scores.trust)) ? Math.max(0, Math.min(100, Number(scores.trust))) : 0),
        effectiveness: Number.isFinite(Number(scores.effectiveness)) ? Math.max(0, Math.min(100, Number(scores.effectiveness))) : 0
      };
    }
    if (Array.isArray(history)) {
      guest.history = history
          .filter((entry) => entry && typeof entry.stepId === "string")
          .map((entry) => ({
            stepId: entry.stepId,
            optionId: String(entry.optionId || ""),
            timedOut: entry.timedOut === true
          }));
      guest.answers = guest.history.map((entry) => {
        const step = findScenarioStep(scenarioById(room.scenarioId), entry.stepId);
        const option = (step?.options || []).find((item) => item.id === entry.optionId);
        const snapshotEntry = history.find((item) => item.stepId === entry.stepId);
        return {
          stepId: entry.stepId,
          prompt: snapshotEntry?.prompt || step?.prompt || "",
          optionId: entry.optionId,
          optionTitle: entry.timedOut ? "Час сплив — відповіді не обрано" : (snapshotEntry?.optionTitle || option?.title || ""),
          deltas: snapshotEntry?.deltas || option?.deltas || {}
        };
      });
    }
    broadcast(room);
    persistRoomState(room).catch((error) => console.error("Failed to persist participant snapshot:", error));
  });

  socket.on("participant_complete", async ({ code, guestId, name, answers, scores, routeId, routeLabel } = {}) => {
    const room = rooms.get(String(code || "").toUpperCase());
    const id = String(guestId || "");
    const meta = sockets.get(socket.id);
    if (!room || !meta || meta.role !== "guest" || meta.code !== room.code || meta.guestId !== id) {
      console.error("participant_complete rejected", { code, guestId: id, roomFound: Boolean(room) });
      return;
    }
    let guest = room.guests.get(id);
    if (!guest) {
      guest = {
        optionId: null,
        stepId: "",
        completed: false,
        history: [],
        answers: [],
        sockets: 1,
        name: "Гість",
        routeId: "",
        routeLabel: "Лінійний маршрут",
        scores: null,
        finishedAt: null
      };
      room.guests.set(id, guest);
    }
    guest.name = String(name || guest.name || "Гість").slice(0, 80);
    guest.routeId = String(routeId || guest.routeId || "");
    guest.routeLabel = String(routeLabel || guest.routeLabel || "Лінійний маршрут").slice(0, 200);
    guest.completed = true;
    guest.finishedAt = guest.finishedAt || Date.now();
    if (Array.isArray(answers)) {
      guest.answers = answers
          .filter((entry) => entry && typeof entry.stepId === "string")
          .map((entry) => ({
            stepId: entry.stepId,
            prompt: String(entry.prompt || ""),
            optionId: String(entry.optionId || ""),
            optionTitle: String(entry.optionTitle || ""),
            deltas: entry.deltas && typeof entry.deltas === "object" ? entry.deltas : {}
          }));
      guest.history = guest.answers.map((entry) => ({
        stepId: entry.stepId,
        optionId: entry.optionId,
        timedOut: false
      }));
    }
    if (scores && typeof scores === "object") {
      guest.scores = {
        integrity: Number.isFinite(Number(scores.integrity)) ? Math.max(0, Math.min(100, Number(scores.integrity))) : 0,
        trust: Number.isFinite(Number(scores.trust)) ? Math.max(0, Math.min(100, Number(scores.trust))) : 0,
        reputation: Number.isFinite(Number(scores.reputation))
            ? Math.max(0, Math.min(100, Number(scores.reputation)))
            : (Number.isFinite(Number(scores.trust)) ? Math.max(0, Math.min(100, Number(scores.trust))) : 0),
        effectiveness: Number.isFinite(Number(scores.effectiveness)) ? Math.max(0, Math.min(100, Number(scores.effectiveness))) : 0
      };
    }
    broadcast(room);
    await persistRoomState(room).catch((error) => console.error("Failed to persist participant completion:", error));
    const onlineGuests = [...room.guests.values()].filter((guestItem) => guestItem.sockets > 0);
    if (onlineGuests.length > 0 && onlineGuests.every((guestItem) => guestItem.completed)) {
      room.phase = "done";
      room.timedOut = false;
      armRoomTimer(room);
      broadcast(room);
      await persistRoom(room).catch((error) => console.error("Failed to persist completed room:", error));
    }
  });

  socket.on("participant_timeout", async ({ code, guestId, stepId, final } = {}) => {
    const room = rooms.get(String(code || "").toUpperCase());
    const id = String(guestId || "");
    const meta = sockets.get(socket.id);
    if (!room || !meta || meta.role !== "guest" || meta.code !== room.code || meta.guestId !== id) return;
    const guest = room.guests.get(id);
    if (!guest) return;
    guest.timedOut = true;
    if (!guest.history) guest.history = [];
    const timeoutEntry = stepId ? guest.history.find((entry) => entry.stepId === stepId) : null;
    if (stepId && !timeoutEntry) guest.history.push({ stepId, optionId: "", timedOut: true });
    if (final) {
      guest.completed = true;
      guest.finishedAt = guest.finishedAt || Date.now();
    }
    broadcast(room);
    const onlineGuests = [...room.guests.values()].filter((guestItem) => guestItem.sockets > 0);
    if (room.phase === "live" && onlineGuests.length > 0 && onlineGuests.every((guestItem) => guestItem.completed)) {
      room.phase = "done";
      room.timedOut = false;
      armRoomTimer(room);
      broadcast(room);
      await persistRoom(room);
    }
  });

  socket.on("submit_vote", ({ code, guestId, stepId, optionId, name, scores, routeId, routeLabel, answers } = {}) => {
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
    let step = scenario?.steps?.find((item) => item.id === (stepId || scenario.steps?.[room.stepIndex]?.id));
    if (!step && scenario?.tree) {
      const findStep = (node) => {
        if (!node) return null;
        if (node.id === stepId) return node;
        for (const nested of node.options || []) {
          const found = findStep(nested.next);
          if (found) return found;
        }
        return null;
      };
      step = findStep(scenario.tree);
    }
    const option = step?.options?.find((item) => item.id === optionId);
    if (!option) {
      socket.emit("room_error", { message: "Такого варіанту на цьому кроці немає." });
      return;
    }
    let guest = room.guests.get(id);
    if (!guest) {
      guest = {
        optionId: null,
        stepId: "",
        completed: false,
        history: [],
        answers: [],
        sockets: 1,
        name: String(name || "Гість").slice(0, 80),
        routeId: "",
        routeLabel: "Лінійний маршрут",
        scores: null,
        finishedAt: null
      };
      room.guests.set(id, guest);
    }
    if (name) guest.name = String(name).slice(0, 80);
    if (routeId) guest.routeId = String(routeId);
    if (routeLabel) guest.routeLabel = String(routeLabel).slice(0, 200);
    if (scores && typeof scores === "object") {
      guest.scores = {
        integrity: Number.isFinite(Number(scores.integrity)) ? Math.max(0, Math.min(100, Number(scores.integrity))) : 0,
        trust: Number.isFinite(Number(scores.trust)) ? Math.max(0, Math.min(100, Number(scores.trust))) : 0,
        reputation: Number.isFinite(Number(scores.reputation))
            ? Math.max(0, Math.min(100, Number(scores.reputation)))
            : (Number.isFinite(Number(scores.trust)) ? Math.max(0, Math.min(100, Number(scores.trust))) : 0),
        effectiveness: Number.isFinite(Number(scores.effectiveness)) ? Math.max(0, Math.min(100, Number(scores.effectiveness))) : 0
      };
    }
    if (Array.isArray(answers)) {
      guest.answers = answers
          .filter((entry) => entry && typeof entry.stepId === "string")
          .map((entry) => ({
            stepId: entry.stepId,
            prompt: String(entry.prompt || ""),
            optionId: String(entry.optionId || ""),
            optionTitle: String(entry.optionTitle || ""),
            deltas: entry.deltas && typeof entry.deltas === "object" ? entry.deltas : {}
          }));
      guest.history = guest.answers.map((entry) => ({
        stepId: entry.stepId,
        optionId: entry.optionId,
        timedOut: false
      }));
    }
    if (guest.optionId && guest.stepId === step.id) {
      socket.emit("your_vote", { stepIndex: room.stepIndex, stepId: guest.stepId, optionId: guest.optionId });
      return;
    }
    guest.optionId = option.id;
    guest.stepId = step.id;
    guest.history = guest.history || [];
    if (!guest.history.some((entry) => entry.stepId === step.id)) {
      guest.history.push({ stepId: step.id, optionId: option.id });
    }
    if (scenario?.tree) {
      guest.routeId = step.id;
      guest.routeLabel = step.label ? `Гілка ${step.label}` : (guest.routeLabel || "Гілка кейсу");
    } else {
      guest.routeId = step.id;
      guest.routeLabel = "Лінійний маршрут";
    }
    const isFinalChoice = scenario?.tree
        ? !option.next
        : Boolean(option.end) || !option.nextStepId;
    if (isFinalChoice) {
      guest.completed = true;
      guest.finishedAt = Date.now();
    }
    socket.emit("your_vote", { stepIndex: room.stepIndex, stepId: guest.stepId, optionId: guest.optionId });
    broadcast(room);
    persistRoomState(room).catch((error) => console.error("Failed to persist participant answer:", error));
    const onlineGuests = [...room.guests.values()].filter((guestItem) => guestItem.sockets > 0);
    if (room.timeMode === "per_question" && onlineGuests.length > 0 && onlineGuests.every((guestItem) => guestItem.optionId)) {
      advanceStepTimer(room);
    }
    if (onlineGuests.length > 0 && onlineGuests.every((guestItem) => guestItem.completed)) {
      room.phase = "done";
      room.timedOut = false;
      room.archive = aggregateArchive(room);
      armRoomTimer(room);
      broadcast(room);
      persistRoom(room).catch(() => {});
    }
  });

  socket.on("disconnect", () => {
    releaseSocket(socket);
  });
});

await refreshScenarios();
await attachAuth(app);
attachCaseRoutes(app, { onChange: refreshScenarios });
httpServer.listen(PORT, "0.0.0.0");