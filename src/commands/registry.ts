import type { Command } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class CommandRegistry {
  private commands = new Map<string, Command>();
  private aliases = new Map<string, string>();

  public register(cmd: Command): void {
    const primaryName = cmd.name.toLowerCase();
    if (this.commands.has(primaryName)) {
      logger.warn({ command: primaryName }, 'Perintah sudah terdaftar, memperbarui implementasi.');
    }
    this.commands.set(primaryName, cmd);

    if (cmd.aliases && Array.isArray(cmd.aliases)) {
      for (const alias of cmd.aliases) {
        const cleanAlias = alias.toLowerCase();
        this.aliases.set(cleanAlias, primaryName);
      }
    }

    logger.debug({ command: primaryName, aliases: cmd.aliases }, 'Perintah berhasil didaftarkan.');
  }

  public get(nameOrAlias: string): Command | undefined {
    const key = nameOrAlias.toLowerCase();
    const resolvedName = this.aliases.get(key) || key;
    return this.commands.get(resolvedName);
  }

  public getAll(): Command[] {
    return Array.from(this.commands.values());
  }
}

export const registry = new CommandRegistry();
