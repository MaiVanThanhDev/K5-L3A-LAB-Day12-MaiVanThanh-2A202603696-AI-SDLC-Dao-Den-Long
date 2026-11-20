# Đảo Đèn Lồng v1.0.0 — web build served by the bundled Node server.
#   docker build -t dao-den-long:1.0.0 .
#   docker run --rm -p 5173:5173 -v ddl-data:/app/data dao-den-long:1.0.0      → http://localhost:5173
# The leaderboard is stored in /app/data (mount a volume to keep it). Export:
#   docker run --rm -v ddl-data:/app/data -v "$PWD":/out dao-den-long:1.0.0 node server.js --export-leaderboard /out/leaderboard.json
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY game.contract.json server.js ./
COPY src ./src
COPY web ./web
COPY scripts ./scripts
COPY tests ./tests
ENV PORT=5173
EXPOSE 5173
VOLUME ["/app/data"]
CMD ["node", "server.js"]
