# Auth Service (`auth-service`)

## 📖 Overview
The **Auth Service** manages user identity and security for the SentinelPay platform. It leverages **Clerk** for robust authentication (Sign Up, Sign In, MFA) and synchronizes user data to our local PostgreSQL database.

It supports:
1.  **Identity Management**: Wrapper around Clerk SDK.
2.  **User Sync**: Webhook receiver to sync Create/Update/Delete events from Clerk to Postgres `User` table.
3.  **Token Verification**: Middleware for other services to validate requests.

## 🏗 Architecture
- **Language**: TypeScript (Node.js 20+)
- **Auth Provider**: Clerk
- **Database**: PostgreSQL (User Table)
- **Message Broker**: Kafka (User created events)

### Data Flow (User Registration)
```
┌─────────────┐    ┌──────────────┐    ┌─────────────────┐
│ Client App  │───►│    Clerk     │───►│  Auth Service   │
│ (Frontend)  │    │  (Identity)  │    │    Webhook      │
└─────────────┘    └──────────────┘    └────────┬────────┘
                                                │
                                       ┌────────▼────────┐
                                       │   PostgreSQL    │
                                       │  (User Table)   │
                                       └─────────────────┘
```

## 📁 Project Structure
```
auth-service/
├── src/
│   ├── app.ts            # Express app
│   ├── config/           # Envs (Clerk Keys)
│   ├── webhooks/         # Clerk Webhook Handlers
│   │   └── user.sync.ts  # Sync logic
│   └── middleware/       # JWT Verification
├── .env.example
├── Dockerfile
└── README.md
```

## 🚀 Quick Start (Running with Full Stack)

> **Tip:** You can run the entire SentinelPay stack using the master docker-compose in the `backend/` directory:
> ```bash
> cd ../..
> docker compose up -d
> ```

### Local Dev Setup

1.  **Start Database:**
    Ensure Postgres is running via Docker:
    ```bash
    cd backend
    docker compose up -d postgres
    ```

2.  **Configure `.env`**:
    Copy `.env.example` to `.env` and add your **Clerk Keys** and **Database URL**:
    ```bash
    DATABASE_URL="postgresql://user:password@localhost:5432/sentinelpay"
    ```

3.  **Start Service**:
    ```bash
    npm install
    npm run dev
    ```

## 🪝 Webhook Setup (User Sync)

To test user synchronization locally:

1.  Start the service (`npm run dev`).
2.  Start a temporary tunnel (in a new terminal):
    ```bash
    npx localtunnel --port 3002
    ```
3.  Add the URL to Clerk Dashboard > Webhooks > Add Endpoint:
    *   URL: `https://<your-tunnel-url>/webhooks/clerk`
    *   Events: `user.created`, `user.updated`, `user.deleted`
4.  Copy the **Signing Secret** to your `.env` as `CLERK_WEBHOOK_SECRET`.
5.  Restart the service.

## 🔌 API Reference

### Health
**GET** `/health`

### Webhooks
**POST** `/webhooks/clerk` - Endpoint for Clerk to push user updates.

### User Management
**GET** `/v1/me` - Get current user profile (synced from DB).

