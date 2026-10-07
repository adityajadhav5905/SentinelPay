import { notificationClient } from './client';

export const notificationsApi = {
    // Get Settings: GET /v1/notifications/settings
    getSettings: async () => {
        const { data } = await notificationClient.get('/v1/notifications/settings');
        return data;
    },

    // Update Settings: PUT /v1/notifications/settings
    updateSettings: async (settings) => {
        const { data } = await notificationClient.put('/v1/notifications/settings', settings);
        return data;
    }
};
