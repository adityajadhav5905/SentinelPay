
import { PrismaClient } from '@sentinelpay/database';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Checking recent Anomalies ---');
    const anomalies = await prisma.anomaly.findMany({
        take: 5,
        orderBy: { detectedAt: 'desc' },
        select: { id: true, userId: true, severity: true, detectedAt: true }
    });
    console.log('Recent Anomalies:', anomalies);

    console.log('--- Checking recent Transactions ---');
    const transactions = await prisma.transaction.findMany({
        take: 5,
        orderBy: { ingestedAt: 'desc' },
        select: { id: true, userId: true, txId: true }
    });
    console.log('Recent Transactions:', transactions);

    console.log('--- Checking Users ---');
    const users = await prisma.user.findMany({
        take: 5,
        select: { id: true, email: true }
    });
    console.log('Users:', users);
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
