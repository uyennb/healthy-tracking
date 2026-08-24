// Persistent Key-Value Adapter for NutriFit Sync Engine
// Supports Upstash Redis with Atomic Lua CAS & Isolated Test Mode

import { Redis } from '@upstash/redis';

const LUA_CAS_SCRIPT = `
local key = KEYS[1]
local expectedVersion = tonumber(ARGV[1])
local newPayloadStr = ARGV[2]
local incomingToken = ARGV[3]

local current = redis.call('GET', key)
if not current then
  if expectedVersion ~= 0 then
    return cjson.encode({ conflict = true, reason = 'NOT_FOUND_BUT_EXPECTED_VERSION' })
  end
  if not incomingToken or incomingToken == '' then
    return cjson.encode({ unauthorized = true })
  end
  redis.call('SET', key, newPayloadStr)
  return cjson.encode({ success = true })
end

local ok, decoded = pcall(cjson.decode, current)
if not ok or not decoded then
  return cjson.encode({ error = 'CORRUPTED_JSON' })
end

if decoded.authToken and decoded.authToken ~= '' then
  if not incomingToken or incomingToken == '' or incomingToken ~= decoded.authToken then
    return cjson.encode({ unauthorized = true })
  end
end

local currentVersion = tonumber(decoded.version) or 0
if currentVersion ~= expectedVersion then
  return cjson.encode({ conflict = true, currentVersion = currentVersion })
end

redis.call('SET', key, newPayloadStr)
return cjson.encode({ success = true })
`;

// Test-mode atomic store map for integration testing without live cloud credentials
const testMemoryStorage = new Map();

function sanitizeEnvValue(val) {
  if (!val) return '';
  let str = String(val).trim();
  // Strip surrounding quotes
  str = str.replace(/^["'`]|["'`]$/g, '').trim();
  // If user pasted KEY=VALUE into Value field by mistake
  if (str.startsWith('UPSTASH_') || str.startsWith('KV_')) {
    const eqIdx = str.indexOf('=');
    if (eqIdx !== -1) {
      str = str.substring(eqIdx + 1).trim().replace(/^["'`]|["'`]$/g, '').trim();
    }
  }
  return str;
}

export class KvAdapter {
  constructor(options = {}) {
    const rawUrl = options.url || process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const rawToken = options.token || process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

    this.url = sanitizeEnvValue(rawUrl);
    this.token = sanitizeEnvValue(rawToken);
    this.isTestMode = options.isTestMode || process.env.KV_TEST_MODE === 'true';

    if (this.url && this.token && !this.isTestMode) {
      try {
        this.redis = new Redis({
          url: this.url,
          token: this.token,
        });
      } catch (e) {
        console.warn('Redis initialization error:', e);
      }
    }
  }

  isConfigured() {
    if (this.isTestMode) return true;
    return Boolean(this.url && this.token && this.redis);
  }

  async ping() {
    if (this.isTestMode) return { ok: true, mode: 'test_memory' };
    if (!this.isConfigured()) return { ok: false, error: 'KV_NOT_CONFIGURED' };

    try {
      const pong = await this.redis.ping();
      return { ok: pong === 'PONG' || pong === true, response: pong };
    } catch (err) {
      return { ok: false, error: err?.message || 'PING_FAILED' };
    }
  }

  async getState(key) {
    if (this.isTestMode) {
      if (testMemoryStorage.has(key)) {
        return { data: JSON.parse(JSON.stringify(testMemoryStorage.get(key))) };
      }
      return { data: null };
    }

    if (!this.isConfigured()) {
      return { error: 'KV_NOT_CONFIGURED' };
    }

    try {
      const data = await this.redis.get(key);
      if (!data) return { data: null };
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      return { data: parsed };
    } catch (err) {
      return { error: err?.message || 'KV_GET_ERROR' };
    }
  }

  async atomicCompareAndSet(key, expectedVersion, newPayload, incomingToken) {
    const payloadStr = JSON.stringify(newPayload);

    if (this.isTestMode) {
      // Simulate exact atomic Lua CAS semantics
      const current = testMemoryStorage.get(key);
      if (!current) {
        if (expectedVersion !== 0) {
          return { conflict: true, reason: 'NOT_FOUND_BUT_EXPECTED_VERSION' };
        }
        if (!incomingToken || incomingToken === '') {
          return { unauthorized: true };
        }
        testMemoryStorage.set(key, JSON.parse(payloadStr));
        return { success: true };
      }

      if (current.authToken && current.authToken !== '') {
        if (!incomingToken || incomingToken === '' || incomingToken !== current.authToken) {
          return { unauthorized: true };
        }
      }

      const currentVersion = Number(current.version) || 0;
      if (currentVersion !== Number(expectedVersion)) {
        return { conflict: true, currentVersion };
      }

      testMemoryStorage.set(key, JSON.parse(payloadStr));
      return { success: true };
    }

    if (!this.isConfigured()) {
      return { error: 'KV_NOT_CONFIGURED' };
    }

    try {
      const result = await this.redis.eval(
        LUA_CAS_SCRIPT,
        [key],
        [expectedVersion, payloadStr, incomingToken || '']
      );

      if (!result) {
        return { error: 'LUA_EMPTY_RESULT' };
      }

      const parsed = typeof result === 'string' ? JSON.parse(result) : result;
      return parsed;
    } catch (err) {
      return { error: err?.message || 'KV_EVAL_ERROR' };
    }
  }
}

export const defaultKvAdapter = new KvAdapter();
