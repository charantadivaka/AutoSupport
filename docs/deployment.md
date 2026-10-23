# Deployment Guide: AutoSupport AI Enterprise Platform

This guide outlines deployment procedures for both containerized environments (Docker Compose / Kubernetes) and native multi-process bare metal environments.

---

## 1. Quick Start with Docker Compose (Full Stack)

The entire platform—including PostgreSQL 16 with the `pgvector` extension, Redis 7, the NestJS API gateway, and Next.js 16 frontend—can be launched with a single command.

### Prerequisites
- Docker Engine 24.0+
- Docker Compose v2.20+

### Step 1: Environment Setup
Copy the template configuration:
```bash
cp .env.example .env
```

Review or modify `.env` to supply production secrets:
```env
JWT_SECRET=your-secure-random-64-character-jwt-secret
LLM_PROVIDER=gemini # or "openai" | "mock"
GEMINI_API_KEY=your-gemini-key
OPENAI_API_KEY=your-openai-key
```

### Step 2: Build & Start All Containers
```bash
docker compose up --build -d
```

### Step 3: Run Database Migrations in the Container
Once the PostgreSQL and Backend containers are healthy:
```bash
docker compose exec backend npx prisma migrate deploy
```

### Step 4: Verify Health & Service Endpoints
- **Frontend Portal**: [http://localhost:3000](http://localhost:3000)
- **Backend API Gateway**: [http://localhost:4000/api](http://localhost:4000/api)
- **Swagger OpenAPI Docs**: [http://localhost:4000/api/docs](http://localhost:4000/api/docs)
- **System Health Probe**: [http://localhost:4000/api/health](http://localhost:4000/api/health)

---

## 2. Service Architecture in Docker

| Container | Image / Base | Internal Port | Host Port | Purpose |
|---|---|---|---|---|
| `autosupport-postgres` | `pgvector/pgvector:pg16` | 5432 | 5433 | Relational database + 1536-dim vector store |
| `autosupport-redis` | `redis:7-alpine` | 6379 | 6379 | Rate limiter cache & idempotency store |
| `autosupport-backend` | `node:20-slim` | 4000 | 4000 | NestJS REST API, RAG Engine & LLM Gateway |
| `autosupport-frontend` | `node:20-alpine` | 3000 | 3000 | Next.js 16 App Router UI Portal |

---

## 3. Native Local Development Setup

For rapid development with hot-reloading:

### 1. Start Infrastructure Only
```bash
docker compose up postgres redis -d
```
*(Runs Postgres on port 5433 and Redis on port 6379).*

### 2. Configure Backend
```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run start:dev
```

### 3. Configure Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## 4. Production Security & Hardening Checklist

- [x] **Non-Root Container Users**: Backend runs under `USER node`, Frontend runs under `USER node`.
- [x] **Dumb-Init Process Supervision**: PID 1 signal forwarding preventing zombie processes.
- [x] **Multi-Stage Builds**: Development tooling, source files, and build caches are excluded from runtime images.
- [x] **Named Rate Limiter Buckets**: `@nestjs/throttler` configured with 60 req/min general, 10 req/min AI, and 10 req/min auth endpoints.
- [x] **Prompt Injection Defense**: Multi-tier guardrails with regex scanners and untrusted context boundary wrappers.
- [x] **CORS & Security Headers**: Helmet middleware enabled with strict X-Frame-Options, HSTS, and XSS protection.
- [x] **Idempotency Safeguards**: Prevent duplicate ticket creation during network retries using active ticket lookups and header caching.
