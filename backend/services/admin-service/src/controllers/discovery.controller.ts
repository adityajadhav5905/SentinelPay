import { Request, Response } from 'express';
import { discoverRoutes } from '../services/discovery.service';

export const getDiscoveredRoutes = async (req: Request, res: Response) => {
    try {
        const routes = await discoverRoutes();
        res.json(routes);
    } catch (error) {
        console.error('Discovery Error:', error);
        res.status(500).json({ error: 'Failed to discover routes' });
    }
};
