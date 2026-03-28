import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert, Terminal, Power, User, Activity, Flame, Coffee } from "lucide-react";

type AppState = "ONBOARDING" | "IDLE" | "DIAGNOSTIC" | "LOCKDOWN";

function App() {
  const [appState, setAppState] = useState<AppState>("IDLE");
  const [countdown, setCountdown] = useState(600); // 10 minutes
  
  // User Data
  const [userName, setUserName] = useState(() => localStorage.getItem("userName") || "");
  const [onboardingName, setOnboardingName] = useState("");

  // Diagnostic form state
  const [sleepHours, setSleepHours] = useState("");
  const [wakeHours, setWakeHours] = useState("");
  const [exercised, setExercised] = useState(false);

  useEffect(() => {
    // Determine initial state
    if (!userName) {
      setAppState("ONBOARDING");
    } else {
      setAppState("DIAGNOSTIC"); // default daily check
    }

    // Alt+X listener to quit
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'x') {
        invoke("quit_app");
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    // Listen for lockdown event from Rust Global Hook
    const unlistenLockdown = listen("trigger-lockdown", () => {
      setAppState("LOCKDOWN");
      setCountdown(600);
    });

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      unlistenLockdown.then(f => f());
    };
  }, [userName]);

  // Lockdown timer logic
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

  const handleOnboardingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onboardingName.trim()) {
      localStorage.setItem("userName", onboardingName.trim());
      setUserName(onboardingName.trim());
      setAppState("DIAGNOSTIC");
    }
  };

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
      setAppState("IDLE");
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

  // Rendering Helper
  const pageTransition = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, scale: 0.95 },
    transition: { duration: 0.4 }
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-system-bg text-system-text font-sans">
      <AnimatePresence mode="wait">
        {appState === "ONBOARDING" && (
          <motion.div key="onboarding" {...pageTransition} className="flex flex-col w-full h-full items-center justify-center">
            <div className="p-10 border border-system-border bg-black/50 backdrop-blur-md rounded-2xl w-[450px] shadow-2xl flex flex-col items-center">
              <div className="bg-system-accent/10 p-4 rounded-full mb-6">
                <Terminal className="w-10 h-10 text-system-accent" />
              </div>
              <h1 className="text-2xl font-bold mb-2 tracking-wide">Welcome to Napas Dulu</h1>
              <p className="text-gray-400 text-sm mb-8 text-center">System initialization sequence. Identify yourself.</p>
              
              <form onSubmit={handleOnboardingSubmit} className="w-full flex flex-col gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-widest text-gray-500 mb-1">Operator Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input 
                      type="text" autoFocus required
                      placeholder="Enter your name..."
                      className="w-full bg-[#111] border border-system-border rounded-lg pl-10 pr-4 py-3 outline-none focus:border-system-accent transition-colors text-white"
                      value={onboardingName} onChange={(e) => setOnboardingName(e.target.value)}
                    />
                  </div>
                </div>
                <button type="submit" className="w-full mt-4 bg-system-accent text-white font-medium rounded-lg py-3 hover:bg-red-600 transition-all active:scale-95 shadow-lg shadow-system-accent/20 cursor-pointer">
                  Initialize System
                </button>
              </form>
            </div>
          </motion.div>
        )}

        {appState === "DIAGNOSTIC" && (
          <motion.div key="diagnostic" {...pageTransition} className="flex flex-col w-full h-full items-center justify-center">
            <div className="p-10 border border-system-border bg-black/50 backdrop-blur-md rounded-2xl w-[450px] shadow-2xl">
              <div className="flex items-center gap-3 mb-8 border-b border-system-border pb-4">
                <Activity className="w-6 h-6 text-system-accent" />
                <h1 className="text-xl font-bold tracking-wide">Morning Diagnostics</h1>
              </div>
              
              <p className="text-gray-400 text-sm mb-6">Welcome back, <span className="text-white font-medium">{userName}</span>. Run your daily scan.</p>
              
              <form onSubmit={handleDiagnosticSubmit} className="space-y-5">
                <div>
                  <label className="block text-xs uppercase tracking-widest text-gray-500 mb-1">Sleep Hours</label>
                  <input 
                    type="number" step="0.5" required min="0" max="24"
                    className="w-full bg-[#111] border border-system-border rounded-lg px-4 py-3 outline-none focus:border-system-accent transition-colors text-white"
                    value={sleepHours} onChange={(e) => setSleepHours(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-widest text-gray-500 mb-1">Wake Hours</label>
                  <input 
                    type="number" step="0.5" required min="0" max="24"
                    className="w-full bg-[#111] border border-system-border rounded-lg px-4 py-3 outline-none focus:border-system-accent transition-colors text-white"
                    value={wakeHours} onChange={(e) => setWakeHours(e.target.value)}
                  />
                </div>
                <label className="flex items-center gap-3 p-4 border border-system-border rounded-lg bg-[#0a0a0a] cursor-pointer hover:bg-[#111] transition-colors">
                  <input 
                    type="checkbox" 
                    className="w-5 h-5 accent-system-accent rounded-sm cursor-pointer"
                    checked={exercised} onChange={(e) => setExercised(e.target.checked)}
                  />
                  <span className="text-sm font-medium">I exercised this week</span>
                </label>
                
                <button type="submit" className="w-full mt-4 bg-system-text text-system-bg font-bold rounded-lg py-3 hover:bg-white transition-all active:scale-95 cursor-pointer">
                  Boot System
                </button>
              </form>
            </div>
          </motion.div>
        )}

        {appState === "IDLE" && (
          <motion.div key="idle" {...pageTransition} className="flex flex-col w-full h-full items-center justify-center opacity-30 hover:opacity-100 transition-opacity duration-500">
            <ShieldAlert className="w-16 h-16 text-gray-500 mb-4 animate-pulse" />
            <p className="text-sm font-mono tracking-[0.3em] text-gray-400">[ SYSTEM DORMANT ]</p>
            <p className="text-xs mt-2 text-gray-600">Monitoring activity in background...</p>
            <p className="text-[10px] mt-8 text-gray-700 font-mono">Press Alt+X to Quit</p>
          </motion.div>
        )}

        {appState === "LOCKDOWN" && (
          <motion.div key="lockdown" {...pageTransition} className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 backdrop-blur-3xl z-50">
            <div className="absolute top-8 left-8 flex items-center gap-3 text-system-accent font-mono text-sm tracking-widest animate-pulse">
              <Power className="w-4 h-4" />
              LOCKDOWN_ENGAGED
            </div>
            
            <motion.div 
              animate={{ scale: [1, 1.05, 1], opacity: [0.8, 1, 0.8] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute w-[600px] h-[600px] bg-system-accent/5 rounded-full blur-3xl -z-10"
            />

            <Coffee className="w-16 h-16 text-system-text mb-8 opacity-50" />
            
            <h1 className="text-[12rem] leading-none font-bold font-mono tracking-tighter text-white drop-shadow-[0_0_30px_rgba(239,68,68,0.3)]">
              {Math.floor(countdown / 60).toString().padStart(2, '0')}:{(countdown % 60).toString().padStart(2, '0')}
            </h1>
            
            <p className="text-2xl mt-8 uppercase tracking-[0.2em] text-gray-400 font-light text-center max-w-lg">
              Step back. Stretch your arms.<br/><span className="text-system-text font-medium mt-2 block">Breathe.</span>
            </p>

            <button 
              onClick={attemptBypass}
              className="absolute bottom-10 right-10 flex items-center gap-2 px-4 py-2 rounded-full border border-gray-800 text-xs text-gray-500 hover:text-system-accent hover:border-system-accent uppercase tracking-widest transition-all bg-black/50 backdrop-blur-sm cursor-pointer"
            >
              <Flame className="w-3 h-3" />
              Server on Fire (Override)
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
