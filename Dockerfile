# Production Dockerfile for Narrative Agent
FROM node:20-alpine

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy package files and install production deps
COPY package*.json ./
COPY packages/serve/package*.json ./packages/serve/
RUN npm ci --only=production && \
    npm cache clean --force

# Copy application files
COPY packages/serve/*.js ./packages/serve/
COPY packages/serve/*.html ./packages/serve/

# Change ownership to nodejs user
RUN chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if(r.statusCode !== 200) process.exit(1);});" || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "packages/serve/web-app.js"]
