# Pursuit

A job application tracker with AI-powered gap analysis, resume tailoring, and prep generation.

## Dev setup

```bash
# Start services
docker compose up -d

# Server (port 3001)
npm --prefix server install
npm --prefix server run dev

# Client (port 5173)
npm --prefix client install
npm --prefix client run dev
```

## Stack

- **Server**: Express + TypeScript + Prisma (Postgres + pgvector)
- **Queue**: BullMQ + Redis
- **Client**: React 18 + Vite + TanStack Query
- **AI**: Anthropic Claude (gap analysis, prep, tailoring)
