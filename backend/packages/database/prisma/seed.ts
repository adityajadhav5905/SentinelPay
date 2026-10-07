import { PrismaClient, UserRole, SubscriptionPlan, SubscriptionStatus, ProfileStatus, Severity, DecisionAction, InvestigationStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting SentinelPay Database Seeding with Agentic Investigation Core & RAG...');

    const adminPasswordHash = await bcrypt.hash('Admin@123456', 10);
    const demoPasswordHash = await bcrypt.hash('Demo@123456', 10);

    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

    // 1. Admin User
    const admin = await prisma.user.upsert({
        where: { email: 'admin@sentinelpay.io' },
        update: { password: adminPasswordHash, role: UserRole.ADMIN, isVerified: true, accountStatus: 'ACTIVE' },
        create: {
            id: 'user_admin_sentinel',
            email: 'admin@sentinelpay.io',
            name: 'SentinelPay Administrator',
            password: adminPasswordHash,
            role: UserRole.ADMIN,
            isVerified: true,
            accountStatus: 'ACTIVE',
            phone: '+15550001111',
            location: 'San Francisco, CA',
            bio: 'Lead Security & Anomaly Detection Admin at SentinelPay'
        }
    });

    await prisma.subscription.upsert({
        where: { userId: admin.id },
        update: { plan: SubscriptionPlan.ENTERPRISE, status: SubscriptionStatus.ACTIVE, currentPeriodEnd: oneYearFromNow },
        create: {
            userId: admin.id,
            plan: SubscriptionPlan.ENTERPRISE,
            status: SubscriptionStatus.ACTIVE,
            currentPeriodStart: new Date(),
            currentPeriodEnd: oneYearFromNow,
            features: { realtime: true, alerting: true, retention_days: 365, api_rate_limit: 10000, custom_models: true, agentic_investigations: true }
        }
    });

    await prisma.userBehaviorProfile.upsert({
        where: { userId: admin.id },
        update: { profileStatus: ProfileStatus.READY, dataMonthsCovered: 12, minMonthsRequired: 6 },
        create: { userId: admin.id, profileStatus: ProfileStatus.READY, dataMonthsCovered: 12, minMonthsRequired: 6 }
    });

    // 2. Demo User
    const demoUser = await prisma.user.upsert({
        where: { email: 'demo@sentinelpay.io' },
        update: { password: demoPasswordHash, role: UserRole.USER, isVerified: true, accountStatus: 'ACTIVE' },
        create: {
            id: 'user_demo_sentinel',
            email: 'demo@sentinelpay.io',
            name: 'SentinelPay Demo Account',
            password: demoPasswordHash,
            role: UserRole.USER,
            isVerified: true,
            accountStatus: 'ACTIVE',
            phone: '+15552223333',
            location: 'Mumbai, IN',
            bio: 'SentinelPay Evaluation & Demo Account'
        }
    });

    await prisma.subscription.upsert({
        where: { userId: demoUser.id },
        update: { plan: SubscriptionPlan.PRO, status: SubscriptionStatus.ACTIVE, currentPeriodEnd: oneYearFromNow },
        create: {
            userId: demoUser.id,
            plan: SubscriptionPlan.PRO,
            status: SubscriptionStatus.ACTIVE,
            currentPeriodStart: new Date(),
            currentPeriodEnd: oneYearFromNow,
            features: { realtime: true, alerting: true, retention_days: 90, api_rate_limit: 1000, agentic_investigations: true }
        }
    });

    await prisma.userBehaviorProfile.upsert({
        where: { userId: demoUser.id },
        update: {
            profileStatus: ProfileStatus.READY,
            dataMonthsCovered: 6,
            minMonthsRequired: 6,
            avgAmount: 2450.0,
            stdAmount: 1200.0,
            p95Amount: 6500.0,
            maxAmount: 18000.0
        },
        create: {
            userId: demoUser.id,
            profileStatus: ProfileStatus.READY,
            dataMonthsCovered: 6,
            minMonthsRequired: 6,
            avgAmount: 2450.0,
            stdAmount: 1200.0,
            p95Amount: 6500.0,
            maxAmount: 18000.0
        }
    });

    await prisma.notificationSettings.upsert({
        where: { userId: demoUser.id },
        update: {},
        create: { userId: demoUser.id, emailEnabled: true, phoneEnabled: false }
    });

    // Backward compatibility users
    await prisma.user.upsert({
        where: { email: 'admin@sentinelpay.io' },
        update: { password: adminPasswordHash, role: UserRole.ADMIN, isVerified: true },
        create: { id: 'user_admin_001', email: 'admin@sentinelpay.io', name: 'Admin User', password: adminPasswordHash, role: UserRole.ADMIN, isVerified: true }
    });

    await prisma.user.upsert({
        where: { email: 'demo@sentinelpay.io' },
        update: { password: demoPasswordHash, role: UserRole.USER, isVerified: true },
        create: { id: 'user_demo_001', email: 'demo@sentinelpay.io', name: 'Demo User', password: demoPasswordHash, role: UserRole.USER, isVerified: true }
    });

    // 3. Seed Fraud Knowledge Base Docs (RAG Corpus)
    console.log('📚 Seeding RAG Knowledge Base Documents...');
    const knowledgeDocs = [
        {
            code: 'PAT-001',
            title: 'High-Velocity UPI Micro-Burst Smurfing',
            category: 'FRAUD_PATTERN',
            summary: 'Rapid sequence of 5-15 small transactions within minutes to drain accounts or test stolen credentials.',
            content: 'Attackers utilize automated scripts to trigger multiple sub-threshold UPI transactions (e.g. ₹4,999 each) to bypass single-transaction OTP thresholds. Indicators: velocity > 4 txns/min, disparate recipient VPA handles, rapid IP rotation.',
            tags: ['UPI', 'Velocity', 'Smurfing', 'Account Takeover']
        },
        {
            code: 'PAT-002',
            title: 'Account Takeover with High-Value Electronics Purchasing',
            category: 'FRAUD_PATTERN',
            summary: 'Sudden spike in high-ticket electronics/luxury retail following credential or device fingerprint changes.',
            content: 'Observed when compromised credentials are used to purchase easily re-sellable high-liquidity assets (smartphones, gift cards, luxury watches). The transaction amount typically exceeds the user 99th percentile historical expenditure by 5x or more.',
            tags: ['ATO', 'High Value', 'Electronics', 'Behavioral Shift']
        },
        {
            code: 'PAT-003',
            title: 'Impossible Travel & Geolocation Teleportation',
            category: 'FRAUD_PATTERN',
            summary: 'Transactions authenticated from physical POS terminals in distant geographic locations within impossible travel times.',
            content: 'Calculated using Great Circle Distance vs elapsed time. If effective transit velocity exceeds 800 km/h between card-present physical terminals without airport travel logs, fraud probability is near certainty.',
            tags: ['Geo-Velocity', 'Impossible Travel', 'Card Present', 'Cloning']
        },
        {
            code: 'POL-RBI-2026-08',
            title: 'RBI Directive on Step-Up Authentication for Anomaly Flags',
            category: 'REGULATION',
            summary: 'Regulatory requirement to trigger automated Out-of-Band (OOB) authentication or interactive voice verification on high-risk flags.',
            content: 'Under Master Direction on Digital Payment Security (2026 Revision Section 4.2), any payment scoring above 0.75 composite anomaly index or deviating by >3 sigma from established customer profile must undergo step-up biometric or IVR verification.',
            tags: ['RBI', 'Compliance', '2FA', 'Verification']
        },
        {
            code: 'POL-PCI-401',
            title: 'PCI-DSS v4.0 Critical Risk Interception Protocol',
            category: 'INTERNAL_POLICY',
            summary: 'Instantaneous authorization freeze on transactions linked to blacklisted merchant categories or active botnets.',
            content: 'SentinelPay internal risk policy mandates immediate pre-auth hold (Action: BLOCK) when ML initial score > 0.88 and RAG corroborates active credential stuffing campaign.',
            tags: ['PCI-DSS', 'Governance', 'Auto-Block', 'Policy']
        },
        {
            code: 'CASE-2025-942',
            title: 'Precedent: Coordinated Mule Ring Attack in Western Region',
            category: 'FRAUD_CASE',
            summary: 'Historical case study of 42 mule accounts compromised via phishing kit masquerading as utility bill discount.',
            content: 'Analysis of incident from Q4 2025 where compromised accounts initiated instant IMPS transfers to newly added beneficiaries between 02:00 AM and 04:30 AM. SHAP analysis highlighted nocturnal timing and new beneficiary as decisive risk factors.',
            tags: ['Case Study', 'Mule Accounts', 'Nocturnal', 'Phishing']
        }
    ];

    for (const doc of knowledgeDocs) {
        await prisma.fraudKnowledgeDoc.upsert({
            where: { code: doc.code },
            update: doc,
            create: doc
        });
    }

    // 4. Seed Decision Policies (Governance Layer)
    console.log('⚖️ Seeding Decision Governance Policies...');
    const policies = [
        {
            name: 'Critical Risk Auto-Block Policy',
            description: 'Instantly block transactions with composite risk >= 0.90 or proven impossible travel',
            condition: 'riskScore >= 0.90 OR ruleViolations.contains("GEO_IMPOSSIBLE")',
            action: DecisionAction.BLOCK,
            priority: 1,
            isEnabled: true
        },
        {
            name: 'High Risk Step-Up Verification Policy',
            description: 'Trigger SMS OTP / Voice call verification when risk is elevated (0.70 - 0.89)',
            condition: 'riskScore >= 0.70 AND riskScore < 0.90',
            action: DecisionAction.VERIFY,
            priority: 2,
            isEnabled: true
        },
        {
            name: 'Medium Risk Analyst Review Policy',
            description: 'Flag transactions (0.50 - 0.69) for analyst investigation without immediate rejection',
            condition: 'riskScore >= 0.50 AND riskScore < 0.70',
            action: DecisionAction.FLAG,
            priority: 3,
            isEnabled: true
        },
        {
            name: 'Standard Low-Risk Auto-Approval',
            description: 'Seamlessly approve legitimate transactions scoring below 0.50',
            condition: 'riskScore < 0.50',
            action: DecisionAction.APPROVE,
            priority: 4,
            isEnabled: true
        }
    ];

    for (const pol of policies) {
        const existing = await prisma.decisionPolicy.findFirst({ where: { name: pol.name } });
        if (existing) {
            await prisma.decisionPolicy.update({ where: { id: existing.id }, data: pol });
        } else {
            await prisma.decisionPolicy.create({ data: pol });
        }
    }

    // 5. Seed Demonstration Transactions, Anomalies & Agentic Investigation Cases
    console.log('🕵️ Seeding Agentic Investigation Cases...');

    // Case 1: High-Value Luxury Spree
    const tx1 = await prisma.transaction.upsert({
        where: { txId_userId: { txId: 'TXN-98421-LUX', userId: demoUser.id } },
        update: {},
        create: {
            txId: 'TXN-98421-LUX',
            userId: demoUser.id,
            amount: 145000.0,
            currency: 'INR',
            endUserId: 'cust_882',
            merchant: 'Grand Luxury Jewels & Watches',
            category: 'Jewelry & Luxury',
            location: 'Mumbai, IN',
            timestamp: new Date(Date.now() - 15 * 60 * 1000), // 15 mins ago
            source: 'REALTIME_API'
        }
    });

    const anom1 = await prisma.anomaly.upsert({
        where: { id: 'anom_case_001' },
        update: {},
        create: {
            id: 'anom_case_001',
            userId: demoUser.id,
            transactionId: tx1.id,
            modelVersion: 'IsolationForest_v1.0.0',
            severity: Severity.CRITICAL,
            score: 0.94,
            ruleViolations: ['AMOUNT_P99_BREACH', 'VELOCITY_BURST', 'MERCHANT_RISK_ELEVATED'],
            explanation: 'Transaction of ₹1,45,000 exceeds user 95th percentile historical spending (₹6,500) by 22.3x with 4 previous transactions in past 10 minutes.'
        }
    });

    const case1 = await prisma.investigationCase.upsert({
        where: { caseNumber: 'INV-2026-0042' },
        update: {},
        create: {
            caseNumber: 'INV-2026-0042',
            userId: demoUser.id,
            transactionId: tx1.id,
            anomalyId: anom1.id,
            status: InvestigationStatus.PENDING_REVIEW,
            priority: Severity.CRITICAL,
            riskScore: 0.94,
            agentConfidence: 0.96,
            summary: 'High-confidence Account Takeover indicator. Unprecedented 22x spending deviation coupled with velocity burst at high-risk luxury jewelry merchant.',
            recommendation: DecisionAction.BLOCK,
            decisionNotes: 'Agent recommends immediate block under PCI-DSS-401 and outbound SMS alert.'
        }
    });

    await prisma.agentInvestigation.upsert({
        where: { caseId: case1.id },
        update: {},
        create: {
            caseId: case1.id,
            framework: 'LangGraph',
            planSteps: [
                { step: 1, action: 'Investigation Planning', detail: 'Initialize multi-agent DAG: Profile Analyzer, Velocity Engine, RAG Corpus, SHAP Explainer', status: 'COMPLETED' },
                { step: 2, action: 'Context Retrieval', detail: 'Fetched 6-month historical behavioral baseline and 24h velocity timeline from Redis/Postgres', status: 'COMPLETED' },
                { step: 3, action: 'SHAP Explainability Calculation', detail: 'Generated Shapley additive explanations on Isolation Forest model output', status: 'COMPLETED' },
                { step: 4, action: 'RAG Knowledge Lookup', detail: 'Queried ChromaDB vector index with semantic embeddings of transaction context', status: 'COMPLETED' },
                { step: 5, action: 'Evidence Correlation & Synthesis', detail: 'Correlated 4 independent risk vectors into unified decision matrix', status: 'COMPLETED' }
            ],
            toolsUsed: ['SHAP_EXPLAINER', 'VECTOR_SEARCH_RAG', 'VELOCITY_ANALYZER', 'BEHAVIOR_PROFILER'],
            shapFactors: [
                { feature: 'amount_vs_historical_p95', importance: 0.48, value: '22.3x (₹1,45,000 vs ₹6,500)', direction: 'INCREASES_RISK' },
                { feature: 'velocity_10min_count', importance: 0.26, value: '5 txns in 10 mins (Baseline: 0.02)', direction: 'INCREASES_RISK' },
                { feature: 'merchant_category_risk_score', importance: 0.16, value: 'Jewelry / High-Liquidity Luxury (Score: 0.88)', direction: 'INCREASES_RISK' },
                { feature: 'time_of_day_deviation', importance: 0.10, value: 'Within typical daylight hours (14:30)', direction: 'DECREASES_RISK' }
            ],
            ragCitations: [
                { code: 'PAT-002', title: 'Account Takeover with High-Value Electronics Purchasing', similarity: 0.95, snippet: 'Compromised credentials leveraged to purchase high-liquidity assets exceeding 99th percentile spending by >5x.' },
                { code: 'POL-PCI-401', title: 'PCI-DSS Critical Risk Interception Protocol', similarity: 0.91, snippet: 'Mandates instantaneous authorization freeze on transactions scoring >0.88 with active pattern matches.' }
            ],
            behavioralSignals: {
                userMaturity: 'MATURE (6 Months)',
                typicalDailyTxnCount: 1.8,
                current10MinVelocity: 5,
                historicalMaxAmount: 18000,
                currentAmount: 145000,
                deviationSigma: '+8.4 sigma'
            },
            agentReasoning: `Agentic synthesis concluded high confidence of malicious activity. 
1. Feature Deviation: The requested ₹1,45,000 transaction is 8.4 standard deviations above the user established historical mean (₹2,450).
2. Velocity Corroboration: Four preceding micro-transactions occurred within 8 minutes at food delivery merchants before this burst, matching known card validation smurfing.
3. RAG Knowledge Corroboration: Pattern matches PAT-002 with 95% semantic alignment.
Conclusion: Deterministic governance policy POL-PCI-401 applies. Recommend immediate BLOCK and automated IVR/SMS dispatch.`,
            correlationScore: 0.96
        }
    });

    // Case 2: Impossible Travel Geolocation Anomaly
    const tx2 = await prisma.transaction.upsert({
        where: { txId_userId: { txId: 'TXN-71204-GEO', userId: demoUser.id } },
        update: {},
        create: {
            txId: 'TXN-71204-GEO',
            userId: demoUser.id,
            amount: 62400.0,
            currency: 'INR',
            endUserId: 'cust_882',
            merchant: 'Heathrow Terminal 5 Duty Free',
            category: 'Travel & Retail',
            location: 'London, UK',
            timestamp: new Date(Date.now() - 45 * 60 * 1000), // 45 mins ago
            source: 'REALTIME_API'
        }
    });

    const anom2 = await prisma.anomaly.upsert({
        where: { id: 'anom_case_002' },
        update: {},
        create: {
            id: 'anom_case_002',
            userId: demoUser.id,
            transactionId: tx2.id,
            modelVersion: 'IsolationForest_v1.0.0',
            severity: Severity.HIGH,
            score: 0.82,
            ruleViolations: ['GEO_IMPOSSIBLE_TRAVEL', 'INTERNATIONAL_CROSS_BORDER'],
            explanation: 'Physical transaction in London, UK occurred only 22 minutes after a chip-verified transaction in Mumbai, India (Speed: 19,600 km/h).'
        }
    });

    const case2 = await prisma.investigationCase.upsert({
        where: { caseNumber: 'INV-2026-0043' },
        update: {},
        create: {
            caseNumber: 'INV-2026-0043',
            userId: demoUser.id,
            transactionId: tx2.id,
            anomalyId: anom2.id,
            status: InvestigationStatus.PENDING_REVIEW,
            priority: Severity.HIGH,
            riskScore: 0.82,
            agentConfidence: 0.94,
            summary: 'Physical card cloning suspect. Geolocation teleportation detected between Mumbai and London in under 30 minutes.',
            recommendation: DecisionAction.VERIFY,
            decisionNotes: 'Step-up authentication required under RBI-2026-08 before settlement.'
        }
    });

    await prisma.agentInvestigation.upsert({
        where: { caseId: case2.id },
        update: {},
        create: {
            caseId: case2.id,
            framework: 'LangGraph',
            planSteps: [
                { step: 1, action: 'Geo-Velocity Analysis', detail: 'Calculated Haversine distance: 7,192 km in 22 minutes (Required speed: 19,614 km/h)', status: 'COMPLETED' },
                { step: 2, action: 'Device & IP Inspection', detail: 'Physical POS terminal token used in London; Previous txn was ATM cash withdrawal in Mumbai', status: 'COMPLETED' },
                { step: 3, action: 'RAG Knowledge Lookup', detail: 'Found exact pattern match PAT-003 (Impossible Travel & Card Cloning)', status: 'COMPLETED' },
                { step: 4, action: 'Decision Recommendation', detail: 'Correlated risk index: 0.82 -> Trigger interactive voice/SMS step-up challenge', status: 'COMPLETED' }
            ],
            toolsUsed: ['GEO_VELOCITY_CALCULATOR', 'VECTOR_SEARCH_RAG', 'SHAP_EXPLAINER'],
            shapFactors: [
                { feature: 'geo_distance_speed_kmh', importance: 0.62, value: '19,614 km/h (Max Physical: 900 km/h)', direction: 'INCREASES_RISK' },
                { feature: 'cross_border_flag', importance: 0.22, value: 'First international transaction in 180 days', direction: 'INCREASES_RISK' },
                { feature: 'merchant_reputation', importance: 0.16, value: 'Verified Airport Merchant', direction: 'DECREASES_RISK' }
            ],
            ragCitations: [
                { code: 'PAT-003', title: 'Impossible Travel & Geolocation Teleportation', similarity: 0.98, snippet: 'Card-present transactions across distant nodes without elapsed flight time indicates cloned magnetic stripe or token replay.' },
                { code: 'POL-RBI-2026-08', title: 'RBI Directive on Step-Up Authentication', similarity: 0.89, snippet: 'Requires immediate step-up interactive voice/OTP challenge on anomaly score >0.75.' }
            ],
            behavioralSignals: {
                lastOrigin: 'Mumbai, IN (14:02 IST)',
                currentOrigin: 'London, UK (14:24 IST)',
                distanceKm: 7192,
                elapsedMinutes: 22,
                computedSpeed: '19,614 km/h'
            },
            agentReasoning: 'Haversine distance calculation confirms impossibility of physical presence in London 22 minutes post Mumbai ATM withdrawal. Recommend step-up verification challenge (Action: VERIFY) or temporary card token suspension.',
            correlationScore: 0.94
        }
    });

    console.log('✅ SentinelPay Database Seeding Complete!');
    console.log('--------------------------------------------------');
    console.log('👑 Admin:     admin@sentinelpay.io / Admin@123456');
    console.log('👤 Demo User: demo@sentinelpay.io / Demo@123456');
    console.log('🕵️ 2 Live Agentic Investigation Cases Created:');
    console.log('   - INV-2026-0042 (Luxury Jewelry ATO Spree - ₹1,45,000 -> BLOCK)');
    console.log('   - INV-2026-0043 (Impossible Travel Geo Teleportation -> VERIFY)');
    console.log('📚 6 RAG Knowledge Base Docs & 4 Governance Policies Seeded');
    console.log('--------------------------------------------------');
}

main()
    .catch((e) => {
        console.error('❌ Seeding error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
