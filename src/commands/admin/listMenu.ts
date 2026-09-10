import type { Command, CommandContext } from '../../types/index.js';
import { isAdmin } from '../../utils/adminAuth.js';
import { menuStore } from '../../utils/menuStore.js';
import { config } from '../../config/index.js';

export const listMenuCommand: Command = {
  name: 'listmenu',
  aliases: ['kelolamenu', 'adminmenu'],
  description: 'Menampilkan detail seluruh menu untuk keperluan admin (Khusus Admin).',
  category: 'Admin',
  execute: async (ctx: CommandContext) => {
    // 1. Verifikasi hak akses admin
    if (!isAdmin(ctx.sender)) {
      await ctx.reply('Perintah ini hanya dapat dijalankan oleh nomor admin yang terdaftar.');
      return;
    }

    const items = menuStore.getAll();

    const lines: string[] = [
      '*PANEL KELOLA MENU (ADMIN)*',
      '--------------------------------',
    ];

    if (items.length === 0) {
      lines.push('Saat ini belum ada menu yang tersimpan.');
    } else {
      for (const item of items) {
        lines.push(`*Trigger:* ${item.trigger}`);
        lines.push(`*Judul:* ${item.title}`);
        lines.push(`*Respon:* ${item.response}`);
        lines.push('--------------------------------');
      }
    }

    lines.push('');
    lines.push('*PANDUAN PERINTAH ADMIN:*');
    lines.push(`- Tambah/Ubah: ${config.prefix}setmenu <trigger> | <judul> | <konten>`);
    lines.push(`- Hapus: ${config.prefix}delmenu <trigger>`);

    await ctx.reply(lines.join('\n'));
  },
};
