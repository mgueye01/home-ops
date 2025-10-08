# Build stage - clone official repository
FROM node:20-alpine AS builder

WORKDIR /app

# Clone official mhenry3164 repository
RUN apk add --no-cache git && \
    git clone https://github.com/mhenry3164/twenty-crm-mcp-server.git . && \
    npm ci --omit=dev

# Runtime stage
FROM node:20-alpine

WORKDIR /app

# Copy from builder
COPY --from=builder /app /app

# Add Express for HTTP/SSE wrapper
RUN npm install --omit=dev express@4.21.2 cors@2.8.5

# Copy HTTP wrapper
COPY server-wrapper.js .

# Create non-root user (node user already exists in alpine)
USER node

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

CMD ["node", "server-wrapper.js"]
