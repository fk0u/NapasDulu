import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

type AppState = "IDLE" | "DIAGNOSTIC" | "LOCKDOWN";

function App() {
  const [appState, setAppState] = useState<AppState>("IDLE");
  const [countdown, setCountdown] = useState(600); // 10 minutes
  
  // Diagnostic form state
  const [sleepHours, setSleepHours] = useState("");
  const [wakeHours, setWakeHours] = useState("");
  const [exercised, setExercised] = useState(false);

  useEffect(() => {
    // Check if diagnostic is needed today (for MVP, we just show it on boot)
    setAppState("DIAGNOSTIC");

    // Listen for lockdown event from Rust Global Hook
    const unlisten = listen("trigger-lockdown", () => {
      setAppState("LOCKDOWN");
      setCountdown(600);
    });

    return () => {
      unlisten.then(f => f());
    };
  }, []);

  useEffect(() => {
    let timer: number;
    if (appState === "LOCKDOWN" && countdown > 0) {
      timer = window.setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (appState === "LOCKDOWN" && countdown === 0) {
      setAppState("IDLE");
    }
    return () => clearInterval(timer);
  }, [appState, countdown]);

  const handleDiagnosticSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res: any = await invoke("log_morning_diagnostic", {
        sleepHours: parseFloat(sleepHours),
        wakeHours: parseFloat(wakeHours),
        exercised
      });
      if (res.success) {
        setAppState("IDLE");
      } else {
        alert(res.message);
      }
    } catch (err) {
      console.error(err);
      setAppState("IDLE"); // fallback to allow usage even if db fails
    }
  };

  const attemptBypass = async () => {
    try {
      const res: any = await invoke("attempt_bypass");
      if (res.success) {
        setAppState("IDLE");
      } else {
        alert(res.message);
      }
    } catch (err) {
      alert("Error bypassing: " + String(err));
    }
  };

  if (appState === "IDLE") {
    return (
      <div className="flex w-full h-full flex-col items-center justify-center bg-system-bg text-system-text opacity-10">
        <p className="text-xs font-mono tracking-widest">[ SYSTEM DORMANT ]</p>
        <p className="text-[10px] mt-2 opacity-50">Monitoring Keystrokes & Mouse Activity natively...</p>
      </div>
    );
  }

  if (appState === "DIAGNOSTIC") {
    return (
      <div className="flex w-full h-full items-center justify-center bg-system-bg text-system-text font-mono">
        <div className="p-8 border border-system-border bg-black w-[400px]">
          <h1 className="text-xl mb-6 border-b border-system-border pb-2 text-system-accent uppercase tracking-widest font-bold">Morning Diagnostics</h1>
          <form onSubmit={handleDiagnosticSubmit} className="space-y-4">
            <div>
              <label className="block text-sm mb-1 uppercase tracking-wider text-gray-400">Sleep Hours (h)</label>
              <input 
                type="number" step="0.5" required
                className="w-full bg-system-bg border border-system-border p-2 outline-none focus:border-system-text text-system-text"
                value={sleepHours} onChange={(e) => setSleepHours(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm mb-1 uppercase tracking-wider text-gray-400">Wake Hours (h)</label>
              <input 
                type="number" step="0.5" required
                className="w-full bg-system-bg border border-system-border p-2 outline-none focus:border-system-text text-system-text"
                value={wakeHours} onChange={(e) => setWakeHours(e.target.value)}
              />
            </div>
            <div className="flex items-center space-x-2 pt-2 cursor-pointer">
              <input 
                type="checkbox" 
                id="exercised" 
                className="w-4 h-4 bg-system-bg border-system-border cursor-pointer appearance-none checked:bg-system-accent border checked:border-system-accent"
                checked={exercised} onChange={(e) => setExercised(e.target.checked)}
              />
              <label htmlFor="exercised" className="text-sm uppercase tracking-wider text-gray-400 cursor-pointer">Exercised This Week?</label>
            </div>
            <button type="submit" className="w-full mt-6 bg-system-border text-system-text hover:bg-system-accent hover:text-white p-2 uppercase tracking-widest transition-colors">
              Initialize Fleshware
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (appState === "LOCKDOWN") {
    const mins = Math.floor(countdown / 60);
    const secs = countdown % 60;
    
    return (
      <div className="flex w-full h-full flex-col items-center justify-center bg-[#050505] text-system-text">
        <div className="absolute top-8 left-8 text-system-accent font-mono text-sm tracking-widest animate-pulse">
          REALITY.EXE // LOCKDOWN_ENGAGED
        </div>
        
        <h1 className="text-9xl font-bold font-mono tracking-tighter mb-4 text-white">
          {mins.toString().padStart(2, '0')}:{secs.toString().padStart(2, '0')}
        </h1>
        
        <p className="text-xl uppercase tracking-widest text-gray-400 mb-12 font-sans font-light">
          Step back. Stretch your arms. Breathe.
        </p>

        <button 
          onClick={attemptBypass}
          className="absolute bottom-8 right-8 text-xs text-gray-600 hover:text-system-accent uppercase tracking-widest transition-colors border-b border-transparent hover:border-system-accent"
        >
          Server on Fire (Override)
        </button>
      </div>
    );
  }

  return null;
}

export default App;
