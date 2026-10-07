# Backend API Documentation

This document lists all available API endpoints across the microservices architecture for frontend integration.

## Base URLs (Local Development)
- **Ingestion Service**: `http://localhost:3000`
- **Notification Service**: `http://localhost:3001`
- **Auth Service**: `http://localhost:3002`
- **Analytics Service**: `http://localhost:3003`
- **Subscription Service**: `http://localhost:3004`
- **ML Service**: `http://localhost:8000`

---

## 🏗️ Frontend Requirements (Verified & Ready)
The following endpoints are **ready for integration**.

### 1. Dashboard (`/`)
-   **Stats Overview**
    -   **Endpoint**: `GET /analytics/stats` (✅ Ready on `:3003`)
    -   **Response**:
        ```json
        {
          "totalTransactions": { "value": "12,450", "change": "+12.5%", "trend": "up" },
          "anomaliesDetected": { "value": "42", "change": "+5.2%", "trend": "down" },
          "systemStatus": { "value": "99.9%", "status": "Operational" }
        }
        ```
-   **Trends Chart**
    -   **Endpoint**: `GET /analytics/trends` (✅ Ready on `:3003`)
    -   **Query Params**: `range` (e.g., `24h`, `7d`, `30d`)
    -   **Response**: `[{ "time": "00:00", "value": 400, "anomalies": 2 }, ...]`
-   **Recent Activity**
    -   **Endpoint**: `GET /analytics/activity/recent` (✅ Ready on `:3003`)
    -   **Response**: `[{ "id": "1", "type": "High Velocity", "description": "...", "timestamp": "..." }]`

### 2. Anomalies Explorer (`/anomalies`)
-   **List Anomalies**
    -   **Endpoint**: `GET /anomalies` (✅ Ready on `:3003`)
    -   **Query Params**: `page`, `limit`, `filter` (status/severity), `search` (id/user/type)
    -   **Response**:
        ```json
        {
          "data": [
             { "id": "TXN-7829", "user": "user_42", "score": 0.98, "type": "Velocity", "severity": "critical", "timestamp": "...", "status": "Pending" }
          ],
          "pagination": { "total": 100, "page": 1, "pages": 10 }
        }
        ```
-   **Export Data**
    -   **Endpoint**: `GET /anomalies/export` (✅ Ready on `:3003`)
    -   **Query Params**: `format=csv`
    -   **Response**: Blob/File Download

### 3. Settings & Subscription (`/settings`)
-   **User Entitlements**
    -   **Endpoint**: `GET /subscriptions/me` (✅ Ready on `:3004`)
    -   **Response**:
        ```json
        {
          "plan": "Advanced",
          "status": "Active",
          "billingCycle": "monthly",
          "usage": { "current": 12450, "limit": 50000 }
        }
        ```
-   **Available Plans**
    -   **Endpoint**: `GET /subscriptions/plans` (✅ Ready on `:3004`)
    -   **Response**: `[{ "name": "Starter", "price": "Free", "features": [...] }]`

### 4. Search (`Header`)
-   **Global Search**
    -   **Endpoint**: `GET /search` (✅ Ready on `:3003`)
    -   **Query Params**: `q` (query string)
    -   **Response**:
        ```json
        {
          "users": [{ "id": "u1", "name": "..." }],
          "transactions": [{ "id": "t1", "amount": 100 }],
          "anomalies": [{ "id": "a1", "type": "..." }]
        }
        ```

### 5. Profile (`/profile`)
-   **Get Profile**
    -   **Endpoint**: `GET /v1/me` (✅ Ready on `:3002`) (Note: Mapped to `/v1/me` in Auth Service)
    -   **Response**: User Object (Name, Email, Phone, Bio, etc.)
-   **Update Profile**
    -   **Endpoint**: `PUT /v1/me` (✅ Ready on `:3002`)
    -   **Body**: `{ "firstName": "...", "lastName": "..." }`

---

## Existing Backend Endpoints

### 1. Auth Service (`:3002`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/v1/me` | Get current user details |
| `POST` | `/webhooks/clerk` | Clerk Webhook Handler |
| `GET` | `/health` | Service Health Check |

### 2. Ingestion Service (`:3000`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/transactions` | Ingest single real-time transaction |
| `POST` | `/transactions/batch` | Upload CSV for batch ingestion |

### 3. ML Service (`:8000`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/inference` | Analyze a transaction |
| `GET` | `/v1/models` | List available models |
| `POST` | `/v1/train` | Trigger model training |
| `GET` | `/v1/users/{user_id}/profile` | Get user behavioral profile |

### 4. Subscription Service (`:3004`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/orders/create` | Create a new subscription order |
| `GET` | `/invoices` | List user invoices |
| `GET` | `/invoices/{id}/download` | Download invoice PDF |

### 5. Notification Service (`:3001`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/notifications/test/email` | Send test email |
| `POST` | `/v1/notifications/test/sms` | Send test SMS |
