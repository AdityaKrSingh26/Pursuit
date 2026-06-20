# Architecture

---

## System Overview

```mermaid
graph TB
    subgraph Client["Client — React 19 + TypeScript + Vite"]
        direction LR
        UI["Pages\nPipeline · Ledger · Funnel\nResume · Intel · Discover · Follow-ups"]
        TQ["TanStack Query\nserver state + cache"]
        ZS["Zustand\nclient state"]
    end

    subgraph API["API Server — Express 5 + Node.js"]
        direction TB
        MW["Middleware\nJWT verify → set RLS context → CSRF"]
        subgraph Modules["Feature Modules"]
            M1["applications"]
            M2["resume + analysis"]
            M3["dashboard + intel"]
            M4["jobs + reminders"]
        end
        MW --> Modules
    end

    subgraph Worker["Background Worker — BullMQ"]
        WI["jd-ingestion\nfetch → parse → embed"]
        WP["pdf-render"]
        WR["reminders  cron 08:00"]
        WD["job-discovery\nTinyFish scan"]
        WMV["dashboard-refresh\nREFRESH MATVIEW  15 min"]
    end

    subgraph PG["PostgreSQL 16 + pgvector"]
        PG1["Applications · StageEvents\nAnalyses · Reminders\n(RLS enforced)"]
        PG2["JobDescription\ncontent-addressed global\nHNSW embedding index"]
        PG3["ResumeBlocks · ResumeVersions\n(RLS enforced)"]
        PG4["DiscoveredJob · UserJobScore\n(global + per-user scores)"]
        PG5["mv_user_funnel\nmaterialized view"]
    end

    REDIS["Redis 7\nBullMQ job queues\ncache-aside TTL keys\nrate-limit counters"]

    EXT_LLM["LLM API\nGroq / OpenAI / Anthropic"]
    EXT_EMB["Embedding API\nGitHub Models / OpenAI"]
    EXT_TF["TinyFish\ncareers page scraper"]
    EXT_CDN["Cloudinary\nPDF object storage"]

    Client -->|"HTTPS REST + SSE\nhttpOnly cookie"| API
    API --> PG
    API --> REDIS
    Worker --> PG
    Worker --> REDIS
    Worker --> EXT_LLM
    Worker --> EXT_EMB
    Worker --> EXT_TF
    Worker --> EXT_CDN
    Modules -->|"enqueue jobs"| REDIS
```

---

## Request Lifecycle

```mermaid
sequenceDiagram
    participant B as Browser
    participant A as API Server
    participant DB as PostgreSQL
    participant Q as Redis / BullMQ
    participant W as Worker
    participant L as LLM API

    B->>A: POST /api/v1/applications (httpOnly cookie + CSRF token)
    A->>A: verify JWT → set app.current_user_id via set_config()
    A->>DB: INSERT Application (RLS policy checks userId)
    A->>DB: INSERT StageEvent (SAVED)
    A->>Q: enqueue jd-ingestion job
    A->>Q: redis.del(dashboard:funnel:{userId})
    A-->>B: 201 Created

    W->>Q: dequeue jd-ingestion
    W->>EXT_TF: fetch careers page → markdown
    W->>L: parse JD → structured JSON
    W->>DB: UPSERT JobDescription (by jdHash — global dedup)
    W->>L: embed rawText → vector[1536]
    W->>DB: UPDATE JobDescription SET embedding = ?
```

---

## LLM Analysis Flow (SSE Streaming)

```mermaid
sequenceDiagram
    participant B as Browser
    participant A as API Server
    participant DB as PostgreSQL
    participant L as LLM API

    B->>A: POST /api/v1/applications/:id/gap-analysis
    A->>DB: load Application + JobDescription + ResumeBlocks
    A->>B: HTTP 200, Content-Type: text/event-stream

    loop token stream
        A->>L: stream chat completion
        L-->>A: token chunk
        A-->>B: data: {"type":"token","content":"..."}
    end

    A->>L: (stream complete, parse structured JSON from full text)
    A->>DB: INSERT Analysis (kind=GAP, result, tokensIn, tokensOut, costUsd)
    A-->>B: data: {"type":"result","data":{...}}
    A-->>B: data: {"type":"done"}
```

---

## Job Discovery Flow

```mermaid
flowchart TD
    A([User clicks Refresh]) --> B{last fetchedAt\n< 12 hours ago?}
    B -- yes --> C[return cached jobs\nstatus: fresh]
    B -- no --> D{scan already\nqueued/running?}
    D -- yes --> E[return status: already_running]
    D -- no --> F[enqueue job-discovery\nto BullMQ]
    F --> G[Worker: for each company\nin companies.json]
    G --> H[TinyFish fetch\ncareers page → markdown]
    H --> I[regex extract\njob links]
    I --> J[TinyFish fetch\nper job page]
    J --> K[UPSERT DiscoveredJob\nby url — global dedup]
    K --> L{more companies?}
    L -- yes --> G
    L -- no --> M([scan complete])

    N([User clicks Score]) --> O[load user's ResumeBlocks]
    O --> P[find DiscoveredJobs\nwithout UserJobScore]
    P --> Q[batch 10 jobs per\nLLM call]
    Q --> R[parse JSON scores\n0-100 + reason]
    R --> S[UPSERT UserJobScore\nUPDATE DiscoveredJob.techStack]
    S --> T([jobs re-sorted by score])
```

---

## Multi-Tenancy Model

```mermaid
flowchart LR
    subgraph Request["Every authenticated request"]
        JWT["1. Verify JWT\n(httpOnly cookie)"]
        CTX["2. set_config\napp.current_user_id = userId"]
        QUERY["3. Application query\nWHERE userId = ?"]
    end

    subgraph DB["PostgreSQL RLS"]
        POL["tenant_isolation policy\nUSING userId =\ncurrent_setting(app.current_user_id)"]
    end

    JWT --> CTX --> QUERY
    QUERY -->|checked against| POL

    note1["If app code forgets WHERE userId:\nRLS policy blocks the query.\nDefense-in-depth."]
```

**Shared vs global tables:**

| Table | Scoped to | RLS |
|-------|-----------|-----|
| Application, ResumeBlock, etc. | Per user | Enabled |
| StageEvent, Analysis, Reminder | Via Application join | Enabled |
| JobDescription | Global (content-addressed) | None |
| DiscoveredJob | Global (shared scrape) | None |
| UserJobScore | Per user | Enabled |

---

## Caching Strategy

```mermaid
flowchart LR
    subgraph Read["Read path"]
        REQ["GET /dashboard/funnel"] --> RHIT{Redis hit?\ndashboard:funnel:userId}
        RHIT -- yes --> RET["return cached JSON\n~0ms"]
        RHIT -- no --> DB2["query mv_user_funnel\n~2ms"]
        DB2 --> STORE["redis.setex TTL=900s"]
        STORE --> RET2["return result"]
    end

    subgraph Write["Write path (invalidation)"]
        CREATE["POST /applications"] --> INV["redis.del\ndashboard:funnel:userId\ndashboard:velocity:userId"]
        STAGE["PATCH stage change"] --> INV2["redis.del\ndashboard:funnel:userId"]
    end

    subgraph Cron["Cron (every 15 min)"]
        MV["REFRESH MATERIALIZED VIEW\nCONCURRENTLY mv_user_funnel"]
    end
```

| Cache key | TTL | Invalidated on |
|-----------|-----|----------------|
| `dashboard:funnel:{userId}` | 15 min | application create / stage change |
| `dashboard:velocity:{userId}` | 15 min | application create |
| `intel:skill-demand:{userId}` | 1 hour | — (TTL only) |
| `intel:clusters:{userId}` | 5 min | — (TTL only) |

---

## Background Worker Queues

```mermaid
flowchart TB
    subgraph Queues["BullMQ Queues (Redis-backed)"]
        Q1["jd-ingestion\nconcurrency: 3"]
        Q2["embedding\nconcurrency: 5"]
        Q3["pdf-render\nconcurrency: 2"]
        Q4["reminders\ncron: 0 8 * * *"]
        Q5["job-discovery\nconcurrency: 1"]
        Q6["dashboard-refresh\nevery: 15 min"]
    end

    subgraph Jobs["What each worker does"]
        Q1 --> J1["fetch URL via readability\nLLM parse → structured JSON\nstore JobDescription"]
        Q2 --> J2["embed rawText → vector[1536]\nstore in JobDescription.embedding"]
        Q3 --> J3["render ResumeVersion blocks\nto PDF via react-pdf\nupload to Cloudinary"]
        Q4 --> J4["scan Applications silent > 7 days\ngenerate follow-up email draft\ncreate Reminder rows"]
        Q5 --> J5["fetch 130+ careers pages\nextract job links\nupsert DiscoveredJob"]
        Q6 --> J6["REFRESH MATERIALIZED VIEW\nCONCURRENTLY mv_user_funnel"]
    end
```

---

## Key Design Decisions

| Decision | Choice | Alternative considered |
|----------|--------|----------------------|
| Service shape | Modular monolith, two processes (API + worker) | Microservices: no benefit at this scale, large ops overhead |
| Multi-tenancy | Shared schema + PostgreSQL RLS | Schema-per-tenant: 10× migration complexity; DB-per-tenant: cost-prohibitive |
| JD storage | Global content-addressed by jdHash | Per-user: duplicates LLM parse and embedding for shared jobs |
| FTS | Generated tsvector column + GIN index | Query-time `to_tsvector()`: O(n) full scan, no index |
| ANN search | HNSW | IVFFlat: requires upfront clustering, poor for dynamic inserts |
| Background jobs | BullMQ + Redis | In-process cron: no retries or observability; SQS/Lambda: cloud lock-in |
| LLM streaming | SSE | WebSockets: bidirectional not needed; SSE is simpler and proxy-friendly |
| Auth | JWT in httpOnly cookie + rotating refresh | localStorage: XSS-exposed; server sessions: fine but JWT handles stateless scaling |
| Soft deletes | `deletedAt` timestamp | Hard delete: no undo, no GDPR audit trail |
| Dashboard aggregation | Materialized view + Redis cache | Raw query on every request: O(rows) per page load |
