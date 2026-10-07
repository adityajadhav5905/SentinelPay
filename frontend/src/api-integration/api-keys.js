import { ingestionClient } from './client';

export const apiKeysApi = {
    // POST /v1/api-keys
    create: async (name) => {
        const { data } = await ingestionClient.post('/v1/api-keys', { name });
        return data;
    },

    // GET /v1/api-keys
    list: async () => {
        const { data } = await ingestionClient.get('/v1/api-keys');
        return data;
    },

    // DELETE /v1/api-keys/:id
    revoke: async (id) => {
        const { data } = await ingestionClient.delete(`/v1/api-keys/${id}`);
        return data;
    }
};
