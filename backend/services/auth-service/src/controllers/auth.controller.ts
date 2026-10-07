import { Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import axios from 'axios';
import { prisma } from '@sentinelpay/database';
import otpGenerator from 'otp-generator';
import { sendOTPEmail } from '../utils/email';

const JWT_SECRET = process.env.JWT_SECRET || 'devforce-secret-key';

// --- Validation Schemas ---
const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    name: z.string().min(2),
    phone: z.string().optional(),
});

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string(),
});

const verifyOtpSchema = z.object({
    email: z.string().email(),
    otp: z.string().length(6),
});

const forgotPasswordSchema = z.object({
    email: z.string().email(),
});

const resetPasswordSchema = z.object({
    email: z.string().email(),
    otp: z.string().length(6),
    newPassword: z.string().min(6),
});

// --- Controller Methods ---

export const register = async (req: Request, res: Response) => {
    try {
        const { email, password, name, phone } = registerSchema.parse(req.body);

        // Check if user exists
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            if (existingUser.isVerified) {
                return res.status(400).json({ error: 'User already exists and is verified. Please sign in.' });
            }
            // User exists but not verified, we can resend OTP and update password/name
            const hashedPassword = await bcrypt.hash(password, 10);
            const otp = otpGenerator.generate(6, { upperCaseAlphabets: false, specialChars: false, lowerCaseAlphabets: false });
            const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

            await prisma.user.update({
                where: { email },
                data: { name, password: hashedPassword, otp, otpExpiry, phone: phone || undefined, updatedAt: new Date() }
            });

            await sendOTPEmail(email, otp, 'registration');
            return res.status(200).json({ message: 'OTP sent successfully', isVerified: false });
        }

        // New User
        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = crypto.randomUUID();
        const otp = otpGenerator.generate(6, { upperCaseAlphabets: false, specialChars: false, lowerCaseAlphabets: false });
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

        // Insert User as unverified with OTP
        await prisma.user.create({
            data: { id: userId, email, password: hashedPassword, name, phone: phone || undefined, isVerified: false, otp, otpExpiry }
        });

        // Send Email
        await sendOTPEmail(email, otp, 'registration');

        res.status(201).json({ message: 'OTP sent successfully. Please verify your email.', isVerified: false });
    } catch (error) {
        console.error('Register Error:', error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const verifyRegistration = async (req: Request, res: Response) => {
    try {
        const { email, otp } = verifyOtpSchema.parse(req.body);

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.isVerified) {
            return res.status(400).json({ error: 'User is already verified' });
        }

        if (user.otp !== otp) {
            return res.status(400).json({ error: 'Invalid OTP' });
        }

        if (user.otpExpiry && new Date(user.otpExpiry).getTime() < Date.now()) {
            return res.status(400).json({ error: 'OTP has expired' });
        }

        // Validate success, mark verified, clear OTP
        await prisma.user.update({
            where: { email },
            data: { isVerified: true, otp: null, otpExpiry: null, updatedAt: new Date() }
        });

        // Initialize empty behavior profile since registration is now complete
        const profileExists = await prisma.userBehaviorProfile.findUnique({ where: { userId: user.id } });
        if (!profileExists) {
            await prisma.userBehaviorProfile.create({
                data: {
                    userId: user.id,
                    profileStatus: 'NEW',
                    dataMonthsCovered: 0,
                    minMonthsRequired: 6
                }
            });
        }

        // Generate Token
        const token = jwt.sign({ userId: user.id, email: user.email, role: user.role || 'USER' }, JWT_SECRET, { expiresIn: '7d' });

        res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
        res.status(200).json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, isVerified: true } });
    } catch (error) {
        console.error('Verify Registration Error:', error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const forgotPassword = async (req: Request, res: Response) => {
    try {
        const { email } = forgotPasswordSchema.parse(req.body);

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            // Return success even if not found to prevent email enumeration
            return res.status(200).json({ message: 'If that email exists, a reset code was sent.' });
        }

        // Don't modify auth strategy for social logins
        if (!user.password && user.googleId) {
            return res.status(400).json({ error: 'This account uses Google Sign-In. Please sign in with Google.' });
        }

        const otp = otpGenerator.generate(6, { upperCaseAlphabets: false, specialChars: false, lowerCaseAlphabets: false });
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

        await prisma.user.update({
            where: { email },
            data: { otp, otpExpiry, updatedAt: new Date() }
        });

        await sendOTPEmail(email, otp, 'reset');

        res.status(200).json({ message: 'If that email exists, a reset code was sent.' });
    } catch (error) {
        console.error('Forgot Password Error:', error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const resetPassword = async (req: Request, res: Response) => {
    try {
        const { email, otp, newPassword } = resetPasswordSchema.parse(req.body);

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(400).json({ error: 'Invalid reset code or email' });
        }

        if (user.otp !== otp) {
            return res.status(400).json({ error: 'Invalid reset code' });
        }

        if (user.otpExpiry && new Date(user.otpExpiry).getTime() < Date.now()) {
            return res.status(400).json({ error: 'Reset code has expired' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await prisma.user.update({
            where: { email },
            data: { password: hashedPassword, otp: null, otpExpiry: null, forcePasswordReset: false, updatedAt: new Date() }
        });

        res.status(200).json({ message: 'Password reset successfully. You can now log in.' });
    } catch (error) {
        console.error('Reset Password Error:', error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = loginSchema.parse(req.body);

        // Find User
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check Password (if exists)
        if (!user.password) {
            return res.status(400).json({ error: 'Please login with Google' });
        }

        // Check Verification
        if (user.isVerified === false) {
            return res.status(403).json({ error: 'Please verify your email address before logging in.', unverified: true });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check Account Status
        if (user.accountStatus === 'SUSPENDED') {
            return res.status(403).json({ error: 'Your account has been suspended. Please contact support.' });
        }
        if (user.accountStatus === 'BANNED') {
            return res.status(403).json({ error: 'Your account has been permanently banned.' });
        }

        // Check Force Password Reset
        if (user.forcePasswordReset) {
            const otp = otpGenerator.generate(6, { upperCaseAlphabets: false, specialChars: false, lowerCaseAlphabets: false });
            const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

            await prisma.user.update({
                where: { email },
                data: { otp, otpExpiry, updatedAt: new Date() }
            });

            await sendOTPEmail(email, otp, 'reset');
            return res.status(403).json({
                error: 'An administrator has forced a password reset for your account. A reset code has been sent to your email.',
                forceReset: true
            });
        }

        // Generate Token
        const token = jwt.sign({ userId: user.id, email: user.email, role: user.role || 'USER' }, JWT_SECRET, { expiresIn: '7d' });

        res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
        res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const impersonateUser = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const targetUser = await prisma.user.findUnique({ where: { id } });
        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Generate Short-lived Token (30m)
        const token = jwt.sign(
            { userId: targetUser.id, email: targetUser.email, role: targetUser.role || 'USER', impersonatedBy: (req as any).auth?.userId },
            JWT_SECRET,
            { expiresIn: '30m' }
        );

        res.json({ token, user: { id: targetUser.id, email: targetUser.email, name: targetUser.name, role: targetUser.role } });
    } catch (error) {
        console.error('Impersonate Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getProfile = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { subscription: true }
        });

        if (!user) return res.status(404).json({ error: 'User not found' });

        const subscription = user.subscription;

        // Format for frontend
        res.json({
            id: user.id, email: user.email, name: user.name, phone: user.phone, role: user.role, createdAt: user.createdAt,
            subscription: {
                plan: subscription?.plan || 'Free',
                status: subscription?.status || 'active'
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// --- Google OAuth ---
export const googleAuth = (req: Request, res: Response) => {
    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const REDIRECT_URI = `${process.env.API_URL || 'http://localhost:3002'}/auth/google/callback`;

    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=email%20profile`;
    res.redirect(url);
};

export const googleCallback = async (req: Request, res: Response) => {
    const code = req.query.code as string;
    if (!code) return res.status(400).json({ error: 'No code provided' });

    try {
        const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
        const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
        const REDIRECT_URI = `${process.env.API_URL || 'http://localhost:3002'}/auth/google/callback`;
        const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

        // 1. Exchange Code for Tokens
        const tokenValues = await axios.post('https://oauth2.googleapis.com/token', {
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            code,
            grant_type: 'authorization_code',
            redirect_uri: REDIRECT_URI,
        });

        const { access_token, id_token } = tokenValues.data;

        // 2. Get User Info
        const googleUserRes = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${access_token}` },
        });

        const googleUser = googleUserRes.data; // id, email, name, picture

        // 3. Upsert User
        let user = await prisma.user.findUnique({ where: { email: googleUser.email } });

        if (!user) {
            // New User
            const userId = crypto.randomUUID();
            user = await prisma.user.create({
                data: {
                    id: userId,
                    email: googleUser.email,
                    name: googleUser.name,
                    googleId: googleUser.id,
                    isVerified: true
                }
            });
            // Initialize empty behavior profile
            await prisma.userBehaviorProfile.create({
                data: {
                    userId: userId,
                    profileStatus: 'NEW',
                    dataMonthsCovered: 0,
                    minMonthsRequired: 6
                }
            });
        } else {
            // Existing User - Update googleId if missing
            if (!user.googleId) {
                user = await prisma.user.update({
                    where: { id: user.id },
                    data: { googleId: googleUser.id }
                });
            }
        }

        // 4. Issue JWT
        const token = jwt.sign({ userId: user.id, email: user.email, role: user.role || 'USER' }, JWT_SECRET, { expiresIn: '7d' });

        // 5. Redirect to Frontend with Token
        res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}`);

    } catch (error) {
        console.error('Google Auth Error:', error);
        res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=GoogleAuthFailed`);
    }
};

// --- Update Phone Number ---
export const updatePhone = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const schema = z.object({ phone: z.string().min(1) });
        const { phone } = schema.parse(req.body);

        await prisma.user.update({
            where: { id: userId },
            data: { phone }
        });

        res.json({ message: 'Phone number updated successfully', phone });
    } catch (error) {
        console.error('Update Phone Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
