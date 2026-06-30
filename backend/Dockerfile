FROM node:20-bookworm-slim

WORKDIR /app

# Native deps for bcrypt + sharp (used by @xenova/transformers)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
EXPOSE 5001

CMD ["npm", "start"]
