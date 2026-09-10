import type { Command, CommandContext } from '../../types/index.js';
import { checkGroupAdminStatus } from '../../utils/groupAuth.js';
import { logger } from '../../utils/logger.js';
import { config } from '../../config/index.js';

export const gcOpenCommand: Command = {
  name: 'gcopen',
  aliases: ['opengc', 'bukagc'],
  description: 'Membuka grup agar semua anggota dapat mengirim pesan.',
  usage: `${config.prefix}gcopen`,
  category: 'Admin',
  execute: async (ctx: CommandContext) => {
    const auth = await checkGroupAdminStatus(ctx);
    if (auth.error) {
      await ctx.reply(auth.error);
      return;
    }

    try {
      await ctx.sock.groupSettingUpdate(ctx.remoteJid, 'not_announcement');
      await ctx.reply('*GRUP DIBUKA*\nPengaturan grup telah diubah. Semua anggota sekarang dapat mengirim pesan.');
    } catch (err) {
      logger.error({ err, remoteJid: ctx.remoteJid }, 'Gagal membuka grup:');
      await ctx.reply('Terjadi kesalahan saat mencoba membuka grup.');
    }
  },
};
