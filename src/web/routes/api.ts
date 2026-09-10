import { Router, Request, Response, NextFunction } from 'express';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { config } from '../../config/index.js';
import { menuStore } from '../../utils/menuStore.js';
import { getAdminNumbers } from '../../utils/adminAuth.js';
import { getStats } from '../../db/stats.js';
import { getRecentLogs } from '../../utils/activityLogger.js';
import { isBotActive, setBotActive } from '../../utils/botState.js';
import { logger } from '../../utils/logger.js';
import type { WhatsAppClient } from '../../core/connection.js';

export function createApiRouter(clientGetter?: () => WhatsAppClient | null): Router {
  const router = Router();

  // Helper untuk memvalidasi token sesi dashboard
  const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers['authorization'];
    const customHeader = req.headers['x-dashboard-key'];
    const token = customHeader || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined);

    if (!token || token !== config.dashboardPassword) {
      res.status(401).json({ success: false, message: 'Autentikasi gagal. Kunci akses tidak valid.' });
      return;
    }
    next();
  };

  // 1. Auth: Login
  router.post('/auth/login', (req: Request, res: Response) => {
    const { password } = req.body;
    if (password === config.dashboardPassword) {
      res.json({ success: true, token: config.dashboardPassword, message: 'Login berhasil.' });
    } else {
      res.status(401).json({ success: false, message: 'Password salah.' });
    }
  });

  // 2. Status: Bot & Server Health
  router.get('/status', async (req: Request, res: Response) => {
    const client = clientGetter ? clientGetter() : null;
    const sock = client ? client.getSocket() : null;

    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsage = process.memoryUsage();
    const stats = await getStats();

    res.json({
      success: true,
      data: {
        bot: {
          status: sock ? 'connected' : 'disconnected',
          active: isBotActive(),
          userJid: sock?.user?.id || null,
          pairingNumber: config.pairingPhoneNumber || null,
          prefix: config.prefix,
        },
        server: {
          hostname: os.hostname(),
          platform: `${os.type()} ${os.release()} (${os.arch()})`,
          nodeVersion: process.version,
          processUptime: Math.floor(process.uptime()),
          osUptime: Math.floor(os.uptime()),
          cpuModel: os.cpus()[0]?.model || 'Unknown',
          cpuCores: os.cpus().length,
          loadAverage: os.loadavg(),
          ram: {
            totalMb: Math.round(totalMem / (1024 * 1024)),
            usedMb: Math.round(usedMem / (1024 * 1024)),
            freeMb: Math.round(freeMem / (1024 * 1024)),
            percent: ((usedMem / totalMem) * 100).toFixed(1),
          },
          processMemoryMb: Math.round(memUsage.rss / (1024 * 1024)),
        },
        stats: {
          totalMessages: stats.totalMessages,
          totalCommands: stats.totalCommands,
        },
        menuCount: menuStore.getAll().length,
      },
    });
  });

  // 3. Menu Management: Get All
  router.get('/menus', (req: Request, res: Response) => {
    res.json({ success: true, data: menuStore.getAll() });
  });

  // Upload banner lokal (base64 dari dashboard)
  router.post('/media', authMiddleware, (req: Request, res: Response) => {
    const { data, filename } = req.body;
    if (typeof data !== 'string' || !data.startsWith('data:image/')) {
      res.status(400).json({ success: false, message: 'File gambar tidak valid.' });
      return;
    }
    const match = data.match(/^data:image\/(jpeg|png|webp);base64,(.+)$/);
    if (!match) {
      res.status(400).json({ success: false, message: 'Format hanya JPG, PNG, atau WEBP.' });
      return;
    }
    const buffer = Buffer.from(match[2], 'base64');
    const isJpeg = buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
    const isPng = buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const isWebp = buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP';
    if (!isJpeg && !isPng && !isWebp) {
      res.status(400).json({ success: false, message: 'Isi file bukan gambar JPG, PNG, atau WEBP yang valid.' });
      return;
    }
    if (buffer.length > 8 * 1024 * 1024) {
      res.status(413).json({ success: false, message: 'Ukuran gambar maksimal 8 MB.' });
      return;
    }
    const extension = match[1] === 'jpeg' ? 'jpg' : match[1];
    const safeName = `${Date.now()}-${String(filename || 'banner').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40)}.${extension}`;
    const mediaDir = path.resolve(process.cwd(), 'public/media');
    fs.mkdirSync(mediaDir, { recursive: true });
    fs.writeFileSync(path.join(mediaDir, safeName), buffer);
    res.json({ success: true, url: `/media/${safeName}` });
  });

  // 4. Menu Management: Add or Update (Protected)
  router.post('/menus', authMiddleware, async (req: Request, res: Response) => {
    const { trigger, title, response, imageUrl } = req.body;

    if (!trigger || !title || !response) {
      res.status(400).json({ success: false, message: 'Field trigger, title, dan response wajib diisi.' });
      return;
    }

    let cleanImageUrl: string | undefined;
    if (imageUrl) {
      const rawImageUrl = String(imageUrl).trim();
      if (rawImageUrl.startsWith('/media/')) {
        const filename = path.basename(rawImageUrl);
        const mediaPath = path.resolve(process.cwd(), 'public/media', filename);
        const mediaDir = path.resolve(process.cwd(), 'public/media');
        if (!mediaPath.startsWith(`${mediaDir}${path.sep}`) || !fs.existsSync(mediaPath)) {
          res.status(400).json({ success: false, message: 'File banner lokal tidak ditemukan.' });
          return;
        }
        cleanImageUrl = `/media/${filename}`;
      } else {
        try {
          const parsedUrl = new URL(rawImageUrl);
          if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('Protocol tidak didukung');
          cleanImageUrl = parsedUrl.toString();
        } catch {
          res.status(400).json({ success: false, message: 'URL banner tidak valid.' });
          return;
        }
      }
    }

    await menuStore.addOrUpdate({
      trigger: String(trigger).trim(),
      title: String(title).trim(),
      response: String(response).trim(),
      ...(cleanImageUrl ? { imageUrl: cleanImageUrl } : {}),
    });

    res.json({
      success: true,
      message: 'Menu berhasil disimpan.',
      item: menuStore.getByTrigger(String(trigger).trim()),
    });
  });

  // 5. Menu Management: Delete (Protected)
  router.delete('/menus/:trigger', authMiddleware, async (req: Request, res: Response) => {
    const trigger = String(req.params.trigger);
    const deleted = await menuStore.delete(trigger);

    if (deleted) {
      res.json({ success: true, message: `Menu "${trigger}" berhasil dihapus.` });
    } else {
      res.status(404).json({ success: false, message: `Menu "${trigger}" tidak ditemukan.` });
    }
  });

  // 6. Config: Get Config
  router.get('/config', (req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        prefix: config.prefix,
        adminNumbers: getAdminNumbers(),
        webPort: config.webPort,
        authMode: config.authMode,
        welcomeEnabled: config.welcomeEnabled,
        welcomeMessage: config.welcomeMessage,
      },
    });
  });

  // 7. Config: Update Config (Protected)
  router.post('/config', authMiddleware, (req: Request, res: Response) => {
    const { prefix, adminNumbers, welcomeEnabled, welcomeMessage } = req.body;

    try {
      const envPath = path.resolve(process.cwd(), '.env');
      if (fs.existsSync(envPath)) {
        let envContent = fs.readFileSync(envPath, 'utf-8');

        if (prefix && typeof prefix === 'string') {
          config.prefix = prefix.trim();
          envContent = envContent.replace(/^BOT_PREFIX=.*$/m, `BOT_PREFIX=${prefix.trim()}`);
        }

        if (adminNumbers && typeof adminNumbers === 'string') {
          envContent = envContent.replace(/^ADMIN_NUMBERS=.*$/m, `ADMIN_NUMBERS=${adminNumbers.trim()}`);
        }

        if (typeof welcomeEnabled === 'boolean') {
          config.welcomeEnabled = welcomeEnabled;
          envContent = envContent.replace(/^WELCOME_ENABLED=.*$/m, `WELCOME_ENABLED=${welcomeEnabled}`);
        }

        if (typeof welcomeMessage === 'string' && welcomeMessage.trim()) {
          config.welcomeMessage = welcomeMessage.trim();
          envContent = envContent.replace(/^WELCOME_MESSAGE=.*$/m, `WELCOME_MESSAGE=${welcomeMessage.trim()}`);
        }

        fs.writeFileSync(envPath, envContent, 'utf-8');
      }

      res.json({
        success: true,
        message: 'Konfigurasi berhasil diperbarui.',
        data: {
          prefix: config.prefix,
          adminNumbers: getAdminNumbers(),
          welcomeEnabled: config.welcomeEnabled,
          welcomeMessage: config.welcomeMessage,
        },
      });
    } catch (err) {
      logger.error(err, 'Gagal menyimpan perubahan konfigurasi ke .env:');
      res.status(500).json({ success: false, message: 'Gagal memperbarui file konfigurasi.' });
    }
  });

  // 8. Logs: Get Activity Logs
  router.get('/logs', (req: Request, res: Response) => {
    const limit = parseInt(String(req.query.limit || '50'), 10);
    res.json({ success: true, data: getRecentLogs(limit) });
  });

  // 9. Bot Control: Toggle On / Off (Protected)
  router.post('/bot/toggle', authMiddleware, async (req: Request, res: Response) => {
    const { active } = req.body;
    const newActiveState = typeof active === 'boolean' ? active : !isBotActive();
    await setBotActive(newActiveState);
    res.json({
      success: true,
      data: {
        active: newActiveState,
        message: `Bot berhasil di-${newActiveState ? 'aktifkan (ON)' : 'nonaktifkan (OFF)'}.`,
      },
    });
  });


  return router;
}
