# SentinelPay Backend

This directory contains the central infrastructure and microservices for the SentinelPay platform.

## 🏗 Architecture

The system consists of **6 Microservices** orchestrated via Kafka and Redis:

| Service | Port | Role | Technology |
|---------|------|------|------------|
| **Ingestion** | 3000 | Traffic Gate, Uploads | Node.js (Express) |
| **ML Service** | 8000 | Anomaly Detection | Python (FastAPI, Sklearn) |
| **Notification** | 3001 | Alerts (Email/SMS) | Node.js (Express) |
| **Auth** | 3002 | Identity (Clerk) | Node.js (Express) |
| **Analytics** | 3003 | Dashboard Stats | Node.js (Express) |
| **Subscription** | 3004 | Billing (Razorpay) | Node.js (Express) |

## 🚀 Running the Backend

### Prerequisites
*   Docker & Docker Compose installed
*   Node.js (for local Prisma commands)
*   **ngrok** (for Auth Service webhooks)

### 1. Environment Setup

**CRITICAL**: You must set up `.env` files for ALL services before starting. Ask the team for the secrets.

```bash
# 1. ML Service
cp services/ml-service/.env.example services/ml-service/.env
# 2. Ingestion
cp services/ingestion-service/.env.example services/ingestion-service/.env
# 3. Notification
cp services/notification-service/.env.example services/notification-service/.env
# 4. Auth
cp services/auth-service/.env.example services/auth-service/.env
# 5. Analytics
cp services/analytics-service/.env.example services/analytics-service/.env
# 6. Subscription
cp services/subscription-service/.env.example services/subscription-service/.env
```

### 2. Start Services (Docker Compose)

```bash
docker compose up -d --build
```

### 3. Start Webhook Tunnel (REQUIRED for Auth)

For user registration to work, the `auth-service` needs to receive webhooks from Clerk. We use a **shared team domain**.

1.  **Configure Token** (Run once):
    ```bash
    ngrok config add-authtoken 32pYlvdJ4qeuCIDfTLJSN95QLWy_3vF5jBytTkffag6zDS4Yd
    ```
2.  **Start Tunnel**:
    ```bash
    npx ngrok http --domain=acrosporous-rikki-superinfinitely.ngrok-free.app 3002
    ```

## 🛠 Database Management (Prisma)

We use a **hosted NeonDB**. Do not rely on local postgres for application data if using the hosted URL.

**Apply Schema Changes:**
If you change `schema.prisma`, run this to update the hosted DB:
```bash
npx prisma db push
```

**Regenerate Client:**
If you encounter type errors or "client not found" in services:
```bash
npx prisma generate
```

**View Data (Prisma Studio):**
```bash
npx prisma studio
```

## ⚠️ Troubleshooting

### 1. "User not found" / 500 Error during Checkout
**Cause**: The Clerk webhook didn't fire, so the user wasn't created in our DB.
**Fix**: 
- Ensure the `ngrok` tunnel (Step 3) is running.
- Ensure `CLERK_WEBHOOK_SECRET` is correct in `services/auth-service/.env`.

### 2. "Column does not exist"
**Cause**: The code expects a DB column that isn't in the schema yet.
**Fix**:
- Run `npx prisma db push` to sync your schema with the database.
- Restart the services: `docker compose restart <service-name>`.

### 3. Kafka Connection Failed
**Symptom**: Services keep restarting with `KafkaJSConnectionError`.
**Fix**: Kafka takes a moment to start. Just restart the failing service:
```bash
docker compose restart ingestion-service
```
