import { db } from './index.js';
import { logger } from '../utils/logger.js';

export interface BotStats {
  totalMessages: number;
  totalCommands: number;
}

export async function incrementStat(key: 'messages' | 'commands', amount = 1): Promise<void> {
  try {
    await db.execute({
      sql: `
        INSERT INTO bot_stats (key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = value + ?;
      `,
      args: [key, amount, amount],
    });
  } catch (err) {
    logger.error({ key, err }, 'Gagal memperbarui metrik statistik di Turso:');
  }
}

export async function getStats(): Promise<BotStats> {
  try {
    const result = await db.execute('SELECT key, value FROM bot_stats');
    const statsMap: Record<string, number> = {};

    for (const row of result.rows) {
      statsMap[String(row.key)] = Number(row.value) || 0;
    }

    return {
      totalMessages: statsMap['messages'] || 0,
      totalCommands: statsMap['commands'] || 0,
    };
  } catch (err) {
    logger.error(err, 'Gagal mengambil metrik statistik dari Turso:');
    return {
      totalMessages: 0,
      totalCommands: 0,
    };
  }
}
