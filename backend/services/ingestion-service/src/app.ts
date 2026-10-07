import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import fs from 'fs';
import { config } from './config';
import router from './api/routes';
import { kafkaProducer } from './kafka/producer';

// Ensure Upload Directory exists
if (!fs.existsSync(config.uploadDir)) {
    fs.mkdirSync(config.uploadDir, { recursive: true });
    console.log(`Created upload directory: ${config.uploadDir}`);
}

// App Initialization
const app = express();
const PORT = config.port;

app.use(cors({
    origin: true, // Reflect origin
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
}));
app.use(express.json());

// Swagger
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: { title: 'Ingestion Service API', version: '1.0.0' },
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'Enter JWT token from auth-service /auth/login'
                }
            }
        },
        security: [{ bearerAuth: [] }]
    },
    apis: ['./src/**/*.ts', './src/**/*.js', './dist/**/*.js'],
};
const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/docs-json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
});

// Routes
app.use('/v1', router);

// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: config.serviceName });
});

// Start Server (Conditional)
if (require.main === module) {
    const startServer = async () => {
        try {
            // Connect to Infrastructure
            await kafkaProducer.connect();

            app.listen(PORT, () => {
                console.log(`✅ ${config.serviceName} running on port ${PORT}`);
            });
        } catch (error) {
            console.error('❌ Failed to start server:', error);
            process.exit(1);
        }
    };

    startServer();

    // Graceful Shutdown
    const shutdown = async () => {
        console.log('Shutting down...');
        await kafkaProducer.disconnect();
        process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
}

export default app;
