import {
  applyRulebookAction,
  createClientUid,
  RulebookAction,
  validateRulebookAction,
} from './rulebookActions';
import {
  createInitialState,
  loadRulebookState,
  reconcileDailyReset,
  RulebookState,
  sanitizeRulebookState,
  saveRulebookState,
  STORAGE_KEY,
} from './storage';

const PENDING_OPS_KEY = 'daily_rulebook_pending_v1';

interface QueuedOp {
  opId: string;
  action: RulebookAction;
  coalesceKey?: string;
  inFlight: boolean;
  readyAt: number;
}

interface PersistedOp {
  opId: string;
  action: RulebookAction;
  coalesceKey?: string;
}

interface ServerMessage {
  type: 'init' | 'state' | 'ack' | 'error';
  rev?: number;
  state?: Partial<RulebookState>;
  opId?: string;
  fromClientId?: string;
  message?: string;
}

export interface DispatchOptions {
  coalesceKey?: string;
  debounceMs?: number;
}

export interface RulebookSyncHandle {
  dispatch: (action: RulebookAction, options?: DispatchOptions) => RulebookState;
  flush: () => void;
  reconcileClock: (now?: Date) => RulebookState;
  destroy: () => void;
}

function loadPendingOps(): QueuedOp[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(PENDING_OPS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const result: QueuedOp[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const entry = item as Partial<PersistedOp>;
      if (typeof entry.opId !== 'string' || !entry.opId) continue;
      const action = validateRulebookAction(entry.action);
      if (!action) continue;
      result.push({
        opId: entry.opId.slice(0, 80),
        action,
        ...(typeof entry.coalesceKey === 'string' ? { coalesceKey: entry.coalesceKey } : {}),
        inFlight: false,
        readyAt: 0,
      });
    }
    return result.slice(-40);
  } catch {
    return [];
  }
}

function savePendingOps(queue: QueuedOp[]): void {
  if (typeof window === 'undefined') return;
  try {
    if (queue.length === 0) {
      window.localStorage.removeItem(PENDING_OPS_KEY);
      return;
    }
    const compact: PersistedOp[] = queue.slice(-40).map((item) => ({
      opId: item.opId,
      action: item.action,
      ...(item.coalesceKey ? { coalesceKey: item.coalesceKey } : {}),
    }));
    window.localStorage.setItem(PENDING_OPS_KEY, JSON.stringify(compact));
  } catch {
    // Ignore storage quota or private-mode errors.
  }
}

export function createRulebookSync(
  initialState: RulebookState,
  onStateChange: (next: RulebookState) => void
): RulebookSyncHandle {
  const clientId = createClientUid('client');
  let localFallback: RulebookState = initialState;
  let serverBase: RulebookState | null = null;
  let serverRev = -1;
  let pendingQueue: QueuedOp[] = loadPendingOps();

  let ws: WebSocket | null = null;
  let wsOpen = false;
  let backendUnsupported = false;
  let destroyed = false;
  let reconnectAttempt = 0;

  let reconnectTimer: number | null = null;
  let pingTimer: number | null = null;
  let debounceTimer: number | null = null;
  let httpPollTimer: number | null = null;
  let httpFlushActive = false;

  const clearTimer = (id: number | null): null => {
    if (id !== null && typeof window !== 'undefined') {
      window.clearTimeout(id);
    }
    return null;
  };

  const computeDisplayed = (now: Date = new Date()): RulebookState => {
    let base = serverBase ?? localFallback;
    for (const item of pendingQueue) {
      base = applyRulebookAction(base, item.action, new Date(item.action.at));
    }
    return reconcileDailyReset(base, now);
  };

  const emitDisplayed = (now: Date = new Date()): RulebookState => {
    const displayed = computeDisplayed(now);
    saveRulebookState(displayed);
    savePendingOps(pendingQueue);
    onStateChange(displayed);
    return displayed;
  };

  const applyRemoteSnapshot = (rev: number, rawState: Partial<RulebookState> | undefined, ackOpId?: string) => {
    if (ackOpId) {
      pendingQueue = pendingQueue.filter((item) => item.opId !== ackOpId);
    }
    if (rawState && typeof rawState === 'object' && rev >= serverRev) {
      serverRev = rev;
      serverBase = sanitizeRulebookState(rawState, createInitialState(), new Date());
      localFallback = serverBase;
    }
    emitDisplayed();
  };

  const sendViaHttp = async (item: QueuedOp, keepalive = false): Promise<boolean> => {
    try {
      const response = await fetch('/api/op', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opId: item.opId,
          clientId,
          action: item.action,
        }),
        keepalive,
      });
      if (response.status === 404 || response.status === 405) {
        backendUnsupported = true;
        return false;
      }
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        backendUnsupported = true;
        return false;
      }
      if (!response.ok) return false;
      const data = (await response.json()) as {
        ok?: boolean;
        rev?: number;
        state?: Partial<RulebookState>;
      };
      if (data.ok && typeof data.rev === 'number') {
        applyRemoteSnapshot(data.rev, data.state, item.opId);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const flushHttpQueue = async (keepalive = false) => {
    if (backendUnsupported || destroyed || httpFlushActive) return;
    httpFlushActive = true;
    try {
      while (!destroyed && !wsOpen && !backendUnsupported) {
        const nowMs = Date.now();
        const next = pendingQueue.find((item) => !item.inFlight && item.readyAt <= nowMs);
        if (!next) break;
        next.inFlight = true;
        const ok = await sendViaHttp(next, keepalive);
        if (!ok) {
          next.inFlight = false;
          break;
        }
      }
    } finally {
      httpFlushActive = false;
    }
  };

  const flushReadyOps = (forceImmediate = false, keepalive = false) => {
    if (destroyed) return;
    if (forceImmediate) {
      debounceTimer = clearTimer(debounceTimer);
      for (const item of pendingQueue) {
        item.readyAt = 0;
      }
    }

    if (backendUnsupported) {
      if (pendingQueue.length > 0) {
        localFallback = computeDisplayed();
        pendingQueue = [];
        emitDisplayed();
      }
      return;
    }

    const nowMs = Date.now();
    if (ws && wsOpen && ws.readyState === WebSocket.OPEN) {
      for (const item of pendingQueue) {
        if (item.inFlight) continue;
        if (!forceImmediate && item.readyAt > nowMs) break;
        item.inFlight = true;
        try {
          ws.send(
            JSON.stringify({
              type: 'op',
              opId: item.opId,
              clientId,
              action: item.action,
            })
          );
        } catch {
          item.inFlight = false;
          break;
        }
      }
    } else {
      void flushHttpQueue(keepalive);
    }

    const nextDelayed = pendingQueue.find((item) => !item.inFlight && item.readyAt > Date.now());
    if (nextDelayed && typeof window !== 'undefined') {
      debounceTimer = clearTimer(debounceTimer);
      const waitMs = Math.max(16, nextDelayed.readyAt - Date.now());
      debounceTimer = window.setTimeout(() => {
        debounceTimer = null;
        flushReadyOps(false);
      }, waitMs);
    }
  };

  const fetchStateHttp = async (): Promise<boolean> => {
    if (destroyed || backendUnsupported || typeof window === 'undefined') return false;
    try {
      const response = await fetch('/api/state', { cache: 'no-store' });
      if (response.status === 404 || response.status === 405) {
        backendUnsupported = true;
        stopHttpPolling();
        flushReadyOps(true);
        return false;
      }
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        backendUnsupported = true;
        stopHttpPolling();
        flushReadyOps(true);
        return false;
      }
      if (!response.ok) return false;
      const data = (await response.json()) as { rev?: number; state?: Partial<RulebookState> };
      if (typeof data.rev === 'number' && data.state) {
        applyRemoteSnapshot(data.rev, data.state);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const stopHttpPolling = () => {
    if (httpPollTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(httpPollTimer);
      httpPollTimer = null;
    }
  };

  const startHttpPolling = () => {
    if (typeof window === 'undefined' || httpPollTimer !== null || backendUnsupported || destroyed) {
      return;
    }
    httpPollTimer = window.setInterval(() => {
      if (document.visibilityState === 'visible' && !wsOpen && !backendUnsupported) {
        void fetchStateHttp();
        void flushHttpQueue(false);
      }
    }, 4_000);
  };

  const stopPing = () => {
    if (pingTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(pingTimer);
      pingTimer = null;
    }
  };

  const startPing = () => {
    stopPing();
    if (typeof window === 'undefined') return;
    pingTimer = window.setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send('ping');
        } catch {
          // Handled by socket close/reconnect.
        }
      }
    }, 25_000);
  };

  const scheduleReconnect = () => {
    if (destroyed || backendUnsupported || typeof window === 'undefined') return;
    reconnectTimer = clearTimer(reconnectTimer);
    const delay = Math.min(5_000, 500 * Math.pow(2, Math.min(reconnectAttempt, 4)));
    reconnectAttempt += 1;
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null;
      connectWebSocket();
    }, delay);
  };

  const connectWebSocket = () => {
    if (destroyed || backendUnsupported || typeof window === 'undefined') return;
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/ws`;

    let socket: WebSocket;
    try {
      socket = new WebSocket(wsUrl);
    } catch {
      startHttpPolling();
      scheduleReconnect();
      return;
    }

    ws = socket;

    socket.onopen = () => {
      if (destroyed || ws !== socket) {
        socket.close();
        return;
      }
      wsOpen = true;
      reconnectAttempt = 0;
      stopHttpPolling();
      startPing();
      for (const item of pendingQueue) {
        item.inFlight = false;
      }
      flushReadyOps(false);
    };

    socket.onmessage = (event) => {
      if (destroyed || typeof event.data !== 'string') return;
      if (event.data === 'pong') return;

      let msg: ServerMessage;
      try {
        msg = JSON.parse(event.data) as ServerMessage;
      } catch {
        return;
      }

      if (msg.type === 'init' && typeof msg.rev === 'number') {
        applyRemoteSnapshot(msg.rev, msg.state);
        flushReadyOps(false);
        return;
      }

      if (msg.type === 'ack' && typeof msg.rev === 'number') {
        applyRemoteSnapshot(msg.rev, msg.state, msg.opId);
        flushReadyOps(false);
        return;
      }

      if (msg.type === 'state' && typeof msg.rev === 'number') {
        applyRemoteSnapshot(msg.rev, msg.state);
        return;
      }

      if (msg.type === 'error' && msg.opId) {
        pendingQueue = pendingQueue.filter((item) => item.opId !== msg.opId);
        emitDisplayed();
      }
    };

    socket.onclose = () => {
      if (ws === socket) {
        ws = null;
      }
      wsOpen = false;
      stopPing();
      for (const item of pendingQueue) {
        item.inFlight = false;
      }
      if (destroyed) return;

      void fetchStateHttp().then((reachable) => {
        if (destroyed || backendUnsupported) return;
        if (reachable) {
          startHttpPolling();
        }
        scheduleReconnect();
      });
    };

    socket.onerror = () => {
      // Cleanup and fallback run in onclose.
    };
  };

  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY || !e.newValue) return;
    if (wsOpen && !backendUnsupported) return;
    try {
      const next = sanitizeRulebookState(
        JSON.parse(e.newValue) as Partial<RulebookState>,
        createInitialState()
      );
      localFallback = next;
      emitDisplayed();
    } catch {
      // Ignore malformed storage values.
    }
  };

  const onOnline = () => {
    if (destroyed || backendUnsupported) return;
    reconnectAttempt = 0;
    connectWebSocket();
    void fetchStateHttp();
  };

  const onVisibilityChange = () => {
    if (destroyed) return;
    if (document.visibilityState === 'hidden') {
      flushReadyOps(true, true);
      return;
    }
    if (backendUnsupported) return;
    if (ws && wsOpen && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: 'sync' }));
      } catch {
        connectWebSocket();
      }
    } else {
      reconnectAttempt = 0;
      connectWebSocket();
      void fetchStateHttp();
    }
  };

  const onPageHide = () => {
    flushReadyOps(true, true);
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage);
    window.addEventListener('online', onOnline);
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibilityChange);
    void fetchStateHttp().then((reachable) => {
      if (destroyed || backendUnsupported) return;
      if (reachable) {
        connectWebSocket();
        flushReadyOps(false);
      } else {
        scheduleReconnect();
      }
    });
  }

  return {
    dispatch(action: RulebookAction, options?: DispatchOptions): RulebookState {
      const debounceMs = options?.debounceMs ?? 0;
      const coalesceKey = options?.coalesceKey;
      const nowMs = Date.now();

      if (debounceMs === 0) {
        for (const item of pendingQueue) {
          if (!item.inFlight && item.readyAt > nowMs) {
            item.readyAt = 0;
          }
        }
      }

      const last = pendingQueue[pendingQueue.length - 1];
      if (coalesceKey && last && !last.inFlight && last.coalesceKey === coalesceKey) {
        last.opId = createClientUid('op');
        last.action = action;
        last.readyAt = debounceMs > 0 ? nowMs + debounceMs : 0;
      } else {
        pendingQueue.push({
          opId: createClientUid('op'),
          action,
          ...(coalesceKey ? { coalesceKey } : {}),
          inFlight: false,
          readyAt: debounceMs > 0 ? nowMs + debounceMs : 0,
        });
      }

      const displayed = emitDisplayed(new Date(action.at));
      flushReadyOps(debounceMs === 0);
      return displayed;
    },

    flush() {
      flushReadyOps(true);
    },

    reconcileClock(now: Date = new Date()): RulebookState {
      if (serverBase) {
        serverBase = reconcileDailyReset(serverBase, now);
      }
      localFallback = reconcileDailyReset(localFallback, now);
      return emitDisplayed(now);
    },

    destroy() {
      destroyed = true;
      reconnectTimer = clearTimer(reconnectTimer);
      debounceTimer = clearTimer(debounceTimer);
      stopPing();
      stopHttpPolling();
      if (ws) {
        try {
          ws.close(1000, 'Unmounted');
        } catch {
          // Ignore close errors.
        }
        ws = null;
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', onStorage);
        window.removeEventListener('online', onOnline);
        window.removeEventListener('pagehide', onPageHide);
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
    },
  };
}

export function getInitialLocalState(): RulebookState {
  return loadRulebookState();
}
