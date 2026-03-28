# Architecture & Execution Plan: Napas Dulu MVP

Aplikasi "Napas Dulu" memosisikan dirinya bukan sebagai "aplikasi desktop rata-rata", melainkan sebagai **intervention system** untuk the Operator (Fleshware). Arsitektur dirancang agar memiliki utilitas sistem (low RAM footprint) menggunakan Tauri dan mendelegasikan beban berat ke OS level via Win32 API.

## Proposed Components

### 1. Database Layer & App State (Phase 1)
Kita membutuhkan persistensi privasi-first yang ringan dan cepat. Modul `rusqlite` pada backend Rust akan bertindak sebagai pengelola state untuk:
- Audit trail pemakaian pelarian *Morning Diagnostics*.
- Audit trail *Bypass* darurat ("Server on Fire"), diperlukan agar sistem tahu kapan harus membatasi akses darurat setelah 2 kali override sukses dalam blok 24 jam (UTC).
- Integrasi antar *Frontend React* ke basis data akan mutlak berjalan murni via asinkronitas mekanisme IPC (Tauri Commands) demi keamaman environment desktop.

### 2. The Activity Engine via Global Hooks (Phase 2)
Jantung pemicu berpusat pada akurasi deteksi interaksi native tanpa metode "polling" yang membuang percuma komputasi (CPU/Battery Drain).
- **Global Hook (`SetWindowsHookEx`)**: Menggunakan interopabilitas crate `windows-rs` untuk mengimplementasikan kait event `WH_MOUSE_LL` (Mouse movement, Clicks) dan `WH_KEYBOARD_LL` (semua Keystrokes).
- **State Machine Threading**: Proses hook berjalan pada thread dedikatif terlepas dari *Main App/WebView Thread*. State update bekerja dengan timestamp pasif:
  - Input terjadi -> Hitung delta dari timestamp sebelumnya.
  - Delta > 5 menit -> Idle reset (kembalikan akumulasi waktu aktif ke 0).
  - Total aktivasi akumulatif >= 90 menit -> Picu signal Event via Tauri Event handler mengarah ke layar intervensi the Operator.
- **Resource Priority Level**: Proses hook **harus murni** melewati filter dan langsung memanggil `CallNextHookEx`—meminimalisasi latency Deferred Procedure Call (DPC) dan menjamin performa keyboard/mouse untuk workflow high-actions.

### 3. Frontend Lockdown & UX (Phase 3)
Dibakar dengan Vibe yang cold, industrial, layaknya terminal maintenance:
- Frontend akan dirender penuh untuk mengadopsi 3 State Utama secara independen (Dorman, Diagnostik Harian, dan Layar Lockdown). 
- State Dorman akan mempertahankan posisi window `hidden` untuk membatasi footprint memori rendering WebView2.

### 4. Lockdown Mechanisms & Anti-Bypass (Phase 4)
Mencegah Operator melakukan interupsi fatal.
- Kombinasi config default Tauri `alwaysOnTop: true`, `fullscreen: true`, dan `skipTaskbar: true`.
- Native enforcement: Jika agresivitas level sistem terakumulasi, API OS level `HWND_TOPMOST` via modul Rust akan memaksa handle webview Windows terus tertindih paling atas, tanpa pengecualian. Bisa pula ditambahkan pencegahan manipulasi `Alt+Tab` menggunakan perangkap keyboard pada state hook berjalan.

## User Review Required
> [!IMPORTANT]  
> Arsitektur ini dirancang untuk agresivitas intervensi sistem. Level proteksi seperti trapping OS hotkey (`Alt+Tab`, DWM override) perlu dikalibrasi sesuai preferensi. Silakan check rancangan ini terlebih dulu sebelum dilanjutkan ke siklus inisialisasi kode. 
