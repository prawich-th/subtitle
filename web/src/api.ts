import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import type { LiveState } from "../../shared/lines";

const PIN_KEY = "operatorPin";

export const getPin = () => localStorage.getItem(PIN_KEY) || "";
export const setPin = (pin: string) => localStorage.setItem(PIN_KEY, pin);

/**
 * Talks to the server. On the Mac running the program no PIN is needed; on any
 * other device a missing/wrong PIN sends you to the PIN page and back again.
 */
export async function api<T = unknown>(
  path: string,
  options: { method?: string; body?: unknown; keepalive?: boolean } = {},
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: options.method ?? (options.body === undefined ? "GET" : "POST"),
    headers: { "Content-Type": "application/json", "X-Operator-Pin": getPin() },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    keepalive: options.keepalive,
  });
  if (response.status === 401 && path !== "/verify") {
    const here = window.location.pathname + window.location.search;
    window.location.assign(`/verify?next=${encodeURIComponent(here)}`);
    return new Promise<T>(() => {});
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || `Request failed (${response.status})`);
  }
  return data as T;
}

/**
 * Follows what is live right now: the show, its lines and the current line.
 * `base` is only set when a display page points at a server somewhere else
 * (the old `?service=` link); normally it is the server that served this page.
 */
export function useLive(base = "") {
  const [live, setLive] = useState<LiveState | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const refresh = () =>
      fetch(`${base}/api/live`)
        .then((response) => response.json())
        .then((data: LiveState) => {
          if (!cancelled && Array.isArray(data?.lines)) setLive(data);
        })
        .catch((error) => console.error("Could not load subtitles:", error));

    const socket = io(base || window.location.origin, {
      // Start with plain web requests and upgrade to a websocket when the
      // network allows it, so updates still arrive on networks that block
      // websockets.
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
    });
    socket.on("connect", () => {
      setConnected(true);
      refresh(); // also re-syncs after every reconnect
    });
    socket.on("disconnect", () => setConnected(false));
    socket.on("subIndex", (data: { index: number }) => {
      if (typeof data?.index === "number") {
        setLive((current) => (current ? { ...current, index: data.index } : current));
      }
    });
    socket.on("live", (data: LiveState) => {
      if (Array.isArray(data?.lines)) setLive(data);
    });
    refresh();

    // Safety net: if the live connection is down, keep asking the server
    // directly so a screen never stays on an old line.
    const safetyNet = setInterval(() => {
      if (!socket.connected) refresh();
    }, 2000);

    return () => {
      cancelled = true;
      clearInterval(safetyNet);
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [base]);

  return { live, connected };
}
