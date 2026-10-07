import axios from 'axios';

// Base URLs for Microservices (from environment variables)
const SERVICES = {
    AUTH: import.meta.env.VITE_API_URL_AUTH || 'http://localhost:3002',
    ANALYTICS: import.meta.env.VITE_API_URL_ANALYTICS || 'http://localhost:3003',
    SUBSCRIPTION: import.meta.env.VITE_API_URL_SUBSCRIPTION || 'http://localhost:3004',
    INGESTION: import.meta.env.VITE_API_URL_INGESTION || 'http://localhost:3000',
    NOTIFICATION: import.meta.env.VITE_API_URL_NOTIFICATION || 'http://localhost:3001',
    ML: import.meta.env.VITE_API_URL_ML || 'http://localhost:8000'
};

// Token Provider to get fresh tokens
let tokenProvider = null;

export const setTokenProvider = (provider) => {
    tokenProvider = provider;
};

const createClient = (baseURL) => {
    const client = axios.create({
        baseURL,
        headers: {
            'Content-Type': 'application/json',
        },
    });

    // Request Interceptor: Attach Token
    client.interceptors.request.use(async (config) => {
        if (tokenProvider) {
            const token = await tokenProvider();
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        }
        return config;
    });

    // Response Interceptor: Handle Auth Errors
    client.interceptors.response.use(
        (response) => response,
        (error) => {
            if (error.response?.status === 401) {
                console.warn('Unauthorized access. Token might be invalid.');
            }
            return Promise.reject(error);
        }
    );

    return client;
};

// Export Clients
export const authClient = createClient(SERVICES.AUTH);
export const analyticsClient = createClient(SERVICES.ANALYTICS);
export const subscriptionClient = createClient(SERVICES.SUBSCRIPTION);
export const ingestionClient = createClient(SERVICES.INGESTION);
export const notificationClient = createClient(SERVICES.NOTIFICATION);
export const mlClient = createClient(SERVICES.ML);
