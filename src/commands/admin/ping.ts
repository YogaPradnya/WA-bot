import type { Command, CommandContext } from '../../types/index.js';
import { isAdmin } from '../../utils/adminAuth.js';

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const parts = [];
  if (d > 0) parts.push(`${d} hari`);
  if (h > 0) parts.push(`${h} jam`);
  if (m > 0) parts.push(`${m} menit`);
  parts.push(`${s} detik`);
  return parts.join(' ');
}

export const pingCommand: Command = {
  name: 'ping',
  aliases: ['p', 'status'],
  description: 'Memeriksa status respon bot, uptime, dan penggunaan memori server (Khusus Admin).',
  category: 'Admin',
  execute: async (ctx: CommandContext) => {
    if (!isAdmin(ctx.sender)) {
      await ctx.reply('Perintah ini hanya dapat dijalankan oleh nomor admin yang terdaftar.');
      return;
    }

    const memory = process.memoryUsage();
    const rssMb = (memory.rss / (1024 * 1024)).toFixed(2);
    const heapMb = (memory.heapUsed / (1024 * 1024)).toFixed(2);
    const uptimeStr = formatUptime(process.uptime());

    const response = [
      '*STATUS BOT & SERVER*',
      '--------------------------------',
      `- Status: Aktif (Online)`,
      `- Uptime: ${uptimeStr}`,
      `- Memori RSS: ${rssMb} MB`,
      `- Heap Terpakai: ${heapMb} MB`,
      `- Platform: Node.js ${process.version} (${process.platform})`,
      '--------------------------------',
    ].join('\n');

    await ctx.reply(response);
  },
};
