import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { z } from 'zod';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import cookieParser from 'cookie-parser';

import router from './api/routes';

// 1. Load Environment Variables
dotenv.config();

// 2. Validate Environment Variables
const envSchema = z.object({
    PORT: z.string().default('3002'),
    SERVICE_NAME: z.string().default('auth-service'),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    JWT_SECRET: z.string().default('devforce-secret-key'),
});

try {
    envSchema.parse(process.env);
} catch (error) {
    if (error instanceof z.ZodError) {
        console.error('Invalid Environment Variables:', error.errors.map(e => `${e.path}: ${e.message}`).join(', '));
        process.exit(1);
    }
}

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());
app.use(cookieParser());

// Swagger
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: { title: 'Auth Service API', version: '1.0.0' },
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'Enter JWT token from /auth/login response'
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
// Routes
app.use('/', router);
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: process.env.SERVICE_NAME });
});

// Start Server (Conditional)
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`✅ ${process.env.SERVICE_NAME} running on port ${PORT}`);
    });
}


export default app;
