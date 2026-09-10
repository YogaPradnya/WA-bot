import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  proto,
  type WASocket,
  type ConnectionState,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

export type MessageUpsertHandler = (sock: WASocket, m: any) => Promise<void>;
export type GroupParticipantsHandler = (sock: WASocket, update: any) => Promise<void>;

export class WhatsAppClient {
  private sock: WASocket | null = null;
  private messageHandlers: MessageUpsertHandler[] = [];
  private groupParticipantsHandlers: GroupParticipantsHandler[] = [];
  private messageStore = new Map<string, proto.IMessage>();
  private isReconnecting = false;
  private isShuttingDown = false;

  public onMessage(handler: MessageUpsertHandler): void {
    this.messageHandlers.push(handler);
  }

  public onGroupParticipantsUpdate(handler: GroupParticipantsHandler): void {
    this.groupParticipantsHandlers.push(handler);
  }

  public getSocket(): WASocket | null {
    return this.sock;
  }

  public async connect(): Promise<WASocket> {
    const { state, saveCreds } = await useMultiFileAuthState(config.sessionDir);
    const { version, isLatest } = await fetchLatestBaileysVersion();

    logger.info({ version, isLatest }, 'Memulai koneksi Baileys...');

    this.sock = makeWASocket({
      version,
      logger: logger.child({ module: 'baileys' }, { level: 'silent' }) as any,
      printQRInTerminal: false,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger.child({ module: 'signal-store' }, { level: 'silent' }) as any),
      },
      generateHighQualityLinkPreview: false,
      syncFullHistory: false,
      fireInitQueries: false,
      maxMsgRetryCount: 1,
      getMessage: async (key) => {
        if (key?.id && this.messageStore.has(key.id)) {
          return this.messageStore.get(key.id);
        }
        return proto.Message.fromObject({});
      },
    });

    // Handle pairing code jika mode pairing diaktifkan dan belum terdaftar
    if (config.authMode === 'pairing' && !this.sock.authState.creds.registered) {
      if (!config.pairingPhoneNumber) {
        logger.error('Mode pairing aktif tetapi PAIRING_PHONE_NUMBER tidak diatur di .env');
      } else {
        const cleanNumber = config.pairingPhoneNumber.replace(/[^0-9]/g, '');
        setTimeout(async () => {
          try {
            if (this.sock && !this.sock.authState.creds.registered) {
              const code = await this.sock.requestPairingCode(cleanNumber);
              logger.info({ pairingCode: code }, 'Pairing Code WhatsApp didapatkan:');
              console.log(`\n=========================================`);
              console.log(`PAIRING CODE: ${code}`);
              console.log(`=========================================\n`);
            }
          } catch (err) {
            logger.error(err, 'Gagal meminta pairing code:');
          }
        }, 3000);
      }
    }

    // Listener pembaruan kredensial
    this.sock.ev.on('creds.update', saveCreds);

    // Listener status koneksi
    this.sock.ev.on('connection.update', async (update: Partial<ConnectionState>) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr && config.authMode === 'qr') {
        logger.info('Scan QR Code berikut dengan WhatsApp:');
        qrcode.generate(qr, { small: true });
      }

      if (connection === 'close') {
        if (this.isShuttingDown) {
          logger.info('Koneksi WhatsApp ditutup secara normal.');
          return;
        }

        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        logger.warn({ statusCode, shouldReconnect }, 'Koneksi WhatsApp terputus.');

        if (statusCode === DisconnectReason.loggedOut) {
          logger.error('Sesi telah di-logout dari perangkat. Hapus folder session dan scan ulang.');
        } else if (shouldReconnect && !this.isReconnecting) {
          this.isReconnecting = true;
          logger.info('Mencoba menyambungkan kembali dalam 5 detik...');
          setTimeout(async () => {
            this.isReconnecting = false;
            try {
              await this.connect();
            } catch (err) {
              logger.error(err, 'Gagal melakukan reconnect:');
            }
          }, 5000);
        }
      } else if (connection === 'open') {
        logger.info('Koneksi WhatsApp berhasil tersambung (OPEN).');
      }
    });

    // Listener anggota grup
    this.sock.ev.on('group-participants.update', async (update) => {
      if (!this.sock) return;
      for (const handler of this.groupParticipantsHandlers) {
        try {
          await handler(this.sock, update);
        } catch (err) {
          logger.error(err, 'Error pada handler anggota grup:');
        }
      }
    });

    // Listener pesan masuk
    this.sock.ev.on('messages.upsert', async (m) => {
      if (m?.messages) {
        for (const msg of m.messages) {
          if (msg?.key?.id && msg?.message) {
            this.messageStore.set(msg.key.id, msg.message);
            if (this.messageStore.size > 1000) {
              const firstKey = this.messageStore.keys().next().value;
              if (firstKey) this.messageStore.delete(firstKey);
            }
          }
        }
      }

      if (this.sock) {
        for (const handler of this.messageHandlers) {
          try {
            await handler(this.sock, m);
          } catch (err) {
            logger.error(err, 'Error pada eksekusi message handler:');
          }
        }
      }
    });

    return this.sock;
  }

  public async disconnect(): Promise<void> {
    this.isShuttingDown = true;
    if (this.sock) {
      try {
        this.sock.end(undefined);
        logger.info('Socket WhatsApp berhasil dihentikan.');
      } catch (err) {
        logger.error(err, 'Error saat menghentikan socket:');
      }
    }
  }
}
