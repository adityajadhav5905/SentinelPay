import { ingestionClient } from './client';

export const ingestionApi = {
    // Batch Upload: POST /v1/transactions/batch
    uploadBatch: async (file, userId, onProgress, uploadType = 'BATCH_CSV') => {
        const formData = new FormData();
        formData.append('file', file);
        if (userId) formData.append('userId', userId);
        formData.append('uploadType', uploadType);

        const { data } = await ingestionClient.post('/v1/transactions/batch', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
            onUploadProgress: (progressEvent) => {
                if (onProgress) {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    onProgress(percentCompleted);
                }
            }
        });
        return data;
    },

    // Get Batch History: GET /v1/transactions/batch/history
    getBatchHistory: async (userId) => {
        if (!userId) return [];
        const { data } = await ingestionClient.get('/v1/transactions/batch/history', {
            params: { userId }
        });
        return data;
    },

    // Get Batch Status: GET /v1/transactions/batch/:id
    getBatchStatus: async (jobId) => {
        const { data } = await ingestionClient.get(`/v1/transactions/batch/${jobId}`);
        return data;
    },

    // Download Batch Errors: GET /v1/transactions/batch/:id/errors/download
    downloadBatchErrors: async (jobId) => {
        const response = await ingestionClient.get(`/v1/transactions/batch/${jobId}/errors/download`, {
            responseType: 'blob'
        });
        return response.data;
    }
};
