import { subscriptionClient } from './client';

export const subscriptionApi = {
    // Get My Subscription: GET /v1/subscriptions/me
    getMySubscription: async () => {
        const { data } = await subscriptionClient.get('/v1/subscriptions/me');
        return data;
    },

    // Get Plans: GET /v1/subscriptions/plans
    getPlans: async () => {
        const { data } = await subscriptionClient.get('/v1/subscriptions/plans');
        return data;
    },

    // Create Order: POST /v1/orders/create
    createOrder: async (planId) => {
        const { data } = await subscriptionClient.post('/v1/orders/create', { planId });
        return data;
    },

    // Verify Order: POST /v1/orders/verify
    verifyOrder: async (orderId, paymentId, signature) => {
        const { data } = await subscriptionClient.post('/v1/orders/verify', { orderId, paymentId, signature });
        return data;
    }
};
