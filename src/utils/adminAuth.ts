import dotenv from 'dotenv';
import { jidNormalizedUser } from '@whiskeysockets/baileys';

/**
 * Membaca daftar nomor admin terbaru secara dinamis dari environment.
 */
export function getAdminNumbers(): string[] {
  dotenv.config();
  const raw = process.env.ADMIN_NUMBERS || '';
  return raw
    .split(',')
    .map((num) => num.replace(/[^0-9]/g, '').trim())
    .filter((num) => num.length > 0);
}

/**
 * Mengekstrak nomor telepon bersih dari JID WhatsApp.
 * Contoh: '628123456789:2@s.whatsapp.net' -> '628123456789'
 */
export function extractPhoneNumberFromJid(jid: string): string {
  if (!jid) return '';
  try {
    const normalized = jidNormalizedUser(jid);
    const userPart = normalized.split('@')[0] || '';
    return userPart.replace(/[^0-9]/g, '');
  } catch {
    const userPart = jid.split('@')[0] || '';
    const phoneOnly = userPart.split(':')[0] || '';
    return phoneOnly.replace(/[^0-9]/g, '');
  }
}

/**
 * Memeriksa apakah pengirim pesan terdaftar sebagai admin.
 */
export function isAdmin(senderJid: string): boolean {
  if (!senderJid) return false;
  const senderNumber = extractPhoneNumberFromJid(senderJid);
  if (!senderNumber) return false;

  const currentAdminNumbers = getAdminNumbers();
  return currentAdminNumbers.includes(senderNumber);
}
