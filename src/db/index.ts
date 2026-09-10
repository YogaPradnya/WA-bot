import { createClient, type Client } from '@libsql/client';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

export const db: Client = createClient({
  url: config.tursoDatabaseUrl,
  authToken: config.tursoAuthToken,
});

export async function initDatabase(): Promise<void> {
  try {
    // Periksa skema tabel custom_menus dan sesuaikan jika masih skema lama
    const tableInfo = await db.execute(`PRAGMA table_info(custom_menus)`);
    const hasTriggerCol = tableInfo.rows.some((col) => col.name === 'trigger');
    if (tableInfo.rows.length > 0 && !hasTriggerCol) {
      await db.execute(`DROP TABLE custom_menus`);
    }

    // Tabel untuk menu kustom dinamis
    await db.execute(`
      CREATE TABLE IF NOT EXISTS custom_menus (
        trigger TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        response TEXT NOT NULL,
        image_url TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Tabel untuk metrik penggunaan dan statistik bot
    await db.execute(`
      CREATE TABLE IF NOT EXISTS bot_stats (
        key TEXT PRIMARY KEY,
        value INTEGER DEFAULT 0
      );
    `);

    // Tabel konfigurasi sistem dan state bot
    await db.execute(`
      CREATE TABLE IF NOT EXISTS bot_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    logger.info('Database Turso (libSQL) berhasil diinisialisasi dan skema tabel siap.');
  } catch (err) {
    logger.error(err, 'Gagal menginisialisasi skema database Turso:');
    throw err;
  }
}
