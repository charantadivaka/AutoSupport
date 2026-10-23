# AutoSupport AI - Enterprise Gen-AI Customer Support Automation Platform

A production-style, placement-ready AI Customer Support platform built with **Next.js (App Router)**, **NestJS**, **PostgreSQL with pgvector**, and **Retrieval-Augmented Generation (RAG)**.

---

## 🌟 Key Features

- **Document-Grounded RAG**: Ingests company policy & product documents (PDF / plain-text), chunks content with preserved metadata, and generates embeddings for high-precision semantic search.
- **Strict Verifiable Citations**: Returns grounded answers with document title, page numbers, and cosine similarity scores. Prevents policy hallucinations.
- **Intelligent Intent Classification & Escalation**: Classifies customer queries, checks evidence sufficiency, and deterministically creates support tickets when confidence is insufficient or human intervention is required.
- **Three Dedicated Portals**:
  - **Customer Portal**: Interactive AI chat, previous conversations, feedback rating, and manual agent escalation.
  - **Support Agent Dashboard**: Escalation inbox, AI conversation summaries, knowledge sources, and ticket resolution workflows.
  - **Administrator Dashboard**: Knowledge document ingestion, chunk inspection, feedback analytics, and vector index monitoring.
- **Production-Grade Architecture**: Modular monolith, Swagger OpenAPI documentation, DTO request validation, and role-based access control (RBAC).

---

## 🏗️ Technology Stack

| Domain | Technology | Description |
|---|---|---|
| **Frontend** | Next.js 16 (App Router), React, TypeScript | Modern server/client architecture, Tailwind CSS, Lucide icons |
| **Backend** | NestJS 10, TypeScript, Express | Modular monolith REST API, Swagger OpenAPI, class-validator DTOs |
| **Database** | PostgreSQL 16, pgvector, Prisma ORM | Relational schema with vector similarity indexes (`vector(1536)`) |
| **Gen-AI / RAG** | Provider-Agnostic LLM Interface | Supports Google Gemini / OpenAI / Anthropic models |
| **Infrastructure** | Docker & Docker Compose | Containerized pgvector PostgreSQL and Redis |
| **Quality** | Jest, ESLint, TypeScript | Unit and integration test suites |

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js**: v20+ (v22.14 verified)
- **npm**: v10+ (v11.17 verified)
- **Docker Desktop** (optional for containerized pgvector and Redis)

### 2. Environment Setup
```bash
# Copy example environment files
cp .env.example .env
cp .env.example backend/.env
```

### 3. Option A: Run Full Stack with Docker Compose (Recommended)
```bash
# Build and run Postgres (pgvector), Redis, NestJS Backend, and Next.js Frontend
docker compose up --build -d

# Run database migrations
docker compose exec backend npx prisma migrate deploy
```
- Frontend Portal: `http://localhost:3000`
- API Gateway & Swagger Docs: `http://localhost:4000/api/docs`
- Health Probe: `http://localhost:4000/api/health`

*(See [`docs/deployment.md`](docs/deployment.md) for full container architecture and configuration details).*

### 4. Option B: Native Local Development

**Start Data Layer Only:**
```bash
docker compose up postgres redis -d
```
> **Note**: Runs PostgreSQL with `pgvector` on host port `5433` (`5433:5432`) to prevent conflicts with local instances.

**Run Backend (NestJS):**
```bash
cd backend
npm install
npx prisma generate
npm run start:dev
```

**Run Frontend (Next.js):**
```bash
cd frontend
npm install
npm run dev
```

---

## 🧪 Verification & Testing

```bash
# Run backend test suite
npm run test:backend

# Build backend and frontend bundles
npm run build
```

GitHub Actions (`.github/workflows/ci.yml`) runs the same backend tests/build and the frontend lint/build on every push and pull request. The CI job uses `LLM_PROVIDER=mock` so it never calls a paid LLM API.

---

## 📁 Repository Structure

```
ai-customer-support/
├── backend/                  # NestJS REST API server
│   ├── prisma/               # Prisma schema & migrations
│   │   └── schema.prisma     # 8 core relational entities + pgvector
│   ├── src/
│   │   ├── app.module.ts     # Root module
│   │   ├── main.ts           # Bootstrap, Swagger, CORS, Validation
│   │   ├── health/           # Health probe & DB connectivity test
│   │   ├── prisma/           # Prisma client service
│   │   └── common/           # Error filters, interceptors, guards
│   └── test/                 # Test suites
├── frontend/                 # Next.js 16 App Router UI
│   ├── app/                  # App Router pages and layout
│   │   ├── layout.tsx        # Root layout with Inter typography
│   │   ├── page.tsx          # Interactive architecture & health portal
│   │   └── globals.css       # Tailwind CSS styles
│   └── public/               # Static assets
├── docs/                     # Placement documentation
│   ├── architecture.md       # High-level architecture & design decisions
│   └── database-schema.md    # Relational entity definitions & indexes
├── docker-compose.yml        # PostgreSQL + pgvector (5433) & Redis (6379)
├── .env.example              # Blueprint of all environment secrets
├── PROJECT_PROGRESS.md       # Phase checklist and verification logs
└── README.md                 # Project documentation
```

---

## 🎓 Placement Interview Highlights

1. **Why Modular Monolith over Microservices?** Eliminates distributed transaction latency and network failure modes while maintaining clean bounded contexts.
2. **Why pgvector inside PostgreSQL?** Enables atomic relational queries linking vector embeddings directly to source documents and users without separate vector database synchronizations.
3. **Deterministic Grounding & Guardrails**: RAG pipeline treats retrieved documents as untrusted data, requiring verbatim citation spans and escalating to humans when confidence thresholds are unmet.
