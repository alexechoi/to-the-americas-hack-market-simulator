# Animal Spirits

![Next.js](https://img.shields.io/badge/Next.js_16-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React_19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![Python](https://img.shields.io/badge/Python_3.13-3776AB?style=for-the-badge&logo=python&logoColor=white)
![pydantic-ai](https://img.shields.io/badge/pydantic--ai-E92063?style=for-the-badge&logo=pydantic&logoColor=white)
![Logfire](https://img.shields.io/badge/Logfire-FF4081?style=for-the-badge&logo=pydantic&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)
![Terraform](https://img.shields.io/badge/Terraform-7B42BC?style=for-the-badge&logo=terraform&logoColor=white)
![Google Cloud](https://img.shields.io/badge/Google_Cloud-4285F4?style=for-the-badge&logo=googlecloud&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)

> A finance-native, multi-agent market simulator. Pick a ticker, inject a
> headline, and watch a population of LLM-driven trader personas react in real
> time — before the tape does.

We don't predict markets. We model the actors inside them. A swarm of ~65
trader personas (HFT, hedge fund, retail, pension fund) reads each headline
through its own reflex, decides via a pydantic-ai agent, and submits orders
into a tick-based exchange with a single market maker. The fair price moves
as a depth-weighted Kyle λ response to net order flow — so the chart you
watch is literally the rolling vote of the crowd.

## Components

| Component                         | Stack                                            |
| --------------------------------- | ------------------------------------------------ |
| [frontend/](./frontend/README.md) | Next.js 16 + React 19 + Tailwind + Firebase Auth |
| [backend/](./backend/README.md)   | FastAPI + Python 3.13 + pydantic-ai + Logfire    |
| [infra/](./infra/README.md)       | Terraform (GCP, Firebase, Cloud Run, CI/CD)      |

The frontend deploys to **Cloud Run**, **Vercel**, or **Netlify**
(configurable). The backend deploys to **Cloud Run**.

---

## How it works

```
   ┌───────────────────────────────────────────────────────────┐
   │                       /sim/[ticker]                       │
   │   price chart · order book · agent swarm · news · log     │
   └────────▲──────────────────────────────────────▲───────────┘
            │ SSE: snapshot · order_log · reset    │ POST /news/inject
            │                                      │
   ┌────────┴────────────────────────┐    ┌────────┴────────────┐
   │       ExchangeRuntime           │    │       NewsBus       │
   │  (singleton, owns the loop)     │◄───│  in-process pub/sub │
   │                                 │    └────────▲────────────┘
   │   ┌───────────────────────┐     │             │
   │   │ Exchange engine       │     │             │
   │   │   · ladder + Kyle λ   │     │             │
   │   │   · FOK matching      │     │             │
   │   │   · agent ledger      │     │             │
   │   └─────────▲─────────────┘     │             │
   └─────────────┼───────────────────┘             │
                 │ Order(qty, limit)               │
                 │                                 │
   ┌─────────────┴─────────────────────────────────┴────────────┐
   │                       Agent swarm                          │
   │     65 personas · one asyncio task each · jittered tick    │
   │                                                            │
   │   build_trader_context  →  pydantic-ai Agent  →  Decision  │
   │                                  ▲                         │
   │                                  │ recall + remember       │
   │                                  ▼                         │
   │                            MuBit memory                    │
   └────────────────────────────────────────────────────────────┘
                                  ▲
                                  │ gateway/<provider>:<model>
                                  ▼
                         PydanticAI Gateway (LLM)
```

- **Bootstrap** — at startup (or on `POST /exchange/spawn`) the backend pulls
  a live spot price + a few recent headlines from Yahoo Finance and seeds the
  exchange around that ticker. Default cold-start ticker is `NVDA`.
- **Tick loop** — the exchange ticks at 5 Hz (UI / "breathing"); every 5th
  tick is an event tick that drains queued FOK orders and updates the fair
  price. The swarm is gated by an auto-pause lifecycle — no SSE viewers, no
  ticks, no LLM spend.
- **Agents** — every persona has its own asyncio loop that calls a cached
  pydantic-ai `Agent` (one per `(model, temperature)`). All inference goes
  through PydanticAI Gateway (single API key, model strings of the form
  `gateway/<provider>:<model>`). Trader memory is a thin facade over MuBit;
  optional, no-op when no key is configured.
- **News** — headlines flow through an in-process `NewsBus` and reach every
  agent's `TraderContext` plus the frontend SSE feed. Inject your own from
  the `/sim/[ticker]` cockpit.
- **Observability** — Logfire is wired once in `backend/observability.py` and
  ships traces when `LOGFIRE_TOKEN` is set; otherwise it's a no-op.

See [`backend/AGENTS.md`](./backend/AGENTS.md) for the contributor rules
around observability, schemas, and dependency management.

---

## Quickstart

### Prerequisites

- [uv](https://docs.astral.sh/uv/) (Python) and Node 20+
- A [PydanticAI Gateway](https://ai.pydantic.dev/gateway/) API key for LLM
  inference
- A Firebase project (created automatically by Terraform — see below)
- For deployment: [Terraform](https://developer.hashicorp.com/terraform/downloads),
  the [Google Cloud SDK](https://cloud.google.com/sdk/docs/install), and a
  GCP Billing Account ID

### 1. Run locally

```bash
# Backend
cd backend
# Create .env with at least PYDANTIC_AI_GATEWAY_API_KEY — see "Backend env" below
uv sync
uv run python main.py             # http://localhost:8000

# Frontend (new terminal)
cd frontend
cp .env.example .env.local        # fill in Firebase config
npm install
npm run dev                       # http://localhost:3000
```

Then hit `http://localhost:3000`, type a ticker, and Launch.

The simulation auto-pauses when nobody is watching the SSE stream — open the
cockpit and it resumes within a tick or two.

### 2. Backend env

Create `backend/.env` with at least:

```env
# LLM inference (required) — single gateway key, model is swappable in env
PYDANTIC_AI_GATEWAY_API_KEY=pylf_v2_...
LLM_MODEL=gateway/groq:llama-3.3-70b-versatile
LLM_TEMPERATURE=1.1                # high on purpose; 0.5 = boring, 1.3 = chaos

# Firebase Admin (auth on protected routes) — pick one of the two:
GOOGLE_APPLICATION_CREDENTIALS=./firebase-service-account.json
# FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}

# CORS (comma-separated, no spaces)
ALLOWED_ORIGINS=http://localhost:3000

# Optional — observability (no-op unless set)
LOGFIRE_TOKEN=
ENVIRONMENT=dev

# Optional — durable trader memory (no-op unless set)
MUBIT_API_KEY=

# Optional — global swarm cadence multiplier (raise to slow the swarm down)
AGENT_TICK_MULTIPLIER=1
# Optional — override the cold-start ticker (defaults to NVDA)
BOOTSTRAP_TICKER=NVDA
```

To switch LLM providers, change `LLM_MODEL` — no code change. Examples:
`gateway/anthropic:claude-sonnet-4-6`, `gateway/openai:gpt-5.2`,
`gateway/groq:llama-3.3-70b-versatile`.

### 3. Deploy with Terraform

```bash
cd infra
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars: project_id, billing_account, github_repo
gcloud auth application-default login
terraform init
terraform apply
```

Then export the generated config to your local checkout:

```bash
# Frontend env
terraform output -json firebase_config | jq -r '
  "NEXT_PUBLIC_FIREBASE_API_KEY=\(.api_key)",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=\(.auth_domain)",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID=\(.project_id)",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=\(.storage_bucket)",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=\(.messaging_sender_id)",
  "NEXT_PUBLIC_FIREBASE_APP_ID=\(.app_id)"
' > ../frontend/.env.local

# Backend service-account key (local dev only)
terraform output -raw firebase_service_account_json > ../backend/firebase-service-account.json
```

CI/CD: pushing to `main` runs `.github/workflows/deploy.yml`, which builds and
deploys both services via Workload Identity Federation. See
[`infra/README.md`](./infra/README.md) for the full GCP / Firebase / GitHub
Actions setup.

---

## Routes

### Frontend

| Path              | What it is                                                |
| ----------------- | --------------------------------------------------------- |
| `/`               | Marketing landing page · ticker launcher                  |
| `/sim/[ticker]`   | Live cockpit — chart, order book, swarm, news, order log  |
| `/auth/login`     | Firebase sign-in (email/password, Google, Apple)          |
| `/auth/signup`    | Firebase sign-up                                          |
| `/dashboard`      | Authenticated user surface                                |
| `/debug`          | Diagnostic panel for the inference + exchange wiring      |

### Backend (selected)

| Method · Path                  | Notes                                          |
| ------------------------------ | ---------------------------------------------- |
| `GET  /health`                 | Liveness                                       |
| `GET  /exchange/state`         | Current ticker / fair price / bootstrap time   |
| `GET  /exchange/snapshot`      | Full ladder + recent trades (one-shot)         |
| `GET  /exchange/stream`        | SSE — `snapshot`, `order_log`, `reset` events  |
| `GET  /exchange/agents`        | Roster + last decision per persona             |
| `POST /exchange/spawn`         | Rebootstrap around a Yahoo ticker              |
| `POST /exchange/orders`        | Manual FOK order (`agent_id`, `qty`, `limit`)  |
| `GET  /news/recent`            | Last N headlines                               |
| `GET  /news/stream`            | SSE — headline events                          |
| `POST /news/inject`            | Publish a user / synthetic headline            |
| `GET  /yahoo/ticker/{ticker}`  | Live spot + headlines passthrough              |

---

## Documentation

- [Frontend setup](./frontend/README.md)
- [Backend setup + agent rules](./backend/README.md) · [`AGENTS.md`](./backend/AGENTS.md)
- [Infrastructure / Terraform](./infra/README.md)
