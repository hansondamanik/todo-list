# Ruang Tugas

Website daftar tugas dengan tanggal dan jam lokal, prioritas, pengingat browser, login pengguna, dan penyimpanan tugas di Supabase. GitHub Pages menyediakan website statis; Supabase menyediakan autentikasi dan database.

## 1. Buat database Supabase

1. Buat project di [supabase.com](https://supabase.com/).
2. Buka **SQL Editor**, salin isi `supabase/schema.sql`, lalu jalankan. Row Level Security membatasi setiap pengguna hanya pada tugas miliknya.
3. Buka **Project Settings → API Keys** dan salin **Project URL** serta **Publishable key** atau **anon public key**. Jangan gunakan `service_role` atau secret key.
4. Buka `public/config.js`, lalu isi nilainya:

   ```js
   window.SUPABASE_CONFIG = {
     url: "https://PROJECT_REF.supabase.co",
     anonKey: "KUNCI_PUBLISHABLE_ATAU_ANON_PUBLIC",
   };
   ```

Kunci publishable/anon memang digunakan oleh website. Keamanan data berasal dari autentikasi dan kebijakan Row Level Security pada database; jangan pernah menaruh service-role key di file website.

## 2. Atur verifikasi email Supabase

Setelah website dipublikasikan, buka **Authentication → URL Configuration** di Supabase:

- Isi **Site URL** dengan URL GitHub Pages, misalnya `https://USERNAME.github.io/NAMA-REPO/`.
- Tambahkan URL yang sama ke daftar **Redirect URLs**.
- Untuk mencoba secara lokal, tambahkan juga `http://127.0.0.1:8000/**`.

Pengguna mendaftar dari halaman website dan mengikuti tautan verifikasi yang dikirim Supabase sebelum masuk.

## 3. Publikasikan melalui GitHub Pages

Workflow `.github/workflows/deploy-pages.yml` menerbitkan isi folder `public` secara otomatis setiap kali ada push ke branch `main`.

1. Buat repository GitHub. Repository publik memudahkan penggunaan GitHub Pages pada paket gratis.
2. Dari terminal VS Code, jalankan perintah berikut dan ganti URL remote dengan URL repository milikmu:

   ```powershell
   Set-Location 'C:\Users\ACER\Documents\todo-list'
   git init
   git add .
   git status
   git commit -m "Initial todo list app"
   git branch -M main
   git remote add origin https://github.com/USERNAME/NAMA-REPO.git
   git push -u origin main
   ```

   Pastikan `data/todos.db` dan `__pycache__` tidak muncul dalam `git status`; keduanya dikecualikan oleh `.gitignore`.
3. Di repository GitHub, buka **Settings → Pages** dan pilih **GitHub Actions** sebagai sumber deploy.
4. Tunggu workflow **Deploy GitHub Pages** selesai di tab **Actions**. URL website akan terlihat di **Settings → Pages**.

Jika mengganti `public/config.js`, lakukan commit dan push lagi agar konfigurasi terbaru terbit.

## Pratinjau lokal

Pastikan `public/config.js` sudah diisi, lalu jalankan:

```powershell
python server.py
```

Buka [http://127.0.0.1:8000](http://127.0.0.1:8000). Tambahkan URL ini ke Redirect URLs Supabase jika ingin mencoba login lokal.

## Pengingat browser

Izinkan notifikasi dari browser dan biarkan halaman website terbuka. Pengingat diperiksa setiap 15 detik. Jika halaman ditutup atau browser tidak berjalan, pengingat yang terlewat akan muncul saat halaman dibuka kembali.
