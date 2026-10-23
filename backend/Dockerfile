# ==============================================================================
# AutoSupport AI - Backend Multi-Stage Dockerfile (NestJS + Prisma)
# ==============================================================================

# Stage 1: Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Install OpenSSL for Prisma engine binary compilation
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Copy dependency specifications
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies needed for build)
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Copy source code and build configs
COPY tsconfig*.json nest-cli.json ./
COPY src ./src/

# Compile TypeScript to JavaScript in /app/dist
RUN npm run build

# ==============================================================================
# Stage 2: Production runner stage
# ==============================================================================
FROM node:20-slim AS runner

WORKDIR /app

# Install OpenSSL and dumb-init for production process signal handling
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates dumb-init curl && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=4000

# Copy package manifests and install only production dependencies
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev

# Generate Prisma Client for the production node environment
RUN npx prisma generate

# Copy compiled application from builder
COPY --from=builder /app/dist ./dist

# Create uploads directory and set permissions for non-root node user
RUN mkdir -p /app/uploads && chown -R node:node /app

USER node

EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:4000/api/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main"]
