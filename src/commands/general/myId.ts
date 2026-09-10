import type { Command, CommandContext } from '../../types/index.js';
import { isAdmin, extractPhoneNumberFromJid } from '../../utils/adminAuth.js';

export const myIdCommand: Command = {
  name: 'myid',
  aliases: ['id', 'me'],
  description: 'Melihat ID WhatsApp dan status hak akses admin Anda.',
  category: 'General',
  execute: async (ctx: CommandContext) => {
    const rawJid = ctx.sender;
    const detectedId = extractPhoneNumberFromJid(rawJid);
    const userIsAdmin = isAdmin(rawJid);

    const lines = [
      '*INFORMASI ID WHATSAPP*',
      '--------------------------------',
      `- JID Pengirim: ${rawJid}`,
      `- ID / Nomor Terdeteksi: ${detectedId}`,
      `- Status Admin: ${userIsAdmin ? 'AKTIF (Admin)' : 'TIDAK AKTIF (Pengguna Biasa)'}`,
      '--------------------------------',
    ];

    if (!userIsAdmin) {
      lines.push(`Untuk menjadikan ID ini sebagai admin, tambahkan ID *${detectedId}* ke baris ADMIN_NUMBERS pada file .env.`);
    }

    await ctx.reply(lines.join('\n'));
  },
};
