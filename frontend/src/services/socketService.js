import { io } from "socket.io-client";

const socket = io({
  path: "/socket.io",
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 500,
  reconnectionDelayMax: 4000,
  timeout: 20000,
  transports: ["polling", "websocket"]
});

export function subscribe(event, handler) {
  socket.on(event, handler);
  return () => socket.off(event, handler);
}

export function send(event, payload) {
  if (!socket.connected) socket.connect();
  socket.emit(event, payload);
}

export function onConnect(handler) {
  socket.on("connect", handler);
  return () => socket.off("connect", handler);
}

export function onConnectError(handler) {
  socket.on("connect_error", handler);
  return () => socket.off("connect_error", handler);
}
