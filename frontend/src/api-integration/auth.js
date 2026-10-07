import { authClient } from './client';

export const authApi = {
    // Login: POST /auth/login
    login: async (email, password) => {
        const { data } = await authClient.post('/auth/login', { email, password });
        return data;
    },

    // Register: POST /auth/register
    register: async (email, password, name, phone) => {
        const { data } = await authClient.post('/auth/register', { email, password, name, phone });
        return data;
    },

    // Get Profile: GET /auth/me
    getProfile: async () => {
        const { data } = await authClient.get('/auth/me');
        return data;
    },

    // Verify Registration: POST /auth/verify-registration
    verifyRegistration: async (email, otp) => {
        const { data } = await authClient.post('/auth/verify-registration', { email, otp });
        return data;
    },

    // Forgot Password: POST /auth/forgot-password
    forgotPassword: async (email) => {
        const { data } = await authClient.post('/auth/forgot-password', { email });
        return data;
    },

    // Reset Password: POST /auth/reset-password
    resetPassword: async (email, otp, newPassword) => {
        const { data } = await authClient.post('/auth/reset-password', { email, otp, newPassword });
        return data;
    },

    // Impersonate User: POST /auth/admin/users/:id/impersonate
    impersonateUser: async (userId) => {
        const { data } = await authClient.post(`/auth/admin/users/${userId}/impersonate`);
        return data;
    },

    // Update Phone: PUT /auth/me/phone
    updatePhone: async (phone) => {
        const { data } = await authClient.put('/auth/me/phone', { phone });
        return data;
    }
};
