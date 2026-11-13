FROM node:24-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --ignore-scripts
COPY frontend ./
RUN npm run build

FROM node:24-alpine
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY backend/src ./src
COPY backend/scripts ./scripts
COPY backend/database ./database
COPY backend/docs ./docs
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist
USER node
CMD ["node", "src/services/gateway/server.js"]
