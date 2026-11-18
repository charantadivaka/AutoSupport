# ==============================================================================
# AutoSupport AI - Frontend Multi-Stage Dockerfile (Next.js 16 App Router)
# ==============================================================================

# Stage 1: Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency specifications
COPY package*.json ./
RUN npm ci

# Copy source code and configuration files
COPY tsconfig.json next.config.ts eslint.config.mjs ./
COPY public ./public/
COPY app ./app/
COPY lib ./lib/
COPY context ./context/

# Build arguments for compile-time environment variables
ARG NEXT_PUBLIC_API_URL=http://localhost:4000/api
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NODE_ENV=production

# Compile Next.js production build
RUN npm run build

# ==============================================================================
# Stage 2: Production runner stage
# ==============================================================================
FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache dumb-init curl

ENV NODE_ENV=production
ENV PORT=3000

# Copy package manifests and install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy public static assets and built next directory from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/next.config.ts ./

# Run as non-root user
USER node

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000 || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "run", "start"]
