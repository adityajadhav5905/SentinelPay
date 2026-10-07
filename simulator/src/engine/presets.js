export const PRESETS = {
  normal: {
    name: 'Normal Traffic',
    icon: '🟢',
    description: 'Moderate amounts, common categories, relaxed timing',
    config: {
      categories: ['Food & Dining', 'Shopping', 'Transportation', 'Entertainment', 'Utilities'],
      amountMin: 50,
      amountMax: 3000,
      currency: 'INR',
      locations: ['Mumbai', 'Delhi', 'Bangalore', 'Pune', 'Hyderabad'],
      endUserCount: 5,
      delayMode: 'random',
      delayConstant: 2000,
      delayMin: 1500,
      delayMax: 5000,
      totalTransactions: 50,
      burstMode: false,
      burstCount: 1,
      burstPause: 1000,
      anomalyPercent: 0,
      anomalyTypes: [],
      anomalyPattern: 'random',
    }
  },
  fraud: {
    name: 'Fraud Burst',
    icon: '🔴',
    description: 'High anomaly rate, unusual locations, rapid-fire',
    config: {
      categories: ['Wire Transfer', 'Cryptocurrency', 'Electronics', 'Shopping'],
      amountMin: 5000,
      amountMax: 50000,
      currency: 'INR',
      locations: ['Lagos', 'Moscow', 'Mumbai'],
      endUserCount: 2,
      delayMode: 'random',
      delayConstant: 500,
      delayMin: 200,
      delayMax: 1000,
      totalTransactions: 30,
      burstMode: true,
      burstCount: 5,
      burstPause: 3000,
      anomalyPercent: 80,
      anomalyTypes: ['highAmount', 'unusualLocation', 'oddHours', 'rapidFire', 'unknownMerchant'],
      anomalyPattern: 'random',
    }
  },
  mixed: {
    name: 'Mixed Reality',
    icon: '🟡',
    description: '85% normal + 15% anomalies, realistic distribution',
    config: {
      categories: ['Food & Dining', 'Shopping', 'Transportation', 'Entertainment', 'Gas & Fuel', 'Healthcare', 'Utilities', 'Travel'],
      amountMin: 30,
      amountMax: 5000,
      currency: 'INR',
      locations: ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Pune'],
      endUserCount: 8,
      delayMode: 'random',
      delayConstant: 2000,
      delayMin: 1000,
      delayMax: 4000,
      totalTransactions: 100,
      burstMode: false,
      burstCount: 1,
      burstPause: 1000,
      anomalyPercent: 15,
      anomalyTypes: ['highAmount', 'unusualLocation', 'oddHours', 'unknownMerchant', 'unusualCategory'],
      anomalyPattern: 'random',
    }
  }
};

export function getDefaultConfig() {
  return JSON.parse(JSON.stringify(PRESETS.mixed.config));
}
