import { io } from "socket.io-client";

const socket = io({ autoConnect: true, transports: ["websocket", "polling"] });

export function send(event, payload) { socket.emit(event, payload); }
export function subscribe(event, handler) {
  socket.on(event, handler);
  return () => socket.off(event, handler);
}
export function onConnect(handler) { socket.on("connect", handler); return () => socket.off("connect", handler); }
export function onConnectError(handler) { socket.on("connect_error", handler); return () => socket.off("connect_error", handler); }
