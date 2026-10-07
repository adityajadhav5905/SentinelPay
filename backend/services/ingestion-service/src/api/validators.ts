import { z } from 'zod';

export const TransactionSchema = z.object({
    txId: z.string().min(1),
    amount: z.number().positive(),
    currency: z.string().length(3).toUpperCase(), // ISO 4217, e.g. "USD"
    userId: z.string().optional(),
    endUserId: z.string().optional(),
    merchant: z.string().optional(),
    timestamp: z.string().datetime({ offset: true }).optional().default(() => new Date().toISOString()),
    location: z.string().optional(),
    category: z.string().optional(),
});

export const BatchUploadSchema = z.object({
    // We don't validate the file content here deep, just that it exists
    // The controller checks `req.file`
});

export type Transaction = z.infer<typeof TransactionSchema>;
