import type { Command, CommandContext } from '../../types/index.js';

type RobloxUserSearch = { id: number; name: string; displayName: string };
type RobloxUserDetails = RobloxUserSearch & { created: string; isBanned: boolean };
const ROBLOX_API = 'https://users.roblox.com/v1';

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeZone: 'Asia/Jakarta' }).format(new Date(value));
}

async function searchUser(username: string): Promise<RobloxUserSearch | null> {
  const response = await fetch(`${ROBLOX_API}/usernames/users`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Roblox API status ${response.status}`);
  const payload = await response.json() as { data?: RobloxUserSearch[] };
  return payload.data?.[0] || null;
}

async function getUserDetails(userId: number): Promise<RobloxUserDetails> {
  const response = await fetch(`${ROBLOX_API}/users/${userId}`, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`Roblox detail API status ${response.status}`);
  return await response.json() as RobloxUserDetails;
}

export const cekRobloxCommand: Command = {
  name: 'cek', aliases: ['cekroblox', 'roblox'],
  description: 'Mengecek informasi username Roblox.', usage: '.cek @username', category: 'General',
  execute: async (ctx: CommandContext) => {
    const username = ctx.args.join(' ').trim().replace(/^@+/, '');
    if (!username) { await ctx.reply('Format penggunaan:\n.cek @usernameRoblox'); return; }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      await ctx.reply('Username Roblox harus 3-20 karakter dan hanya boleh berisi huruf, angka, atau underscore.'); return;
    }
    try {
      const user = await searchUser(username);
      if (!user) { await ctx.reply(`Username Roblox *${username}* tidak ditemukan.`); return; }
      const details = await getUserDetails(user.id);
      const response = [
        'USERNAME ROBLOX DITEMUKAN',
        '--------------------------------',
        `Username: ${details.name}`,
        `Display Name: ${details.displayName}`,
        '--------------------------------',
      ].join('\n');
      await ctx.reply(response);
    } catch (error) {
      console.error('Gagal mengecek username Roblox:', error);
      await ctx.reply('Tidak dapat menghubungi layanan Roblox saat ini. Silakan coba lagi beberapa saat.');
    }
  },
};
