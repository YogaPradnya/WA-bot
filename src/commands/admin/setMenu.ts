import type { Command, CommandContext } from '../../types/index.js';
import { isAdmin } from '../../utils/adminAuth.js';
import { menuStore } from '../../utils/menuStore.js';
import { config } from '../../config/index.js';

export const setMenuCommand: Command = {
  name: 'setmenu',
  aliases: ['addmenu', 'updatemenu'],
  description: 'Menambah atau memperbarui pilihan menu (Khusus Admin).',
  usage: `${config.prefix}setmenu <trigger> | <judul> | <konten_respon>`,
  category: 'Admin',
  execute: async (ctx: CommandContext) => {
    // 1. Verifikasi hak akses admin
    if (!isAdmin(ctx.sender)) {
      await ctx.reply('Perintah ini hanya dapat dijalankan oleh nomor admin yang terdaftar.');
      return;
    }

    // 2. Ekstraksi konten setelah nama perintah
    const fullText = ctx.body.slice(config.prefix.length + ctx.command.length).trim();
    const parts = fullText.split('|').map((part) => part.trim());

    if (parts.length < 3 || !parts[0] || !parts[1] || !parts[2]) {
      const guide = [
        '*FORMAT PERINTAH TIDAK VALID*',
        '--------------------------------',
        `Gunakan format:`,
        `${config.prefix}setmenu <trigger> | <judul> | <konten_respon>`,
        '',
        'Contoh:',
        `${config.prefix}setmenu 4 | Promo Spesial | Dapatkan diskon 50% untuk layanan kami minggu ini.`,
        '--------------------------------',
      ].join('\n');
      await ctx.reply(guide);
      return;
    }

    const [trigger, title, ...restResponse] = parts;
    const response = restResponse.join('|').trim();

    // 3. Simpan ke database menu
    await menuStore.addOrUpdate({
      trigger,
      title,
      response,
    });

    const successMessage = [
      '*BERHASIL MENYIMPAN MENU*',
      '--------------------------------',
      `- Trigger: ${trigger}`,
      `- Judul: ${title}`,
      `- Respon: ${response}`,
      '--------------------------------',
      `Menu telah aktif dan langsung dapat di-trigger pengguna tanpa tanda titik.`,
    ].join('\n');

    await ctx.reply(successMessage);
  },
};
