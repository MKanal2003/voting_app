# 📖 Voting App — Operations Runbook

**Project:** Distributed Voting Application  
**Author:** Mallikarjuna Kanal  
**Version:** 1.0  
**Last Updated:** 2025  

---

## 📋 Table of Contents

1. [System Overview](#1-system-overview)
2. [Start / Stop Procedures](#2-start--stop-procedures)
3. [Troubleshooting & Fixes](#3-troubleshooting--fixes)
4. [Monitoring & Alerts](#4-monitoring--alerts)
5. [Backup & Recovery](#5-backup--recovery)
6. [CI/CD Operations](#6-cicd-operations)
7. [Emergency Contacts & Escalation](#7-emergency-contacts--escalation)

---

## 1. System Overview

### Architecture

```
                    ┌─────────────────────────────────┐
                    │         front-tier network        │
  [Browser:8080] ──▶│  Vote App (Flask)                │
  [Browser:8081] ──▶│  Result App (Node.js+Socket.io)  │
                    └──────────────┬──────────────────┘
                                   │
                    ┌──────────────▼──────────────────┐
                    │         back-tier network         │
                    │  Redis     (queue)   :6379        │
                    │  Worker    (.NET)    internal     │
                    │  PostgreSQL (db)     :5432        │
                    └─────────────────────────────────┘
```

### Service Inventory

| Service | Image | Port | Role |
|---|---|---|---|
| vote | mkanal/vote:latest | 8080 (Compose) / 31000 (K8s) | Voting frontend |
| result | mkanal/result:latest | 8081 (Compose) / 31001 (K8s) | Live results |
| worker | mkanal/worker:latest | none | Vote processor |
| redis | redis:alpine | 6379 | Message queue |
| db | postgres:15-alpine | 5432 | Database |

### Service Dependencies

```
redis  ──▶  vote   (vote waits for redis healthy)
redis  ──▶  worker (worker waits for redis healthy)
db     ──▶  result (result waits for db healthy)
db     ──▶  worker (worker waits for db healthy)
```

---

## 2. Start / Stop Procedures

---

### 2.1 Docker Compose — Start

#### Normal Start
```bash
cd /path/to/voting_app

# Start all services
docker compose up -d

# Verify all containers are running
docker compose ps
```

#### Expected Output
```
NAME                  STATUS           PORTS
vote_app-vote-1       Up (healthy)     0.0.0.0:8080->80/tcp
vote_app-result-1     Up               0.0.0.0:8081->80/tcp
vote_app-worker-1     Up
vote_app-db-1         Up (healthy)     0.0.0.0:5432->5432/tcp
vote_app-redis-1      Up (healthy)     0.0.0.0:6379->6379/tcp
```

#### First Time Start (with build)
```bash
docker compose up --build -d
```

#### Start with Test Data
```bash
docker compose --profile seed up -d
```

#### Start with Monitoring Stack
```bash
docker compose --profile monitoring up -d
```

---

### 2.2 Docker Compose — Stop

#### Graceful Stop (keeps data)
```bash
docker compose down
```

#### Stop + Remove Volumes (DELETES ALL DATA ⚠️)
```bash
docker compose down -v
```

#### Stop Single Service
```bash
docker compose stop vote
docker compose stop result
docker compose stop worker
```

#### Restart Single Service
```bash
docker compose restart vote
docker compose restart worker
docker compose restart result
```

---

### 2.3 Kubernetes — Start

#### Deploy Everything
```bash
# Deploy infrastructure first
kubectl apply -f k8s-specifications/redis-deployment.yaml
kubectl apply -f k8s-specifications/redis-service.yaml
kubectl apply -f k8s-specifications/db-deployment.yaml
kubectl apply -f k8s-specifications/db-service.yaml

# Wait for infra to be ready
kubectl wait --for=condition=ready pod -l app=redis --timeout=60s
kubectl wait --for=condition=ready pod -l app=db --timeout=60s

# Deploy applications
kubectl apply -f k8s-specifications/vote-deployment.yaml
kubectl apply -f k8s-specifications/vote-service.yaml
kubectl apply -f k8s-specifications/worker-deployment.yaml
kubectl apply -f k8s-specifications/result-deployment.yaml
kubectl apply -f k8s-specifications/result-service.yaml
```

#### Deploy All at Once
```bash
kubectl apply -f k8s-specifications/
```

#### Verify Everything is Running
```bash
kubectl get pods
kubectl get services
kubectl get deployments
```

#### Expected Output
```
NAME                       READY   STATUS    RESTARTS
db-xxxxxxxxxx-xxxxx        1/1     Running   0
redis-xxxxxxxxxx-xxxxx     1/1     Running   0
vote-xxxxxxxxxx-xxxxx      1/1     Running   0
vote-xxxxxxxxxx-xxxxx      1/1     Running   0
worker-xxxxxxxxxx-xxxxx    1/1     Running   0
result-xxxxxxxxxx-xxxxx    1/1     Running   0
```

---

### 2.4 Kubernetes — Stop

#### Remove All Resources
```bash
kubectl delete -f k8s-specifications/
```

#### Remove Single Deployment
```bash
kubectl delete deployment vote
kubectl delete deployment worker
kubectl delete deployment result
```

#### Scale Down (keep deployment, stop pods)
```bash
kubectl scale deployment vote --replicas=0
kubectl scale deployment result --replicas=0
kubectl scale deployment worker --replicas=0
```

#### Scale Back Up
```bash
kubectl scale deployment vote --replicas=2
kubectl scale deployment result --replicas=1
kubectl scale deployment worker --replicas=1
```

---

### 2.5 Health Check URLs

| Service | Health Check |
|---|---|
| Vote App | http://localhost:8080 |
| Result App | http://localhost:8081 |
| Prometheus | http://localhost:9090 |
| Grafana | http://localhost:3000 |
| Redis | `docker exec vote_app-redis-1 redis-cli ping` |
| PostgreSQL | `docker exec vote_app-db-1 pg_isready -U postgres` |

---

## 3. Troubleshooting & Fixes

---

### 3.1 Vote App Issues

#### Problem: localhost:8080 — Connection Refused
```
Symptom: ERR_CONNECTION_REFUSED in browser
```

**Step 1 — Check if container is running:**
```bash
docker compose ps vote
```

**Step 2 — Check logs:**
```bash
docker compose logs vote
```

**Step 3 — If container is not running, restart it:**
```bash
docker compose restart vote
```

**Step 4 — If Redis is not ready:**
```bash
docker compose logs redis
# If Redis is unhealthy, restart it
docker compose restart redis
# Then restart vote
docker compose restart vote
```

---

#### Problem: Vote App Crashes with Redis Connection Error
```
Symptom: redis.exceptions.ConnectionError in vote logs
```

**Fix:**
```bash
# Restart Redis first, then vote
docker compose restart redis
sleep 5
docker compose restart vote
```

---

#### Problem: Gunicorn Worker Timeout
```
Symptom: [CRITICAL] WORKER TIMEOUT in vote logs
```

**Fix — increase timeout in vote/Dockerfile CMD:**
```dockerfile
CMD ["gunicorn", "app:app", "-b", "0.0.0.0:80", 
     "--log-file", "-", 
     "--access-logfile", "-", 
     "--workers", "4", 
     "--keep-alive", "0",
     "--timeout", "120"]
```

---

### 3.2 Result App Issues

#### Problem: localhost:8081 — Blank White Page
```
Symptom: Page loads but stays white, no content visible
```

**Step 1 — Check browser console (F12):**
```
Look for red errors in Console tab
```

**Step 2 — Check result logs:**
```bash
docker compose logs result
```

**Step 3 — Verify Socket.io files exist:**
```bash
ls result/views/
# Must have: socket.io.js, angular.min.js (if using Angular)
```

**Step 4 — Check Postgres connection:**
```bash
docker compose logs result | grep "Connected\|Waiting\|Error"
```

**Fix if waiting for DB:**
```bash
docker compose restart db
sleep 10
docker compose restart result
```

---

#### Problem: Results Not Updating in Real Time
```
Symptom: Page shows but numbers never change
```

**Check worker is processing votes:**
```bash
docker compose logs worker | tail -20
# Should see: "Processing vote for 'a' by 'voter123'"
```

**Check Redis queue:**
```bash
docker exec vote_app-redis-1 redis-cli LLEN votes
# If always > 0, worker is not consuming
```

**Fix:**
```bash
docker compose restart worker
```

---

### 3.3 Worker Issues

#### Problem: Worker Keeps Restarting
```
Symptom: RESTARTS count increasing in docker compose ps
```

**Check logs:**
```bash
docker compose logs worker
```

**Common cause — DB not ready:**
```bash
# Worker has built-in retry, but if Postgres is down:
docker compose restart db
sleep 15
docker compose restart worker
```

**Common cause — Redis not ready:**
```bash
docker compose restart redis
sleep 5
docker compose restart worker
```

---

#### Problem: Votes Not Being Saved to Database
```
Symptom: Votes appear to work but results show 0
```

**Step 1 — Check Redis queue is receiving votes:**
```bash
docker exec vote_app-redis-1 redis-cli LRANGE votes 0 -1
```

**Step 2 — Check worker logs:**
```bash
docker compose logs worker | grep "Processing\|Error"
```

**Step 3 — Check DB directly:**
```bash
docker exec -it vote_app-db-1 psql -U postgres -c "SELECT * FROM votes LIMIT 10;"
```

**Step 4 — Check DB table exists:**
```bash
docker exec -it vote_app-db-1 psql -U postgres -c "\dt"
# Should show: votes table
```

---

### 3.4 Redis Issues

#### Problem: Redis Healthcheck Failing
```
Symptom: redis shows "unhealthy" in docker compose ps
```

**Check:**
```bash
docker compose logs redis
docker exec vote_app-redis-1 redis-cli ping
# Should return: PONG
```

**Fix:**
```bash
docker compose restart redis
```

---

#### Problem: Redis Out of Memory
```
Symptom: OOM command not allowed when used memory > maxmemory
```

**Check memory usage:**
```bash
docker exec vote_app-redis-1 redis-cli INFO memory | grep used_memory_human
```

**Flush queue (CAUTION — loses unprocessed votes):**
```bash
docker exec vote_app-redis-1 redis-cli DEL votes
```

---

### 3.5 PostgreSQL Issues

#### Problem: DB Container Unhealthy
```
Symptom: db shows "unhealthy" in docker compose ps
```

**Check:**
```bash
docker compose logs db
docker exec vote_app-db-1 pg_isready -U postgres
```

**Fix:**
```bash
docker compose restart db
```

---

#### Problem: Too Many Connections
```
Symptom: FATAL: remaining connection slots are reserved
```

**Check connections:**
```bash
docker exec -it vote_app-db-1 psql -U postgres \
  -c "SELECT count(*) FROM pg_stat_activity;"
```

**Kill idle connections:**
```bash
docker exec -it vote_app-db-1 psql -U postgres -c "
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
AND state_change < now() - interval '10 minutes';"
```

---

### 3.6 Kubernetes Troubleshooting

#### Pod in CrashLoopBackOff
```bash
# Get pod name
kubectl get pods

# Check logs
kubectl logs <pod-name>
kubectl logs <pod-name> --previous  # logs from crashed container

# Describe for events
kubectl describe pod <pod-name>
```

#### Pod Stuck in Pending
```bash
kubectl describe pod <pod-name>
# Look for "Events" section at bottom
# Common cause: insufficient resources
```

#### Service Not Accessible
```bash
# Check service exists
kubectl get svc

# Check endpoints
kubectl get endpoints vote

# Check pod labels match service selector
kubectl get pods --show-labels
```

#### Rolling Restart
```bash
kubectl rollout restart deployment/vote
kubectl rollout restart deployment/worker
kubectl rollout restart deployment/result

# Check rollout status
kubectl rollout status deployment/vote
```

#### Rollback to Previous Version
```bash
kubectl rollout undo deployment/vote
kubectl rollout undo deployment/vote --to-revision=2
```

---

## 4. Monitoring & Alerts

---

### 4.1 Key Metrics to Watch

| Metric | Normal | Warning | Critical |
|---|---|---|---|
| Vote container CPU | < 30% | 30–70% | > 70% |
| Vote container RAM | < 256MB | 256–400MB | > 400MB |
| Redis memory | < 100MB | 100–200MB | > 200MB |
| DB connections | < 10 | 10–20 | > 20 |
| Redis queue length | 0–5 | 5–50 | > 50 |
| Worker restart count | 0 | 1–3 | > 3 |

---

### 4.2 Prometheus Queries

Open Prometheus at http://localhost:9090

#### Container CPU Usage
```promql
rate(container_cpu_usage_seconds_total{name=~".*vote.*"}[5m]) * 100
```

#### Container Memory Usage
```promql
container_memory_usage_bytes{name=~".*vote_app.*"} / 1024 / 1024
```

#### Container Restart Count
```promql
changes(container_start_time_seconds{name=~".*vote_app.*"}[1h])
```

#### Redis Queue Length
```promql
redis_list_length{key="votes"}
```

#### All Running Containers
```promql
count(container_last_seen{name=~".*vote_app.*"})
```

---

### 4.3 Grafana Dashboards

Access Grafana: http://localhost:3000  
Login: admin / admin

#### Pre-built Dashboards to Import

| Dashboard | ID | What it shows |
|---|---|---|
| Docker Container Monitoring | 193 | CPU, RAM, network per container |
| Node Exporter Full | 1860 | Host system metrics |
| Redis Dashboard | 11835 | Redis memory, commands, queue |
| PostgreSQL | 9628 | DB connections, queries, size |

**To import:** Dashboards → Import → Enter ID → Load

---

### 4.4 Grafana Alert Rules

Set these alerts in Grafana → Alerting → Alert Rules:

#### Alert 1 — Container Down
```
Condition: container_last_seen{name=~".*vote_app.*"} == 0
For: 1 minute
Severity: Critical
Message: "Container {{ $labels.name }} is down!"
```

#### Alert 2 — High Memory
```
Condition: container_memory_usage_bytes > 400000000  (400MB)
For: 5 minutes
Severity: Warning
Message: "High memory usage in {{ $labels.name }}"
```

#### Alert 3 — Redis Queue Backing Up
```
Condition: redis_list_length{key="votes"} > 50
For: 2 minutes
Severity: Warning
Message: "Redis votes queue is backing up — worker may be down"
```

---

### 4.5 Manual Health Checks

Run this to check all services at once:

```bash
#!/bin/bash
echo "=== Voting App Health Check ==="
echo ""

# Check Docker containers
echo "📦 CONTAINERS:"
docker compose ps

echo ""
echo "🔴 REDIS:"
docker exec vote_app-redis-1 redis-cli ping 2>/dev/null || echo "UNREACHABLE"

echo ""
echo "🐘 POSTGRES:"
docker exec vote_app-db-1 pg_isready -U postgres 2>/dev/null || echo "UNREACHABLE"

echo ""
echo "📊 VOTE COUNTS:"
docker exec -it vote_app-db-1 psql -U postgres -c \
  "SELECT vote, COUNT(*) as count FROM votes GROUP BY vote;" 2>/dev/null

echo ""
echo "📬 REDIS QUEUE LENGTH:"
docker exec vote_app-redis-1 redis-cli LLEN votes 2>/dev/null

echo ""
echo "=== Check Complete ==="
```

Save as `healthcheck.sh` and run: `bash healthcheck.sh`

---

## 5. Backup & Recovery

---

### 5.1 PostgreSQL Backup

#### Manual Backup
```bash
# Create backup directory
mkdir -p backups

# Dump the database
docker exec vote_app-db-1 pg_dump -U postgres postgres > \
  backups/votes_$(date +%Y%m%d_%H%M%S).sql

echo "Backup created: backups/votes_$(date +%Y%m%d_%H%M%S).sql"
```

#### Automated Daily Backup Script
```bash
#!/bin/bash
# Save as: backup.sh
# Add to cron: 0 2 * * * /path/to/backup.sh

BACKUP_DIR="/path/to/voting_app/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/votes_$TIMESTAMP.sql"

mkdir -p $BACKUP_DIR

docker exec vote_app-db-1 pg_dump -U postgres postgres > $BACKUP_FILE

if [ $? -eq 0 ]; then
  echo "✅ Backup successful: $BACKUP_FILE"
  # Keep only last 7 days of backups
  find $BACKUP_DIR -name "votes_*.sql" -mtime +7 -delete
  echo "🗑️  Old backups cleaned up"
else
  echo "❌ Backup FAILED"
  exit 1
fi
```

#### Set Up Cron Job
```bash
crontab -e

# Add this line (runs at 2am every day)
0 2 * * * /path/to/voting_app/backup.sh >> /var/log/voting_backup.log 2>&1
```

---

### 5.2 PostgreSQL Restore

#### Restore from Backup
```bash
# Stop worker and result to prevent writes during restore
docker compose stop worker result

# Restore the database
cat backups/votes_20250101_020000.sql | \
  docker exec -i vote_app-db-1 psql -U postgres postgres

# Restart services
docker compose start worker result

echo "✅ Restore complete"
```

#### Verify Restore
```bash
docker exec -it vote_app-db-1 psql -U postgres \
  -c "SELECT vote, COUNT(*) FROM votes GROUP BY vote;"
```

---

### 5.3 Kubernetes — Backup PersistentVolume

```bash
# Get the PVC name
kubectl get pvc

# Create a backup pod that mounts the volume
kubectl run backup-pod --image=postgres:15-alpine \
  --env="PGPASSWORD=postgres" \
  --restart=Never \
  -- pg_dump -h db -U postgres postgres > backup.sql

# Wait for completion
kubectl wait --for=condition=complete pod/backup-pod

# Copy backup out
kubectl cp backup-pod:/backup.sql ./backup.sql

# Cleanup
kubectl delete pod backup-pod
```

---

### 5.4 Full Stack Recovery (Disaster Recovery)

If everything goes down — follow these steps in order:

```bash
# Step 1 — Pull latest images
docker compose pull

# Step 2 — Start infrastructure first
docker compose up -d redis db

# Step 3 — Wait for healthy status
echo "Waiting for infrastructure..."
sleep 30

# Step 4 — Restore database if needed
cat backups/latest_backup.sql | \
  docker exec -i vote_app-db-1 psql -U postgres postgres

# Step 5 — Start applications
docker compose up -d vote result worker

# Step 6 — Verify
docker compose ps
bash healthcheck.sh

echo "✅ Recovery complete"
```

---

## 6. CI/CD Operations

---

### 6.1 GitHub Actions Pipeline

#### Trigger
```
Every push to main branch →  automatic trigger
Pull Request to main     →  automatic trigger
Manual trigger           →  GitHub → Actions → Run workflow
```

#### Monitor Pipeline
```
GitHub → Your Repo → Actions tab → "Build and Push to Docker Hub"
```

#### Pipeline Stages
```
Build Vote Image    ──▶  Push vote:latest + vote:<sha>
Build Worker Image  ──▶  Push worker:latest + worker:<sha>
Build Result Image  ──▶  Push result:latest + result:<sha>
```

All 3 jobs run in **parallel** — total time ~3-4 minutes.

---

#### Force Re-run Pipeline
```bash
# Push empty commit to trigger
git commit --allow-empty -m "trigger CI"
git push
```

#### Check Pipeline Secrets (if pipeline fails with auth error)
```
GitHub → Repo → Settings → Secrets and variables → Actions

Required secrets:
✅ DOCKER_USERNAME
✅ DOCKER_PASSWORD
```

---

### 6.2 Jenkins Pipeline

#### Access Jenkins
```
URL: http://localhost:8080  (or your Jenkins server)
```

#### Trigger Build Manually
```
Jenkins → voting_app pipeline → Build Now
```

#### Pipeline Stages
```
Stage 1: Checkout    → pulls code from GitHub
Stage 2: Build       → docker build for all 3 services
Stage 3: Push        → docker push to Docker Hub
Stage 4: Deploy      → kubectl apply (if configured)
```

#### View Build Logs
```
Jenkins → voting_app → Build #N → Console Output
```

#### Common Jenkins Failures

**Docker daemon not running:**
```bash
# On Jenkins server
sudo systemctl start docker
sudo systemctl enable docker
```

**Jenkins user can't run Docker:**
```bash
sudo usermod -aG docker jenkins
sudo systemctl restart jenkins
```

**Docker Hub login failing:**
```
Jenkins → Manage Jenkins → Credentials → Add Credentials
Kind: Username with password
Username: your Docker Hub username
Password: your Docker Hub password
ID: dockerhub-credentials
```

---

### 6.3 Update Docker Images

#### Build and Push New Version Manually
```bash
# Build with version tag
docker build -t mkanal/vote:1.1 ./vote
docker build -t mkanal/worker:1.1 ./worker
docker build -t mkanal/result:1.1 ./result

# Push to Docker Hub
docker push mkanal/vote:1.1
docker push mkanal/worker:1.1
docker push mkanal/result:1.1

# Also update latest tag
docker tag mkanal/vote:1.1 mkanal/vote:latest
docker push mkanal/vote:latest
```

#### Update Running Containers (Docker Compose)
```bash
# Pull new images
docker compose pull

# Recreate containers with new images
docker compose up -d --no-deps vote result worker
```

#### Update Running Pods (Kubernetes)
```bash
# Pull latest images and rolling restart
kubectl set image deployment/vote vote=mkanal/vote:1.1
kubectl set image deployment/result result=mkanal/result:1.1
kubectl set image deployment/worker worker=mkanal/worker:1.1

# Monitor rollout
kubectl rollout status deployment/vote
kubectl rollout status deployment/result
kubectl rollout status deployment/worker
```

---

### 6.4 Rollback Procedures

#### Docker Compose Rollback
```bash
# Pull specific version
docker pull mkanal/vote:1.0

# Update compose to use specific version
# Edit docker-compose.yml: image: mkanal/vote:1.0

# Restart with old version
docker compose up -d --no-deps vote
```

#### Kubernetes Rollback
```bash
# Roll back to previous version
kubectl rollout undo deployment/vote

# Roll back to specific version
kubectl rollout history deployment/vote      # list versions
kubectl rollout undo deployment/vote --to-revision=2

# Verify rollback
kubectl rollout status deployment/vote
kubectl get pods
```

---

## 7. Emergency Contacts & Escalation

---

### Service Owner

| Role | Name | Contact |
|---|---|---|
| Project Owner | Mallikarjuna Kanal | linkedin.com/in/mallikarjuna-kanal |
| GitHub | MKanal2003 | github.com/MKanal2003 |

---

### Severity Levels

| Level | Description | Response Time |
|---|---|---|
| P1 - Critical | All services down, no votes possible | Immediate |
| P2 - High | One service down, partial functionality | 15 minutes |
| P3 - Medium | Monitoring down, performance degraded | 1 hour |
| P4 - Low | Minor issue, workaround available | Next business day |

---

### Quick Reference Card

```
┌─────────────────────────────────────────────────────┐
│           VOTING APP — QUICK REFERENCE              │
├─────────────────────────────────────────────────────┤
│ START     │ docker compose up -d                    │
│ STOP      │ docker compose down                     │
│ STATUS    │ docker compose ps                       │
│ LOGS      │ docker compose logs [service]           │
│ RESTART   │ docker compose restart [service]        │
├─────────────────────────────────────────────────────┤
│ K8S START │ kubectl apply -f k8s-specifications/    │
│ K8S STOP  │ kubectl delete -f k8s-specifications/   │
│ K8S PODS  │ kubectl get pods                        │
│ K8S LOGS  │ kubectl logs -f deployment/[name]       │
│ ROLLBACK  │ kubectl rollout undo deployment/[name]  │
├─────────────────────────────────────────────────────┤
│ BACKUP    │ docker exec vote_app-db-1               │
│           │ pg_dump -U postgres postgres > bk.sql   │
├─────────────────────────────────────────────────────┤
│ VOTE URL  │ http://localhost:8080 (Compose)         │
│           │ http://localhost:31000 (K8s)            │
│ RESULT    │ http://localhost:8081 (Compose)         │
│           │ http://localhost:31001 (K8s)            │
│ GRAFANA   │ http://localhost:3000                   │
│ PROMETHEUS│ http://localhost:9090                   │
└─────────────────────────────────────────────────────┘
```

---

*This runbook should be reviewed and updated after every major incident or infrastructure change.*