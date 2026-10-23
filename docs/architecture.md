# System Architecture: AI Customer Support Automation Platform

## 1. High-Level Architectural Overview

AutoSupport AI is architected as an **enterprise modular monolith** designed for high cohesion, rapid development, type safety, and seamless interview explainability. It avoids premature microservice overhead while enforcing strict domain boundary separation between modules.

```
                          [ Web Client / Next.js 16 App Router ]
                                         │
                                   REST / JSON (CORS)
                                         ▼
                     ┌───────────────────────────────────────┐
                     │         NestJS Backend Gateway        │
                     │  - Global ValidationPipe (DTOs)       │
                     │  - Swagger OpenAPI Generator          │
                     │  - Global AllExceptionsFilter         │
                     │  - JWT & RBAC Guards                  │
                     └───────────────────┬───────────────────┘
                                         │
        ┌────────────────────────────────┼────────────────────────────────┐
        ▼                                ▼                                ▼
┌─────────────────┐             ┌─────────────────┐             ┌─────────────────┐
│   Auth & User   │             │  Conversations  │             │   Knowledge &   │
│     Module      │             │   & Messages    │             │   RAG Engine    │
└─────────────────┘             └────────┬────────┘             └────────┬────────┘
                                         │                               │
                                         ▼                               ▼
                                ┌─────────────────┐             ┌─────────────────┐
                                │ Human Escalation│             │ LLM Provider    │
                                │  Ticket Module  │             │ Abstraction     │
                                └─────────────────┘             └─────────────────┘
                                         │                               │
                                         └───────────────┬───────────────┘
                                                         │
                                                         ▼
                                            ┌─────────────────────────┐
                                            │      Prisma Service     │
                                            └────────────┬────────────┘
                                                         │
                                    ┌────────────────────┴────────────────────┐
                                    ▼                                         ▼
                    ┌───────────────────────────────┐         ┌───────────────────────────────┐
                    │  PostgreSQL 16 Relational DB  │         │   pgvector (Cosine Distance)  │
                    │  - Users, Conversations,      │         │   - 1536-dim embeddings       │
                    │    Tickets, Feedback          │         │   - Document Chunks           │
                    └───────────────────────────────┘         └───────────────────────────────┘
```

---

## 2. Core Architectural Principles

### A. Modular Monolith vs. Microservices
- **Monolith with Clean Modules**: By organizing features into NestJS modules (`auth`, `users`, `conversations`, `messages`, `ai`, `knowledge-base`, `tickets`, `analytics`), we maintain single-repo deployment velocity, atomic database transactions, and zero distributed-network latency.
- **Provider-Agnostic AI Interface**: The backend communicates with LLMs through an abstraction layer (`AiService`), permitting seamless switching between OpenAI, Google Gemini, Anthropic, or local open-weights models without rewriting domain logic.

### B. Security & Guardrails
- **Prompt Injection Defense (layered)**:
  1. `GuardrailsService` regex scan on customer messages before the LLM is called.
  2. Retrieved knowledge chunks are wrapped as `UNTRUSTED_KNOWLEDGE_BASE_CONTENT` so document text cannot act as instructions.
  3. Model output is constrained to structured JSON enums; the backend still decides escalation independently.
- **Rate limiting**: `@nestjs/throttler` with named buckets (`default` 60/min, `ai` 10/min, `auth` 10/min). Health checks are skipped.
- **Upload hardening**: extension + MIME allowlists, 10MB cap, path-traversal rejection, PDF magic-byte check, before disk write.
- **Idempotency**: active-ticket lookup per conversation plus optional `Idempotency-Key` header replay cache for `POST /api/tickets`.
- **Strict Authorization at Data Layer**: Every conversation, ticket, and message query is filtered by `customerId` or `assignedAgentId` verified from the cryptographically validated JWT session. Frontend checks are treated solely as UX conveniences.

### C. Reliability
- **Structured logging**: pino JSON logs with secret redaction, plus `X-Request-Id` correlation.
- **LLM timeouts and retries**: `AiService` wraps provider calls with a timeout (default 20s) and retries only transient errors (429, 5xx, network). Permanent 4xx errors are not retried. Failures fall back to `MockAiProvider`, then to a stored system message and a support ticket so the customer message is never discarded.
- **Database connect retries**: Prisma attempts three connections at startup and reports `degraded` from `/api/health` instead of crashing the process.

### D. Deterministic Grounding & Escalation
- **Grounding Verification**: The model must provide verbatim text spans and source chunk IDs. If cosine similarity between the query embedding and nearest chunk falls below the calibrated threshold, or the model detects policy ambiguities, the system initiates deterministic human escalation rather than hallucinating answers.
