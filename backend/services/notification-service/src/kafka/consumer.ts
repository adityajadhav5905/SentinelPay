// src/kafka/consumer.ts
import { Kafka, EachMessagePayload } from 'kafkajs';

import { sendEmailNotification } from '../services/email.service';
import { sendSmsNotification } from '../services/sms.service';
import { sendWebhookNotification } from '../services/webhook.service';
import { makeCallNotification } from '../services/call.service';
import { evaluateCallRules } from '../services/call-rules';
import { shouldSendAlert } from '../services/deduplication.service';
import { getUserContext, canSendNotification } from '../services/subscription.service';
import {
  addAnomalyToBatch,
  onBatchFlush,
  AnomalyEventData,
} from '../services/batch-aggregator.service';
import {
  buildBatchEmailHtml,
  buildAnomaliesCsv,
  buildSingleAnomalyEmailHtml,
} from '../services/email-template.service';

import {
  startKafkaProducer,
  produceAlertEvent,
} from './producer';
import { prisma, Severity } from '@sentinelpay/database';


const KAFKA_BROKERS =
  process.env.KAFKA_BOOTSTRAP_SERVERS?.split(',') || ['localhost:9092'];

const KAFKA_TOPIC =
  process.env.KAFKA_ANOMALIES_TOPIC || 'anomalies';

const KAFKA_GROUP_ID =
  process.env.KAFKA_GROUP_ID || 'notification-service-group';

const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 2000;

/**
 * Retry helper with exponential backoff
 */
async function retry<T>(
  fn: () => Promise<T>,
  retries = MAX_RETRIES,
  backoffMs = BACKOFF_BASE_MS
): Promise<T> {
  let attempt = 0;

  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      if (attempt > retries) throw err;

      console.warn(
        `⚠️ Retry ${attempt}/${retries} failed. Retrying in ${backoffMs}ms...`
      );
      await new Promise(res => setTimeout(res, backoffMs));
      backoffMs *= 2;
    }
  }
}

/**
 * Extract a normalized AnomalyEventData object from the raw Kafka event.
 */
function extractAnomalyData(event: any, userId: string): AnomalyEventData {
  return {
    userId,
    batchId: event.meta?.batch_id || '',
    txId: event.data?.tx_id || event.tx_id || event.id || 'unknown_tx',
    endUserId: event.meta?.end_user_id,
    amount: event.data?.amount || 0,
    currency: event.data?.currency || 'USD',
    merchant: event.data?.merchant,
    category: event.data?.category,
    severity: event.severity || event.verdict?.final_severity || 'MEDIUM',
    mlScore: event.analysis?.ml_score || 0,
    explanation: event.verdict?.explanation || 'Anomaly detected by ML model',
    ruleFlags: event.analysis?.rule_flags || [],
    timestamp: event.meta?.timestamp || new Date().toISOString(),
  };
}

// Cache user contexts for batch flush (avoid re-fetching per individual anomaly)
const userContextCache: Map<string, { context: any; expiry: number }> = new Map();
const CONTEXT_CACHE_TTL_MS = 60_000; // 1 min

async function getCachedUserContext(userId: string) {
  const cached = userContextCache.get(userId);
  if (cached && cached.expiry > Date.now()) {
    return cached.context;
  }
  const ctx = await getUserContext(userId);
  if (ctx) {
    userContextCache.set(userId, { context: ctx, expiry: Date.now() + CONTEXT_CACHE_TTL_MS });
  }
  return ctx;
}

export const startKafkaConsumer = async () => {
  const kafka = new Kafka({
    clientId: 'notification-service',
    brokers: KAFKA_BROKERS,
  });

  const consumer = kafka.consumer({ groupId: KAFKA_GROUP_ID });

  // 🔥 Start producer ONCE
  await startKafkaProducer();

  // 📦 Register batch flush callback — sends consolidated email when batch is ready
  onBatchFlush(async (userId: string, batchId: string, anomalies: AnomalyEventData[]) => {
    console.log(`📧 Batch flush triggered: ${anomalies.length} anomalies for user ${userId} (batch: ${batchId})`);

    const userContext = await getCachedUserContext(userId);
    if (!userContext) {
      console.warn(`⚠️ User not found for batch email: ${userId}. Skipping.`);
      return;
    }

    // Check if user allows email.
    if (!userContext.settings.emailEnabled) {
      console.log(`🚫 Email disabled for user ${userId}. Skipping batch report.`);
      return;
    }

    const emailTo = userContext.email;
    if (emailTo) {
      // Include ALL anomalies in CSV, regardless of severity
      const csvContent = buildAnomaliesCsv(anomalies);

      // Determine if we should send the email (e.g. at least one anomaly?)
      // User asked for a report per upload, so we send it even if anomalies are low severity.
      if (anomalies.length > 0) {
        const html = buildBatchEmailHtml(userId, anomalies);

        await retry(() =>
          sendEmailNotification({
            to: emailTo,
            subject: `🚨 ${anomalies.length} Anomalies Detected — CSV Upload Report`,
            html,
            body: `${anomalies.length} anomalies detected in your CSV upload. View the attached CSV for full details.`,
            attachments: [
              {
                filename: `anomalies_${batchId.slice(0, 8)}_${new Date().toISOString().slice(0, 10)}.csv`,
                content: csvContent,
                contentType: 'text/csv',
              },
            ],
          })
        );

        // Log a single notification entry for the batch
        await prisma.notificationLog.create({
          data: {
            userId,
            channel: 'EMAIL',
            status: 'SENT',
            anomalyId: `batch_${batchId}`,
            metadata: {
              emailTo,
              batchId,
              anomalyCount: anomalies.length,
              type: 'BATCH_SUMMARY',
            },
          },
        });

        console.log(`✅ Batch email sent to ${emailTo}: ${anomalies.length} anomalies`);
      }
    }
  });

  await consumer.connect();
  console.log(`✅ Kafka consumer connected: ${KAFKA_BROKERS.join(', ')}`);

  await consumer.subscribe({
    topic: KAFKA_TOPIC,
    fromBeginning: false,
  });

  console.log(`📩 Subscribed to topic: ${KAFKA_TOPIC}`);

  await consumer.run({
    eachMessage: async ({ message }: EachMessagePayload) => {
      if (!message.value) return;

      const event = JSON.parse(message.value.toString());
      const userId = event.userId || event.meta?.user_id || 'unknown_user';
      const txId = event.data?.tx_id || event.tx_id || event.id || 'unknown_tx';
      const endUserId = event.meta?.end_user_id;
      const batchId = event.meta?.batch_id;

      console.log(`📢 Received anomaly event for Company ${userId} (End User: ${endUserId || 'N/A'}, Batch: ${batchId || 'realtime'})`);

      // 🛑 DEDUPLICATION CHECK
      const shouldSend = await shouldSendAlert(userId, txId);
      if (!shouldSend) {
        return;
      }

      // Determine severity once
      const severity = event.severity || event.verdict?.final_severity || 'MEDIUM';

      try {
        // ============================================================
        // 📦 BATCH MODE: If this event has a batch_id, buffer it
        // ============================================================
        if (batchId) {
          const anomalyData = extractAnomalyData(event, userId);
          await addAnomalyToBatch(anomalyData);

          // Still send SMS/Webhook/Call per-event for CRITICAL/HIGH urgency
          if (severity === 'CRITICAL' || severity === 'HIGH') {
            await handleNonEmailChannels(event, userId, severity);
          }

          // Produce alert event (per-event still)
          await produceAlertEvent({
            alertId: `alert_${Date.now()}`,
            userId,
            severity: event.severity,
            channels: {
              email: false, // Email deferred to batch flush
              sms: severity === 'CRITICAL' || severity === 'HIGH',
              webhook: !!event.webhookUrl,
              call: false, // Voice calls disabled for CSV/batch uploads
            },
            sourceEvent: event,
            timestamp: new Date().toISOString(),
          });

          return; // Don't send individual email — batch will handle it
        }

        // ============================================================
        // ⚡ REALTIME MODE: No batch_id — send individual email immediately
        // ============================================================

        // 🛑 SEVERITY CHECK — Only notify for HIGH or CRITICAL (for realtime)
        if (severity !== 'HIGH' && severity !== 'CRITICAL') {
          console.log(`ℹ️ Notification skipped for ${userId}: Severity is ${severity} (Threshold: HIGH)`);
          return;
        }

        const userContext = await getCachedUserContext(userId);

        if (!userContext) {
          console.warn(`⚠️ User not found in DB: ${userId}. Skipping notification.`);
          return;
        }

        // -------- EMAIL (clean HTML for realtime too) --------
        if (canSendNotification(userContext, 'EMAIL', severity as Severity)) {
          const emailTo = userContext.email || event.email;
          if (emailTo) {
            const anomalyData = extractAnomalyData(event, userId);
            const html = buildSingleAnomalyEmailHtml(anomalyData);

            await retry(() =>
              sendEmailNotification({
                to: emailTo,
                subject: `🚨 Anomaly Alert — ${severity} severity transaction detected`,
                html,
                body: `Anomaly detected for End User: ${endUserId || 'N/A'}. Amount: $${anomalyData.amount}. ${anomalyData.explanation}`,
              })
            );
            await prisma.notificationLog.create({
              data: {
                userId,
                channel: 'EMAIL',
                status: 'SENT',
                anomalyId: event.data?.tx_id,
                metadata: { emailTo, type: 'REALTIME' },
              }
            });
          }
        } else {
          console.log(`🚫 Email suppressed for ${userId} (Disabled/Settings)`);
        }

        // -------- SMS / WEBHOOK / CALL --------
        await handleNonEmailChannels(event, userId, severity);

        // -------- PRODUCE ALERT EVENT --------
        // Use userContext from above (already fetched)
        await produceAlertEvent({
          alertId: `alert_${Date.now()}`,
          userId,
          severity: event.severity,
          channels: {
            email: canSendNotification(userContext, 'EMAIL', severity as Severity),
            sms: canSendNotification(userContext, 'SMS', severity as Severity),
            webhook: !!event.webhookUrl,
            call: canSendNotification(userContext, 'VOICE', severity as Severity),
          },
          sourceEvent: event,
          timestamp: new Date().toISOString(),
        });

        console.log(`✅ Notifications processed for user: ${userId} (Plan: ${userContext.plan || 'unknown'})`);
      } catch (err) {
        console.error(
          `❌ Failed processing notifications for user: ${userId}`,
          err
        );
      }
    },
  });
};

/**
 * Handle non-email notification channels (SMS, Webhook, Voice Call).
 * These are still sent per-event regardless of batching.
 */
async function handleNonEmailChannels(event: any, userId: string, severity: string) {
  const userContext = await getCachedUserContext(userId);
  if (!userContext) return;

  // -------- SMS --------
  if (canSendNotification(userContext, 'SMS', severity as Severity)) {
    const phoneTo = userContext.phone || event.phone;
    if (phoneTo) {
      await retry(() =>
        sendSmsNotification({
          to: phoneTo,
          message: `🚨 ${severity} anomaly: $${event.data?.amount || 0} transaction flagged. Check SentinelPay dashboard.`,
        })
      );
      await prisma.notificationLog.create({
        data: {
          userId,
          channel: 'SMS',
          status: 'SENT',
          anomalyId: event.data?.tx_id,
          metadata: { phoneTo },
        }
      });
    }
  }

  // -------- WEBHOOK --------
  if (event.webhookUrl) {
    await retry(() =>
      sendWebhookNotification({
        url: event.webhookUrl,
        data: { userId, event },
        secret: process.env.WEBHOOK_SIGNING_SECRET,
      })
    );
    await prisma.notificationLog.create({
      data: {
        userId,
        channel: 'WEBHOOK',
        status: 'SENT',
        anomalyId: event.data?.tx_id,
        metadata: { url: event.webhookUrl },
      }
    });
  }

  // -------- CALL --------
  // Voice calls ONLY for live tracking, NEVER for batch/CSV uploads
  const isBatchUpload = !!(event.meta?.batch_id || event.sourceEvent?.meta?.batch_id);
  if (!isBatchUpload && canSendNotification(userContext, 'VOICE', severity as Severity)) {
    const phoneTo = userContext.phone || event.phone;
    if (phoneTo) {
      // Evaluate smart call-trigger rules before placing the call.
      // A call is only made when at least one specific fraud rule fires,
      // AND the voice message will explain exactly which rules were violated.
      const callRuleResult = evaluateCallRules(event);

      if (callRuleResult.shouldCall) {
        console.log(
          `📞 Call rules matched [${callRuleResult.triggeredRules.join(', ')}] for user ${userId}. Placing call to ${phoneTo}.`
        );

        await retry(() =>
          makeCallNotification({
            to: phoneTo,
            message: callRuleResult.voiceMessage,
            triggeredRules: callRuleResult.triggeredRules,
          })
        );

        await prisma.notificationLog.create({
          data: {
            userId,
            channel: 'VOICE',
            status: 'SENT',
            anomalyId: event.data?.tx_id,
            metadata: {
              phoneTo,
              triggeredRules: callRuleResult.triggeredRules,
            },
          },
        });
      } else {
        console.log(
          `📵 Call skipped for user ${userId} — severity ${severity} but no specific call rules matched.`
        );
      }
    }
  }
}
