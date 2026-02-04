# Build stage
FROM node:20-alpine AS builder

RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy only what's needed
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

RUN mkdir -p /app/data

EXPOSE 3001
ENV NODE_ENV=production
ENV PORT=3001
ENV DATABASE_PATH=/app/data/klaude.db

CMD ["npm", "start"]
