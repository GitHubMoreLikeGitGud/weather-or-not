// HTTP client for the Zetaris gateway (127.0.0.1:8793). The agent sends a template id
// and parameters, never SQL text. Parameters are checked here with the gateway's own
// patterns before any request, so a bad CIK or period fails fast and locally; the gateway
// checks them again. Only loopback gateway hosts are accepted.
// Adapted from ClearShelf (same author, Apache-2.0).

import { DEFAULT_GATEWAY_URL } from "../config.ts";

export type Role = "reader" | "registrar";
export type CacheState = "hit" | "miss" | "unknown" | string;

/** The gateway's POST /sql/template response body. */
export interface TemplateResponse {
  template_id: string;
  role: Role;
  columns: string[];
  rows: unknown[][];
  row_count: number;
  truncated: boolean;
  elapsed_ms: number;
  sql: string | null;
  sql_sha256: string | null;
  objects: string[];
  raw_objects: string[];
  executed_at: string;
  cache_state: CacheState;
  cache_detail: Record<string, string>;
  source_cached_at: Record<string, string>;
  error: string | null;
}

export interface TemplateResult extends TemplateResponse {
  params: Record<string, string>;
  http_status: number;
  wall_ms: number;
  /** HTTP 503 "warming" replies that were waited out before this result. */
  warm_retries: number;
}

/** One step of a registrar plan as the gateway reports it (POST /registrar/<action>). */
export interface RegistrarStep {
  template_id: string;
  kind: string;
  sql: string;
  sql_sha256: string;
  objects: string[];
  elapsed_ms?: number;
  executed_at?: string;
  row_count?: number;
  columns?: string[];
  rows?: unknown[][];
  skipped_exists?: boolean;
  error?: string;
}

export interface RegistrarResponse {
  action: string;
  params: Record<string, string>;
  contract_id: string;
  steps: RegistrarStep[];
  skipped: string[];
  error?: string;
  code?: string;
}

export interface RegistrarResult extends RegistrarResponse {
  http_status: number;
  wall_ms: number;
}

export class GatewayError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly response?: Partial<TemplateResponse> | Partial<RegistrarResponse>,
  ) {
    super(message);
    this.name = "GatewayError";
  }
}

// Same patterns as gateway/templates.py PARAM_PATTERNS.
export const PARAM_PATTERNS = {
  cik10: /^\d{10}$/u,
  tag: /^(Revenues|RevenueFromContractWithCustomerExcludingAssessedTax|RegulatedAndUnregulatedOperatingRevenue)$/u,
  period: /^CY\d{4}Q[1-3]$/u,
  year: /^20\d{2}$/u,
  quarter: /^[1-3]$/u,
  station: /^US[A-Z0-9]{9}$/u,
  element: /^(TMAX|TMIN)$/u,
} as const;
export type ParamKind = keyof typeof PARAM_PATTERNS;

/** Parameter kinds per reader template id, mirroring gateway/templates.py TEMPLATES. The
 *  templates over the WON_* objects are added together with their gateway entries. */
export const TEMPLATE_PARAMS: Record<string, Record<string, ParamKind>> = {
  select1: {},
  show_databases: {},
};

/** Parameter kinds per registrar action, mirroring gateway/templates.py REGISTRAR_PLANS. */
export const REGISTRAR_PARAMS: Record<string, Record<string, ParamKind>> = {};

export class BadParams extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BadParams";
  }
}

export function validateParam(kind: ParamKind, value: string): string {
  if (typeof value !== "string" || !PARAM_PATTERNS[kind].test(value)) {
    throw new BadParams(`invalid ${kind}: ${JSON.stringify(String(value).slice(0, 40))}`);
  }
  return value;
}

function validateParams(kinds: Record<string, ParamKind> | undefined, params: Record<string, string>, what: string): void {
  if (!kinds) throw new BadParams(`unknown ${what}`);
  const extra = Object.keys(params).filter((k) => !(k in kinds));
  const missing = Object.keys(kinds).filter((k) => !(k in params));
  if (extra.length || missing.length) {
    throw new BadParams(`${what} takes [${Object.keys(kinds).join(", ")}]; missing [${missing}], unexpected [${extra}]`);
  }
  for (const [name, kind] of Object.entries(kinds)) validateParam(kind, params[name]!);
}

export function validateTemplateParams(templateId: string, params: Record<string, string>): void {
  validateParams(TEMPLATE_PARAMS[templateId], params, `template ${templateId}`);
}

export function validateRegistrarParams(action: string, params: Record<string, string>): void {
  validateParams(REGISTRAR_PARAMS[action], params, `registrar action ${action}`);
}

export function rowsAsObjects(res: Pick<TemplateResponse, "columns" | "rows">): Record<string, unknown>[] {
  return res.rows.map((r) => Object.fromEntries(res.columns.map((c, i) => [c, r[i] ?? null])));
}

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);
let refusedGatewayHosts = 0;

/** Attempts to reach a non-loopback gateway host since the process started. */
export function refusedGatewayHostAttempts(): number {
  return refusedGatewayHosts;
}

export interface GatewayClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  /** Client-side bound per request; the gateway bounds each query at 60 s itself. */
  timeoutMs?: number;
  /** Registrar plans CACHE parquet views; their client-side bound is longer. */
  registrarTimeoutMs?: number;
  /** How many HTTP 503 "warming" replies to wait out, and how long between them. */
  warmRetries?: number;
  warmDelayMs?: number;
}

export class GatewayClient {
  readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly registrarTimeoutMs: number;
  private readonly warmRetries: number;
  private readonly warmDelayMs: number;

  constructor(opts: GatewayClientOptions = {}) {
    const base = new URL(opts.baseUrl ?? process.env.GATEWAY_URL ?? DEFAULT_GATEWAY_URL);
    if (!LOOPBACK_HOSTS.has(base.hostname)) {
      refusedGatewayHosts++;
      throw new GatewayError(`refusing non-local gateway host ${base.hostname}`, 0);
    }
    this.baseUrl = base.origin;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.timeoutMs = opts.timeoutMs ?? 120_000;
    this.registrarTimeoutMs = opts.registrarTimeoutMs ?? 900_000;
    this.warmRetries = opts.warmRetries ?? 6;
    this.warmDelayMs = opts.warmDelayMs ?? 10_000;
  }

  async health(): Promise<Record<string, unknown>> {
    const res = await this.fetchImpl(`${this.baseUrl}/health`, { signal: AbortSignal.timeout(30_000) });
    const body = (await res.json()) as Record<string, unknown>;
    if (!res.ok) throw new GatewayError(`gateway /health HTTP ${res.status}`, res.status, body as Partial<TemplateResponse>);
    return body;
  }

  /** Runs one named reader template. Throws GatewayError on any non-200 reply (after waiting out warm-up 503s). */
  async template(templateId: string, params: Record<string, string> = {}, role: Role = "reader"): Promise<TemplateResult> {
    validateTemplateParams(templateId, params);
    let warm = 0;
    for (;;) {
      const started = performance.now();
      const res = await this.fetchImpl(`${this.baseUrl}/sql/template`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ template_id: templateId, params, role }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      const wall = performance.now() - started;
      let body: TemplateResponse;
      try {
        body = (await res.json()) as TemplateResponse;
      } catch {
        throw new GatewayError(`gateway ${templateId}: non-JSON reply (HTTP ${res.status})`, res.status);
      }
      if (res.status === 503 && String(body.error ?? "").startsWith("warming") && warm < this.warmRetries) {
        warm++;
        await new Promise((r) => setTimeout(r, this.warmDelayMs));
        continue;
      }
      if (res.status !== 200 || body.error) {
        throw new GatewayError(`gateway ${templateId} HTTP ${res.status}: ${String(body.error ?? "").slice(0, 300)}`, res.status, body);
      }
      return { ...body, params, http_status: res.status, wall_ms: Math.round(wall), warm_retries: warm };
    }
  }

  /**
   * Runs one registrar plan (POST /registrar/<action>) under a signed execution contract
   * (agent/src/contract/scout.ts). The contract names the same action and parameters; the
   * gateway refuses anything else and never accepts a contract twice. Throws GatewayError on
   * any non-200 reply, with the steps that ran so far in `response`.
   */
  async registrar(action: string, params: Record<string, string>, contract: Record<string, unknown>): Promise<RegistrarResult> {
    validateRegistrarParams(action, params);
    const started = performance.now();
    const res = await this.fetchImpl(`${this.baseUrl}/registrar/${encodeURIComponent(action)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...params, contract }),
      signal: AbortSignal.timeout(this.registrarTimeoutMs),
    });
    const wall = performance.now() - started;
    let body: RegistrarResponse;
    try {
      body = (await res.json()) as RegistrarResponse;
    } catch {
      throw new GatewayError(`gateway registrar ${action}: non-JSON reply (HTTP ${res.status})`, res.status);
    }
    if (res.status !== 200 || body.error) {
      throw new GatewayError(`gateway registrar ${action} HTTP ${res.status}: ${String(body.error ?? "").slice(0, 300)}`, res.status, body);
    }
    return { ...body, http_status: res.status, wall_ms: Math.round(wall) };
  }
}

// ---------- DQ gate ----------
// TODO(agent loop): the dq_gate tool (SHOW DQ ALL INVALID on the USL for the target utility,
// then the coverage, SIC-orphan and missing-station rules) goes here once the reader
// templates exist. The ClearShelf DqGate and write-back DQ check were removed: nothing in
// this entry writes back to Zetaris.
