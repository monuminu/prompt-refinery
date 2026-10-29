import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));

export function readEnv() {
  const path = new URL('../.env', import.meta.url);
  if (existsSync(path)) process.loadEnvFile(fileURLToPath(path));
  return loadConfig(process.env);
}

function integer(value, fallback, min, max, name) {
  const raw = value === undefined || value === '' ? String(fallback) : String(value);
  const number = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(number) || number < min || number > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  }
  return number;
}

export function loadConfig(env) {
  let url;
  try { url = new URL(env.OPENAI_BASE_URL || 'https://api.openai.com/v1'); }
  catch { throw new Error('OPENAI_BASE_URL must be a valid API root URL.'); }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) ||
      url.username || url.password || url.search || url.hash) {
    throw new Error('OPENAI_BASE_URL requires HTTPS (HTTP is allowed for localhost), without credentials, query or fragment.');
  }
  const model = (env.OPENAI_MODEL ?? 'gpt-6-astra').trim();
  if (!model || model.length > 200) throw new Error('OPENAI_MODEL must name an accessible model or deployment.');
  const reasoningEffort = (env.OPENAI_REASONING_EFFORT || '').trim();
  if (reasoningEffort && !['none', 'low', 'medium', 'high', 'xhigh', 'max'].includes(reasoningEffort)) {
    throw new Error('OPENAI_REASONING_EFFORT must be blank, none, low, medium, high, xhigh or max.');
  }
  if (reasoningEffort === 'none' && /^(gpt-6-astra|gpt-6\.1-sol)(-|$)/.test(model)) {
    throw new Error(`${model} does not support none reasoning; use low or leave blank.`);
  }
  return {
    apiKey: (env.OPENAI_API_KEY || '').trim(),
    baseUrl: url.href.replace(/\/+$/, ''), model, reasoningEffort,
    timeoutMs: integer(env.OPENAI_TIMEOUT_MS, 120000, 1000, 600000, 'OPENAI_TIMEOUT_MS'),
    port: integer(env.PORT, 3000, 1, 65535, 'PORT'),
  };
}
