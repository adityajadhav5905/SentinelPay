import { Request, Response } from 'express';
import axios from 'axios';

/**
 * Proxy request to internal services
 * POST /admin/proxy
 * Body: { service: 'ingestion-service', port: 3000, method: 'POST', path: '/v1/upload', body: {...} }
 */
export const proxyRequest = async (req: Request, res: Response) => {
    try {
        const { service, port, method, path, body, headers } = req.body;

        if (!service || !path) {
            return res.status(400).json({ error: 'Service and path are required' });
        }

        // Construct internal URL (Docker DNS)
        // In local dev without docker, this might fail unless we map ports. 
        // For this task assume we are in Docker network OR addressing localhost ports if running locally.

        let baseUrl = `http://${service}:${port}`;

        // If running locally on host (outside docker), we might want to target localhost
        if (process.env.NODE_ENV === 'development' && !process.env.KAFKA_BOOTSTRAP_SERVERS?.includes('redpanda')) {
            baseUrl = `http://localhost:${port}`;
        }

        const url = `${baseUrl}${path}`;

        console.log(`Proxying ${method} request to ${url}`);

        const response = await axios({
            method: method || 'GET',
            url: url,
            data: body,
            headers: {
                ...headers,
                'Content-Type': 'application/json'
                // Add Authorization header if needed? Admin token != User token. 
                // We might want to pass the Admin's token or a Service Token. 
                // For now, pass what user sent in headers if any.
            },
            validateStatus: () => true // Don't throw on error status
        });

        res.status(response.status).json(response.data);

    } catch (error: any) {
        console.error('Proxy Error:', error.message);
        res.status(500).json({ error: 'Proxy request failed', details: error.message });
    }
};
