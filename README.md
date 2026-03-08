# Ploutos

**Visual Financial Sandbox for Canadian SMBs.** Built for Hack Canada 2026.

Ploutos helps small business owners visualize their financial health on a drag-and-drop React Flow canvas and receive expansion strategy grounded in real Canadian economic data.

---

## Architecture

### Two Parallel Backend Layers

**Layer 1 — Backboard.io** (`backend/agents.py`)
Three persistent assistants: `Ploutos-Accountant`, `Ploutos-Scout`, `Ploutos-Ingestor`. Session state is held in-memory (one accountant + one scout thread per session). The Scout runs a tool-call loop fetching market data before synthesizing an expansion recommendation.

**Layer 2 — Gemini + Real Canadian APIs** (`backend/gemini_agents/`, `backend/routers/`, `backend/services/`)
All external API responses pass through `backend/utils/digest.py` before entering any agent prompt — agents never receive raw JSON.

| Endpoint | Agent | Purpose |
|---|---|---|
| `POST /sync` | Gemini Accountant | Financial health report from canvas state |
| `POST /optimize` | Gemini Scout | Ranked expansion locations with viability scores |
| `GET /macro` | — | Cached BoC + FRED macro briefing (6hr TTL) |
| `GET /health` | — | Pings all 6 external APIs |

### Data Sources

| Service | Data |
|---|---|
| Bank of Canada Valet API | Overnight rate, CAD/USD, CPI |
| FRED (St. Louis Fed) | Canada inflation cross-reference |
| Statistics Canada | 2021 Census demographics per city (cached 24hr) |
| Square Sandbox | POS catalog for inventory cross-reference |
| UPC Item DB | Product lookup (100/day trial limit) |

### Viability Score Formula (Scout Agent)
```
Ve = (P_rev × D_demographic) / ((C_rent × max(S_competition, 0.01)) + O_fixed) × 40
```
Capped 0–100. Applies a 15% financing penalty when BoC overnight rate > 4.5%.

### Frontend Data Flow
```
FinancialSandbox (canvas state)
  ├── useCanvasFinancials(nodes, edges)   → local math, no API
  ├── useSession()                        → POST /session/start
  ├── debounce 1500ms on node change →
  │     Promise.allSettled([
  │       syncCanvas()       → POST /sandbox/sync  (Backboard)
  │       syncCanvasGemini() → POST /sync           (Gemini)
  │     ])
  └── SummarySidebar
        ├── getMacro() on mount → GET /macro
        ├── FinancialsTab    (local calc)
        ├── InsightsTab      (Gemini preferred, Backboard fallback)
        └── OptimizationTab  → POST /optimize
```

---

## Getting Started

### Backend
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env   # fill in API keys
uvicorn main:app --reload --port 8000
curl http://localhost:8000/health   # verify all APIs live
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:3000/sandbox`.

---

## Tech Stack

- **Frontend:** Next.js 14 (TypeScript), React Flow, Tailwind CSS
- **Backend:** FastAPI, Google GenAI SDK (`google-genai`), Backboard.io
- **Data:** Bank of Canada Valet, FRED, Statistics Canada, Square Sandbox, UPC Item DB
- **Infra:** In-memory TTL cache, tenacity retry (3× with exponential backoff on 429s)
