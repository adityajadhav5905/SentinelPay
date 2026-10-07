
require('dotenv').config();

const colors = {
    reset: "\x1b[0m",
    green: "\x1b[32m",
    red: "\x1b[31m",
    yellow: "\x1b[33m"
};

function checkKey(name, value) {
    console.log(`Checking ${name}...`);
    if (!value) {
        console.log(`${colors.red}❌ MISSING${colors.reset}`);
        return;
    }

    const length = value.length;
    console.log(`  Length: ${length}`);

    // Check for whitespace
    if (/\s/.test(value)) {
        console.log(`${colors.red}❌ CONTAINS WHITESPACE${colors.reset}`);
        // show where
        console.log(`  Value (escaped): "${value.replace(/\s/g, (m) => `[${m.charCodeAt(0)}]`)}"`);
    } else {
        console.log(`${colors.green}✅ No whitespace detected${colors.reset}`);
    }

    // Check for common prefixes
    if (name.includes('PUBLISHABLE') && !value.startsWith('pk_')) {
        console.log(`${colors.yellow}⚠️ WARNING: Does not start with 'pk_'${colors.reset}`);
    }
    if (name.includes('SECRET') && !value.startsWith('sk_')) {
        console.log(`${colors.yellow}⚠️ WARNING: Does not start with 'sk_'${colors.reset}`);
    }

    // Check for weird characters that might throw atob/base64 errors if Clerk does decoding
    // Clerk keys are usually alphanumeric + underscores/dashes.
    if (/[^a-zA-Z0-9_.-]/.test(value)) {
        console.log(`${colors.red}❌ CONTAINS INVALID CHARS${colors.reset}`);
        const invalidChars = value.match(/[^a-zA-Z0-9_.-]/g) || [];
        console.log(`  Invalid chars: ${invalidChars.join(', ')}`);
    }

    console.log('');
}

console.log('--- Clerk Key Validator ---');
checkKey('CLERK_PUBLISHABLE_KEY', process.env.CLERK_PUBLISHABLE_KEY);
checkKey('CLERK_SECRET_KEY', process.env.CLERK_SECRET_KEY);
