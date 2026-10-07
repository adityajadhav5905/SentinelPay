import { Request, Response } from 'express';
import { prisma } from '@sentinelpay/database';
import { sendKafkaMessage } from '../kafka/producer';
import axios from 'axios';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://ml-service:8000';

export const listModels = async (req: Request, res: Response) => {
    try {
        // Try to get model info from ML service
        let mlServiceInfo = null;
        try {
            const response = await axios.get(`${ML_SERVICE_URL}/v1/health`, { timeout: 5000 });
            mlServiceInfo = response.data;
        } catch (e) {
            console.log('ML service not reachable, using fallback');
        }

        // Get model artifacts from database
        const models = await prisma.modelArtifact.findMany({
            orderBy: { trainedAt: 'desc' },
            take: 10
        });

        // If no models in DB, return default info
        if (models.length === 0) {
            res.json({
                activeModel: {
                    type: 'isolation_forest',
                    version: mlServiceInfo?.model_version || 'v2.1',
                    status: mlServiceInfo?.status === 'healthy' ? 'ACTIVE' : 'UNKNOWN',
                    isLoaded: mlServiceInfo?.model_loaded || false,
                    features: mlServiceInfo?.features_count || 11,
                    lastTrained: new Date().toISOString(),
                    accuracy: 0.94
                },
                history: [],
                mlServiceStatus: mlServiceInfo?.status || 'unknown'
            });
            return;
        }

        const activeModel = models.find((m: { isActive: boolean }) => m.isActive) || models[0];

        res.json({
            activeModel: {
                id: activeModel.id,
                type: activeModel.type,
                version: activeModel.version,
                status: activeModel.isActive ? 'ACTIVE' : 'INACTIVE',
                accuracy: activeModel.accuracy,
                metrics: activeModel.metrics,
                lastTrained: activeModel.trainedAt,
                s3Path: activeModel.s3Path
            },
            history: models,
            mlServiceStatus: mlServiceInfo?.status || 'unknown'
        });
    } catch (error) {
        console.error('List Models Error:', error);
        res.status(500).json({ error: 'Failed to list models' });
    }
};

export const retrainModel = async (req: Request, res: Response) => {
    try {
        const { modelType } = req.body; // e.g., 'isolation_forest'

        // Try direct call to ML service first
        try {
            const response = await axios.post(`${ML_SERVICE_URL}/v1/retrain/trigger`, {
                model_type: modelType || 'isolation_forest',
                triggered_by: (req as any).auth?.userId || 'ADMIN'
            }, { timeout: 10000 });

            res.json({
                message: 'Model retraining triggered successfully',
                job: response.data
            });
            return;
        } catch (mlError: any) {
            console.log('Direct ML call failed, trying Kafka:', mlError.message);
        }

        // Fallback: Send event to Kafka
        await sendKafkaMessage('model.retrain', {
            triggeredBy: (req as any).auth?.userId || 'ADMIN',
            modelType: modelType || 'all',
            timestamp: new Date().toISOString()
        });

        res.json({ message: 'Model retraining triggered via Kafka' });
    } catch (error) {
        console.error('Retrain Error:', error);
        res.status(500).json({ error: 'Failed to trigger retraining' });
    }
};

export const getModelHealth = async (req: Request, res: Response) => {
    try {
        const response = await axios.get(`${ML_SERVICE_URL}/v1/health`, { timeout: 5000 });
        res.json(response.data);
    } catch (error) {
        res.status(503).json({ status: 'unavailable', error: 'ML service unreachable' });
    }
};
