/**
 * Hostinger Web App Production Entrypoint
 * MAD O MEDIA • Agency OS
 *
 * This file serves as the primary launcher for Hostinger's Node.js Web App environment.
 * It ensures proper environment initialization, port binding, and process resilience.
 */

require('dotenv').config();

// Enforce production defaults if not specified
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.env.PORT = process.env.PORT || '3000';
process.env.BIND_HOST = process.env.BIND_HOST || '0.0.0.0';

// Global error shields to prevent unhandled errors from terminating the server under high traffic
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Agency OS] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[Agency OS] Uncaught Exception:', error);
});

console.log('----------------------------------------------------');
console.log('  MAD O MEDIA • AGENCY OS PRODUCTION SERVER');
console.log(`  Environment: ${process.env.NODE_ENV}`);
console.log(`  Host:        ${process.env.BIND_HOST}`);
console.log(`  Port:        ${process.env.PORT}`);
console.log(`  App URL:     ${process.env.APP_URL || 'Not configured'}`);
console.log('----------------------------------------------------');

// Apply database migrations automatically if DATABASE_URL is available
if (process.env.DATABASE_URL) {
  try {
    console.log('[Agency OS] Checking and applying database migrations...');
    require('node:child_process').execSync('npx prisma migrate deploy', { stdio: 'inherit' });
    console.log('[Agency OS] Database schema is verified.');
  } catch (err) {
    console.warn('[Agency OS] Notice: Database migration check:', err.message);
  }
}

// Launch the compiled NestJS + Next.js server
require('./apps/api/dist/main.js');
