import { Router } from 'express';
import { register, login, getProfile, googleAuth, googleCallback, verifyRegistration, forgotPassword, resetPassword, impersonateUser, updatePhone } from '../controllers/auth.controller';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware';

const router = Router();

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login with email and password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
router.post('/auth/login', login);

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - name
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: User already exists
 */
router.post('/auth/register', register);

router.post('/auth/verify-registration', verifyRegistration);
router.post('/auth/forgot-password', forgotPassword);
router.post('/auth/reset-password', resetPassword);
router.post('/auth/admin/users/:id/impersonate', requireAdmin, impersonateUser);
/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile data
 *       401:
 *         description: Unauthorized
 */
router.get('/auth/me', requireAuth, getProfile);
router.put('/auth/me/phone', requireAuth, updatePhone);

// Google OAuth
router.get('/auth/google', googleAuth);
router.get('/auth/google/callback', googleCallback);

// Health Check
router.get('/', (req, res) => {
    res.send('Auth Service is running');
});

export default router;
