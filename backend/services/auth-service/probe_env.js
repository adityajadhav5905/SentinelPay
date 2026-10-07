
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config();

console.log('--- ENV PROBE ---');
console.log('CLERK_SECRET_KEY exists:', !!process.env.CLERK_SECRET_KEY);
if (process.env.CLERK_SECRET_KEY) {
    console.log('CLERK_SECRET_KEY prefix:', process.env.CLERK_SECRET_KEY.substring(0, 7));
}
console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);
console.log('--- END PROBE ---');
