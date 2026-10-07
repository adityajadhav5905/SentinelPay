// Simple unit test for validators - avoids complex app initialization
import { TransactionSchema } from '../src/api/validators';

describe('Transaction Validator', () => {
    it('should validate a valid transaction', () => {
        const validTx = {
            txId: 'tx_123',
            amount: 100.50,
            currency: 'USD',
            userId: 'user_abc',
            merchant: 'Test Store',
        };

        const result = TransactionSchema.safeParse(validTx);
        expect(result.success).toBe(true);
    });

    it('should reject invalid transaction (negative amount)', () => {
        const invalidTx = {
            txId: 'tx_123',
            amount: -50,
            currency: 'USD',
            userId: 'user_abc',
        };

        const result = TransactionSchema.safeParse(invalidTx);
        expect(result.success).toBe(false);
    });

    it('should reject invalid transaction (missing userId)', () => {
        const invalidTx = {
            txId: 'tx_123',
            amount: 100,
            currency: 'USD',
        };

        const result = TransactionSchema.safeParse(invalidTx);
        expect(result.success).toBe(false);
    });

    it('should add default timestamp if not provided', () => {
        const txWithoutTimestamp = {
            txId: 'tx_123',
            amount: 100,
            currency: 'USD',
            userId: 'user_abc',
        };

        const result = TransactionSchema.parse(txWithoutTimestamp);
        expect(result.timestamp).toBeDefined();
    });
});
