import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export interface AppConfig {
  prefix: string;
  sessionDir: string;
  logLevel: string;
  authMode: 'qr' | 'pairing';
  pairingPhoneNumber?: string;
  adminNumbers: string[];
  webPort: number;
  dashboardPassword: string;
  welcomeEnabled: boolean;
  welcomeMessage: string;
  antispamEnabled: boolean;
  antispamMaxMessages: number;
  antispamWindowSeconds: number;
  antispamCooldownSeconds: number;
  tursoDatabaseUrl: string;
  tursoAuthToken?: string;
}

const parseAdminNumbers = (raw: string | undefined): string[] => {
  if (!raw) return [];
  return raw
    .split(',')
    .map((num) => num.replace(/[^0-9]/g, '').trim())
    .filter((num) => num.length > 0);
};

export const config: AppConfig = {
  prefix: process.env.BOT_PREFIX || '.',
  sessionDir: path.resolve(process.cwd(), process.env.SESSION_NAME || 'session'),
  logLevel: process.env.LOG_LEVEL || 'info',
  authMode: (process.env.AUTH_MODE as 'qr' | 'pairing') || 'qr',
  pairingPhoneNumber: process.env.PAIRING_PHONE_NUMBER || undefined,
  adminNumbers: parseAdminNumbers(process.env.ADMIN_NUMBERS),
  webPort: parseInt(process.env.WEB_PORT || '3000', 10),
  dashboardPassword: process.env.DASHBOARD_PASSWORD || 'admin123',
  welcomeEnabled: process.env.WELCOME_ENABLED !== 'false',
  welcomeMessage: process.env.WELCOME_MESSAGE || 'Selamat datang @user! Ketik .menu untuk melihat menu bot.',
  antispamEnabled: process.env.ANTISPAM_ENABLED === 'true',
  antispamMaxMessages: parseInt(process.env.ANTISPAM_MAX_MESSAGES || '5', 10),
  antispamWindowSeconds: parseInt(process.env.ANTISPAM_WINDOW_SECONDS || '10', 10),
  antispamCooldownSeconds: parseInt(process.env.ANTISPAM_COOLDOWN_SECONDS || '60', 10),
  tursoDatabaseUrl: process.env.TURSO_DATABASE_URL || 'file:bot.db',
  tursoAuthToken: process.env.TURSO_AUTH_TOKEN || undefined,
};
