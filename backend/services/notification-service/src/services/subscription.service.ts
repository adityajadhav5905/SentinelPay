import { prisma, SubscriptionPlan, Severity } from '@sentinelpay/database';


// Defined in schema.prisma:
// enum SubscriptionPlan {
//   FREE
//   BASIC
//   PRO
// }

interface UserContext {
    userId: string;
    email: string | null;
    phone: string | null;
    plan: SubscriptionPlan;
    features: any; // JSON
    settings: {
        emailEnabled: boolean;
        phoneEnabled: boolean;
        minSeverityForCall: Severity;
    };
}

/**
 * Fetches the user's current subscription context and notification settings.
 */
/** Normalise a phone number to E.164 format (adds +91 for bare 10-digit Indian numbers). */
function normalisePhone(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const digits = raw.replace(/\D/g, '');
    if (raw.startsWith('+')) return raw; // already E.164
    if (digits.length === 10) return `+91${digits}`; // Indian mobile
    if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
    return raw; // return as-is for other formats
}

export const getUserContext = async (userId: string): Promise<UserContext | null> => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                subscription: true,
                notificationSettings: true,
            },
        });

        if (!user) return null;

        // Prefer notification_settings.phoneNumber, fall back to user.phone
        const rawPhone = user.notificationSettings?.phoneNumber || (user as any).phone || null;

        return {
            userId: user.id,
            email: user.email,
            phone: normalisePhone(rawPhone),
            plan: user.subscription?.plan || 'FREE',
            features: user.subscription?.features || {},
            settings: {
                emailEnabled: user.notificationSettings?.emailEnabled ?? true,
                phoneEnabled: user.notificationSettings?.phoneEnabled ?? !!(user as any).phone,
                minSeverityForCall: user.notificationSettings?.minSeverityForCall || 'CRITICAL',
            },
        };
    } catch (err) {
        console.error(`❌ DB Error fetching user context for ${userId}:`, err);
        return null;
    }
};

/**
 * Determines if a notification should be sent based on subscription tier and user preferences.
 */
export const canSendNotification = (
    context: UserContext,
    channel: 'EMAIL' | 'SMS' | 'VOICE',
    severity: Severity
): boolean => {
    const { plan, settings, features } = context;

    if (channel === 'EMAIL') {
        // Email is available for all plans, if enabled by user
        return settings.emailEnabled;
    }

    if (channel === 'SMS') {
        // SMS Requires PRO plan OR specific feature flag
        // Also requires user to enable it
        if (!settings.phoneEnabled) return false;

        // Check Plan or Features
        if (plan === 'PRO') return true;
        if (features && features.sms === true) return true;

        return false; // FREE/BASIC don't get SMS by default
    }

    if (channel === 'VOICE') {
        // Voice Requires PRO plan AND Critical/High Severity
        if (plan !== 'PRO') return false;

        // Check severity threshold — allow CRITICAL and HIGH
        if (severity !== 'CRITICAL' && severity !== 'HIGH') return false;

        return true;
    }

    return false;
};
