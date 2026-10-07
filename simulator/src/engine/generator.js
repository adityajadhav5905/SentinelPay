import { v4 as uuidv4 } from 'uuid';
import { MERCHANTS } from '../data/merchants.js';

/**
 * Generate a single transaction payload matching SentinelPay's ingestion schema.
 */
export function generateTransaction(config, endUserIds) {
  const {
    categories,
    amountMin,
    amountMax,
    currency,
    locations,
  } = config;

  // Pick random category
  const category = categories[Math.floor(Math.random() * categories.length)];

  // Pick random merchant for that category
  const merchantList = MERCHANTS[category] || MERCHANTS['Food & Dining'];
  const merchant = merchantList[Math.floor(Math.random() * merchantList.length)];

  // Random amount in range
  const amount = parseFloat(
    (Math.random() * (amountMax - amountMin) + amountMin).toFixed(2)
  );

  // Random location
  const location = locations[Math.floor(Math.random() * locations.length)];

  // Random end user
  const endUserId = endUserIds[Math.floor(Math.random() * endUserIds.length)];

  return {
    txId: `sim_${uuidv4().slice(0, 12)}`,
    amount,
    currency: currency || 'INR',
    userId: 'placeholder', // will be overridden by auth context at ingestion service
    endUserId,
    merchant,
    timestamp: new Date().toISOString(),
    location,
    category,
    _meta: {
      isAnomaly: false,
      anomalyType: null,
    }
  };
}

/**
 * Generate a list of end-user IDs.
 */
export function generateEndUserIds(count) {
  return Array.from({ length: count }, (_, i) => `customer_${String(i + 1).padStart(3, '0')}`);
}
