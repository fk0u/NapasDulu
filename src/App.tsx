import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert, Terminal, Power, User, Activity, Coffee, ActivitySquare, Ban } from "lucide-react";
import { audioSynth } from "./lib/audio";

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

  // Phase 2: Immersive Dash & Audio
  const [activeTime, setActiveTime] = useState(0);
  const [stats, setStats] = useState({ bypass_count: 0, sleep_hours: 0, exercised: false });
  const [warning, setWarning] = useState(false);

  // Phase 2: Breathing & Strict Bypass
  const [breathingPhase, setBreathingPhase] = useState<"inhale"|"hold"|"exhale">("inhale");
  const [bypassInput, setBypassInput] = useState("");
  const [showBypassInput, setShowBypassInput] = useState(false);

  useEffect(() => {
    if (!userName) {
      setAppState("ONBOARDING");
    } else {
      setAppState("DIAGNOSTIC");
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'x') {
        invoke("quit_app");
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    const unlistenLockdown = listen("trigger-lockdown", () => {
      setAppState("LOCKDOWN");
      setCountdown(600);
      setShowBypassInput(false);
      setBypassInput("");
    });

    const unlistenWarning = listen("trigger-warning", () => {
      if (!warning) {
        setWarning(true);
        audioSynth.playWarningSiren();
      }
    });

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      unlistenLockdown.then(f => f());
      unlistenWarning.then(f => f());
    };
  }, [userName, warning]);

  // IDLE Dashboard Poller
  useEffect(() => {
    let interval: number;
    if (appState === "IDLE") {
      audioSynth.playBootSequence();
      
      const fetchStats = async () => {
        try {
          const res: any = await invoke("get_stats");
          setStats(res);
          setActiveTime(res.active_time);
          if (res.active_time >= 5340) {
              setWarning(true);
          } else {
              setWarning(false);
          }
        } catch(e) {}
      };
      
      fetchStats();
      interval = window.setInterval(fetchStats, 1000);
    }
    return () => clearInterval(interval);
  }, [appState]);

  // Lockdown timer logic & Breathing Loop
  useEffect(() => {
    let timer: number;
    let phaseTimeoutId: number;
    let isActive = false;

    if (appState === "LOCKDOWN") {
      isActive = true;
      if(countdown > 0) {
        timer = window.setInterval(() => {
          setCountdown((prev) => prev - 1);
        }, 1000);
      } else {
        setAppState("IDLE");
      }

      // Breathing routine 4-7-8
      const runCycle = () => {
        if(!isActive) return;
        setBreathingPhase("inhale");
        audioSynth.playBreathingDrone("inhale");
        phaseTimeoutId = window.setTimeout(() => {
            if(!isActive) return;
            setBreathingPhase("hold");
            audioSynth.playBreathingDrone("hold");
            phaseTimeoutId = window.setTimeout(() => {
                if(!isActive) return;
                setBreathingPhase("exhale");
                audioSynth.playBreathingDrone("exhale");
                phaseTimeoutId = window.setTimeout(runCycle, 8000);
            }, 7000);
        }, 4000);
      };
      runCycle();
    }
    return () => {
      isActive = false;
      clearInterval(timer);
      clearTimeout(phaseTimeoutId);
    };
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
    if (bypassInput !== "I sacrifice my physical health to bypass") {
      alert("Invalid protocol. Type exactly as requested with matching case.");
      return;
    }
    try {
      const res: any = await invoke("attempt_bypass", { phrase: bypassInput });
      if (res.success) {
        setAppState("IDLE");
      } else {
        alert(res.message);
      }
    } catch (err) {
      alert("Error bypassing: " + String(err));
    }
  };

  const pageTransition = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, scale: 0.95 },
    transition: { duration: 0.4 }
  };

  // Ring styling computation
  const progressPercent = Math.min((activeTime / 5400) * 100, 100);
  const ringRadius = 120;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const strokeDashoffset = ringCircumference - (progressPercent / 100) * ringCircumference;

  // Breathing animation computation
  const getScale = () => {
    if(breathingPhase === "inhale") return 1.5;
    if(breathingPhase === "hold") return 1.5;
    return 1;
  };
  const getDuration = () => {
    if(breathingPhase === "inhale") return 4;
    if(breathingPhase === "hold") return 0.1;
    return 8; // exhale
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#050505] text-system-text font-sans selection:bg-system-accent/30 selection:text-white">
      {/* GLITCH OVERLAY */}
      {warning && appState === "IDLE" && (
        <motion.div 
          animate={{ opacity: [0, 0.2, 0, 0.4, 0] }}
          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
          className="pointer-events-none absolute inset-0 bg-red-600/20 mix-blend-screen z-50"
        />
      )}

      <AnimatePresence mode="wait">
        {/* ONBOARDING AND DIAGNOSTIC (Kept mostly similar but styled better) */}
        {appState === "ONBOARDING" && (
          <motion.div key="onboarding" {...pageTransition} className="flex flex-col w-full h-full items-center justify-center">
            <div className="p-10 border border-system-border bg-black/50 backdrop-blur-md rounded-2xl w-[450px] shadow-[0_0_50px_rgba(239,68,68,0.1)] flex flex-col items-center">
              <div className="bg-system-accent/10 p-4 rounded-full mb-6">
                <Terminal className="w-10 h-10 text-system-accent" />
              </div>
              <h1 className="text-2xl font-bold mb-2 tracking-wide font-mono">NEURAL_UPLINK</h1>
              <p className="text-gray-400 text-sm mb-8 text-center border-b border-system-border/50 pb-6 w-full">Identify biological operator.</p>
              
              <form onSubmit={handleOnboardingSubmit} className="w-full flex flex-col gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-widest text-system-accent mb-1 font-mono">Identity_Token</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input 
                      type="text" autoFocus required
                      placeholder="Enter designation..."
                      className="w-full bg-[#0a0a0a] border border-system-border rounded-lg pl-10 pr-4 py-3 outline-none focus:border-system-accent transition-colors text-white font-mono placeholder:text-gray-600"
                      value={onboardingName} onChange={(e) => setOnboardingName(e.target.value)}
                    />
                  </div>
                </div>
                <button type="submit" className="w-full mt-4 bg-system-accent text-white font-medium rounded-lg py-3 hover:bg-red-600 transition-all active:scale-95 shadow-lg shadow-system-accent/20 cursor-pointer uppercase tracking-widest font-mono text-sm">
                  Initialize
                </button>
              </form>
            </div>
          </motion.div>
        )}

        {appState === "DIAGNOSTIC" && (
          <motion.div key="diagnostic" {...pageTransition} className="flex flex-col w-full h-full items-center justify-center">
            <div className="p-10 border border-system-border bg-black/50 backdrop-blur-md rounded-2xl w-[450px] shadow-[0_0_50px_rgba(239,68,68,0.1)]">
              <div className="flex items-center gap-3 mb-8 border-b border-system-border/50 pb-4">
                <ActivitySquare className="w-6 h-6 text-system-accent" />
                <h1 className="text-xl font-bold tracking-wide font-mono">SYS_DIAGNOSTICS</h1>
              </div>
              
              <p className="text-gray-400 text-sm mb-6 font-mono">Auth: <span className="text-system-accent/80 font-medium">[{userName}]</span></p>
              
              <form onSubmit={handleDiagnosticSubmit} className="space-y-5">
                <div className="flex gap-4">
                  <div className="w-1/2">
                    <label className="block text-[10px] uppercase tracking-widest text-gray-500 mb-1 font-mono">Sleep (HRS)</label>
                    <input 
                      type="number" step="0.5" required min="0" max="24"
                      className="w-full bg-[#0a0a0a] border border-system-border rounded-lg px-4 py-3 outline-none focus:border-system-accent transition-colors text-white font-mono text-lg text-center"
                      value={sleepHours} onChange={(e) => setSleepHours(e.target.value)}
                    />
                  </div>
                  <div className="w-1/2">
                    <label className="block text-[10px] uppercase tracking-widest text-gray-500 mb-1 font-mono">Wake (HRS)</label>
                    <input 
                      type="number" step="0.5" required min="0" max="24"
                      className="w-full bg-[#0a0a0a] border border-system-border rounded-lg px-4 py-3 outline-none focus:border-system-accent transition-colors text-white font-mono text-lg text-center"
                      value={wakeHours} onChange={(e) => setWakeHours(e.target.value)}
                    />
                  </div>
                </div>
                <label className="flex items-center gap-3 p-4 border border-system-border rounded-lg bg-[#0a0a0a] cursor-pointer hover:border-system-accent/50 transition-colors">
                  <input 
                    type="checkbox" 
                    className="w-5 h-5 accent-system-accent rounded-sm cursor-pointer"
                    checked={exercised} onChange={(e) => setExercised(e.target.checked)}
                  />
                  <span className="text-sm font-medium font-mono text-gray-300">Physical Activity Detected</span>
                </label>
                
                <button type="submit" className="w-full mt-4 bg-system-text text-system-bg font-bold rounded-lg py-3 hover:bg-white transition-all active:scale-95 cursor-pointer uppercase tracking-widest font-mono text-sm">
                  Run Core System
                </button>
              </form>
            </div>
          </motion.div>
        )}

        {appState === "IDLE" && (
          <motion.div key="idle" {...pageTransition} className="flex flex-col w-full h-full items-center justify-center">
             
             {/* Dynamic Dashboard HUD */}
             <div className="relative flex items-center justify-center">
                <svg width="300" height="300" className="transform -rotate-90">
                  <circle cx="150" cy="150" r={ringRadius} stroke="#111" strokeWidth="8" fill="none" />
                  <motion.circle 
                    cx="150" cy="150" r={ringRadius} 
                    stroke={warning ? "#ef4444" : "#4ade80"} 
                    strokeWidth="8" fill="none" 
                    strokeLinecap="round"
                    strokeDasharray={ringCircumference}
                    animate={{ strokeDashoffset }}
                    transition={{ ease: "linear", duration: 1 }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <p className={`text-4xl font-light font-mono mb-1 ${warning ? 'text-system-accent drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]' : 'text-gray-200'}`}>
                      {Math.floor(activeTime / 60).toString().padStart(2, '0')}:{(activeTime % 60).toString().padStart(2, '0')}
                    </p>
                    <p className="text-[10px] tracking-[0.3em] uppercase text-gray-500 font-mono">
                      {warning ? 'Limit Approaching' : 'Active Protocol'}
                    </p>
                </div>
             </div>

             <div className="mt-12 flex items-center justify-between w-[500px] border-t border-system-border/50 pt-8">
               <div className="flex flex-col items-center">
                 <Activity className="w-5 h-5 text-gray-500 mb-2" />
                 <span className="text-xl font-mono text-white">{stats.sleep_hours.toFixed(1)}h</span>
                 <span className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">Sleep Logs</span>
               </div>
               <div className="flex flex-col items-center">
                 <ShieldAlert className="w-5 h-5 text-gray-500 mb-2" />
                 <span className={`text-xl font-mono ${stats.bypass_count > 0 ? 'text-system-accent' : 'text-white'}`}>{stats.bypass_count}/2</span>
                 <span className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">Overrides</span>
               </div>
               <div className="flex flex-col items-center">
                 <User className="w-5 h-5 text-gray-500 mb-2" />
                 <span className="text-lg font-mono text-white tracking-widest truncate max-w-[120px]">{userName}</span>
                 <span className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">Operator</span>
               </div>
             </div>
             <p className="fixed bottom-6 text-[10px] text-gray-700 font-mono uppercase tracking-widest text-center">
               System Dormant. Global hooks engaged.<br/>[Alt+X to Hibernate]
             </p>
          </motion.div>
        )}

        {appState === "LOCKDOWN" && (
          <motion.div key="lockdown" {...pageTransition} className="absolute inset-0 flex flex-col items-center justify-center bg-[#000] border border-system-accent/20 z-50 overflow-hidden">
            
            <div className="absolute top-8 left-8 flex items-center gap-3 text-system-accent font-mono text-[10px] tracking-[0.3em] animate-pulse">
              <Power className="w-3 h-3" />
              LOCKDOWN_MANDATORY
            </div>
            
            {/* BREATHING VISUALIZER */}
            <div className="relative flex flex-col items-center justify-center mt-[-100px]">
               <motion.div 
                 animate={{ scale: getScale(), opacity: breathingPhase === "hold" ? 1 : 0.6 }}
                 transition={{ duration: getDuration(), ease: "easeInOut" }}
                 className="absolute w-48 h-48 rounded-full bg-system-accent/20 blur-xl"
               />
               <motion.div 
                 animate={{ scale: getScale() }}
                 transition={{ duration: getDuration(), ease: "easeInOut" }}
                 className="w-16 h-16 rounded-full bg-system-accent z-10 flex items-center justify-center shadow-[0_0_40px_rgba(239,68,68,0.5)]"
               >
                 <Coffee className="w-6 h-6 text-black" />
               </motion.div>
            </div>

            <div className="mt-40 text-center z-10">
               <h1 className="text-8xl font-bold font-mono tracking-tighter text-white drop-shadow-[0_0_20px_rgba(239,68,68,0.4)] mb-4">
                 {Math.floor(countdown / 60).toString().padStart(2, '0')}:{(countdown % 60).toString().padStart(2, '0')}
               </h1>
               <motion.p 
                 key={breathingPhase}
                 initial={{ opacity: 0, y: 10 }}
                 animate={{ opacity: 1, y: 0 }}
                 className="text-lg tracking-[0.5em] text-gray-400 font-mono uppercase"
               >
                 {breathingPhase === "inhale" ? "Breathe In" : breathingPhase === "hold" ? "Hold" : "Breathe Out"}
               </motion.p>
            </div>

            <div className="absolute bottom-10 right-10 flex flex-col items-end gap-3 z-50">
               {!showBypassInput ? (
                  <button 
                    onClick={() => setShowBypassInput(true)}
                    className="flex items-center gap-2 px-5 py-3 rounded-md border border-[#222] text-[10px] text-gray-600 hover:text-system-accent hover:border-system-accent uppercase tracking-widest font-mono transition-all bg-black/80 backdrop-blur-sm cursor-pointer"
                  >
                    <Ban className="w-3 h-3" />
                    Bypass Protocol
                  </button>
               ) : (
                  <div className="flex flex-col items-end gap-2 bg-[#0a0a0a] p-4 border border-system-accent/30 rounded-md">
                     <p className="text-[10px] text-system-accent font-mono uppercase tracking-widest mb-2 max-w-xs text-right leading-relaxed">
                        Strict Override. Type exactly:<br/>
                        <span className="text-white bg-system-accent/20 px-2 py-1 mt-1 block select-none">I sacrifice my physical health to bypass</span>
                     </p>
                     <div className="flex items-center gap-2">
                       <input 
                         autoFocus
                         type="text"
                         placeholder="Wait, don't do this..."
                         className="bg-[#111] border border-[#333] rounded px-3 py-2 text-xs font-mono text-white outline-none focus:border-system-accent w-64 uppercase-"
                         value={bypassInput}
                         onChange={(e) => setBypassInput(e.target.value)}
                       />
                       <button 
                         onClick={attemptBypass}
                         className="px-4 py-2 bg-system-accent text-black text-[10px] uppercase font-bold tracking-widest rounded hover:bg-red-600 transition-colors"
                       >
                         Execute
                       </button>
                     </div>
                  </div>
               )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
