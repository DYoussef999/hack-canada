/** Response from POST /session/start */
export interface SessionResponse {
  session_id: string;
  accountant_thread_id: string;
  scout_thread_id: string;
  resumed: boolean;
}

/** Financial health analysis returned by the Accountant agent */
export interface AccountantAnalysis {
  burn_rate: number;
  gross_margin_pct: number;
  runway_months: number | null;
  health_score: number;
  top_cost_drivers: string[];
  warnings: string[];
  financial_markers: {
    max_affordable_rent: number;
    monthly_revenue: number;
    monthly_expenses: number;
    net_profit: number;
  };
}

/** Response from POST /sandbox/sync */
export interface CanvasSyncResponse {
  analysis: AccountantAnalysis;
  tokens_used: number | null;
  retrieved_memories: unknown[];
}

/** A single location recommendation from the Scout agent */
export interface LocationResult {
  city: string;
  neighbourhood: string;
  monthly_rent: number;
  viability_score: number;
  rationale: string;
  risk_flag: string | null;
}

/** Response from POST /optimize/expansion */
export interface ExpansionResponse {
  result: {
    locations: LocationResult[];
    recommendation: string;
  };
  model_used: string;
  tool_turns: number;
  tokens_used: number | null;
}

/** Response from POST /import/sheets */
export interface ImportSheetsResponse {
  nodes: unknown[];
  edges: unknown[];
  rows_processed: number;
  tokens_used: number | null;
}

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

// ── New Gemini intelligence layer types ───────────────────────────────────────

export interface SegmentMargin {
  segment_name: string;
  revenue: number;
  expenses: number;
  margin_pct: number;
}

/** Response from POST /sync (Gemini Accountant Agent) */
export interface FinancialHealthReport {
  net_profit: number;
  profit_margin_pct: number;
  break_even_revenue: number;
  health_score: number;
  top_cost_risks: string[];
  warnings: string[];
  monthly_revenue: number;
  monthly_expenses: number;
  max_affordable_rent: number;
  recommendation: string;
  segment_margins?: SegmentMargin[];
}

/** Response from GET /macro (BoC + FRED, cached 6hr) */
export interface MacroTrendsBriefing {
  current_overnight_rate: number | null;
  current_cpi: number | null;
  cad_usd_rate: number | null;
  trend_label: 'tightening' | 'easing' | 'stable';
  smb_impact_summary: string;
  last_updated: string;
}

export interface ViabilityScore {
  p_rev: number;
  d_demographic: number;
  c_rent: number;
  s_competition: number;
  o_fixed: number;
  computed_score: number;
}

/** A single ranked location from POST /optimize */
export interface RankedLocation {
  city_name: string;
  lat: number;
  lng: number;
  business_type: string;
  monthly_rent: number;
  viability_score: ViabilityScore;
  recommendation: string;
  macro_risk_flag: string;
  vulnerability_note: string;
}

/** Response from POST /optimize (Gemini Scout Agent) */
export interface GeminiExpansionReport {
  ranked_locations: RankedLocation[];
  top_macro_risk: string;
  macro_context: MacroTrendsBriefing;
  generated_at: string;
}
