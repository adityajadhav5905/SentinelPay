import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.middleware';
import * as statsController from '../controllers/stats.controller';
import * as userController from '../controllers/user.controller';
import * as modelController from '../controllers/model.controller';
import * as proxyController from '../controllers/proxy.controller';
import * as discoveryController from '../controllers/discovery.controller';

const router = Router();

// Middleware: All routes require ADMIN role
router.use(requireAdmin);

// Dashboard Stats
router.get('/stats', statsController.getSystemStats);
router.get('/stats/charts', statsController.getChartData);

// User Management
router.get('/users', userController.listUsers);
router.patch('/users/:id/role', userController.updateUserRole);
router.patch('/users/:id/status', userController.updateUserStatus);
router.patch('/users/:id/force-reset', userController.forcePasswordReset);
router.patch('/users/:id/subscription', userController.updateUserSubscription);

// Model Management
router.get('/models', modelController.listModels);
router.post('/models/retrain', modelController.retrainModel);

// API Discovery & Proxy
router.get('/routes', discoveryController.getDiscoveredRoutes);
router.post('/proxy', proxyController.proxyRequest);

export default router;
