import { isAdmin } from './adminAuth.js';
import { config } from '../config/index.js';

interface SpamState { timestamps: number[]; cooldownUntil: number; }
const states = new Map<string, SpamState>();

export function checkGroupSpam(sender: string, isGroup: boolean): { blocked: boolean; warn: boolean; remainingSeconds: number } {
  if (!config.antispamEnabled || !isGroup || isAdmin(sender)) return { blocked: false, warn: false, remainingSeconds: 0 };
  const now = Date.now();
  const state = states.get(sender) || { timestamps: [], cooldownUntil: 0 };
  if (state.cooldownUntil > now) return { blocked: true, warn: false, remainingSeconds: Math.ceil((state.cooldownUntil - now) / 1000) };
  state.timestamps = state.timestamps.filter((timestamp) => now - timestamp < config.antispamWindowSeconds * 1000);
  state.timestamps.push(now);
  if (state.timestamps.length > config.antispamMaxMessages) {
    state.cooldownUntil = now + config.antispamCooldownSeconds * 1000;
    state.timestamps = [];
    states.set(sender, state);
    return { blocked: true, warn: true, remainingSeconds: config.antispamCooldownSeconds };
  }
  states.set(sender, state);
  return { blocked: false, warn: false, remainingSeconds: 0 };
}

setInterval(() => {
  const expiry = Date.now() - config.antispamWindowSeconds * 1000;
  for (const [key, state] of states) {
    state.timestamps = state.timestamps.filter((timestamp) => timestamp > expiry);
    if (state.timestamps.length === 0 && state.cooldownUntil < Date.now()) states.delete(key);
  }
}, 60_000).unref();
