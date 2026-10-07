// import { client } from './client'; // Removed unused and invalid import

// We need to target the admin service.
// In local dev, admin service is on port 3005.
// However, 'client' uses a base URL (likely pointing to ingestion or gateway).
// Since we don't have a gateway, we need a separate client or override the base URL.
// For simplicity in this demo, we'll create a dedicated admin client or assumes usage of proxy if configured.
// Given the setup, we'll make direct calls to port 3005 for local dev, 
// OR simpler: we update vite proxy to route /api/admin to port 3005.

// Let's assume we can use the same axios instance but override baseURL if needed, 
// or simpler, just create a new one.

import axios from 'axios';

const ADMIN_URL = import.meta.env.VITE_ADMIN_SERVICE_URL || 'http://localhost:3005';

const adminClient = axios.create({
    baseURL: ADMIN_URL,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Add auth interceptor
adminClient.interceptors.request.use(async (config) => {
    const token = localStorage.getItem('sentinelpay_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export const adminApi = {
    // GET /admin/stats
    getStats: async () => {
        const { data } = await adminClient.get('/admin/stats');
        return data;
    },

    // GET /admin/stats/charts
    getChartData: async () => {
        const { data } = await adminClient.get('/admin/stats/charts');
        return data;
    },

    // GET /admin/users
    getUsers: async (params) => {
        const { data } = await adminClient.get('/admin/users', { params });
        return data;
    },

    // PATCH /admin/users/:id/role
    updateUserRole: async (userId, role) => {
        const { data } = await adminClient.patch(`/admin/users/${userId}/role`, { role });
        return data;
    },

    // PATCH /admin/users/:id/status
    updateUserStatus: async (userId, status) => {
        const { data } = await adminClient.patch(`/admin/users/${userId}/status`, { status });
        return data;
    },

    // PATCH /admin/users/:id/force-reset
    forcePasswordReset: async (userId, forceReset) => {
        const { data } = await adminClient.patch(`/admin/users/${userId}/force-reset`, { forceReset });
        return data;
    },

    // PATCH /admin/users/:id/subscription
    updateUserSubscription: async (userId, plan, status) => {
        const { data } = await adminClient.patch(`/admin/users/${userId}/subscription`, { plan, status });
        return data;
    },

    // GET /admin/models
    getModels: async () => {
        const { data } = await adminClient.get('/admin/models');
        return data;
    },

    // POST /admin/models/retrain
    retrainModel: async (modelType) => {
        const { data } = await adminClient.post('/admin/models/retrain', { modelType });
        return data;
    },

    // GET /admin/routes
    getDiscoveredRoutes: async () => {
        const { data } = await adminClient.get('/admin/routes');
        return data;
    },

    // POST /admin/proxy
    proxyRequest: async (proxyData) => {
        const { data } = await adminClient.post('/admin/proxy', proxyData);
        return data;
    }
};
