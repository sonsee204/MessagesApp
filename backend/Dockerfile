# ==============================================================================
# Stage 1: Dependencies
# ==============================================================================
FROM node:20-alpine AS deps
WORKDIR /app

# Cài đặt công cụ build cho các module native C++ (như bcrypt)
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json* ./
RUN npm ci

# ==============================================================================
# Stage 2: Builder
# ==============================================================================
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY src ./src

RUN npm run build

# ==============================================================================
# Stage 3: Runner (Production)
# ==============================================================================
FROM node:20-alpine AS runner
WORKDIR /app

# Cài đặt runtime dependencies cho module native
RUN apk add --no-cache python3 make g++

ENV NODE_ENV=production
ENV PORT=5000

# Install production dependencies only
COPY package.json package-lock.json* ./
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Security: Run as non-root user
USER node

EXPOSE 5000

CMD ["node", "dist/server.js"]
