# Ploutos

**A visual financial sandbox for Canadian small businesses.**

Built at [Hack Canada 2026](https://hackcanada.org/).

![Status](https://img.shields.io/badge/status-active-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![Python](https://img.shields.io/badge/python-3.11%2B-blue)
![Node](https://img.shields.io/badge/node-18%2B-blue)

---

## 📌 Overview

Most small business owners manage their finances in their heads, a spreadsheet that's three years old, or a napkin. Ploutos turns that chaos into a living canvas — drag your revenue streams and expenses onto a board, wire them together, and watch a team of AI agents figure out what it all means.

The idea is simple: **you shouldn't need an MBA to understand your burn rate** or whether opening a second location in Winnipeg actually makes sense.

### Key Features

✨ **Visual Canvas** — Drag-and-drop financial modeling with React Flow  
🤖 **Dual AI Layers** — Backboard persistent agents + Gemini reasoning  
📊 **Real Canadian Data** — BoC rates, StatsCan demographics, Square POS integration  
🗺️ **Location Intelligence** — Viability scoring for expansion across 47+ Canadian cities  
🔐 **Secure Auth** — Auth0 OAuth integration  
⚡ **Real-time Sync** — Sub-1.5s canvas debounce with parallel AI analysis  

---

## 🏗️ How It Works

### The Canvas

The core of the app is a **drag-and-drop financial board** built with [React Flow](https://reactflow.dev/). You drop nodes for:
- **Revenue sources** — product lines, service tiers, contracts
- **Expense categories** — staff, overhead, operating costs
- **Connections** — edges model how money flows through your business

Every change triggers a **1.5-second debounce** followed by two parallel backend calls to both AI intelligence layers. No button pressing required—the AI reacts in real-time.

### The Two Intelligence Layers

We built two parallel AI stacks because each solved different problems:

#### **Layer 1 — Backboard.io (Persistent Agent Threads)**

Uses [Backboard](https://backboard.io) for orchestration and multi-turn conversations:

- **Ploutos-Accountant** — Analyzes canvas state, crunches financials, writes health scores + flagged risks
- **Ploutos-Scout** — Expansion specialist using tool-call loops for census data, rent estimates, foot traffic signals
- **Ploutos-Ingestor** — Parses Google Sheets / CSV imports into structured canvas nodes

The Scout demonstrates Backboard's strength: agents maintain memory across sessions without manual context stitching.

#### **Layer 2 — Gemini (Reasoning + Canadian Data)**

For analysis requiring Canadian economic data, we use [Google Gemini](https://ai.google.dev/) directly via the `google-genai` SDK:

- **Gemini Accountant** → `FinancialHealthReport`
- **Gemini Scout** → `GeminiExpansionReport` with ranked locations + lat/lng for mapping
- **Gemini Wire Matcher** → Intelligently connects expenses to revenue streams

Frontend prefers Gemini reports; falls back to Backboard if unavailable.

### Real Canadian Data Sources

The Viability Score isn't guessed—it's built from:

| Source | Data | API |
|--------|------|-----|
| **Bank of Canada** | Overnight rate, prime rate, CPI | Valet API |
| **Statistics Canada** | 2021 Census demographics (population, income, business density) | REST API |
| **FRED** | Cross-reference CPI + rate data | Federal Reserve |
| **Square Sandbox** | Real POS product catalogs | Transactions API |
| **UPC Item DB** | Product lookup for inventory | Public DB |

**Viability Formula:**
```
Ve = (projected_revenue × demographic_score) / ((rent_cost × competition_factor) + fixed_overhead) × 40
Capped at 100
```

### Authentication

Secure OAuth via **[Auth0](https://auth0.com/)** — zero custom session logic required.

---

## 📁 Project Structure

```
ploutos/
├── frontend/                    # Next.js 14 App Router
│   ├── app/
│   │   ├── sandbox/            # Main drag-and-drop canvas page
│   │   ├── dashboard/          # Business metrics overview
│   │   ├── expansion/          # Location selection interface
│   │   ├── maps/               # Interactive location map
│   │   ├── auth/               # Auth0 login/signup flow
│   │   └── api/auth/[auth0]/   # Auth0 callback handler
│   ├── components/
│   │   ├── FinancialSandbox.tsx    # Canvas container + handlers
│   │   ├── Navbar.jsx              # Navigation
│   │   ├── SummarySidebar.tsx      # Financial summary panel
│   │   ├── edges/                  # Custom React Flow edges
│   │   └── nodes/                  # Revenue/Expense/Group nodes
│   ├── hooks/
│   │   ├── useCanvasFinancials.ts  # Local financial calculations
│   │   ├── useSession.ts           # Session state management
│   │   └── useFinancialCalculation.ts # Math utilities
│   ├── services/
│   │   ├── api.js                  # fetch() wrapper for backend calls
│   │   └── compassApi.ts           # Specialized API routes
│   ├── types/                      # Shared TypeScript interfaces
│   ├── utils/                      # Helpers (nodeFactory, groupLayout)
│   ├── lib/                        # Auth0 SDK config
│   └── public/                     # Static assets
│
└── backend/                   # FastAPI + Gemini + Backboard
    ├── main.py               # App entrypoint, CORS, lifespan
    ├── config.py             # Pydantic config from .env
    ├── requirements.txt      # Dependencies
    ├── agents.py             # Backboard orchestration (legacy)
    ├── gemini_agents/        # New Gemini intelligence layer
    │   ├── accountant_agent.py    # Financial analysis
    │   ├── scout_agent.py         # Location expansion
    │   ├── wire_agent.py          # Connection matching
    │   ├── listing_agent.py       # Inventory management
    │   └── tools.py               # Shared tool definitions
    ├── models/               # Pydantic request/response models
    │   ├── briefings.py           # AI agent output schemas
    │   ├── business.py            # Business entity models
    │   └── location.py            # Location/viability models
    ├── routers/              # API route handlers (NEW)
    │   ├── sync.py                # POST /sync (Accountant)
    │   ├── optimize.py            # POST /optimize (Scout)
    │   ├── wire.py                # POST /auto-wire
    │   └── listings.py            # POST /listings
    ├── routes/               # Legacy Backboard routes
    │   ├── sandbox.py             # Old session endpoints
    │   ├── locations.py           # Location data + BestTime
    │   ├── dashboard.py           # Metrics (stub)
    │   └── optimizer.py           # Deprecated endpoint
    ├── services/             # External API clients
    │   ├── bankofcanada_service.py
    │   ├── fred_service.py
    │   ├── statscan_service.py
    │   ├── square_service.py
    │   └── upc_service.py
    ├── database/             # SQLite utilities (future)
    └── utils/
        ├── cache.py               # TTL digest caching
        └── digest.py              # API response → briefing conversion
```

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+ & npm
- **Python** 3.11+
- API keys: [Gemini](https://aistudio.google.com/app/apikey), [FRED](https://fredaccount.stlouisfed.org/), [Auth0](https://auth0.com/)

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and add your API keys

# Start server
uvicorn main:app --reload --port 8000

# Verify health check
curl http://localhost:8000/health
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Set up Auth0 (if using authentication)
# Add NEXT_PUBLIC_AUTH0_* to .env.local

# Start development server
npm run dev

# Open browser
open http://localhost:3000/sandbox
```

### First Use

1. Navigate to **http://localhost:3000/auth** and sign in
2. Go to **/sandbox** to start building your financial model
3. Drag revenue/expense nodes onto the canvas
4. Watch AI agents analyze your business in real-time

---

## 🔌 API Reference

### Gemini Intelligence Layer (New)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Ping all 8 external APIs and report status |
| `/sync` | POST | Accountant Agent: analyze canvas and return `FinancialHealthReport` |
| `/optimize` | POST | Scout Agent: rank locations by Viability Score |
| `/optimize/macro` | GET | Macro trends briefing (cached 6hr) |
| `/auto-wire` | POST | Wire Matcher: intelligently connect expenses to revenue |

### Legacy Backboard Routes (Preserved)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/session/start` | POST | Initialize Backboard thread pair |
| `/sandbox/sync` | POST | Backboard Accountant sync (legacy) |
| `/optimize/expansion` | POST | Backboard Scout location analysis |
| `/import/sheets` | POST | CSV/Sheets ingestor |

See [OpenAPI docs](http://localhost:8000/docs) for schema details.

---

## 🧪 Development

### Running Tests

```bash
# Backend tests (future)
pytest backend/

# Frontend tests (future)
npm run test --prefix frontend
```

### Debugging AI Agents

All agent calls are logged at `INFO` level:

```bash
tail -f backend.log | grep "gemini\|backboard"
```

To test individual agents in isolation:

```python
# backend/
from gemini_agents import accountant_agent
report = await accountant_agent.analyze(canvas_state)
print(report.json())
```

### Environment Variables

Copy [`.env.example`](./backend/.env.example) to `.env` and fill in your keys:

| Variable | Source | Required |
|----------|--------|----------|
| `GOOGLE_GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/app/apikey) | ✅ Yes |
| `FRED_API_KEY` | [Federal Reserve FRED](https://fredaccount.stlouisfed.org/) | ✅ Yes |
| `SQUARE_ACCESS_TOKEN` | [Square Developer](https://developer.squareup.com) | ❌ Optional |
| `BACKBOARD_API_KEY` | [Backboard.io](https://backboard.io) | ❌ Optional |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | [Mapbox](https://www.mapbox.com) | ❌ Optional |

**Security Note:** Never commit `.env` files. They are in `.gitignore` for this reason.

---

## 🐛 Troubleshooting

### "Gemini API key not configured"
Ensure `GOOGLE_GEMINI_API_KEY` is set in `.env` and backend is restarted.

### Frontend can't reach backend
Check CORS origin in `backend/main.py` matches your frontend URL (default: `http://localhost:3000`).

### Canvas doesn't sync to backend
Open browser DevTools console (`F12`) and check network tab. Verify `/sync` endpoint returns 200.

### Location viability scores are low
Ensure `FRED_API_KEY` and external APIs are available. Check `/health` endpoint for missing services.

---

## 📜 License

MIT License — See [LICENSE](./LICENSE) file for details.

---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. **Fork the repo** and create a feature branch: `git checkout -b feature/your-feature`
2. **Make changes** following the existing code style (PEP 8 for Python, Prettier for JS)
3. **Test thoroughly** — ensure no new errors are introduced
4. **Create a Pull Request** with a clear description of changes
5. **Link any related issues** with `Closes #123`

### Code Style

- **Python**: [PEP 8](https://www.python.org/dev/peps/pep-0008/) via `black` + `flake8`
- **JavaScript/TypeScript**: [Prettier](https://prettier.io/) + [ESLint](https://eslint.org/)
- **Commit messages**: Descriptive, lowercase, imperative mood (`add feature` not `added feature`)

### Areas for Contribution

- [ ] Add unit tests for agent logic
- [ ] Improve error handling for external API failures
- [ ] Optimize React Flow rendering for large canvases (1000+ nodes)
- [ ] Expand location data sources (international expansion)
- [ ] Mobile responsiveness improvements
- [ ] Performance profiling + caching strategies

---

## 🎯 Roadmap

- ✅ MVP: Canvas + Gemini + Backboard integration
- ⏳ **Q2 2026**: Multi-user workspaces + real-time collaboration
- ⏳ **Q3 2026**: Historical data analysis + forecasting models
- ⏳ **Q4 2026**: Integration with QuickBooks, Xero, Wave
- ⏳ **2027**: International expansion (US, UK, EU)

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/DYoussef999/Ploutos/issues)
- **Email**: support@ploutos.io (future)
- **Twitter**: [@PloutosApp](https://twitter.com/PloutosApp) (future)

---

## 🙏 Acknowledgments

Built with:
- [React Flow](https://reactflow.dev/) — Visual canvas
- [Backboard.io](https://backboard.io) — Persistent agent threads
- [Google Gemini](https://ai.google.dev/) — Reasoning + data synthesis
- [FastAPI](https://fastapi.tiangolo.com/) — High-performance Python API
- [Next.js](https://nextjs.org/) — Full-stack React framework
- [Auth0](https://auth0.com/) — Secure authentication

---

Made with ❤️ at [Hack Canada 2026](https://www.hackcanda.io/)

---

## APIs & Tools Used

- **[Backboard AI](https://backboard.io)** — agent thread orchestration and persistent memory across sessions
- **[Google Gemini](https://deepmind.google/technologies/gemini/)** — financial analysis and location viability reasoning
- **[Auth0](https://auth0.com)** — authentication
- **[Square](https://developer.squareup.com)** — commerce APIs for real product catalog data
- **[Bank of Canada Valet API](https://www.bankofcanada.ca/valet/docs)** — live interest rates and CPI
- **[Statistics Canada](https://www.statcan.gc.ca)** — 2021 Census demographics
- **[FRED](https://fred.stlouisfed.org)** — economic indicator cross-reference
- **[UPC Item DB](https://www.upcitemdb.com)** — product lookup

---

*We just want Canadian small businesses to have tools that don't suck.*
