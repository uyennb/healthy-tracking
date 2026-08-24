// Health check endpoint for NutriFit Cloud Sync backend
// Validates Upstash Redis connection without exposing credentials or user health data

import { defaultKvAdapter } from './kvAdapter.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const databaseConfigured = defaultKvAdapter.isConfigured();
  let databaseReachable = false;

  if (databaseConfigured) {
    const pingResult = await defaultKvAdapter.ping();
    databaseReachable = Boolean(pingResult.ok);
  }

  const statusCode = databaseConfigured && databaseReachable ? 200 : 503;

  return res.status(statusCode).json({
    status: statusCode === 200 ? 'healthy' : 'degraded',
    databaseConfigured,
    databaseReachable,
    timestamp: new Date().toISOString(),
  });
}
