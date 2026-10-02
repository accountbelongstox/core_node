import { QUEUE_CENTER_SCHEMA_GATE } from '../../contracts/QueueCenterContract';

export type ServerSchemaState = 'unknown' | 'ready' | 'pending';

export interface ServerSchemaSnapshot {
  schema: ServerSchemaState;
  errorCode: string;
  retryAfterSeconds: number;
  version: number;
}

const GATE = QUEUE_CENTER_SCHEMA_GATE;
const [SCHEMA_READY_STATE, SCHEMA_PENDING_STATE] = GATE.health_states;
const MS_PER_SECOND = 1000;

type Listener = () => void;
type HealthProbe = () => Promise<unknown>;

function parseBody(body: unknown): Record<string, unknown> | null {
  return body && typeof body === 'object' ? body as Record<string, unknown> : null;
}

function bodyCode(body: Record<string, unknown> | null): string {
  if (typeof body?.error_code === 'string') return body.error_code;
  return typeof body?.code === 'string' ? body.code : '';
}

function retryOf(body: Record<string, unknown> | null): number {
  const retry = Number(body?.retry_after_seconds);
  return Number.isFinite(retry) && retry > 0 ? retry : GATE.retry_after_seconds;
}

/**
 * The server's schema gate (contract `schema_gate`): while Laravel's code needs a schema its database has not
 * reached, every lease, report, delivery and gap route answers SERVER_SCHEMA_PENDING and /api/health says
 * `schema: pending`. One owner turns that into a state every consumer reads instead of retrying: answered
 * requests and health reads feed it, and while pending one health probe per `retry_after_seconds` clears it.
 */
class ServerSchemaGate {
  private readonly listeners = new Set<Listener>();
  private snapshot: ServerSchemaSnapshot = {
    schema: 'unknown',
    errorCode: GATE.error_code,
    retryAfterSeconds: GATE.retry_after_seconds,
    version: 0,
  };
  private timer: ReturnType<typeof setTimeout> | null = null;
  private healthProbe: HealthProbe | null = null;
  private probing: Promise<void> | null = null;

  readonly subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  readonly getSnapshot = (): ServerSchemaSnapshot => this.snapshot;

  /** The one health read of the selected Laravel endpoint (registered by ApiManager). */
  setHealthProbe(probe: HealthProbe): void {
    this.healthProbe = probe;
  }

  isGateCode(code: unknown): boolean {
    return code === GATE.error_code;
  }

  /** A Laravel answer: the gate's own error (http status + error code) marks the schema pending. */
  observeHttp(status: number, body: unknown): boolean {
    if (status !== GATE.http_status) return false;
    const parsed = parseBody(body);
    if (bodyCode(parsed) !== GATE.error_code) return false;
    this.setSchema('pending', retryOf(parsed));
    return true;
  }

  /** A thrown Laravel error (`status` plus `payload` / `code`): true when it is the schema gate. */
  observeError(error: unknown): boolean {
    const failure = error as { status?: unknown; code?: unknown; payload?: unknown } | null;
    if (!failure || typeof failure !== 'object') return false;
    const payload = parseBody(failure.payload);
    if (failure.code !== GATE.error_code && bodyCode(payload) !== GATE.error_code) return false;
    this.setSchema('pending', retryOf(payload));
    return true;
  }

  /** The schema state a /api/health body reports; unknown when it carries no field. */
  readHealth(body: unknown): ServerSchemaState {
    const schema = parseBody(body)?.[GATE.health_field];
    if (schema === SCHEMA_PENDING_STATE) return 'pending';
    return schema === SCHEMA_READY_STATE ? 'ready' : 'unknown';
  }

  /** A /api/health body: `schema` pending marks it, ready clears it, an absent field changes nothing. */
  observeHealth(body: unknown): void {
    const schema = this.readHealth(body);
    if (schema !== 'unknown') this.setSchema(schema, retryOf(parseBody(body)));
  }

  /** One health probe now; a server that does not answer changes nothing. */
  probe(): Promise<void> {
    if (!this.healthProbe) return Promise.resolve();
    if (!this.probing) {
      this.probing = this.healthProbe()
        .then(() => undefined, () => undefined)
        .finally(() => {
          this.probing = null;
          if (this.snapshot.schema === 'pending') this.armProbe();
        });
    }
    return this.probing;
  }

  private armProbe(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.probe();
    }, this.snapshot.retryAfterSeconds * MS_PER_SECOND);
  }

  private setSchema(schema: ServerSchemaState, retryAfterSeconds: number): void {
    const changed = this.snapshot.schema !== schema || this.snapshot.retryAfterSeconds !== retryAfterSeconds;
    if (changed) {
      this.snapshot = { ...this.snapshot, schema, retryAfterSeconds, version: this.snapshot.version + 1 };
    }
    if (schema === 'pending') {
      if (!this.timer && !this.probing) this.armProbe();
    } else if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (changed) this.listeners.forEach((listener) => listener());
  }
}

export const serverSchemaGate = new ServerSchemaGate();

export const SERVER_SCHEMA_PENDING_CODE: string = GATE.error_code;
