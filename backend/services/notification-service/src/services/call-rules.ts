// src/services/call-rules.ts
/**
 * Call Warning Rule Engine
 *
 * Evaluates an anomaly event against a set of fraud-signal rules.
 * A voice call is triggered only when severity is HIGH/CRITICAL
 * AND at least one rule fires. The resulting message is read aloud
 * via Twilio TTS.
 */

export interface CallRuleResult {
    shouldCall: boolean;
    triggeredRules: string[];
    voiceMessage: string;
}

// Amount threshold (in the transaction's currency units) above which HIGH_AMOUNT fires
const HIGH_AMOUNT_THRESHOLD = 50_000;

// ML score (0–1) above which CRITICAL_ML_SCORE fires
const CRITICAL_ML_SCORE_THRESHOLD = 0.85;

// Hours considered "odd" (1 AM – 5 AM inclusive)
const ODD_HOUR_START = 1;
const ODD_HOUR_END = 5;

/**
 * Evaluate all call-trigger rules against a raw Kafka anomaly event.
 */
export function evaluateCallRules(event: any): CallRuleResult {
    const severity: string = event.severity || event.verdict?.final_severity || 'MEDIUM';
    const ruleFlags: string[] = (event.analysis?.rule_flags || []).map((f: string) => f.toUpperCase());

    const amount: number = event.data?.amount || 0;
    const currency: string = event.data?.currency || 'INR';
    const merchant: string = event.data?.merchant || '';
    const location: string = event.data?.location || '';
    const mlScore: number = event.analysis?.ml_score || 0;
    const txTimestamp: string = event.meta?.timestamp || new Date().toISOString();
    const endUserId: string = event.meta?.end_user_id || 'an end user';

    // Only consider calls for HIGH or CRITICAL severity
    if (severity !== 'HIGH' && severity !== 'CRITICAL') {
        return { shouldCall: false, triggeredRules: [], voiceMessage: '' };
    }

    const triggeredRules: string[] = [];
    const reasons: string[] = [];

    // ── Rule 1: HIGH_AMOUNT ───────────────────────────────────────────────────
    // Fires either via direct threshold check OR if ML flagged it as an amount spike
    if (amount >= HIGH_AMOUNT_THRESHOLD || ruleFlags.includes('AMOUNT_SPIKE')) {
        triggeredRules.push('HIGH_AMOUNT');
        reasons.push(
            `The transaction amount is critically high at ${amount.toLocaleString('en-IN')} ${currency}.`
        );
    }

    // ── Rule 2: HIGH_VELOCITY ─────────────────────────────────────────────────
    // ML service emits: VELOCITY_HIGH, VELOCITY_SPIKE
    if (
        ruleFlags.includes('HIGH_VELOCITY') ||
        ruleFlags.includes('RAPID_FIRE') ||
        ruleFlags.includes('VELOCITY_HIGH') ||
        ruleFlags.includes('VELOCITY_SPIKE')
    ) {
        triggeredRules.push('HIGH_VELOCITY');
        reasons.push(
            'Suspicious rapid-fire transaction activity has been detected for this account.'
        );
    }

    // ── Rule 3: SUSPICIOUS / UNUSUAL LOCATION ────────────────────────────────
    if (
        ruleFlags.includes('SUSPICIOUS_LOCATION') ||
        ruleFlags.includes('UNUSUAL_LOCATION') ||
        ruleFlags.includes('GEO_ANOMALY')
    ) {
        triggeredRules.push('SUSPICIOUS_LOCATION');
        const locationText = location ? `from ${location}` : 'from a high-risk location';
        reasons.push(`A transaction ${locationText} has been flagged as geographically suspicious.`);
    }

    // ── Rule 4: ODD HOURS ─────────────────────────────────────────────────────
    // ML service emits: UNUSUAL_HOUR
    const txHour = new Date(txTimestamp).getHours();
    if (
        ruleFlags.includes('ODD_HOURS') ||
        ruleFlags.includes('UNUSUAL_HOUR') ||
        (txHour >= ODD_HOUR_START && txHour <= ODD_HOUR_END)
    ) {
        triggeredRules.push('ODD_HOURS');
        const timeStr = new Date(txTimestamp).toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        });
        reasons.push(`This transaction occurred at an unusual hour for this account's pattern.`);
    }

    // ── Rule 5: CRITICAL ML SCORE ─────────────────────────────────────────────
    if (mlScore >= CRITICAL_ML_SCORE_THRESHOLD) {
        triggeredRules.push('CRITICAL_ML_SCORE');
        const scorePercent = Math.round(mlScore * 100);
        reasons.push(
            `The machine learning model flagged this with a ${scorePercent} percent fraud confidence score.`
        );
    }

    // ── Rule 6: UNKNOWN MERCHANT ──────────────────────────────────────────────
    if (
        ruleFlags.includes('UNKNOWN_MERCHANT') ||
        (merchant && merchant.toLowerCase().includes('unknown'))
    ) {
        triggeredRules.push('UNKNOWN_MERCHANT');
        reasons.push('The transaction involves an unknown or unregistered merchant.');
    }

    // ── Rule 7: UNUSUAL CATEGORY ──────────────────────────────────────────────
    if (ruleFlags.includes('UNUSUAL_CATEGORY')) {
        triggeredRules.push('UNUSUAL_CATEGORY');
        const category = event.data?.category || 'an unusual category';
        reasons.push(`The transaction category, ${category}, is atypical for this account.`);
    }

    // If no rules fired, do not call even if severity is HIGH/CRITICAL
    if (triggeredRules.length === 0) {
        return { shouldCall: false, triggeredRules: [], voiceMessage: '' };
    }

    // ── Build the voice message ───────────────────────────────────────────────
    const severityWord = severity === 'CRITICAL' ? 'critical' : 'high severity';
    const rulesText = triggeredRules.join(', ').replace(/_/g, ' ').toLowerCase();

    const voiceMessage = [
        `Hello. This is an urgent fraud alert from SentinelPay.`,
        `A ${severityWord} anomaly has been detected for ${endUserId}.`,
        ...reasons,
        `Rules triggered: ${rulesText}.`,
        `Please log in to your SentinelPay dashboard immediately to review and take action.`,
        `If this transaction was not authorised, contact your bank now.`,
        `This message will now repeat.`,
        `A ${severityWord} anomaly has been detected for ${endUserId}.`,
        ...reasons,
    ].join(' ');

    return { shouldCall: true, triggeredRules, voiceMessage };
}
