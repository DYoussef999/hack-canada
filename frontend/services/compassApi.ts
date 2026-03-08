/**
 * compassApi.ts — typed fetch wrapper for the Compass AI backend.
 * All methods throw on non-2xx responses with the backend's detail message.
 */

import type {
  SessionResponse,
  CanvasSyncResponse,
  ExpansionResponse,
  ImportSheetsResponse,
  FinancialHealthReport,
  MacroTrendsBriefing,
  GeminiExpansionReport,
} from '@/types/api';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

async function post<T>(path: string, body: unknown, timeoutMs: number = 30000): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail ?? `Request failed (${res.status})`);
    }
    return res.json() as Promise<T>;
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Create or resume a Backboard thread pair for this session. */
export async function startSession(sessionId: string): Promise<SessionResponse> {
  return post('/session/start', { session_id: sessionId });
}

/** Push canvas snapshot to the Accountant agent for financial analysis.
 *  `segments` carries the direct-cost linkage map so the Scout agent can
 *  understand which parts of the business are most scalable for expansion. */
export async function syncCanvas(
  sessionId: string,
  nodes: unknown[],
  edges: unknown[],
  segments: unknown[] = []
): Promise<CanvasSyncResponse> {
  return post('/sandbox/sync', { session_id: sessionId, nodes, edges, segments });
}

/** Ask the Scout agent to rank expansion locations. */
export async function optimizeExpansion(
  sessionId: string,
  targetCities: string[],
  businessType: string,
  deepAnalysis: boolean
): Promise<ExpansionResponse> {
  return post('/optimize/expansion', {
    session_id: sessionId,
    target_cities: targetCities,
    business_type: businessType,
    deep_analysis: deepAnalysis,
  });
}

/** Convert raw CSV rows into React Flow nodes via LLM. */
export async function importSheets(
  rows: Record<string, string>[]
): Promise<ImportSheetsResponse> {
  return post('/import/sheets', { rows });
}

// ── Gemini intelligence layer ─────────────────────────────────────────────────

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

/** Analyze canvas nodes with Gemini Accountant Agent → FinancialHealthReport. */
export async function syncCanvasGemini(
  nodes: unknown[],
  edges: unknown[]
): Promise<FinancialHealthReport> {
  return post('/sync', { nodes, edges });
}

/** Fetch current BoC + FRED macro briefing (cached 6hr on backend). */
export async function getMacro(): Promise<MacroTrendsBriefing> {
  return get('/macro');
}

export interface CandidateLocation {
  lat: number;
  lng: number;
  city_name: string;
  business_type: string;
  monthly_rent: number;
  census_division: string;
}

/** Run Scout Agent to rank candidate locations by Viability Score. */
export async function optimizeLocations(
  financialReport: FinancialHealthReport,
  locations: CandidateLocation[]
): Promise<GeminiExpansionReport> {
  return post('/optimize', { financial_report: financialReport, locations });
}

// ── Canvas auto-wiring ────────────────────────────────────────────────────────

export interface NodeForWiring {
  id: string;
  label: string;
  type: string;
  category?: string | null;
}

export interface WireMapping {
  source: string;
  target: string;
}

export interface AutoWireResponse {
  mappings: WireMapping[];
}

/** Use Gemini to auto-wire unconnected expenses to revenue streams. */
export async function autoWireNodes(
  revenueNodes: NodeForWiring[],
  expenseNodes: NodeForWiring[]
): Promise<AutoWireResponse> {
  return post('/canvas/auto-wire', {
    revenue_nodes: revenueNodes,
    expense_nodes: expenseNodes,
  }, 60000); // 60 second timeout for auto-wire since it can be slow
}
