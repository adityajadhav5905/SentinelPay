import axios from 'axios';

// Map of services and their ports (or URLs if in K8s/Docker DNS)
// We assume we are running inside the docker network where hostnames resolve.
// Fallback to localhost for local dev if needed.

const SERVICES = [
    { name: 'ingestion-service', url: 'http://ingestion-service:3000' },
    { name: 'auth-service', url: 'http://auth-service:3002' },
    { name: 'analytics-service', url: 'http://analytics-service:3003' },
    { name: 'notification-service', url: 'http://notification-service:3001' },
    { name: 'subscription-service', url: 'http://subscription-service:3004' }
];

export const discoverRoutes = async () => {
    const predictions = await Promise.all(
        SERVICES.map(async (service) => {
            try {
                // Determine URL based on environment
                let baseUrl = service.url;
                if (process.env.NODE_ENV === 'development' && !process.env.KAFKA_BOOTSTRAP_SERVERS?.includes('redpanda')) {
                    // Local dev (outside docker)
                    baseUrl = service.url.replace(service.name, 'localhost');
                }

                const { data: spec } = await axios.get(`${baseUrl}/docs-json`, { timeout: 2000 });

                const endpoints: any[] = [];

                if (spec.paths) {
                    Object.entries(spec.paths).forEach(([path, methods]: [string, any]) => {
                        Object.entries(methods).forEach(([method, details]: [string, any]) => {
                            endpoints.push({
                                method: method.toUpperCase(),
                                path: path,
                                summary: details.summary || '',
                                tags: details.tags || ['Default'],
                                description: details.description || '',
                                body: details.requestBody
                                    ? JSON.stringify(details.requestBody?.content?.['application/json']?.schema?.example || {}, null, 2)
                                    : '{}'
                            });
                        });
                    });
                }

                return {
                    service: service.name,
                    port: parseInt(service.url.split(':').pop() || '80'),
                    status: 'UP',
                    endpoints
                };
            } catch (error) {
                // Service might be down
                return {
                    service: service.name,
                    status: 'DOWN',
                    endpoints: []
                };
            }
        })
    );

    return predictions;
};
