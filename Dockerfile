FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend .
RUN npm run build

FROM python:3.11-slim AS backend-builder
WORKDIR /app/backend
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend .

FROM nginx:alpine
COPY --from=frontend-builder /app/frontend/dist /usr/share/nginx/html
COPY --from=backend-builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=backend-builder /app/backend /app/backend

RUN apk add --no-cache python3 py3-pip supervisor && \
    mkdir -p /app/data /etc/supervisor.d

COPY supervisord.conf /etc/supervisor.d/app.ini
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["supervisord", "-n"]
