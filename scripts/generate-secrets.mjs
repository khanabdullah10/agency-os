import { randomBytes } from 'node:crypto';

console.log('====================================================');
console.log('  MAD O MEDIA • AGENCY OS PRODUCTION SECRET GENERATOR');
console.log('====================================================\n');

const jwtSecret = randomBytes(32).toString('hex');
const cronSecret = randomBytes(32).toString('hex');

console.log('Generated Cryptographically Secure Production Keys:\n');
console.log(`JWT_SECRET=${jwtSecret}`);
console.log(`CRON_SECRET=${cronSecret}\n`);

console.log('====================================================');
console.log('Copy the lines above into your Hostinger .env file');
console.log('or enter them in hPanel -> Web App -> Environment.');
console.log('====================================================\n');
