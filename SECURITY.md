# Security & Privacy Policy

> **Napas Dulu** is built on the absolute philosophy of data privacy and local-first ownership.

## 1. Zero Telemetry & Air Gap
This application does not make any outbound network requests to any remote server. All data, including diagnostic configurations, fleshware habit logs, and bypass records, is strictly kept on the machine running the software.
- **Database Engine**: Local SQLite (`rusqlite`).
- **Default Path**: `AppData\Roaming\com.fk0u.napasdulu\napas_dulu.sqlite` (Or equivalent system AppData).

## 2. Windows API Hooking (The Activity Engine)
To accurately determine "continuous physical work" without relying on battery-draining polling structures, the application relies on low-level OS interceptions: `SetWindowsHookEx` (`WH_KEYBOARD_LL` and `WH_MOUSE_LL`).

**Is it a keylogger?**
Absolutely **not**. The Windows hook implementation only detects the *event* that a keystroke or mouse movement occurred to increment a system-wide activity timestamp. **No payload, key codes, string conversions, or mouse coordinates are captured, inspected, or logged.** 
The source code in `src-tauri/src/activity.rs` serves as proof of this minimal footprint detection logic.

## 3. Anti-Malware / False Positives
Because the application asserts native authority over the OS window manager via `alwaysOnTop` and Win32 `HWND_TOPMOST` behavior, heuristic antivirus systems or Windows Defender might flag the compiled executable—especially if it isn't codesigned with an Extended Validation (EV) Certificate.
- **Mitigation Details:** The application explicitly avoids disabling `Alt+Tab`, Task Manager (`Ctrl+Alt+Del`), or the `Windows` key. You maintain full OS-level control.
- If it is flagged during compilation or execution, we recommend verifying the open-source logic and whitelisting the built `.exe` locally on your system.

## 4. Reporting Vulnerabilities
If you discover a memory leak in the background hook thread, an IPC vulnerability, or unexpected SQLite leakage, please open an Issue in the GitHub repository.
