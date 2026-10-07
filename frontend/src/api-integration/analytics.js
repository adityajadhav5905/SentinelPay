import { analyticsClient } from './client';

export const analyticsApi = {
    // Dashboard Stats: GET /analytics/stats
    getStats: async (range, batchId) => {
        const { data } = await analyticsClient.get('/analytics/stats', {
            params: { range, batchId }
        });
        return data;
    },

    // Trends Chart: GET /analytics/trends?range=24h
    getTrends: async (range = '24h', batchId) => {
        const { data } = await analyticsClient.get('/analytics/trends', {
            params: { range, batchId }
        });
        return data;
    },

    // Recent Activity: GET /analytics/activity/recent
    getRecentActivity: async () => {
        const { data } = await analyticsClient.get('/analytics/activity/recent');
        return data;
    },

    // Anomalies List: GET /anomalies
    getAnomalies: async ({ page = 1, limit = 10, filter, status, search, batchId, userId } = {}) => {
        const { data } = await analyticsClient.get('/anomalies', {
            params: { page, limit, filter, status, search, batchId, userId }
        });
        return data;
    },

    // Resolve Anomaly: PATCH /anomalies/:id
    resolveAnomaly: async (id, { isFalsePositive, feedbackReason, feedbackNotes }) => {
        const { data } = await analyticsClient.patch(`/anomalies/${id}`, {
            isFalsePositive,
            feedbackReason,
            feedbackNotes
        });
        return data;
    },

    // Export Anomalies: GET /anomalies/export
    exportAnomalies: async () => {
        const { data } = await analyticsClient.get('/anomalies/export', {
            responseType: 'blob'
        });
        return data;
    }
};
