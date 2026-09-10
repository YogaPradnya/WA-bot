# Panduan Deployment WhatsApp Bot di Google Cloud Platform (VM)

Panduan ini mendokumentasikan langkah-langkah penyiapan, konfigurasi, dan pemeliharaan bot WhatsApp pada Virtual Machine (VM) Google Cloud Platform Compute Engine.

---

## 1. Rekomendasi Spesifikasi VM

Untuk menjalankan bot dengan efisien dan hemat biaya:
- **Tipe Mesin**: `e2-micro` (2 vCPU core burstable, 1 GB RAM - masuk dalam kuota *Always Free* Google Cloud) atau `e2-small` (2 GB RAM).
- **Sistem Operasi**: Ubuntu 22.04 LTS atau Ubuntu 24.04 LTS x86_64.
- **Disk**: 10 GB - 20 GB Balanced Persistent Disk atau Standard Persistent Disk.
- **Firewall**: Tidak memerlukan port inbound publik khusus (koneksi WhatsApp Baileys bekerja secara aman melalui outbound WebSocket ke server WhatsApp).

---

## 2. Persiapan Sistem Operasi VM

Setelah terhubung ke VM via SSH di Google Cloud Console atau terminal lokal:

### A. Konfigurasi SWAP Memory (Wajib untuk e2-micro RAM 1 GB)
Alokasi SWAP mencegah proses terhenti (OOM/Out-Of-Memory) saat kompilasi paket:
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Jadikan permanen saat VM restart
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### B. Update Paket & Instalasi Node.js LTS
Pasang Node.js versi LTS (Node 20 atau Node 22):
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential

# Mengunduh repositori NodeSource
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Verifikasi versi
node -v
npm -v
```

### C. Instalasi Process Manager (PM2)
```bash
sudo npm install -g pm2
```

---

## 3. Menyiapkan Proyek Bot di VM

### A. Clone atau Salin Kode
Posisikan proyek di direktori home pengguna:
```bash
cd ~
git clone <URL_REPOSITORY_ANDA> BotWA
cd BotWA
```

### B. Konfigurasi Environment (.env)
Salin template konfigurasi:
```bash
cp .env.example .env
nano .env
```
Sesuaikan konfigurasi:
- `BOT_PREFIX=!`: Prefix perintah bot.
- `AUTH_MODE=pairing`: Disarankan menggunakan mode **pairing** saat mengakses server via terminal SSH agar tidak repot dengan karakter QR Code.
- `PAIRING_PHONE_NUMBER=628xxxxxxxxxx`: Nomor WhatsApp yang akan dijadikan bot (format internasional tanpa tanda `+`).

---

## 4. Autentikasi Awal WhatsApp

Sebelum menjalankan bot sebagai daemon di background, lakukan proses tautan perangkat (pairing) sekali secara interaktif:

1. Jalankan proses awal:
   ```bash
   npm install
   npm run build
   node dist/index.js
   ```
2. Terminal akan menampilkan **Pairing Code** (8 digit angka):
   - Buka WhatsApp di smartphone Anda.
   - Masuk ke **Menu (titik tiga) > Perangkat Tertaut > Tautkan Perangkat**.
   - Pilih **Tautkan dengan nomor telepon saja**.
   - Masukkan 8 digit kode yang muncul di terminal.
3. Setelah status menampilkan `Koneksi WhatsApp berhasil tersambung (OPEN)`, tekan `Ctrl + C` untuk menghentikan proses interaktif. Kredensial sesi telah tersimpan permanen di direktori `session/`.

---

## 5. Menjalankan Bot di Background (PM2)

Gunakan PM2 untuk menjaga bot tetap berjalan nonstop dan otomatis menyala kembali jika VM di-restart:

```bash
# 1. Jalankan aplikasi menggunakan file konfigurasi
pm2 start ecosystem.config.cjs

# 2. Simpan daftar proses aktif
pm2 save

# 3. Aktifkan autorun saat VM boot
pm2 startup
# (Jalankan perintah sudo env PATH... yang diberikan oleh output terminal PM2)
```

---

## 6. Perintah Operasional & Monitoring

- **Melihat status bot**:
  ```bash
  pm2 status
  ```
- **Melihat live logs proses**:
  ```bash
  pm2 logs bot-wa
  ```
- **Me-restart bot**:
  ```bash
  pm2 restart bot-wa
  ```
- **Mematikan bot**:
  ```bash
  pm2 stop bot-wa
  ```
- **Pembaruan kode (Update Deployment)**:
  ```bash
  ./deploy.sh
  ```

---

## 7. Verifikasi Perintah via WhatsApp

Kirim pesan ke bot dari akun WhatsApp lain (atau dari grup yang ada bot-nya):
- `!ping` : Menguji respons bot, status uptime, dan memori heap.
- `!server` : Menampilkan metrik CPU, RAM terpakai, dan uptime Google Cloud VM.
- `!help` : Menampilkan daftar seluruh perintah yang tersedia.
- `!info` : Menampilkan menu informasi dinamis.
