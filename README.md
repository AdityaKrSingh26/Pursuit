# Pursuit

Pursuit is a job-hunt command center and application tracker built to manage software engineering applications end to end. It uses AI to perform real-time gap analysis, tailor resumes per role, and generate target prep.

Pursuit was built to solve the developer's real job-hunting problems. When managing dozens of applications across different platforms, keeping track of interview stages, notes, and customized resume versions quickly becomes unmanageable. Pursuit automates these painful administrative tasks while keeping the human in control.

From a technical perspective, Pursuit demonstrates production-grade full-stack engineering. It features structured LLM schema validation, streaming Server-Sent Events (SSE), background BullMQ processing, and vector database similarity clustering using pgvector.

## System Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Frontend (Vercel)                                       │
│  React 18 + TypeScript + Vite                            │
│  Zustand (client state) + TanStack Query (server state)  │
│  Tailwind + dnd-kit + Recharts                           │
└───────────────┬──────────────────────────────────────────┘
                │ HTTPS (REST, JSON) · SSE for LLM streaming
┌───────────────▼──────────────────────────────────────────┐
│  API (Railway/Render) — single Node service (monolith)   │
│  Express + TypeScript + Zod (request & LLM validation)   │
│  Prisma ORM                                              │
│  Modules: auth / applications / ingestion / analysis /   │
│           resume / intelligence / reminders              │
└────┬───────────────┬───────────────┬─────────────────────┘
     │               │               │
┌────▼─────┐   ┌─────▼─────┐   ┌─────▼──────────────┐
│ Postgres │   │  Redis    │   │ Worker process     │
│ + pgvector│  │  BullMQ   │   │ (same codebase,    │
│ + FTS    │   │  queues + │   │  separate dyno):   │
│          │   │  cache    │   │  fetch/parse/embed │
└──────────┘   └───────────┘   │  /reminders/PDF    │
                               └─────┬──────────────┘
                                     │
                          ┌──────────▼──────────┐
                          │ External: LLM API   │
                          │ Object storage (S3- │
                          │ compatible) for PDFs│
                          └─────────────────────┘
```

## Architectural Decisions

| Decision | Choice | Rejected alternative & why |
|---|---|---|
| **Service shape** | Modular monolith, two processes (API + worker) | Microservices: zero benefit at this scale, large failure-mode cost. |
| **DB** | PostgreSQL (+ pgvector + FTS) | Mongo: relational data (applications ↔ versions ↔ blocks) is genuinely relational; separate vector DB: extra service for <10k vectors. |
| **Background work** | BullMQ + Redis | Cron-in-process: no retries/observability; SQS/Lambda: cloud lock-in and overkill. |
| **LLM streaming** | SSE | WebSockets: bidirectional not needed; SSE is simpler and proxy-friendly. |
| **Job-status updates** | Polling (2s) | WebSockets: not justified for one user watching one job; know the crossover point. |
| **Client state** | Zustand + TanStack Query | Redux Toolkit: ceremony without payoff at this scope. |
| **PDF** | react-pdf server-side | Client print-to-PDF: inconsistent output; Puppeteer kept as fallback for complex layouts. |
| **Auth** | JWT access (15 min) in httpOnly cookie + rotating refresh (7 d) | localStorage tokens: XSS-exposed; sessions table: fine too, but JWT chosen to demonstrate the harder pattern correctly. |

## What Breaks at 10k Users & Scalability Plan

If Pursuit scales to 10k users, the following bottlenecks will arise, along with our mitigation plans:

1. **Connection Pool Exhaustion**: 10k concurrent users making API requests will saturate PostgreSQL's maximum connections. We will place **pgBouncer** between the API service and Postgres to manage connection pooling.
2. **pgvector Sequential Scans**: As the number of job description vectors scales, exact cosine-similarity scans will slow down. We will add an **IVFFlat** or **HNSW** index:
   ```sql
   CREATE INDEX ON "JobDescription" USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
   ```
3. **BullMQ Queuing Bottlenecks**: A single worker thread will fall behind. We will spawn multiple, multi-process workers behind a shared Redis cluster.
4. **Redis Reliability**: Single instance Redis will become a single point of failure. We will switch to **Redis Sentinel** for High Availability and **Redis Cluster** for horizontal scaling.
5. **Ingestion Status Polling**: Polling the database every 2 seconds for job ingestion status will put load on the API. We will replace polling with **WebSockets (ws)** at 1k+ concurrent users.

## Local Setup

### 1. Clone the repository
```bash
git clone https://github.com/AdityaKrSingh26/Pursuit.git
cd Pursuit
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and fill in the required variables (e.g. `JWT_SECRET`, `LLM_API_KEY`):
```bash
cp .env.example .env
```

### 3. Start Database and Cache Services
Ensure Docker is installed and run:
```bash
docker compose up -d
```

### 4. Setup Backend
Install dependencies, run database migrations, and generate Prisma client:
```bash
npm --prefix server install
npx --prefix server prisma migrate dev
npx --prefix server prisma generate
```

### 5. Setup Frontend
Install client dependencies:
```bash
npm --prefix client install
```

### 6. Run the Application
Run the following commands in three separate terminal tabs:

**Terminal 1 (API Server)**:
```bash
npm --prefix server run dev
```

**Terminal 2 (Background Worker)**:
```bash
npm --prefix server run dev:worker
```

**Terminal 3 (Frontend)**:
```bash
npm --prefix client run dev
```

The client will be running at `http://localhost:5173`.

### 7. Run Evaluation Suite
Execute prompt evaluation:
```bash
npm run evals
```

## Demo Account

You can access the pre-seeded portfolio demo account with the credentials below:

- **Email**: `demo@pursuit.dev`
- **Password**: `demo1234`

To seed the database with demo applications:
```bash
npm --prefix server run seed
```

## Demo Walkthrough

![Demo](docs/demo.gif)
