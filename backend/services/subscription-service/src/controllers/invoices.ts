import { Request, Response } from 'express';
import { prisma } from '@sentinelpay/database';
import { generateInvoicePDF } from '../services/invoiceGenerator';

export const listInvoices = async (req: Request, res: Response) => {
  try {
    // Assuming user_id is passed in query for now (in real app, use auth middleware)
    const { userId } = req.query;

    const invoices = await prisma.invoice.findMany({
      where: userId ? { userId: userId as string } : undefined,
      orderBy: { createdAt: 'desc' }
    });

    res.json(invoices);
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const downloadInvoice = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Try to find the payment log associated with this subscription
    const paymentLog = await prisma.paymentLog.findFirst({
      where: { userId: invoice.userId },
      orderBy: { createdAt: 'desc' }
    });

    const invoiceData = {
      paymentId: paymentLog?.razorpayPaymentId || `INV-${invoice.id}`,
      userId: invoice.userId,
      amount: invoice.amount.toNumber(),
      date: invoice.createdAt.toISOString().split('T')[0],
      currency: invoice.currency
    };

    const doc = generateInvoicePDF(invoiceData);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${id}.pdf`);

    doc.pipe(res);
  } catch (error) {
    console.error('Error generating invoice PDF:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
