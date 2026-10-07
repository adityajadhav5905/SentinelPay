import { MERCHANTS } from '../data/merchants.js';
import { LOCATIONS } from '../data/locations.js';

/**
 * Anomaly injection strategies. Each mutator modifies a normal transaction 
 * to exhibit suspicious behavior the ML model should detect.
 */
const ANOMALY_MUTATORS = {
  highAmount: (tx, config) => {
    // 10x to 50x the configured max amount
    const multiplier = 10 + Math.random() * 40;
    tx.amount = parseFloat((config.amountMax * multiplier / 10).toFixed(2));
    tx._meta.anomalyType = 'High Amount';
    return tx;
  },

  unusualLocation: (tx) => {
    const suspiciousLocations = LOCATIONS.suspicious;
    tx.location = suspiciousLocations[Math.floor(Math.random() * suspiciousLocations.length)];
    tx._meta.anomalyType = 'Unusual Location';
    return tx;
  },

  oddHours: (tx) => {
    // Set timestamp to 1AM-5AM
    const now = new Date();
    const hour = 1 + Math.floor(Math.random() * 4);
    now.setHours(hour, Math.floor(Math.random() * 60), 0, 0);
    tx.timestamp = now.toISOString();
    tx._meta.anomalyType = 'Odd Hours';
    return tx;
  },

  rapidFire: (tx) => {
    // Just flag it — the burst sender handles the actual rapid sending
    tx._meta.anomalyType = 'Rapid Fire';
    return tx;
  },

  unknownMerchant: (tx) => {
    const unknowns = MERCHANTS['Unknown'] || ['Unknown Merchant'];
    tx.merchant = unknowns[Math.floor(Math.random() * unknowns.length)];
    tx.category = 'Unknown';
    tx._meta.anomalyType = 'Unknown Merchant';
    return tx;
  },

  unusualCategory: (tx) => {
    // Switch to an unusual category for this user
    const unusual = ['Wire Transfer', 'Cryptocurrency'];
    const cat = unusual[Math.floor(Math.random() * unusual.length)];
    const merchantList = MERCHANTS[cat];
    tx.category = cat;
    tx.merchant = merchantList[Math.floor(Math.random() * merchantList.length)];
    tx._meta.anomalyType = 'Unusual Category';
    return tx;
  },
};

/**
 * Decide whether to inject an anomaly and apply mutation.
 * @param {object} tx - Normal transaction
 * @param {object} config - Simulator config
 * @param {number} index - Current transaction index
 * @returns {object} - Modified transaction (or original)
 */
export function maybeInjectAnomaly(tx, config, index) {
  const { anomalyPercent, anomalyTypes, anomalyPattern } = config;

  if (!anomalyTypes || anomalyTypes.length === 0 || anomalyPercent <= 0) {
    return tx;
  }

  let shouldInject = false;

  if (anomalyPattern === 'periodic') {
    // Every Nth transaction
    const n = Math.max(1, Math.round(100 / anomalyPercent));
    shouldInject = index % n === 0 && index > 0;
  } else {
    // Random based on percentage
    shouldInject = Math.random() * 100 < anomalyPercent;
  }

  if (!shouldInject) return tx;

  // Pick a random anomaly type to apply
  const type = anomalyTypes[Math.floor(Math.random() * anomalyTypes.length)];
  const mutator = ANOMALY_MUTATORS[type];

  if (mutator) {
    tx._meta.isAnomaly = true;
    return mutator(tx, config);
  }

  return tx;
}

export const ANOMALY_TYPE_LABELS = {
  highAmount: 'High Amount (10-50x)',
  unusualLocation: 'Unusual Location',
  oddHours: 'Odd Hours (1-5 AM)',
  rapidFire: 'Rapid Fire Burst',
  unknownMerchant: 'Unknown Merchant',
  unusualCategory: 'Unusual Category',
};
