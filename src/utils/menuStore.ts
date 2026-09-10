import fs from 'fs';
import path from 'path';
import { logger } from './logger.js';
import { db } from '../db/index.js';

export interface MenuItem {
  trigger: string;
  title: string;
  response: string;
  imageUrl?: string;
}

interface MenuDataFile {
  items: MenuItem[];
}

export class MenuStore {
  private filePath: string;
  private items: Map<string, MenuItem> = new Map();
  private isInitialized = false;

  constructor() {
    this.filePath = path.resolve(process.cwd(), 'src/data/menuData.json');
    this.loadLocal();
  }

  private loadLocal(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const data: MenuDataFile = JSON.parse(raw);
        if (Array.isArray(data.items)) {
          for (const item of data.items) {
            this.items.set(item.trigger.toLowerCase().trim(), item);
          }
        }
      }
    } catch (err) {
      logger.error(err, 'Gagal memuat file menuData.json:');
    }
  }

  private saveLocal(): void {
    try {
      const data: MenuDataFile = {
        items: Array.from(this.items.values()),
      };
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      logger.error(err, 'Gagal menyimpan menuData.json:');
    }
  }

  public async init(): Promise<void> {
    try {
      const result = await db.execute('SELECT trigger, title, response, image_url FROM custom_menus');

      if (result.rows.length > 0) {
        this.items.clear();
        for (const row of result.rows) {
          const item: MenuItem = {
            trigger: String(row.trigger).toLowerCase().trim(),
            title: String(row.title),
            response: String(row.response),
            ...(row.image_url ? { imageUrl: String(row.image_url) } : {}),
          };
          this.items.set(item.trigger, item);
        }
        this.saveLocal();
        logger.info({ count: this.items.size }, 'Menu berhasil dimuat dari database Turso ke memori');
      } else if (this.items.size > 0) {
        logger.info({ count: this.items.size }, 'Tabel Turso kosong, melakukan migrasi data menu lokal ke Turso...');
        for (const item of this.items.values()) {
          await db.execute({
            sql: `INSERT OR REPLACE INTO custom_menus (trigger, title, response, image_url, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            args: [item.trigger, item.title, item.response, item.imageUrl || null],
          });
        }
        logger.info('Migrasi menu lokal ke database Turso berhasil.');
      }
      this.isInitialized = true;
    } catch (err) {
      logger.error(err, 'Gagal sinkronisasi menuStore dengan Turso (tetap menggunakan cache lokal):');
    }
  }

  public getAll(): MenuItem[] {
    return Array.from(this.items.values());
  }

  public getByTrigger(trigger: string): MenuItem | undefined {
    return this.items.get(trigger.toLowerCase().trim());
  }

  public async addOrUpdate(item: MenuItem): Promise<void> {
    const cleanTrigger = item.trigger.toLowerCase().trim();
    const imageUrl = item.imageUrl?.trim() || undefined;
    const menuItem: MenuItem = {
      trigger: cleanTrigger,
      title: item.title.trim(),
      response: item.response.trim(),
      ...(imageUrl ? { imageUrl } : {}),
    };

    this.items.set(cleanTrigger, menuItem);
    this.saveLocal();

    try {
      await db.execute({
        sql: `INSERT OR REPLACE INTO custom_menus (trigger, title, response, image_url, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        args: [cleanTrigger, menuItem.title, menuItem.response, menuItem.imageUrl || null],
      });
      logger.info({ trigger: cleanTrigger }, 'Menu item berhasil disimpan ke database Turso');
    } catch (err) {
      logger.error({ trigger: cleanTrigger, err }, 'Gagal menyimpan menu ke Turso (tersimpan di lokal)');
    }
  }

  public async delete(trigger: string): Promise<boolean> {
    const cleanTrigger = trigger.toLowerCase().trim();
    const existed = this.items.delete(cleanTrigger);
    if (existed) {
      this.saveLocal();
      try {
        await db.execute({
          sql: `DELETE FROM custom_menus WHERE trigger = ?`,
          args: [cleanTrigger],
        });
        logger.info({ trigger: cleanTrigger }, 'Menu item berhasil dihapus dari database Turso');
      } catch (err) {
        logger.error({ trigger: cleanTrigger, err }, 'Gagal menghapus menu item dari Turso');
      }
    }
    return existed;
  }
}

export const menuStore = new MenuStore();
