# MLOps Playground

A hands-on learning environment for production machine learning engineering. Sixteen interactive simulators, structured study guides, and AI-evaluated mock interviews across four ML engineering domains.

## What It Is

Most ML education stops at model training. MLOps Playground picks up where that leaves off — deployments, failure modes, monitoring, drift detection, and the system design decisions that define production ML work at senior levels.

The platform has three modes that work together:

- **Labs** — Run simulators, inject faults, watch automated gates respond in real time
- **Study Guide** — 180+ concept sections written at engineering blog-post depth, with AI-generated quizzes
- **Mock Interview** — 360+ questions evaluated by AI with specific feedback on what you got right and what you missed. Export a full preparation guide as a PDF at the end of any session.

---

## Prerequisites

- Node.js 18+
- Python 3.11+
- [uv](https://docs.astral.sh/uv/) (Python package manager)
- A Groq API key — free at [console.groq.com](https://console.groq.com)

---

## Running Locally

### 1. Clone the repo

```bash
git clone https://github.com/SharmaSheetal/ml-playground.git
cd ml-playground
```

### 2. Start the backend

```bash
cd backend
cp .env.example .env
# Edit .env and add your GROQ_API_KEY
uv run uvicorn main:app --reload --port 8000
```

### 3. Start the frontend

```bash
cd frontend
cp .env.local.example .env.local
# .env.local already points to http://localhost:8000 — no changes needed
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Run with Docker

```bash
# Add your GROQ_API_KEY to backend/.env first
docker-compose up --build
```

Frontend at `localhost:3000`, backend at `localhost:8000`.

---

## AI Setup

AI powers the quiz generator, interview answer evaluator, and PDF export. The platform uses the Groq API (Llama 3.1-8b-instant).

**Priority chain:**

1. If you paste your own Groq key in the UI (Settings icon in the navbar) — it runs directly from your browser, no backend needed
2. If no user key is set — it falls through to the `GROQ_API_KEY` in the backend `.env`
3. If both are unavailable — every AI feature falls back to static content (curated question sets, key-point rubrics, template STAR answers)

The platform is fully usable without AI. AI just makes it more personalized.

---

## Modules

16 modules across 4 domains. Each module has a lab simulator, study guide, and interview question set.

### Deployment

| Module | What you learn |
|---|---|
| Traffic Split | Canary routing, blue/green switching, champion/challenger, P99-gated rollback |
| Canary Release | Staged promotion, PSI validation gates, observation windows, Argo Rollouts patterns |
| Shadow Mode | Request mirroring, prediction divergence metrics, Istio/Envoy patterns |
| Latency Optimizer | Quantization (FP16/INT8), TensorRT, dynamic batching, caching, P99 SLA design |

### Monitoring

| Module | What you learn |
|---|---|
| Drift Detection | PSI, KL divergence, covariate shift, threshold calibration |
| Four-Layer Metrics | Infrastructure, model quality, business, and data quality metric tiers |
| Alert Threshold | Precision/recall tradeoffs in alerting, alert fatigue modeling |
| A/B Significance | Statistical power, sample sizing, peeking problem, CUPED variance reduction |

### MLOps

| Module | What you learn |
|---|---|
| Retraining Triggers | Scheduled vs drift-triggered retraining, data flywheel, versioning |
| Feature Store | Online/offline stores, training-serving skew, feature freshness |
| Skew Detector | Distribution mismatch detection across ML pipelines |
| CI/CD Pipeline | Model validation gates, staging environments, automated promotion |

### System Design

| Module | What you learn |
|---|---|
| Two-Stage Recommender | Candidate retrieval, ranking, cold-start strategies, feedback loop bias |
| Fraud Detection | Real-time scoring, cost matrix, reject inference, class imbalance |
| Scalability | Throughput, fan-out latency, horizontal scaling, GPU cost modeling |
| Precision / Recall | ROC vs PR curves, model calibration, cost-sensitive threshold selection |

---

## Features

### Fault injection in every simulator

Each lab has configurable fault modes you can trigger at any time — latency spikes, error injection, distribution drift, rollback scenarios. The simulator responds in real time and tracks recovery.

### AI-generated quizzes

After reading any study guide section, generate a quiz based on that specific section's content. Not a generic question bank — the questions are derived from what you just read.

### Answer evaluation with specific feedback

In mock interview mode, the AI breaks down each answer: what you got right, what you missed, and what a natural follow-up would be. Same structure as a real technical interview round.

### Interview preparation guide PDF export

At the end of any session, export a printable PDF with:
- Technical answer for every question in the module
- Behavioral variant ("Tell me about a time...")
- Full STAR-method response
- Alternative framing for candidates without direct production experience
- Your session answers and AI feedback, if you answered questions

### Progress checkpoints

Each lab tracks progress through checkpoints based on decisions you make, not just clicks. Tells you what you have understood vs what you have just seen.

---

## Project Structure

```
ml-playground/
├── backend/                    FastAPI server
│   ├── main.py                 App entry point, router registration
│   ├── routers/
│   │   ├── llm.py              POST /api/llm/ask — proxies Groq API
│   │   ├── deployment.py       Simulator state endpoints for deployment labs
│   │   ├── monitoring.py       Simulator state endpoints for monitoring labs
│   │   ├── mlops.py            Simulator state endpoints for MLOps labs
│   │   └── system_design.py    Simulator state endpoints for system design labs
│   ├── services/               Business logic for each simulator
│   │   ├── traffic_split.py
│   │   ├── canary_release.py
│   │   ├── shadow_mode.py
│   │   └── latency_optimizer.py
│   ├── models/                 Pydantic request/response models
│   ├── .env.example            Copy to .env and add GROQ_API_KEY
│   └── requirements.txt
│
├── frontend/                   Next.js 14 App Router
│   ├── app/
│   │   ├── page.tsx            Homepage — module listing across all 4 domains
│   │   ├── labs/               Lab simulator pages
│   │   │   ├── page.tsx        Labs index with all 16 simulators
│   │   │   ├── deployment/     traffic-split, canary-release, shadow-mode, latency-optimizer
│   │   │   ├── monitoring/     drift-detection, metrics-dashboard, alert-threshold, ab-significance
│   │   │   ├── mlops/          retraining-trigger, feature-store, skew-detector, cicd-pipeline
│   │   │   └── system-design/  recommender, fraud-detection, scalability, precision-recall
│   │   ├── study-guide/        Study guide pages (same module structure as labs)
│   │   └── mock-interview/     Interview pages (same module structure as labs)
│   │       └── demo/           Demo page showing the PDF export flow
│   │
│   ├── modules/                All simulator and content logic lives here
│   │   └── [domain]/[module]/
│   │       ├── index.tsx           Main simulator component
│   │       ├── content.ts          Study guide sections and interview Q&A
│   │       ├── useSimulation.ts    Simulation state and fault injection logic
│   │       └── AIAdvisorPanel.tsx  Context-aware AI advice panel
│   │
│   ├── components/
│   │   ├── MockInterviewRunner.tsx    Full interview session with AI evaluation
│   │   ├── InterviewPDFModal.tsx      PDF generation and inline document preview
│   │   ├── StudyGuideViewer.tsx       Section viewer with quiz and practice mode
│   │   ├── layout/                    Navbar, sidebar
│   │   └── ui/                        Shared UI components, AIToggleModal
│   │
│   ├── lib/
│   │   ├── llm.ts              Single entry point for all AI calls (user key → backend → static)
│   │   └── questionCache.ts    Caches generated quiz questions per section
│   │
│   └── .env.local.example      Copy to .env.local — sets NEXT_PUBLIC_API_URL
│
├── docs/                       Submission documents
│   ├── project-description.docx
│   └── generate_doc.py         Script to regenerate the docx
│
├── docker-compose.yml          Runs frontend + backend together
└── pyproject.toml              Python project config (uv)
```

---

## Environment Variables

**backend/.env**

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | Yes (for AI) | Server-side Groq key, used when no user key is provided |
| `ALLOWED_ORIGINS` | Yes | CORS origins, e.g. `http://localhost:3000` |

**frontend/.env.local**

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Yes | Backend URL, e.g. `http://localhost:8000` |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Animations | Framer Motion |
| Backend | FastAPI, Python 3.11, uvicorn |
| AI | Groq API (Llama 3.1-8b-instant) |
| Package management | npm (frontend), uv (backend) |
| Containerization | Docker, docker-compose |
