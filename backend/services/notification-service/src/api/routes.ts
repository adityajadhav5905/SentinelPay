import { Router, Request, Response } from 'express';
import { sendEmailNotification } from '../services/email.service';
import { sendSmsNotification } from '../services/sms.service';
import { sendWebhookNotification } from '../services/webhook.service';
import { makeCallNotification } from '../services/call.service';
import { requireAuth } from '../middleware/auth.middleware';
import { getUserContext } from '../services/subscription.service';
import { prisma, Severity } from '@sentinelpay/database';

const router = Router();

/**
 * @swagger
 * /v1/notifications/test/email:
 *   post:
 *     summary: Send a test email
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [to, subject, body]
 *             properties:
 *               to:
 *                 type: string
 *                 format: email
 *                 example: "test@example.com"
 *               subject:
 *                 type: string
 *                 example: "Test Notification"
 *               body:
 *                 type: string
 *                 example: "This is a test message."
 *     responses:
 *       200:
 *         description: Email sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Test email sent (logged)"
 */
router.post('/v1/notifications/test/email', async (req, res) => {
  const { to, subject, body } = req.body;
  await sendEmailNotification({ to, subject, body });
  res.json({ success: true, message: 'Test email sent (logged)' });
});

/**
 * @swagger
 * /v1/notifications/test/sms:
 *   post:
 *     summary: Send a test SMS
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [to, message]
 *             properties:
 *               to:
 *                 type: string
 *                 example: "+1234567890"
 *               message:
 *                 type: string
 *                 example: "Test SMS alert"
 *     responses:
 *       200:
 *         description: SMS sent successfully
 */
router.post('/v1/notifications/test/sms', async (req, res) => {
  const { to, message } = req.body;
  await sendSmsNotification({ to, message });
  res.json({ success: true, message: 'Test SMS sent (logged)' });
});

/**
 * @swagger
 * /v1/notifications/test/webhook:
 *   post:
 *     summary: Send a test Webhook
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [url, data]
 *             properties:
 *               url:
 *                 type: string
 *                 format: uri
 *                 example: "https://webhook.site/..."
 *               data:
 *                 type: object
 *                 example: { "event": "alert.triggered", "score": 0.9 }
 *     responses:
 *       200:
 *         description: Webhook sent successfully
 *       400:
 *         description: Missing url or data
 */
router.post('/v1/notifications/test/webhook', async (req, res) => {
  const { url, data } = req.body;

  if (!url || !data) {
    return res.status(400).json({
      success: false,
      message: 'url and data are required',
    });
  }

  await sendWebhookNotification({
    url,
    data,
    secret: process.env.WEBHOOK_SIGNING_SECRET,
  });

  res.json({
    success: true,
    message: 'Test webhook sent',
  });
});

/**
 * @swagger
 * /v1/notifications/test/call:
 *   post:
 *     summary: Send a test Voice Call
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [to, message]
 *             properties:
 *               to:
 *                 type: string
 *                 example: "+1234567890"
 *               message:
 *                 type: string
 *                 example: "Test Voice alert"
 *     responses:
 *       200:
 *         description: Voice call triggered successfully
 */
router.post('/v1/notifications/test/call', async (req, res) => {
  const { to, message } = req.body;
  await makeCallNotification({ to, message });
  res.json({ success: true, message: 'Test Voice call sent (logged)' });
});

/**
 * @swagger
 * /v1/notifications/settings:
 *   get:
 *     summary: Get current user's notification settings
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Notification settings object
 */
router.get('/v1/notifications/settings', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const context = await getUserContext(userId);
    if (!context) return res.status(404).json({ error: 'User not found' });

    res.json(context.settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * @swagger
 * /v1/notifications/settings:
 *   put:
 *     summary: Update current user's notification settings
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               emailEnabled:
 *                 type: boolean
 *               phoneEnabled:
 *                 type: boolean
 *               phoneNumber:
 *                 type: string
 *               minSeverityForCall:
 *                 type: string
 *                 enum: [HIGH, CRITICAL]
 *     responses:
 *       200:
 *         description: Settings updated
 */
router.put('/v1/notifications/settings', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { emailEnabled, phoneEnabled, phoneNumber, minSeverityForCall } = req.body;

    const updated = await prisma.notificationSettings.upsert({
      where: { userId },
      update: {
        emailEnabled,
        phoneEnabled,
        phoneNumber,
        minSeverityForCall: minSeverityForCall as Severity,
        updatedAt: new Date(),
      },
      create: {
        userId,
        emailEnabled: emailEnabled ?? true,
        phoneEnabled: phoneEnabled ?? false,
        phoneNumber,
        minSeverityForCall: (minSeverityForCall as Severity) || 'CRITICAL',
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
