import type { Command, CommandContext } from '../../types/index.js';
import { checkGroupAdminStatus } from '../../utils/groupAuth.js';
import { logger } from '../../utils/logger.js';
import { config } from '../../config/index.js';

export const gcCloseCommand: Command = {
  name: 'gcclose',
  aliases: ['closegc', 'tutupgc'],
  description: 'Menutup grup sehingga hanya admin yang dapat mengirim pesan.',
  usage: `${config.prefix}gcclose`,
  category: 'Admin',
  execute: async (ctx: CommandContext) => {
    const auth = await checkGroupAdminStatus(ctx);
    if (auth.error) {
      await ctx.reply(auth.error);
      return;
    }

    try {
      await ctx.sock.groupSettingUpdate(ctx.remoteJid, 'announcement');
      await ctx.reply('*GRUP DITUTUP*\nPengaturan grup telah diubah. Hanya admin yang sekarang dapat mengirim pesan.');
    } catch (err) {
      logger.error({ err, remoteJid: ctx.remoteJid }, 'Gagal menutup grup:');
      await ctx.reply('Terjadi kesalahan saat mencoba menutup grup.');
    }
  },
};
