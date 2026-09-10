import express, { Express } from 'express';
import path from 'path';
import http from 'http';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { createApiRouter } from './routes/api.js';
import type { WhatsAppClient } from '../core/connection.js';

export interface WebServerInstance {
  app: Express;
  server: http.Server;
  start: (port?: number) => Promise<http.Server>;
  stop: () => Promise<void>;
}

export function createWebServer(clientGetter?: () => WhatsAppClient | null): WebServerInstance {
  const app = express();

  // Middleware JSON & Form Data
  app.use(express.json({ limit: '8mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Static Assets (Dashboard Frontend)
  const publicDir = path.resolve(process.cwd(), 'public');
  app.use(express.static(publicDir));
  app.use('/media', express.static(path.join(publicDir, 'media')));

  // REST API Router
  app.use('/api', createApiRouter(clientGetter));

  // Fallback Route untuk Single Page Application
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    const indexPath = path.join(publicDir, 'index.html');
    res.sendFile(indexPath, (err) => {
      if (err) {
        res.status(404).send('Halaman tidak ditemukan.');
      }
    });
  });

  const server = http.createServer(app);

  const start = (port: number = config.webPort): Promise<http.Server> => {
    return new Promise((resolve, reject) => {
      server.listen(port, () => {
        logger.info({ port }, `Web Dashboard berjalan pada http://localhost:${port}`);
        resolve(server);
      });
      server.on('error', (err) => {
        logger.error(err, `Gagal menjalankan Web Dashboard pada port ${port}:`);
        reject(err);
      });
    });
  };

  const stop = (): Promise<void> => {
    return new Promise((resolve) => {
      server.close(() => {
        logger.info('Web Dashboard server berhasil dihentikan.');
        resolve();
      });
    });
  };

  return { app, server, start, stop };
}
