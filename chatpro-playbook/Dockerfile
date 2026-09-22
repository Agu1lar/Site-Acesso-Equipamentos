FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY data ./data

ENV PLAYBOOK_WHISPER=off
ENV NODE_ENV=production

CMD ["npx", "tsx", "src/after-hours-run.ts", "--live"]
