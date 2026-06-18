# Pursuit

Pursuit is a job application tracker. It uses AI to perform gap analysis, tailor resumes, and generate interview preparation.

## Features

- **Application Tracking**: Track application progress, stages, and history events.
- **Job Description Ingestion**: Process job details from raw text or URLs using a background worker queue.
- **Gap Analysis**: Get real-time skill comparisons between resumes and job requirements streamed using Server-Sent Events (SSE).
- **Prep Generator**: Generate targeted interview questions and personalized preparation advice streamed using SSE.
- **Resume Tailoring**: Optimize resume blocks dynamically for matching roles.
- **Dashboard Funnel**: Monitor application statistics and progress metrics.

## Dev Setup

### Start Services
Start database and cache services:
```bash
docker compose up -d
```

### Run Server
The backend API runs on port 3001:
```bash
npm --prefix server install
npm --prefix server run dev
```
To process ingestion jobs, run the background worker:
```bash
npm --prefix server run dev:worker
```

### Run Client
The frontend application runs on port 5173:
```bash
npm --prefix client install
npm --prefix client run dev
```

### Running Tests
Execute the test suite using Vitest:
```bash
npm --prefix server run test
```

## Tech Stack

- **Backend**: Node.js, Express, Prisma (Postgres + pgvector)
- **Frontend**: React, Vite, TanStack Query
- **Worker & Caching**: BullMQ, Redis
- **AI Integration**: Anthropic Claude API
