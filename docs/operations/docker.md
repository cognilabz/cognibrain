# Docker Deployment

Cognibrain provides optional Docker packaging for containerized deployments. Docker is not required — it's an alternative to native service installation.

## Quick Start

```bash
# Build
docker build -f docker/Dockerfile -t cognibrain:latest .

# Run
docker run -d \
  --name cognibrain \
  -p 8787:8787 \
  -e MEMORY_API_KEY=your-key \
  -e MEMORY_POSTGRES_URL=postgresql://user:pass@host:5432/cognibrain \
  -v cognibrain-data:/app/.cognibrain \
  cognibrain:latest
```

## Docker Compose

```yaml
version: "3.9"

services:
  cognibrain:
    build:
      context: .
      dockerfile: docker/Dockerfile
    ports:
      - "8787:8787"
    environment:
      MEMORY_API_KEY: ${MEMORY_API_KEY}
      MEMORY_POSTGRES_URL: postgresql://cognibrain:secret@postgres:5432/cognibrain
      MEMORY_POLICY_MODE: production
    volumes:
      - cognibrain-data:/app/.cognibrain
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: cognibrain
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: cognibrain
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U cognibrain"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  cognibrain-data:
  postgres-data:
```

## Kubernetes

Deployment manifests are provided under `deploy/`:

### Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cognibrain
  labels:
    app: cognibrain
spec:
  replicas: 1
  selector:
    matchLabels:
      app: cognibrain
  template:
    metadata:
      labels:
        app: cognibrain
    spec:
      containers:
        - name: cognibrain
          image: cognibrain:latest
          ports:
            - containerPort: 8787
          env:
            - name: MEMORY_API_KEY
              valueFrom:
                secretKeyRef:
                  name: cognibrain-secrets
                  key: api-key
            - name: MEMORY_POSTGRES_URL
              valueFrom:
                secretKeyRef:
                  name: cognibrain-secrets
                  key: postgres-url
            - name: MEMORY_POLICY_MODE
              value: "production"
          livenessProbe:
            httpGet:
              path: /api/health
              port: 8787
            initialDelaySeconds: 10
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /api/health
              port: 8787
            initialDelaySeconds: 5
            periodSeconds: 10
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "500m"
```

### Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: cognibrain
spec:
  selector:
    app: cognibrain
  ports:
    - port: 8787
      targetPort: 8787
  type: ClusterIP
```

### Secret

```bash
kubectl create secret generic cognibrain-secrets \
  --from-literal=api-key=your-secure-key \
  --from-literal=postgres-url=postgresql://user:pass@postgres:5432/cognibrain
```

## Health Checks

The container exposes a health endpoint:

```bash
curl http://localhost:8787/api/health
```

Response:

```json
{
  "status": "healthy",
  "memoryCount": 42,
  "uptime": 86400,
  "version": "0.1.0"
}
```

## Volumes

| Mount Point | Purpose |
|------------|---------|
| `/app/.cognibrain` | Runtime state, logs, local config |

For PostgreSQL-backed deployments, the volume mainly holds logs and connector state. Memory data lives in the database.

## Environment Variables

All [configuration environment variables](../reference/configuration.md) work in Docker. Key ones for container deployments:

| Variable | Required | Description |
|----------|----------|-------------|
| `MEMORY_API_KEY` | Yes | API authentication |
| `MEMORY_POSTGRES_URL` | Recommended | Database connection |
| `MEMORY_POLICY_MODE` | Recommended | Set to `production` |
| `COGNIBRAIN_HOST` | No | Bind to `0.0.0.0` for container access |
| `COGNIBRAIN_PORT` | No | Default `8787` |

!!! tip "Bind address"
    In containers, set `COGNIBRAIN_HOST=0.0.0.0` to accept connections from outside the container.
