# Napas Dulu 🫁

**Napas Dulu** is a radical, OS-level intervention system designed specifically for developers (or "Fleshware") who suffer from extreme hyperfocus, neglect breaks, and risk their physical health during long coding sessions.

It is not just a Pomodoro timer; it's a lockdown mechanism that actively monitors your interactions and enforces a mandatory physical break.

## Why?
Programmers treat their bodies like servers with 24/7 uptime. This leads to severe health consequences extending into hypertension and chronic pain. **Napas Dulu** monitors your physical input (mouse movement and keystrokes). If you are active for 90 minutes without a 5-minute break, reality kicks in—the app locks down your screen and forces you to step away.

## Features
- **Intelligent Activity Engine**: Uses low-level Windows API (`SetWindowsHookEx`) to measure true activity instead of relying on basic timers.
- **Reality.exe Lockdown**: An absolute, `HWND_TOPMOST` screen overlay that interrupts your flow, covering your IDE, browser, and taskbar for exactly 10 minutes.
- **Morning Diagnostics**: A daily check-in prompt requesting your sleep hours, wake hours, and exercise habits.
- **Privacy First**: Everything is stored locally via `rusqlite`. No telemetry, no cloud servers.
- **Server on Fire Bypass**: A panic button limited to 2 uses per 24 hours just in case production literally goes down during your lockdown.

## Prerequisites
- Windows 10/11
- WebView2 Runtime (Included in most modern Windows installations)

## Architecture
- **Frontend**: React, TypeScript, Vite, TailwindCSS.
- **Backend & OS Interop**: Rust, Tauri v2.
- **Database**: SQLite (`rusqlite`).

## Build Instructions
1. Clone the repository.
2. Install Node dependencies:
   ```bash
   npm install
   ```
3. Run Development Server:
   ```bash
   npm run tauri dev
   ```
4. Build Production Installer (.exe / .msi):
   ```bash
   npm run tauri build
   ```

## Contribution
Built by `fk0u` for the `init.kaltim` community. 

## License
MIT License. See [LICENSE](LICENSE).
