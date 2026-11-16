import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import os from "os";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scenariosDir = path.join(__dirname, "scenarios");
const PORT = Number(process.env.PORT) || 4000;

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: true } });

app.use(cors());

const rooms = new Map();
const sockets = new Map();
let scenarios = [];

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
  await fs.mkdir(scenariosDir, { recursive: true });
  let files = [];
  try {
    files = await fs.readdir(scenariosDir);
  } catch {
    files = [];
  }
  const next = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const raw = await fs.readFile(path.join(scenariosDir, file), "utf8");
      const data = JSON.parse(raw);
      if (data.template || !data.id || !Array.isArray(data.steps) || data.steps.length === 0) continue;
      next.push(data);
    } catch {
      continue;
    }
  }
  next.sort((a, b) => String(a.code || a.id).localeCompare(String(b.code || b.id), "uk"));
  scenarios = next;
  return scenarios;
}

function scenarioById(id) {
  return scenarios.find((item) => item.id === id) || null;
}

function clearVotes(room) {
  for (const guest of room.guests.values()) {
    guest.optionId = null;
  }
}

function publicState(room) {
  const scenario = scenarioById(room.scenarioId);
  const steps = scenario?.steps || [];
  const visible = room.phase === "live" || room.phase === "done";
  const step = visible ? steps[room.stepIndex] : null;
  const options = step?.options || [];
  const tallies = options.map((option) => ({
    id: option.id,
    count: [...room.guests.values()].filter((guest) => guest.optionId === option.id).length
  }));
  let online = 0;
  for (const guest of room.guests.values()) {
    if (guest.sockets > 0) online += 1;
  }
  return {
    code: room.code,
    scenarioId: room.scenarioId,
    stepIndex: room.stepIndex,
    stepCount: steps.length,
    phase: room.phase,
    participantCount: online,
    tallies
  };
}

function broadcast(room) {
  io.to(channel(room.code)).emit("room_state", publicState(room));
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

app.get("/api/scenarios", async (req, res) => {
  const list = await refreshScenarios();
  res.json({ scenarios: list });
});

app.get("/api/host", (req, res) => {
  res.json({ host: lanAddress() });
});

io.on("connection", (socket) => {
  socket.on("create_room", async ({ scenarioId } = {}) => {
    await refreshScenarios();
    const scenario = scenarioById(scenarioId);
    if (!scenario) {
      socket.emit("room_error", { message: "Сценарій для кімнати не знайдено." });
      return;
    }
    releaseSocket(socket);
    const code = makeCode();
    const token = crypto.randomBytes(18).toString("hex");
    const room = {
      code,
      token,
      scenarioId: scenario.id,
      stepIndex: 0,
      phase: "lobby",
      guests: new Map()
    };
    rooms.set(code, room);
    sockets.set(socket.id, { role: "host", code, token });
    socket.join(channel(code));
    socket.emit("room_created", { code, token, scenarioId: scenario.id });
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
    socket.emit("room_created", { code: room.code, token, scenarioId: room.scenarioId });
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
      socket.emit("joined_room", { code: room.code, scenarioId: room.scenarioId });
      socket.emit("your_vote", { stepIndex: room.stepIndex, optionId: guest?.optionId || "" });
      socket.emit("room_state", publicState(room));
      return;
    }
    releaseSocket(socket);
    if (!room.guests.has(id)) room.guests.set(id, { optionId: null, sockets: 0 });
    const guest = room.guests.get(id);
    guest.sockets += 1;
    sockets.set(socket.id, { role: "guest", code: room.code, guestId: id });
    socket.join(channel(room.code));
    socket.emit("joined_room", { code: room.code, scenarioId: room.scenarioId });
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
    const total = scenario?.steps?.length || 0;
    if (!total) {
      socket.emit("room_error", { message: "У сценарії немає кроків." });
      return;
    }
    if (room.phase === "lobby") {
      room.phase = "live";
      room.stepIndex = 0;
      clearVotes(room);
    } else if (room.phase === "live") {
      if (room.stepIndex >= total - 1) {
        room.phase = "done";
      } else {
        room.stepIndex += 1;
        clearVotes(room);
      }
    }
    broadcast(room);
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
httpServer.listen(PORT, "0.0.0.0");
