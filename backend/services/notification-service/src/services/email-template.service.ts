// src/services/email-template.service.ts
/**
 * Builds clean HTML emails and CSV attachments for batch anomaly notifications.
 */

import { AnomalyEventData } from './batch-aggregator.service';

/**
 * Build an HTML email summarizing all anomalies from a batch upload.
 */
export const buildBatchEmailHtml = (
    userId: string,
    anomalies: AnomalyEventData[]
): string => {
    const total = anomalies.length;
    const critical = anomalies.filter(a => a.severity === 'CRITICAL').length;
    const high = anomalies.filter(a => a.severity === 'HIGH').length;
    const medium = anomalies.filter(a => a.severity === 'MEDIUM').length;

    // Sort by severity (CRITICAL first) then by mlScore descending
    const severityOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    const sorted = [...anomalies].sort((a, b) => {
        const sevDiff = (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4);
        return sevDiff !== 0 ? sevDiff : b.mlScore - a.mlScore;
    });

    // Show top 10 most critical anomalies in the email
    const topAnomalies = sorted.slice(0, 10);

    const severityColor: Record<string, string> = {
        CRITICAL: '#dc2626',
        HIGH: '#ea580c',
        MEDIUM: '#ca8a04',
        LOW: '#65a30d',
    };

    const anomalyRows = topAnomalies
        .map(a => {
            const color = severityColor[a.severity] || '#6b7280';
            return `
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-family: monospace; font-size: 13px;">${a.txId}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${a.amount.toFixed(2)}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
            <span style="background: ${color}; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">${a.severity}</span>
          </td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; color: #374151; max-width: 300px;">${truncate(a.explanation, 120)}</td>
        </tr>`;
        })
        .join('\n');

    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; background: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; margin-top: 20px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); padding: 24px 32px;">
      <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 600;">
        🚨 Anomaly Report — CSV Upload
      </h1>
      <p style="margin: 6px 0 0; color: #94a3b8; font-size: 14px;">
        ${total} anomal${total === 1 ? 'y' : 'ies'} detected in your upload
      </p>
    </div>

    <!-- Summary Stats -->
    <div style="padding: 20px 32px; display: flex; gap: 16px; border-bottom: 1px solid #e5e7eb;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          ${critical > 0 ? `<td style="text-align: center; padding: 12px;">
            <div style="font-size: 28px; font-weight: 700; color: #dc2626;">${critical}</div>
            <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Critical</div>
          </td>` : ''}
          ${high > 0 ? `<td style="text-align: center; padding: 12px;">
            <div style="font-size: 28px; font-weight: 700; color: #ea580c;">${high}</div>
            <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">High</div>
          </td>` : ''}
          ${medium > 0 ? `<td style="text-align: center; padding: 12px;">
            <div style="font-size: 28px; font-weight: 700; color: #ca8a04;">${medium}</div>
            <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Medium</div>
          </td>` : ''}
          <td style="text-align: center; padding: 12px;">
            <div style="font-size: 28px; font-weight: 700; color: #1e293b;">${total}</div>
            <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Total</div>
          </td>
        </tr>
      </table>
    </div>

    <!-- Top Anomalies Table -->
    <div style="padding: 20px 32px;">
      <h2 style="margin: 0 0 12px; font-size: 16px; color: #1e293b;">
        ${total <= 10 ? 'Flagged Transactions' : `Top ${topAnomalies.length} Critical Anomalies`}
      </h2>
      <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden;">
        <thead>
          <tr style="background: #f9fafb;">
            <th style="padding: 8px 12px; text-align: left; font-size: 12px; color: #6b7280; text-transform: uppercase; border-bottom: 1px solid #e5e7eb;">Tx ID</th>
            <th style="padding: 8px 12px; text-align: right; font-size: 12px; color: #6b7280; text-transform: uppercase; border-bottom: 1px solid #e5e7eb;">Amount</th>
            <th style="padding: 8px 12px; text-align: center; font-size: 12px; color: #6b7280; text-transform: uppercase; border-bottom: 1px solid #e5e7eb;">Severity</th>
            <th style="padding: 8px 12px; text-align: left; font-size: 12px; color: #6b7280; text-transform: uppercase; border-bottom: 1px solid #e5e7eb;">Reason</th>
          </tr>
        </thead>
        <tbody>
          ${anomalyRows}
        </tbody>
      </table>
      ${total > 10 ? `<p style="margin: 12px 0 0; font-size: 13px; color: #6b7280;">+ ${total - 10} more anomalies — see attached CSV for full details.</p>` : ''}
    </div>

    <!-- Footer -->
    <div style="padding: 16px 32px; background: #f9fafb; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0; font-size: 12px; color: #9ca3af;">
        SentinelPay • Automated anomaly detection • <a href="#" style="color: #3b82f6;">View Dashboard</a>
      </p>
    </div>
  </div>
</body>
</html>`;
};

/**
 * Build a single-anomaly HTML email (for realtime anomalies without batch_id).
 */
export const buildSingleAnomalyEmailHtml = (anomaly: AnomalyEventData): string => {
    const severityColor: Record<string, string> = {
        CRITICAL: '#dc2626',
        HIGH: '#ea580c',
        MEDIUM: '#ca8a04',
        LOW: '#65a30d',
    };
    const color = severityColor[anomaly.severity] || '#6b7280';

    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; background: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 520px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); padding: 20px 24px;">
      <h1 style="margin: 0; color: #fff; font-size: 18px;">🚨 Anomaly Detected</h1>
    </div>
    <div style="padding: 20px 24px;">
      <table cellpadding="0" cellspacing="0" style="width: 100%;">
        <tr>
          <td style="padding: 6px 0; color: #6b7280; font-size: 13px;">Transaction</td>
          <td style="padding: 6px 0; font-family: monospace; font-size: 13px;">${anomaly.txId}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #6b7280; font-size: 13px;">Amount</td>
          <td style="padding: 6px 0; font-weight: 600;">$${anomaly.amount.toFixed(2)}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #6b7280; font-size: 13px;">Severity</td>
          <td style="padding: 6px 0;">
            <span style="background: ${color}; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">${anomaly.severity}</span>
          </td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #6b7280; font-size: 13px;">End User</td>
          <td style="padding: 6px 0;">${anomaly.endUserId || 'N/A'}</td>
        </tr>
      </table>
      <div style="margin-top: 16px; padding: 12px; background: #f9fafb; border-radius: 6px; border-left: 3px solid ${color};">
        <p style="margin: 0; font-size: 13px; color: #374151;">${anomaly.explanation}</p>
      </div>
    </div>
    <div style="padding: 12px 24px; background: #f9fafb; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0; font-size: 12px; color: #9ca3af;">SentinelPay • Automated anomaly detection</p>
    </div>
  </div>
</body>
</html>`;
};

/**
 * Build a CSV string of all anomalies in a batch.
 */
export const buildAnomaliesCsv = (anomalies: AnomalyEventData[]): string => {
    const header = 'tx_id,amount,currency,severity,ml_score,end_user_id,merchant,explanation';
    const rows = anomalies.map(a => {
        // Escape commas and quotes in explanation
        const escapedExplanation = `"${(a.explanation || '').replace(/"/g, '""')}"`;
        return [
            a.txId,
            a.amount.toFixed(2),
            a.currency || 'USD',
            a.severity,
            a.mlScore.toFixed(3),
            a.endUserId || '',
            a.merchant || '',
            escapedExplanation,
        ].join(',');
    });

    return [header, ...rows].join('\n');
};

/** Truncate a string for email display. */
const truncate = (str: string, maxLen: number): string =>
    str.length <= maxLen ? str : str.slice(0, maxLen - 3) + '...';
