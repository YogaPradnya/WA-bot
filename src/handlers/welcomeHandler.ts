import type { WASocket } from '@whiskeysockets/baileys';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

export async function handleGroupParticipantsUpdate(sock: WASocket, update: any): Promise<void> {
  if (!config.welcomeEnabled || update.action !== 'add' || !update.id || !Array.isArray(update.participants)) return;

  const mentions = update.participants.map((jid: string) => `@${jid.split('@')[0]}`).join(', ');
  const message = config.welcomeMessage.replace(/@user/g, mentions);

  await sock.sendMessage(update.id, {
    text: message,
    mentions: update.participants,
  });
  logger.info({ groupId: update.id, participants: update.participants }, 'Welcome message dikirim.');
}
