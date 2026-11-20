# Stage 1: install production dependencies only
FROM node:26-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Stage 2: run the tests (build it on purpose with --target test)
FROM node:26-alpine AS test
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm test

# Stage 3: the image you ship
FROM node:26-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
# Files stay owned by root, so the app user can read them but not change them
COPY --from=deps /app/node_modules ./node_modules
COPY package.json healthcheck.js ./
COPY src ./src
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD ["node", "healthcheck.js"]
CMD ["node", "src/server.js"]
