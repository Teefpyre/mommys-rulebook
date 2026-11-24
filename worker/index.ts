import { DurableObject } from 'cloudflare:workers';
import {
  applyRulebookAction,
  RulebookAction,
  validateRulebookAction,
} from '../src/lib/rulebookActions';
import {
  createInitialState,
  RulebookState,
  sanitizeRulebookState,
} from '../src/lib/storage';

export interface Env {
  RULEBOOK_HUB: DurableObjectNamespace;
  ASSETS: Fetcher;
}

const SHARED_HUB_NAME = 'shared-rulebook';
const MAX_PAYLOAD_BYTES = 512 * 1024;
const MAX_PROCESSED_OPS = 250;

interface DocRow {
  rev: number;
  state_json: string;
  updated_at: number;
}

interface IncomingOpEnvelope {
  type?: string;
  opId?: unknown;
  clientId?: unknown;
  action?: unknown;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

export class RulebookHub extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));

    this.ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS rulebook_doc (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          rev INTEGER NOT NULL,
          state_json TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS processed_ops (
          op_id TEXT PRIMARY KEY,
          rev INTEGER NOT NULL,
          created_at INTEGER NOT NULL
        );
      `);
    });
  }

  private loadDoc(now: Date = new Date()): { rev: number; state: RulebookState } {
    const cursor = this.ctx.storage.sql.exec(
      'SELECT rev, state_json, updated_at FROM rulebook_doc WHERE id = 1'
    );
    const rows = cursor.toArray() as unknown as DocRow[];
    if (rows.length === 0) {
      return { rev: 0, state: createInitialState(now) };
    }

    const row = rows[0];
    try {
      const parsed = JSON.parse(row.state_json) as Partial<RulebookState>;
      const fallback = createInitialState(now);
      const state = sanitizeRulebookState(parsed, fallback, now);
      if (parsed.activeDayKey && parsed.activeDayKey !== state.activeDayKey) {
        this.saveDoc(row.rev, state, now.getTime());
      }
      return { rev: row.rev, state };
    } catch {
      return { rev: row.rev, state: createInitialState(now) };
    }
  }

  private saveDoc(rev: number, state: RulebookState, nowMs: number): void {
    const cleanState: RulebookState = {
      ...state,
      extras: state.extras.map((extra) => ({ ...extra, checked: false })),
    };
    this.ctx.storage.sql.exec(
      `INSERT INTO rulebook_doc (id, rev, state_json, updated_at)
       VALUES (1, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         rev = excluded.rev,
         state_json = excluded.state_json,
         updated_at = excluded.updated_at`,
      rev,
      JSON.stringify(cleanState),
      nowMs
    );
  }

  private hasProcessedOp(opId: string): boolean {
    const rows = this.ctx.storage.sql
      .exec('SELECT op_id FROM processed_ops WHERE op_id = ? LIMIT 1', opId)
      .toArray();
    return rows.length > 0;
  }

  private recordProcessedOp(opId: string, rev: number, nowMs: number): void {
    this.ctx.storage.sql.exec(
      'INSERT OR IGNORE INTO processed_ops (op_id, rev, created_at) VALUES (?, ?, ?)',
      opId,
      rev,
      nowMs
    );
    this.ctx.storage.sql.exec(
      `DELETE FROM processed_ops
       WHERE op_id NOT IN (
         SELECT op_id FROM processed_ops ORDER BY created_at DESC LIMIT ?
       )`,
      MAX_PROCESSED_OPS
    );
  }

  private broadcastState(rev: number, state: RulebookState, fromClientId: string, exclude?: WebSocket): void {
    const payload = JSON.stringify({
      type: 'state',
      rev,
      state,
      fromClientId,
    });
    for (const socket of this.ctx.getWebSockets()) {
      if (exclude && socket === exclude) continue;
      try {
        socket.send(payload);
      } catch {
        try {
          socket.close(1011, 'Send failed');
        } catch {
          // Socket already closed.
        }
      }
    }
  }

  private applyOp(
    opId: string,
    clientId: string,
    action: RulebookAction,
    sender?: WebSocket
  ): { rev: number; state: RulebookState; duplicate: boolean } {
    const now = new Date();
    if (this.hasProcessedOp(opId)) {
      const current = this.loadDoc(now);
      return { ...current, duplicate: true };
    }

    const current = this.loadDoc(now);
    const nextState = applyRulebookAction(current.state, action, now);
    const changed = nextState !== current.state;
    const nextRev = changed ? current.rev + 1 : current.rev;
    const nowMs = now.getTime();

    if (changed) {
      this.saveDoc(nextRev, nextState, nowMs);
    }
    this.recordProcessedOp(opId, nextRev, nowMs);

    if (changed) {
      this.broadcastState(nextRev, nextState, clientId, sender);
    }

    return { rev: nextRev, state: nextState, duplicate: false };
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/ws') {
      if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
        return new Response('Expected WebSocket upgrade', { status: 426 });
      }
      const pair = new WebSocketPair();
      const [client, server] = [pair[0], pair[1]];
      this.ctx.acceptWebSocket(server);

      const current = this.loadDoc(new Date());
      try {
        server.send(
          JSON.stringify({
            type: 'init',
            rev: current.rev,
            state: current.state,
          })
        );
      } catch {
        // Ignore send failure on closing socket.
      }

      return new Response(null, { status: 101, webSocket: client });
    }

    if (url.pathname === '/api/state' && request.method === 'GET') {
      const current = this.loadDoc(new Date());
      return jsonResponse(current);
    }

    if (url.pathname === '/api/op' && request.method === 'POST') {
      const contentLength = Number(request.headers.get('content-length') ?? '0');
      if (contentLength > MAX_PAYLOAD_BYTES) {
        return jsonResponse({ error: 'Payload too large' }, 413);
      }
      const text = await request.text();
      if (text.length > MAX_PAYLOAD_BYTES) {
        return jsonResponse({ error: 'Payload too large' }, 413);
      }

      let parsed: IncomingOpEnvelope;
      try {
        parsed = JSON.parse(text) as IncomingOpEnvelope;
      } catch {
        return jsonResponse({ error: 'Invalid JSON' }, 400);
      }

      const opId = typeof parsed.opId === 'string' && parsed.opId ? parsed.opId.slice(0, 80) : '';
      const clientId =
        typeof parsed.clientId === 'string' && parsed.clientId ? parsed.clientId.slice(0, 80) : 'http';
      const action = validateRulebookAction(parsed.action);
      if (!opId || !action) {
        return jsonResponse({ error: 'Invalid operation' }, 400);
      }

      const result = this.applyOp(opId, clientId, action);
      return jsonResponse({
        ok: true,
        opId,
        rev: result.rev,
        state: result.state,
        duplicate: result.duplicate,
      });
    }

    return jsonResponse({ error: 'Not found' }, 404);
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== 'string') return;
    if (message.length > MAX_PAYLOAD_BYTES) {
      try {
        ws.send(JSON.stringify({ type: 'error', message: 'Payload too large' }));
      } catch {
        // Ignore send failure.
      }
      return;
    }

    let parsed: IncomingOpEnvelope;
    try {
      parsed = JSON.parse(message) as IncomingOpEnvelope;
    } catch {
      return;
    }

    if (parsed.type === 'sync') {
      const current = this.loadDoc(new Date());
      try {
        ws.send(JSON.stringify({ type: 'init', rev: current.rev, state: current.state }));
      } catch {
        // Ignore send failure.
      }
      return;
    }

    if (parsed.type !== 'op') return;

    const opId = typeof parsed.opId === 'string' && parsed.opId ? parsed.opId.slice(0, 80) : '';
    const clientId =
      typeof parsed.clientId === 'string' && parsed.clientId ? parsed.clientId.slice(0, 80) : 'ws';
    const action = validateRulebookAction(parsed.action);
    if (!opId || !action) {
      try {
        ws.send(JSON.stringify({ type: 'error', opId, message: 'Invalid operation' }));
      } catch {
        // Ignore send failure.
      }
      return;
    }

    const result = this.applyOp(opId, clientId, action, ws);
    try {
      ws.send(
        JSON.stringify({
          type: 'ack',
          opId,
          rev: result.rev,
          state: result.state,
        })
      );
    } catch {
      // Ignore send failure.
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    try {
      ws.close(code, reason);
    } catch {
      // Socket already closed.
    }
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    try {
      ws.close(1011, 'Socket error');
    } catch {
      // Socket already closed.
    }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      const id = env.RULEBOOK_HUB.idFromName(SHARED_HUB_NAME);
      const stub = env.RULEBOOK_HUB.get(id);
      return stub.fetch(request);
    }
    return env.ASSETS.fetch(request);
  },
};
