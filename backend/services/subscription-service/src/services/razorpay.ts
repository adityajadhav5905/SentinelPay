import Razorpay from 'razorpay';
import crypto from 'crypto';

class RazorpayService {
  instance: any;

  constructor() {
    this.instance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_dev12345678',
      key_secret: process.env.RAZORPAY_KEY_SECRET || 'dev_secret_12345678',
    });
  }

  async createOrder(amount: number, currency: string = 'INR', receipt: string) {
    try {
      const options = {
        amount: amount * 100, // amount in the smallest currency unit
        currency,
        receipt,
      };
      const order = await this.instance.orders.create(options);
      return order;
    } catch (error) {
      console.error('Razorpay Order Creation Error:', error);
      throw error;
    }
  }

  verifyPaymentSignature(order_id: string, payment_id: string, signature: string) {
    const generated_signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
      .update(order_id + '|' + payment_id)
      .digest('hex');

    return generated_signature === signature;
  }
}

export default new RazorpayService();
