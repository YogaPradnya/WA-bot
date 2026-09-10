import type { proto, WASocket, AnyMessageContent } from '@whiskeysockets/baileys';
import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { registry } from '../commands/index.js';
import { menuStore } from '../utils/menuStore.js';
import { isAdmin, extractPhoneNumberFromJid } from '../utils/adminAuth.js';
import { checkGroupSpam } from '../utils/antiSpam.js';
import { incrementStat } from '../db/stats.js';
import { isBotActive } from '../utils/botState.js';
import { addLog } from '../utils/activityLogger.js';
import type { CommandContext } from '../types/index.js';

// Cache untuk menyimpan ID pesan yang dikirimkan oleh bot (mencegah auto-reply loop)
const botSentMessageIds = new Set<string>();
const MAX_SENT_CACHE = 500;

export function addSentMessageId(id: string): void {
  if (botSentMessageIds.size >= MAX_SENT_CACHE) {
    const firstKey = botSentMessageIds.keys().next().value;
    if (firstKey) botSentMessageIds.delete(firstKey);
  }
  botSentMessageIds.add(id);
}

export function extractMessageText(message: proto.IMessage | null | undefined): string {
  if (!message) return '';

  return (
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    message.documentMessage?.caption ||
    message.buttonsResponseMessage?.selectedButtonId ||
    message.listResponseMessage?.singleSelectReply?.selectedRowId ||
    message.templateButtonReplyMessage?.selectedId ||
    ''
  ).trim();
}

function getLocalMediaBuffer(imageUrl: string): Buffer | null {
  if (!imageUrl.startsWith('/media/')) return null;
  const filename = path.basename(imageUrl);
  const mediaPath = path.resolve(process.cwd(), 'public/media', filename);
  const mediaDir = path.resolve(process.cwd(), 'public/media');
  if (!mediaPath.startsWith(`${mediaDir}${path.sep}`) || !fs.existsSync(mediaPath)) return null;
  return fs.readFileSync(mediaPath);
}

export async function handleIncomingMessage(
  sock: WASocket,
  upsert: { messages: proto.IWebMessageInfo[]; type: string }
): Promise<void> {
  if (upsert.type !== 'notify') return;

  for (const msg of upsert.messages) {
    // 1. Abaikan pesan jika dikirim oleh proses bot ini sendiri (mencegah loop)
    if (msg.key.id && botSentMessageIds.has(msg.key.id)) {
      continue;
    }

    if (!msg.message) continue;

    const remoteJid = msg.key.remoteJid;
    if (!remoteJid || remoteJid === 'status@broadcast') continue;

    const isGroup = remoteJid.endsWith('@g.us');

    // 2. Identifikasi pengirim pesan
    // Jika fromMe: pesan diketik oleh pemilik akun di WhatsApp. Kita tetapkan sender sebagai akun bot tersebut.
    let sender = msg.key.participant || remoteJid;
    if (msg.key.fromMe) {
      sender = sock.user?.id || (config.pairingPhoneNumber ? `${config.pairingPhoneNumber}@s.whatsapp.net` : remoteJid);
    }

    const body = extractMessageText(msg.message);
    if (!body) continue;

    const senderPhone = extractPhoneNumberFromJid(sender);
    const senderIsAdmin = isAdmin(sender);

    // 3. Log diagnostik pesan masuk
    logger.info(
      {
        sender,
        senderPhone,
        isAdmin: senderIsAdmin,
        fromMe: !!msg.key.fromMe,
        isGroup,
        text: body,
      },
      'Pesan WhatsApp masuk:'
    );

    // Catat ke Activity Logger Dashboard
    addLog('info', 'message', `Pesan dari ${senderPhone || sender}: ${body.slice(0, 50)}`);

    // Catat statistik pesan masuk ke Turso DB
    incrementStat('messages').catch(() => {});

    // Jika bot dalam status nonaktif (OFF), abaikan auto-respon & perintah
    if (!isBotActive()) {
      logger.info({ senderPhone }, 'Bot berstatus NONAKTIF (OFF) dari dashboard. Pesan tidak diproses.');
      continue;
    }

    const spamCheck = checkGroupSpam(sender, isGroup);
    if (spamCheck.blocked) {
      if (spamCheck.warn) {
        const warning = await sock.sendMessage(
          remoteJid,
          { text: `Peringatan: terlalu banyak pesan. Anda dibatasi selama ${spamCheck.remainingSeconds} detik.` },
          { quoted: msg },
        );
        if (warning?.key?.id) addSentMessageId(warning.key.id);
      }
      continue;
    }

    const reply = async (content: string | AnyMessageContent) => {
      const messageContent: AnyMessageContent =
        typeof content === 'string' ? { text: content } : content;

      const sent = await sock.sendMessage(remoteJid, messageContent, { quoted: msg });
      if (sent?.key?.id) {
        addSentMessageId(sent.key.id);
      }
      return sent;
    };

    // 4. Pengecekan Perintah Ber-prefix (misal .menu, .setmenu, .ping)
    if (body.startsWith(config.prefix)) {
      const trimmed = body.slice(config.prefix.length).trim();
      if (!trimmed) continue;

      const [commandName, ...args] = trimmed.split(/\s+/);
      const command = registry.get(commandName);

      if (!command) {
        continue;
      }

      logger.info(
        { command: command.name, senderPhone, senderIsAdmin, remoteJid, args },
        'Mengeksekusi perintah ber-prefix:'
      );

      // Catat ke log aktivitas dan statistik
      addLog('info', 'command', `Perintah .${command.name} dijalankan oleh ${senderPhone}`);
      incrementStat('commands').catch(() => {});

      const ctx: CommandContext = {
        sock,
        message: msg,
        remoteJid,
        sender,
        isGroup,
        command: commandName,
        args,
        body,
        reply,
      };

      try {
        await command.execute(ctx);
      } catch (err) {
        logger.error({ err, command: command.name }, 'Error saat eksekusi command:');
        try {
          await reply('Terjadi kesalahan saat memproses perintah ini.');
        } catch (replyErr) {
          logger.error(replyErr, 'Gagal mengirim pesan error:');
        }
      }
      continue;
    }

    // 5. Pengecekan Pemicu Non-Prefix (misal pengguna mengetik 1, 2, atau kata kunci menu)
    const normalizedBody = body.toLowerCase().trim();
    const menuItem = menuStore.getByTrigger(normalizedBody);

    if (menuItem) {
      logger.info(
        { trigger: menuItem.trigger, senderPhone, remoteJid },
        'Mengeksekusi respon menu non-prefix:'
      );
      addLog('success', 'command', `Trigger menu "${menuItem.trigger}" oleh ${senderPhone}`);
        try {
          if (menuItem.imageUrl) {
            try {
              const localImage = getLocalMediaBuffer(menuItem.imageUrl);
              const image = localImage || { url: menuItem.imageUrl };
              await reply({ image, caption: menuItem.response });
            } catch (imageError) {
              logger.warn({ err: imageError, trigger: menuItem.trigger }, 'Gambar menu gagal dikirim, menggunakan teks fallback.');
              await reply(menuItem.response);
            }
          } else {
            await reply(menuItem.response);
          }
        } catch (err) {
          logger.error({ err, trigger: menuItem.trigger }, 'Gagal mengirim respon menu non-prefix:');
        }
    }
  }
}
