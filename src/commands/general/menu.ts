import type { Command, CommandContext } from '../../types/index.js';
import { menuStore } from '../../utils/menuStore.js';

export const menuCommand: Command = {
  name: 'menu',
  aliases: ['m', 'daftar'],
  description: 'Menampilkan daftar menu utama yang dapat diakses.',
  category: 'General',
  execute: async (ctx: CommandContext) => {
    const items = menuStore.getAll();

    if (items.length === 0) {
      await ctx.reply('Belum ada menu yang terdaftar saat ini. Silakan hubungi admin.');
      return;
    }

    const lines: string[] = [
      '*DAFTAR MENU UTAMA*',
      'Ketik angka / kata kunci pilihan Anda langsung:',
      '--------------------------------',
    ];

    for (const item of items) {
      lines.push(`[ ${item.trigger} ] ${item.title}`);
    }

    lines.push('--------------------------------');
    lines.push('Catatan: Cukup ketik angka/trigger di atas secara langsung tanpa tanda titik.');

    await ctx.reply(lines.join('\n'));
  },
};
