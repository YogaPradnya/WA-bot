import { jidNormalizedUser } from '@whiskeysockets/baileys';
import type { CommandContext } from '../types/index.js';
import { isAdmin } from './adminAuth.js';
import { logger } from './logger.js';

export interface GroupAdminCheckResult {
  isGroup: boolean;
  isSenderAdmin: boolean;
  isBotAdmin: boolean;
  error?: string;
}

/**
 * Memverifikasi apakah konteks berada di grup,
 * serta memeriksa hak admin pengirim dan hak admin bot.
 */
export async function checkGroupAdminStatus(ctx: CommandContext): Promise<GroupAdminCheckResult> {
  if (!ctx.isGroup) {
    return {
      isGroup: false,
      isSenderAdmin: false,
      isBotAdmin: false,
      error: 'Perintah ini hanya dapat digunakan di dalam grup.',
    };
  }

  try {
    const groupMeta = await ctx.sock.groupMetadata(ctx.remoteJid);
    const participants = groupMeta?.participants || [];

    const senderNormalized = jidNormalizedUser(ctx.sender);
    const botUser = ctx.sock.user;
    const botNormalized = botUser?.id ? jidNormalizedUser(botUser.id) : '';

    const senderIsOwner = isAdmin(ctx.sender);

    const senderParticipant = participants.find((p) => jidNormalizedUser(p.id) === senderNormalized);
    const botParticipant = botNormalized
      ? participants.find((p) => jidNormalizedUser(p.id) === botNormalized)
      : undefined;

    const isSenderGroupAdmin = !!(
      senderParticipant?.admin === 'admin' || senderParticipant?.admin === 'superadmin'
    );
    const isBotAdmin = !!(
      botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin'
    );

    const isSenderAdmin = senderIsOwner || isSenderGroupAdmin;

    if (!isSenderAdmin) {
      return {
        isGroup: true,
        isSenderAdmin: false,
        isBotAdmin,
        error: 'Perintah ini hanya dapat digunakan oleh admin grup.',
      };
    }

    if (!isBotAdmin) {
      return {
        isGroup: true,
        isSenderAdmin: true,
        isBotAdmin: false,
        error: 'Bot bukan admin di grup ini. Jadikan bot sebagai admin grup terlebih dahulu.',
      };
    }

    return {
      isGroup: true,
      isSenderAdmin: true,
      isBotAdmin: true,
    };
  } catch (err) {
    logger.error({ err, remoteJid: ctx.remoteJid }, 'Gagal mengambil metadata grup untuk validasi admin.');
    return {
      isGroup: true,
      isSenderAdmin: false,
      isBotAdmin: false,
      error: 'Gagal memverifikasi status grup. Pastikan bot memiliki akses ke grup ini.',
    };
  }
}
