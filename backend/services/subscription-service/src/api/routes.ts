import express from 'express';
import { createOrder, verifyOrder } from '../controllers/checkout';
import { handleRazorpayWebhook } from '../controllers/webhook';
import { listInvoices, downloadInvoice } from '../controllers/invoices';
import { getMySubscription, getPlans } from '../controllers/subscription.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Plan:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "pro_plan"
 *         name:
 *           type: string
 *           example: "Pro Plan"
 *         price:
 *           type: number
 *           example: 29.99
 *         currency:
 *           type: string
 *           example: "USD"
 *         features:
 *           type: array
 *           items:
 *             type: string
 *     Entitlement:
 *       type: object
 *       properties:
 *         limits:
 *           type: object
 *           description: Usage limits
 *           example: { "transactions": 10000, "users": 5 }
 *     Subscription:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           enum: [active, past_due, canceled, incomplete]
 *           example: "active"
 *         plan:
 *           $ref: '#/components/schemas/Plan'
 *         currentPeriodEnd:
 *           type: string
 *           format: date-time
 *     Invoice:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "inv_123"
 *         amount:
 *           type: number
 *           example: 2999
 *         status:
 *           type: string
 *           enum: [paid, open, void]
 *         pdfUrl:
 *           type: string
 *           format: uri
 *         description:
 *           type: string
 */

/**
 * @swagger
 * /orders/create:
 *   post:
 *     summary: Create a new subscription order
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [planId]
 *             properties:
 *               planId:
 *                 type: string
 *                 enum: [basic, pro]
 *                 example: "pro"
 *     responses:
 *       201:
 *         description: Order created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 orderId:
 *                   type: string
 *                 amount:
 *                   type: number
 *                 currency:
 *                   type: string
 *       400:
 *         description: Invalid planId
 */
router.post('/orders/create', requireAuth, createOrder);

/**
 * @swagger
 * /orders/verify:
 *   post:
 *     summary: Verify Razorpay order signature
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [orderId, paymentId, signature]
 *             properties:
 *               orderId:
 *                 type: string
 *               paymentId:
 *                 type: string
 *               signature:
 *                 type: string
 *     responses:
 *       200:
 *         description: Subscription verified and activated
 */
router.post('/orders/verify', requireAuth, verifyOrder);

/**
 * @swagger
 * /webhooks/razorpay:
 *   post:
 *     summary: Handle Razorpay webhooks
 *     tags: [Webhooks]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Webhook received
 */
// Webhook Routes (No Auth - Signature Verified internally)
router.post('/webhooks/razorpay', handleRazorpayWebhook);

// Invoice Routes
/**
 * @swagger
 * /invoices:
 *   get:
 *     summary: List invoices
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Optional filter by user ID (Admin only)
 *     responses:
 *       200:
 *         description: List of invoices
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Invoice'
 */
router.get('/invoices', requireAuth, listInvoices);

/**
 * @swagger
 * /invoices/{id}/download:
 *   get:
 *     summary: Download invoice PDF
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: PDF file stream
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get('/invoices/:id/download', requireAuth, downloadInvoice);

// Subscription Routes
/**
 * @swagger
 * /subscriptions/me:
 *   get:
 *     summary: Get current user's subscription and entitlements
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User subscription details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Subscription'
 */
router.get('/subscriptions/me', requireAuth, getMySubscription);

/**
 * @swagger
 * /subscriptions/plans:
 *   get:
 *     summary: Get available subscription plans
 *     tags: [Subscriptions]
 *     responses:
 *       200:
 *         description: List of available plans
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Plan'
 */
// Public Route
router.get('/subscriptions/plans', getPlans);

export default router;
