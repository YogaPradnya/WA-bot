import { silenceLibsignalLogs } from './utils/silenceLibsignal.js';
// Aktifkan filter log mentah libsignal sebelum inisialisasi modul lain
silenceLibsignalLogs();

import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { WhatsAppClient } from './core/connection.js';
import { initializeCommands } from './commands/index.js';
import { handleIncomingMessage } from './handlers/messageHandler.js';
import { handleGroupParticipantsUpdate } from './handlers/welcomeHandler.js';
import { createWebServer } from './web/server.js';
import { initDatabase } from './db/index.js';
import { menuStore } from './utils/menuStore.js';
import { initBotState } from './utils/botState.js';

async function bootstrap() {
  logger.info({ prefix: config.prefix, authMode: config.authMode }, 'Menginisialisasi WhatsApp Bot (Clean Terminal & Turso Active)...');

  // 0. Inisialisasi Database Turso, State Bot, dan Sinkronisasi Menu
  await initDatabase();
  await initBotState();
  await menuStore.init();

  // 1. Registrasi command-command
  initializeCommands();

  // 2. Inisialisasi WhatsApp client
  let client: WhatsAppClient | null = new WhatsAppClient();

  // 3. Inisialisasi dan jalankan Web Dashboard Server
  const webServer = createWebServer(() => client);
  await webServer.start(config.webPort);

  // 4. Pasang dispatcher pesan dan welcome message grup
  client.onMessage(async (sock, m) => {
    await handleIncomingMessage(sock, m);
  });
  client.onGroupParticipantsUpdate(handleGroupParticipantsUpdate);

  // 5. Hubungkan socket ke WhatsApp
  await client.connect();

  // 6. Penanganan graceful shutdown
  const handleShutdown = async (signal: string) => {
    logger.info({ signal }, 'Menerima sinyal terminasi, mematikan bot dan web dashboard secara aman...');
    try {
      await webServer.stop();
    } catch (err) {
      logger.error(err, 'Error saat menghentikan web dashboard:');
    }
    if (client) {
      await client.disconnect();
      client = null;
    }
    process.exit(0);
  };

  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  logger.error(err, 'Fatal error saat menjalankan bot:');
  process.exit(1);
});
