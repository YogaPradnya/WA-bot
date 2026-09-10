import { db } from '../db/index.js';
import { logger } from './logger.js';
import { addLog } from './activityLogger.js';

let botActive = true;

export function isBotActive(): boolean {
  return botActive;
}

export async function initBotState(): Promise<void> {
  try {
    const result = await db.execute({
      sql: `SELECT value FROM bot_config WHERE key = ?`,
      args: ['bot_active'],
    });

    if (result.rows.length > 0) {
      botActive = result.rows[0].value === 'true';
      logger.info({ botActive }, 'Status aktif bot berhasil dimuat dari database Turso');
    } else {
      // Default: aktif
      await db.execute({
        sql: `INSERT OR REPLACE INTO bot_config (key, value, updated_at) VALUES ('bot_active', 'true', CURRENT_TIMESTAMP)`,
        args: [],
      });
      botActive = true;
    }
  } catch (err) {
    logger.error(err, 'Gagal memuat status bot_active dari Turso, menggunakan default: true');
    botActive = true;
  }
}

export async function setBotActive(active: boolean): Promise<boolean> {
  botActive = active;
  const statusText = active ? 'ONLINE / AKTIF' : 'OFFLINE / NONAKTIF';

  addLog(
    active ? 'success' : 'warn',
    'system',
    `Status bot diubah menjadi ${statusText} melalui Dashboard`
  );

  try {
    await db.execute({
      sql: `INSERT OR REPLACE INTO bot_config (key, value, updated_at) VALUES ('bot_active', ?, CURRENT_TIMESTAMP)`,
      args: [active ? 'true' : 'false'],
    });
    logger.info({ botActive: active }, `Status bot berhasil disimpan ke Turso: ${statusText}`);
  } catch (err) {
    logger.error(err, 'Gagal menyimpan status bot_active ke Turso:');
  }

  return botActive;
}
