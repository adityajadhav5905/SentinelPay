// src/services/call.service.ts
import twilio from 'twilio';

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_CALL_FROM,
} = process.env;

let client: ReturnType<typeof twilio> | null = null;

if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
  client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
}

interface CallPayload {
  to: string;
  message: string;
  triggeredRules?: string[];
}

/**
 * Build TwiML that reads the fraud warning aloud with natural pacing.
 * Uses <Pause> between sentences so Alice voice sounds more human.
 */
function buildTwiML(message: string): string {
  // Split on '. ' or '.' to insert pauses between sentences
  const sentences = message
    .split(/(?<=\.)\s+/)
    .map(s => s.trim())
    .filter(Boolean);

  const sayParts = sentences
    .map(s => `<Say voice="alice" language="en-IN">${escapeXml(s)}</Say><Pause length="1"/>`)
    .join('\n        ');

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Pause length="1"/>
  ${sayParts}
  <Pause length="2"/>
</Response>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const makeCallNotification = async ({
  to,
  message,
  triggeredRules = [],
}: CallPayload) => {
  const rulesLog = triggeredRules.length > 0 ? triggeredRules.join(', ') : 'GENERAL';
  console.log(`📞 Call rule triggered [${rulesLog}] → ${to}`);

  if (!client) {
    console.warn('📞 Twilio not configured. Logging call only.');
    console.log(`[CALL] → ${to}:\n${message}`);
    return;
  }

  const twiml = buildTwiML(message);

  try {
    const call = await client.calls.create({
      to,
      from: TWILIO_CALL_FROM!,
      twiml,
    });

    console.log(`📞 Call placed to ${to} — SID: ${call.sid} [Rules: ${rulesLog}]`);
  } catch (err: any) {
    console.error('❌ Failed to place call:', err.message || err);
    throw err; // Let retry() in consumer handle it
  }
};
