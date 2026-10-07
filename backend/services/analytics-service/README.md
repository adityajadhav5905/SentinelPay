# Analytics Service (`analytics-service`)

## 📖 Overview
The **Analytics Service** is the central dashboard API for the SentinelPay platform. It aggregates data from the `transactions` and `anomalies` database tables to provide real-time insights to the frontend.

It serves as the user's primary interface for visualizing:
1.  **Dashboard Stats**: Total transactions, anomaly counts, and system status.
2.  **Trends Chart**: Time-series data for transactions and anomalies (customizable ranges).
3.  **Anomaly Management**: List, filter, and resolve anomalies (mark as false positive).
4.  **Recent Activity**: A feed of the latest detection events.

## 🏗 Architecture
- **Language**: TypeScript (Node.js 20+)
- **Database**: PostgreSQL (Shared via Prisma)
- **Authentication**: Clerk (Middleware)
- **Framework**: Express.js

### Data Flow
The service queries the shared PostgreSQL database (populated by Ingestion and ML services) to generate on-demand statistics.

```
┌─────────────┐    ┌───────────────────────────────────┐
│  Dashboard  │◄───│         Analytics Service         │
│  (React)    │    └─┬─────────────────────────────────┘
└─────────────┘      │
            ┌────────▼──────┐
            │   PostgreSQL  │
            │ (Shared DB)   │
            └───────────────┘
```

## 📁 Project Structure
```
analytics-service/
├── src/
│   ├── app.ts            # Express app setup & middleware
│   ├── config/           # DB configuration
│   └── api/
│       └── routes.ts     # Main API endpoints (Dashboard & Anomalies)
├── .env.example
├── Dockerfile
└── README.md
```

## 🚀 Quick Start

> **Tip:** Run everything via the master compose in `backend/`:
> ```bash
> cd ../..
> docker compose up -d
> ```

### Local Dev
1.  **Configure `.env`**: Copy `.env.example` and set `DATABASE_URL` and `CLERK_SECRET_KEY`.
2.  **Start Service**:
    ```bash
    npm install
    npm run dev
    ```

## 🔌 API Reference

### Dashboard

**GET** `/analytics/stats`
- Returns overview metrics (Total Transactions, Anomalies Detected, System Status).
- Supports filtering by `batchId` and `userId` (via Auth).

**GET** `/analytics/trends`
- Returns time-series data for charts.
- Query Params:
    - `range`: `24h` (default), `7d`, `30d`.
    - `batchId`: Filter by specific batch.

**GET** `/analytics/activity/recent`
- Returns the last 10 anomaly events.

### Anomalies

**GET** `/anomalies`
- List anomalies with pagination, searching, and filtering.
- Query Params:
    - `page`, `limit`
    - `filter`: Severity (LOW, MEDIUM, HIGH, CRITICAL)
    - `status`: Resolved, Pending
    - `search`: Transaction ID or Merchant

**PATCH** `/anomalies/:id`
- Mark an anomaly as resolved (False Positive) or add feedback.
- Body: `{ isFalsePositive: boolean, feedbackNotes: string }`

**GET** `/anomalies/export`
- Download anomalies as CSV.

**GET** `/search`
- Global search for Users, Transactions, and Anomalies.
