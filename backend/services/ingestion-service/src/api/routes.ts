import { Router } from 'express';
import multer from 'multer';
import { ingestTransaction, ingestBatch, getBatchHistory, getBatchStatus, downloadBatchErrors, createApiKey, listApiKeys, revokeApiKey } from './controllers';
import { config } from '../config';
import { requireAuth } from '../middleware/auth.middleware';

// Configure upload
const upload = multer({ dest: config.uploadDir });

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Transaction:
 *       type: object
 *       required:
 *         - txId
 *         - userId
 *         - amount
 *         - currency
 *         - timestamp
 *       properties:
 *         txId:
 *           type: string
 *           description: Unique transaction ID from source system
 *           example: "tx_123456789"
 *         userId:
 *           type: string
 *           description: ID of the user performing the transaction (The Company/Client)
 *           example: "user_550e8400"
 *         endUserId:
 *           type: string
 *           description: ID of the end user (Client's User) who originated the transaction
 *           example: "end_user_alice"
 *         amount:
 *           type: number
 *           format: float
 *           description: Transaction amount
 *           example: 150.50
 *         currency:
 *           type: string
 *           description: 3-letter currency code (ISO 4217)
 *           example: "USD"
 *         timestamp:
 *           type: string
 *           format: date-time
 *           description: ISO 8601 timestamp of when the transaction occurred
 *           example: "2023-10-27T10:00:00Z"
 *         location:
 *           type: string
 *           description: Location where transaction occurred
 *           example: "New York, NY"
 *         merchant:
 *           type: string
 *           description: Name of the merchant
 *           example: "Starbucks"
 *         category:
 *           type: string
 *           description: Transaction category
 *           example: "Food & Dining"
 */

/**
 * @swagger
 * /v1/transactions:
 *   post:
 *     summary: Ingest a single real-time transaction
 *     tags: [Ingestion]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Transaction'
 *     responses:
 *       202:
 *         description: Transaction accepted for processing
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Transaction accepted"
 *                 traceId:
 *                   type: string
 *                   example: "550e8400-e29b-41d4-a716-446655440000"
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post('/transactions', requireAuth, ingestTransaction);

/**
 * @swagger
 * /v1/transactions/batch:
 *   post:
 *     summary: Ingest a batch of transactions via CSV
 *     tags: [Ingestion]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: CSV file containing transactions. Headers required (txId, userId, amount, currency, timestamp).
 *     responses:
 *       202:
 *         description: Batch file accepted for processing
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Batch upload accepted"
 *                 jobId:
 *                   type: string
 *                   example: "job_987654321"
 *       400:
 *         description: Invalid file format or missing file
 *       401:
 *         description: Unauthorized
 */
router.post('/transactions/batch', requireAuth, upload.single('file'), ingestBatch);

/**
 * @swagger
 * /v1/transactions/batch/history:
 *   get:
 *     summary: Get recent batch upload history
 *     tags: [Ingestion]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of batch jobs
 */
router.get('/transactions/batch/history', requireAuth, getBatchHistory);

/**
 * @swagger
 * /v1/transactions/batch/{id}:
 *   get:
 *     summary: Get batch job status
 *     tags: [Ingestion]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Batch job details
 */
router.get('/transactions/batch/:id', requireAuth, getBatchStatus);

/**
 * @swagger
 * /v1/transactions/batch/{id}/errors/download:
 *   get:
 *     summary: Download batch job errors as CSV
 *     tags: [Ingestion]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: CSV file download
 */
router.get('/transactions/batch/:id/errors/download', requireAuth, downloadBatchErrors);

/**
 * API Key Routes
 */
router.post('/api-keys', requireAuth, createApiKey);
router.get('/api-keys', requireAuth, listApiKeys);
router.delete('/api-keys/:id', requireAuth, revokeApiKey);

export default router;
