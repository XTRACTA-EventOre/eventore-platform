FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY src ./src
COPY scripts ./scripts
COPY database ./database
COPY docs/openapi.json ./docs/openapi.json
USER node
CMD ["node", "src/services/gateway/server.js"]
