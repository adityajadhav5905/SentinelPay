import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import routes from './api/routes';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3005;

// Middleware
app.use(cors());
app.use(express.json());


// Swagger Setup
const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Admin Service API',
            version: '1.0.0',
            description: 'API for System Administration and Analytics',
        },
        servers: [
            {
                url: `http://localhost:${PORT}`,
            },
        ],
    },
    apis: ['./src/api/*.ts'], // Path to the API docs
};

const specs = swaggerJsdoc(options);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
app.get('/docs-json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
});

// Routes
app.use('/admin', routes);

// Health Check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'UP', service: 'admin-service' });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Admin Service running on port ${PORT}`);
});

export default app;
