# SentinelPay Frontend

![SentinelPay Dashboard](https://placehold.co/1200x600?text=SentinelPay+Dashboard+Preview)

**SentinelPay** is a premium, high-performance dashboard for visualizing real-time anomaly detection in financial transactions. Built with a focus on aesthetics, glassmorphism, and smooth animations.

## 🚀 Features

*   **Premium UI/UX**: Modern Glassmorphism design with a fully responsive layout.
*   **Dynamic Theming**: Seamless Light & Dark mode support with persistent preferences.
*   **Interactive Dashboard**: Real-time stats, animated charts (Recharts), and activity feeds.
*   **Anomalies Explorer**: Advanced data grid with filtering, sorting, and severity badges.
*   **Animations**: Powered by `framer-motion` for smooth organic page transitions.
*   **Production Ready**: Fully Dockerized with Nginx serving static assets.

## 🛠 Tech Stack

*   **Framework**: React 19 (Vite)
*   **Styling**: TailwindCSS v4
*   **Icons**: Lucide React
*   **Animations**: Framer Motion
*   **Charts**: Recharts
*   **Notifications**: Sonner
*   **Auth**: Clerk (Integrated)

## 📦 Installation & Setup

### Prerequisites
*   Node.js v20+
*   npm or yarn

### 1. Clone & Install
```bash
git clone https://github.com/omkardj2/SentinelPay.git
cd SentinelPay/frontend

npm install
```

### 2. Run Development Server
```bash
npm run dev
```
The app will be available at `http://localhost:5173`.

### 3. Build for Production
```bash
npm run build
```

## 🐳 Docker Deployment

The frontend is containerized using a multi-stage Docker build served by Nginx.

### Run with Docker Compose (Recommended)
```bash
docker compose up -d --build
```
Access the app at `http://localhost:8080`.

### Manual Build
```bash
# Build the image
docker build -t sentinelpay-frontend .

# Run the container
docker run -p 8080:80 sentinelpay-frontend
```

## 📂 Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── common/       # Reusable UI primitives (Cards, Inputs)
│   │   ├── dashboard/    # specific widgets (StatsCard)
│   │   └── layout/       # Sidebar, Header, AppLayout
│   ├── contexts/         # ThemeContext, NotificationContext
│   ├── pages/            # Main Route Components (Dashboard, Profile)
│   └── lib/              # Utilities (cn, tailwind-merge)
├── API_DOCS.md           # Backend API Integration Guide
├── Dockerfile            # Production build definition
└── nginx.conf            # SPA routing configuration
```

---

Built with ❤️ by SentinelPay.
