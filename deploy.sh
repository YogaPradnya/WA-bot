#!/usr/bin/env bash

set -e

echo "=== Memulai Proses Deployment Bot WhatsApp ==="

# 1. Pastikan folder logs tersedia
mkdir -p logs

# 2. Periksa file konfigurasi .env
if [ ! -f .env ]; then
  echo "Peringatan: File .env tidak ditemukan. Menyalin dari .env.example..."
  cp .env.example .env
  echo "Silakan sesuaikan konfigurasi pada file .env terlebih dahulu."
fi

# 3. Install dependensi
echo "Memasang dependensi project..."
npm install

# 4. Pastikan asset Web Dashboard tersedia
if [ ! -f public/index.html ] || [ ! -f public/css/style.css ] || [ ! -f public/js/app.js ]; then
  echo "Error: Asset Web Dashboard pada folder public/ tidak lengkap."
  exit 1
fi
echo "Asset Web Dashboard terverifikasi."

# 5. Kompilasi TypeScript ke JavaScript produksi
echo "Melakukan kompilasi TypeScript..."
npm run build

# 6. Menjalankan / Reload via PM2 jika PM2 terpasang
if command -v pm2 >/dev/null 2>&1; then
  echo "Mendeteksi PM2. Memperbarui proses bot-wa..."
  pm2 reload ecosystem.config.cjs || pm2 start ecosystem.config.cjs
  pm2 save
  echo "Proses bot-wa berhasil diperbarui dan disimpan di PM2."
else
  echo "PM2 tidak ditemukan. Untuk menjalankan manual gunakan: npm start"
  echo "Atau pasang PM2 secara global: sudo npm install -g pm2"
fi

echo "Dashboard tersedia pada port WEB_PORT di .env."
echo "Pastikan firewall GCP mengizinkan port tersebut hanya dari IP terpercaya."
echo "=== Deployment Selesai ==="
