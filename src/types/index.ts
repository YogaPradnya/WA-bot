import type { proto, WASocket, AnyMessageContent } from '@whiskeysockets/baileys';

export interface CommandContext {
  sock: WASocket;
  message: proto.IWebMessageInfo;
  remoteJid: string;
  sender: string;
  isGroup: boolean;
  command: string;
  args: string[];
  body: string;
  reply: (content: string | AnyMessageContent) => Promise<proto.WebMessageInfo | undefined>;
}

export interface Command {
  name: string;
  aliases?: string[];
  description: string;
  usage?: string;
  category?: string;
  execute: (ctx: CommandContext) => Promise<void>;
}
