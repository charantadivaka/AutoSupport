# Database Schema & Relational Design

This platform utilizes **PostgreSQL 16** with the **pgvector** extension managed via **Prisma ORM**.

## Entity Relationship Overview

```
 [User] (Customer / Agent / Admin)
   │  1:N
   ├──────► [Conversation]
   │          │  1:N
   │          ├──────► [Message] ◄────── 1:N ────── [MessageSource]
   │          │          │ 1:1                           │ N:1
   │          │          └──────► [Feedback]             │
   │          │                                          ▼
   │          └──────► [Ticket]                  [DocumentChunk]
   │                     │                              ▲ 1:N
   │                     │                              │
   │                     ▼                     [KnowledgeDocument]
   └──────────────► [AssignedAgent]                     ▲
                         │                              │ 1:N
                         └──────────────────────────────┴ (Creator)
```

---

## Entity Definitions & Indexes

### 1. `users`
| Column | Type | Constraints / Description |
|---|---|---|
| `id` | `UUID` | Primary Key, default UUID v4 |
| `name` | `VARCHAR` | User full name |
| `email` | `VARCHAR` | Unique index, normalized lowercase |
| `passwordHash` | `VARCHAR` | Argon2 or Bcrypt hash |
| `role` | `ENUM` | `CUSTOMER`, `AGENT`, `ADMIN` |
| `createdAt` | `TIMESTAMPTZ` | Timestamp of registration |
| `updatedAt` | `TIMESTAMPTZ` | Automatic update timestamp |

### 2. `conversations`
| Column | Type | Constraints / Description |
|---|---|---|
| `id` | `UUID` | Primary Key |
| `customerId` | `UUID` | Foreign Key -> `users.id` (Indexed, OnDelete: Cascade) |
| `status` | `ENUM` | `ACTIVE`, `WAITING_AGENT`, `RESOLVED` (Indexed) |
| `createdAt` | `TIMESTAMPTZ` | Session start time |
| `updatedAt` | `TIMESTAMPTZ` | Session activity time |

### 3. `messages`
| Column | Type | Constraints / Description |
|---|---|---|
| `id` | `UUID` | Primary Key |
| `conversationId` | `UUID` | Foreign Key -> `conversations.id` (Indexed, OnDelete: Cascade) |
| `sender` | `ENUM` | `CUSTOMER`, `AI`, `AGENT`, `SYSTEM` |
| `content` | `TEXT` | Message text content |
| `metadata` | `JSONB` | Tokens, processing latency, intent, confidence score |
| `createdAt` | `TIMESTAMPTZ` | Created timestamp |

### 4. `knowledge_documents`
| Column | Type | Constraints / Description |
|---|---|---|
| `id` | `UUID` | Primary Key |
| `title` | `VARCHAR` | Document title |
| `originalFilename` | `VARCHAR` | Original file name (e.g. `return_policy.pdf`) |
| `filePath` | `VARCHAR` | Local storage or S3 object key |
| `processingStatus` | `ENUM` | `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED` (Indexed) |
| `processingError` | `TEXT` | Failure diagnosis if extraction/embedding fails |
| `createdBy` | `UUID` | Foreign Key -> `users.id` (Admin user) |
| `createdAt` | `TIMESTAMPTZ` | Upload timestamp |
| `updatedAt` | `TIMESTAMPTZ` | Last update timestamp |

### 5. `document_chunks`
| Column | Type | Constraints / Description |
|---|---|---|
| `id` | `UUID` | Primary Key |
| `documentId` | `UUID` | Foreign Key -> `knowledge_documents.id` (Cascade) |
| `chunkIndex` | `INTEGER` | Order of chunk within document |
| `content` | `TEXT` | Chunk text payload |
| `pageNumber` | `INTEGER` | Source page for exact PDF citations |
| `embedding` | `vector(1536)` | pgvector cosine distance vector |
| `metadata` | `JSONB` | Section headings, token count |
| `createdAt` | `TIMESTAMPTZ` | Ingestion timestamp |

### 6. `tickets`
| Column | Type | Constraints / Description |
|---|---|---|
| `id` | `UUID` | Primary Key |
| `conversationId` | `UUID` | Optional Foreign Key -> `conversations.id` |
| `customerId` | `UUID` | Foreign Key -> `users.id` (Indexed) |
| `assignedAgentId` | `UUID` | Optional Foreign Key -> `users.id` (Indexed) |
| `subject` | `VARCHAR` | Ticket headline |
| `description` | `TEXT` | Escalation description |
| `category` | `VARCHAR` | AI Intent category (e.g., Billing, Refund) |
| `priority` | `ENUM` | `LOW`, `MEDIUM`, `HIGH`, `URGENT` (Indexed) |
| `status` | `ENUM` | `OPEN`, `IN_PROGRESS`, `WAITING_FOR_CUSTOMER`, `RESOLVED` (Indexed) |
| `conversationSummary` | `TEXT` | LLM-generated conversation synopsis |
| `resolutionNotes` | `TEXT` | Human agent resolution record |
| `createdAt` | `TIMESTAMPTZ` | Escalation timestamp |
| `updatedAt` | `TIMESTAMPTZ` | Status change timestamp |
| `resolvedAt` | `TIMESTAMPTZ` | Resolution timestamp |

### 7. `message_sources`
| Column | Type | Constraints / Description |
|---|---|---|
| `id` | `UUID` | Primary Key |
| `messageId` | `UUID` | Foreign Key -> `messages.id` (Cascade) |
| `documentChunkId` | `UUID` | Foreign Key -> `document_chunks.id` (Cascade) |
| `relevanceScore` | `FLOAT` | Cosine similarity score |
| `createdAt` | `TIMESTAMPTZ` | Attribution timestamp |

### 8. `feedback`
| Column | Type | Constraints / Description |
|---|---|---|
| `id` | `UUID` | Primary Key |
| `messageId` | `UUID` | Unique Foreign Key -> `messages.id` (Cascade) |
| `customerId` | `UUID` | Foreign Key -> `users.id` (Cascade) |
| `rating` | `INTEGER` | 1 (Thumbs Up) or -1 (Thumbs Down) |
| `comment` | `TEXT` | Optional user comment |
| `createdAt` | `TIMESTAMPTZ` | Feedback timestamp |
