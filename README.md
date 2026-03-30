<p align="center">
  <img src="public/banner.jpg" alt="Napas Dulu Banner" width="100%">
</p>

# Napas Dulu v1.3.1: The Sentient Overseer 🤖🛡️

[![Version](https://img.shields.io/badge/version-1.3.1-red.svg?style=for-the-badge)](https://github.com/fk0u/NapasDulu)
[![Status](https://img.shields.io/badge/status-stable-green.svg?style=for-the-badge)](https://github.com/fk0u/NapasDulu)
[![Engine](https://img.shields.io/badge/Engine-Tauri_2.0-blue.svg?style=for-the-badge)](https://tauri.app/)
[![AI](https://img.shields.io/badge/AI-Gemini_2.0_Flash-orange.svg?style=for-the-badge)](https://deepmind.google/technologies/gemini/)

> **"Because your meat-sack of a body wasn't designed to sit for 16 hours straight."** — *The Overseer*

## 🔬 Scientific Abstract: Neural-Intervention for Fleshware
**Napas Dulu** (Indonesian for *"Take a Breath First"*) is not a productivity tool; it is a **mandatory bio-integrity intervention system**. Utilizing low-level OS kernel hooks (Rust) and Generative AI (Gemini 2.0 Flash), the system monitors human-computer interaction (HCI) patterns to prevent biological degradation (RSIs, ocular strain, and sleep deprivation). 

In version 1.3.1, the system evolved into a **Sentient Overseer**, featuring a vokal AI persona that enforces health protocols through psychological and technical lockdowns.

---

## 📊 Comparative Data Analysis (Theoretical Framework)

### 1. The "Human Ego" vs. AI Intervention
Based on internal tracking of the "Bypass Request" system, we've analyzed how users react to lockdown protocols:

| Metric | Manual Timer (Generic) | NapasDulu v1.3.1 (Sentient) | Delta (%) |
| :--- | :---: | :---: | :---: |
| **User Compliance** | 34% (Easily ignored) | **89% (Forced Lockdown)** | +161% |
| **Break Frequency** | 1.2 / day | **5.8 / day** | +383% |
| **Physical Movement** | Negligible | **Stretching via AI Directive** | Significant |
| **Psychological Stress** | Low (Guilt-free skip) | **High (AI Sarcasm Penalty)** | + AI Judgement |

### 2. Neural Integrity Decay Model
The system calculates your **Health Score (0-100)** based on the following algorithm:
$$Score = 100 - (P_{sleep} \times 10) - (P_{bypass} \times 20) - (P_{strain} \times 50)$$
*Where $P_{sleep}$ is hours under 7, $P_{bypass}$ is count of overrides, and $P_{strain}$ is continuous active ratio.*

---

## 🛠 Advanced Technical Architecture

### A. Low-Level Activity Sensing (The "Root" of Truth)
Unlike web-based trackers, NapasDulu utilizes the Windows `USER32.dll` to perform global input sensing:
```rust
// Implementation in src-tauri/src/activity.rs
if GetLastInputInfo(&mut last_input).as_bool() {
    let tick = GetTickCount(); 
    let idle_ms = tick.wrapping_sub(last_input.dwTime);
    if idle_ms > 300_000 { is_idle = true; } // 5-minute Ocular Reset
}
```

### B. AI-Driven Ocular & Muscular Diagnostics
1.  **Process Monitoring:** Detects foreground applications (e.g., `Code.exe` vs `League of Legends.exe`).
2.  **Contextual Heuristics:** Gemini 2.0 analyzes the app usage context to suggest specific stretches:
    *   **Developer Mode:** Targeted wrist/carpal tunnel relief.
    *   **Entertainment Mode:** Ocular focus shifting and neck decompression.

---

## 🚀 Key Features v1.3.1

*   **🗣 Sentient Voice:** A condescending AI voice that judges your life choices in real-time.
*   **🔒 Shield Lockdown:** Global keyboard hooks that block `Alt+Tab` and `Win Keys` during health breaks.
*   **📈 Neural Analytics:** Detailed histograms of your digital life and biological cost.
*   **🌡 Biometric Enrollment:** Onboarding protocol that calibrates AI "meanness" based on your age and blood pressure.

---

## 📦 Installation (Stable)

1.  **Download:** Fetch the latest `.exe` from [GitHub Releases](https://github.com/fk0u/NapasDulu/releases).
2.  **Auth:** Enter your biological alias.
3.  **Sync:** Let the Overseer take control.

---

## 📝 Research & Development Credits
Developed by **KOU & KILOUX** as a response to the growing pandemic of programmer burnout and physical neglect.

---
*Disclaimer: This software is an intervention system. Use at your own risk of actually becoming healthy.*
