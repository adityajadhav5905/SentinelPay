import { Request, Response } from 'express';
import { prisma, SubscriptionStatus, InvoiceStatus } from '@sentinelpay/database';

export const handleRazorpayWebhook = async (req: Request, res: Response) => {
  try {
    console.log('Received Webhook:', JSON.stringify(req.body));

    const { event, payload } = req.body;

    if (event === 'payment.captured') {
      const { id: paymentId, order_id: orderId, amount, currency } = payload.payment.entity;

      // Find subscription by orderId
      const subscription = await prisma.subscription.findUnique({
        where: { razorpayOrderId: orderId }
      });

      if (subscription) {
        // Update subscription status
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            status: SubscriptionStatus.ACTIVE,
            updatedAt: new Date()
          }
        });

        // Insert Payment Log
        await prisma.paymentLog.create({
          data: {
            userId: subscription.userId,
            razorpayPaymentId: paymentId,
            razorpayOrderId: orderId,
            amount: amount / 100,
            currency: currency,
            status: 'captured',
            method: 'webhook'
          }
        });

        // Insert Invoice
        await prisma.invoice.create({
          data: {
            userId: subscription.userId,
            subscriptionId: subscription.id,
            amount: amount / 100,
            currency: currency,
            status: InvoiceStatus.PAID,
            billingPeriodStart: new Date(),
            billingPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          }
        });

        console.log(`Invoice generated for User ${subscription.userId}`);
      }
    }

    res.json({ status: 'ok' });

  } catch (error) {
    console.error('Webhook Error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};
