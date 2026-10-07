import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3001';

export class OtpService {
    private redis: Redis;

    constructor() {
        this.redis = new Redis(REDIS_URL);
    }

    /**
     * Generate a 6-digit OTP and store it in Redis with TTL
     */
    async generateOtp(email: string): Promise<string> {
        // Generate 6 digit code
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Store in Redis with 5 minute expiration (300 seconds)
        const key = `auth:otp:${email}`;
        await this.redis.set(key, otp, 'EX', 300);

        return otp;
    }

    /**
     * Verify the OTP provided by the user
     */
    async verifyOtp(email: string, code: string): Promise<boolean> {
        // Backdoor for testing/dev if needed
        if (process.env.NODE_ENV === 'development' && code === '000000') {
            return true;
        }

        const key = `auth:otp:${email}`;
        const storedOtp = await this.redis.get(key);

        if (!storedOtp) return false;

        if (storedOtp === code) {
            // Invalidate OTP after successful use
            await this.redis.del(key);
            return true;
        }

        return false;
    }

    /**
     * Send OTP via Notification Service
     */
    async sendOtpEmail(email: string, otp: string): Promise<boolean> {
        try {
            console.log(`Sending OTP ${otp} to ${email} via ${NOTIFICATION_SERVICE_URL}`);

            // In a real K8s/Docker environment, we use service names.
            // For local dev, we might need localhost port if not in docker network.
            const response = await fetch(`${NOTIFICATION_SERVICE_URL}/v1/notifications/test/email`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    to: email,
                    subject: 'Your SentinelPay Verification Code',
                    body: `Your verification code is: ${otp}. It expires in 5 minutes.`
                })
            });

            if (!response.ok) {
                console.error('Failed to send email via notification service:', await response.text());
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error calling notification service:', error);
            return false;
        }
    }
}

export const otpService = new OtpService();
