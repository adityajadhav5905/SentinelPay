// Category → Merchant name pools
export const MERCHANTS = {
  'Food & Dining': [
    'Starbucks', 'McDonalds', 'Zomato', 'Swiggy', 'Pizza Hut',
    'Dominos', 'Subway', 'KFC', 'Burger King', 'Haldirams',
    'Barbeque Nation', 'Chai Point', 'Cafe Coffee Day', 'Dunkin Donuts'
  ],
  'Shopping': [
    'Amazon', 'Flipkart', 'Myntra', 'Ajio', 'Nykaa',
    'Meesho', 'Tata Cliq', 'Reliance Digital', 'Croma', 'Zara'
  ],
  'Transportation': [
    'Uber', 'Ola', 'Rapido', 'Metro Card Recharge', 'Indian Railways',
    'MakeMyTrip', 'RedBus', 'BlueSmart', 'InDrive'
  ],
  'Entertainment': [
    'Netflix', 'Spotify', 'Amazon Prime', 'Disney+ Hotstar', 'YouTube Premium',
    'BookMyShow', 'PVR Cinemas', 'Sony LIV', 'JioCinema'
  ],
  'Gas & Fuel': [
    'Indian Oil', 'HP Petrol', 'Bharat Petroleum', 'Shell Gas', 'Reliance Petrol'
  ],
  'Electronics': [
    'Best Buy', 'Croma Electronics', 'Reliance Digital', 'Vijay Sales',
    'Apple Store', 'Samsung Store', 'Mi Store'
  ],
  'Wire Transfer': [
    'Wire Transfer Intl', 'SWIFT Transfer', 'Western Union',
    'MoneyGram', 'Remitly', 'Bank Wire'
  ],
  'Cryptocurrency': [
    'Crypto Exchange XYZ', 'WazirX', 'CoinDCX', 'Binance',
    'CoinSwitch', 'ZebPay', 'Unknown Crypto Platform'
  ],
  'Healthcare': [
    'Apollo Pharmacy', 'MedPlus', 'Netmeds', 'PharmEasy', '1mg',
    'Apollo Hospital', 'Fortis Healthcare', 'Max Hospital'
  ],
  'Utilities': [
    'Electricity Bill', 'Water Bill', 'Gas Bill', 'Internet Bill',
    'Jio Recharge', 'Airtel Recharge', 'Vi Recharge', 'BSNL'
  ],
  'Travel': [
    'MakeMyTrip', 'Goibibo', 'Yatra', 'EaseMyTrip',
    'Airbnb', 'OYO Rooms', 'Booking.com', 'IndiGo Airlines',
    'Air India', 'SpiceJet', 'Vistara'
  ],
  'Unknown': [
    'Unknown Merchant', 'Unknown Store', 'Unregistered Vendor',
    'Anonymous Transfer', 'POS Terminal Unknown'
  ]
};

export const CATEGORIES = Object.keys(MERCHANTS).filter(c => c !== 'Unknown');
