import type { Command, CommandContext } from '../../types/index.js';
import { isAdmin } from '../../utils/adminAuth.js';
import { menuStore } from '../../utils/menuStore.js';
import { config } from '../../config/index.js';

export const delMenuCommand: Command = {
  name: 'delmenu',
  aliases: ['hapusmenu', 'removemenu'],
  description: 'Menghapus pilihan menu berdasarkan trigger (Khusus Admin).',
  usage: `${config.prefix}delmenu <trigger>`,
  category: 'Admin',
  execute: async (ctx: CommandContext) => {
    // 1. Verifikasi hak akses admin
    if (!isAdmin(ctx.sender)) {
      await ctx.reply('Perintah ini hanya dapat dijalankan oleh nomor admin yang terdaftar.');
      return;
    }

    const trigger = ctx.args[0]?.trim();

    if (!trigger) {
      await ctx.reply(`Format salah. Gunakan: ${config.prefix}delmenu <trigger>\nContoh: ${config.prefix}delmenu 4`);
      return;
    }

    const deleted = await menuStore.delete(trigger);

    if (deleted) {
      await ctx.reply(`Menu dengan trigger "${trigger}" berhasil dihapus dari sistem.`);
    } else {
      await ctx.reply(`Menu dengan trigger "${trigger}" tidak ditemukan dalam daftar menu.`);
    }
  },
};
