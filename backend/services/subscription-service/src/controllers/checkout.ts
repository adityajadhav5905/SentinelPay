import { Request, Response } from 'express';
import razorpayService from '../services/razorpay';
import { prisma, SubscriptionPlan, SubscriptionStatus, InvoiceStatus } from '@sentinelpay/database';
import crypto from 'crypto';

export const createOrder = async (req: Request, res: Response) => {
  try {
    const { planId } = req.body;
    // @ts-ignore
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!planId) {
      return res.status(400).json({ error: 'planId is required' });
    }

    let amount = 0;

    // Normalize plan ID
    const plan = planId.toLowerCase();

    // Map Plans to Enum
    const planMap: Record<string, SubscriptionPlan> = {
      'free': SubscriptionPlan.FREE,
      'basic': SubscriptionPlan.BASIC,
      'pro': SubscriptionPlan.PRO,
      'enterprise': SubscriptionPlan.ENTERPRISE,
      // Legacy support
      'starter': SubscriptionPlan.BASIC,
      'advanced': SubscriptionPlan.PRO
    };

    const enumPlan = planMap[plan];
    if (!enumPlan) {
      return res.status(400).json({ error: `Invalid planId ${plan}. Available: basic, pro, enterprise` });
    }

    switch (plan) {
      case 'free':
        amount = 0;
        break;
      case 'basic':
      case 'starter':
        amount = 2900; // 29 * 100
        break;
      case 'pro':
      case 'advanced':
        amount = 9900; // 99 * 100
        break;
      case 'enterprise':
        amount = 29900;
        break;
      default:
      // Already validated
    }

    if (amount === 0) {
      // Free plan logic - just update DB immediately
      await prisma.subscription.upsert({
        where: { userId },
        create: {
          userId,
          plan: enumPlan,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          features: {}
        },
        update: {
          plan: enumPlan,
          status: SubscriptionStatus.ACTIVE,
          updatedAt: new Date()
        }
      });
      return res.json({ success: true, message: 'Switched to free plan' });
    }

    const receipt = `receipt_${userId.substring(0, 8)}_${Date.now()}`;
    console.log(`[DEBUG] Creating Razorpay order. Amount: ${amount}, Receipt: ${receipt}`);
    const order = await razorpayService.createOrder(amount / 100, 'INR', receipt);
    console.log(`[DEBUG] Razorpay order created: ${(order as any).id}`);

    // Create PENDING subscription
    await prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        plan: enumPlan,
        status: SubscriptionStatus.UNPAID,
        razorpayOrderId: (order as any).id,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        features: {}
      },
      update: {
        plan: enumPlan,
        status: SubscriptionStatus.UNPAID,
        razorpayOrderId: (order as any).id,
        updatedAt: new Date()
      }
    });

    res.status(201).json({
      success: true,
      orderId: (order as any).id,
      amount: (order as any).amount, // In paise
      currency: (order as any).currency,
      key: process.env.RAZORPAY_KEY_ID,
      planId
    });

  } catch (error) {
    console.error('Create Order Controller Error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
};

export const verifyOrder = async (req: Request, res: Response) => {
  try {
    const { orderId, paymentId, signature } = req.body;
    // @ts-ignore
    const userId = req.auth?.userId; // Optional validation

    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({ error: 'Missing verification parameters' });
    }

    const isValid = razorpayService.verifyPaymentSignature(orderId, paymentId, signature);

    if (!isValid) {
      return res.status(400).json({ error: 'Invalid Payment Signature' });
    }

    // Activate Subscription
    const sub = await prisma.subscription.updateMany({
      where: { razorpayOrderId: orderId },
      data: { status: SubscriptionStatus.ACTIVE, updatedAt: new Date() }
    });

    if (sub.count === 0) {
      return res.status(404).json({ error: 'Subscription order not found' });
    }

    // Fetch the updated subscription to get info
    const subscription = await prisma.subscription.findFirst({
      where: { razorpayOrderId: orderId }
    });

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found after update' });
    }

    // Log Payment
    await prisma.paymentLog.create({
      data: {
        userId: subscription.userId,
        razorpayPaymentId: paymentId,
        razorpayOrderId: orderId,
        razorpaySignature: signature,
        amount: 49.00, // Hardcoded for now
        currency: 'INR',
        status: 'captured',
        method: 'card'
      }
    });

    // Create Invoice
    await prisma.invoice.create({
      data: {
        userId: subscription.userId,
        subscriptionId: subscription.id,
        amount: 49.00,
        currency: 'INR',
        status: InvoiceStatus.GENERATED,
        billingPeriodStart: new Date(),
        billingPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });

    res.json({ success: true, message: 'Subscription activated' });

  } catch (error) {
    console.error('Verify Order Error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
};
