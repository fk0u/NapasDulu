import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert, Terminal, Power, User, Activity, Coffee, ActivitySquare, Ban, BarChart3, Clock, Play, Pause } from "lucide-react";
import { audioSynth } from "./lib/audio";
import { fetchWellnessLimits } from "./lib/gemini";

type AppState = "ONBOARDING" | "IDLE" | "DIAGNOSTIC" | "LOCKDOWN";

interface UsageDay {
  date: string;
  active_seconds: number;
}

function App() {
  const [appState, setAppState] = useState<AppState>("IDLE");
  const [countdown, setCountdown] = useState(600); // 10 minutes
  
  // User Data
  const [userName, setUserName] = useState(() => localStorage.getItem("userName") || "");
  const [onboardingName, setOnboardingName] = useState("");
  const [onboardingAge, setOnboardingAge] = useState("");
  const [onboardingBp, setOnboardingBp] = useState("");
  const [onboardingWeight, setOnboardingWeight] = useState("");
  
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(() => localStorage.getItem("aiMessage") || null);

  // Diagnostic form state
  const [bedTime, setBedTime] = useState("");
  const [wakeTime, setWakeTime] = useState("");
  const [exercised, setExercised] = useState(false);

  // Phase 2: Immersive Dash & Audio
  const [activeTime, setActiveTime] = useState(0);
  const [stats, setStats] = useState({ bypass_count: 0, sleep_hours: 0, exercised: false });
  const [warning, setWarning] = useState(false);
  const [usageHistory, setUsageHistory] = useState<UsageDay[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Phase 2: Breathing & Strict Bypass
  const [breathingPhase, setBreathingPhase] = useState<"inhale"|"hold"|"exhale">("inhale");
  const [bypassInput, setBypassInput] = useState("");
  const [showBypassInput, setShowBypassInput] = useState(false);
  
  // Scheduler state
  const [isSchedulerActive, setIsSchedulerActive] = useState(true);

  // Handle initial boot setup
  useEffect(() => {
    if (userName) {
       setAppState("DIAGNOSTIC");
       // Sync saved AI limits to backend on app restart
       const storedLimit = localStorage.getItem("sessionLimitSeconds");
       if (storedLimit) {
           invoke("set_dynamic_limit", { limitSeconds: parseInt(storedLimit) }).catch(console.error);
       }
    }
  }, []); // Run ONCE on mount

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
    if (appState === "IDLE" || appState === "ONBOARDING" || appState === "DIAGNOSTIC") {
      // Revert window to normal if it's not lockdown
      const appWindow = getCurrentWindow();
      appWindow.setFullscreen(false);
      appWindow.setAlwaysOnTop(false);
      appWindow.setDecorations(true);
    }
    
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
          
          if (showHistory) {
              const hist: UsageDay[] = await invoke("get_usage_history");
              setUsageHistory(hist);
          }
        } catch(e) {}
      };
      
      fetchStats();
      interval = window.setInterval(fetchStats, 1000);
    }
    return () => clearInterval(interval);
  }, [appState, showHistory]);

  // Lockdown timer logic & Breathing Loop
  useEffect(() => {
    let timer: number;
    let phaseTimeoutId: number;
    let isActive = false;

    if (appState === "LOCKDOWN") {
      isActive = true;
      const appWindow = getCurrentWindow();
      appWindow.setFullscreen(true);
      appWindow.setAlwaysOnTop(true);
      appWindow.setDecorations(false);
      
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

  const handleOnboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onboardingName.trim() || !onboardingAge || !onboardingBp || !onboardingWeight) return;
    
    setAiLoading(true);
    let message = "";
    
    try {
        const wellness = await fetchWellnessLimits(onboardingName, onboardingAge, onboardingBp, onboardingWeight);
        // Sync generated limit to backend & storage
        await invoke("set_dynamic_limit", { limitSeconds: wellness.sessionLimitSeconds });
        localStorage.setItem("sessionLimitSeconds", wellness.sessionLimitSeconds.toString());
        message = wellness.message;
    } catch (err) {
        console.error("AI Error Triggered", err);
        message = "ERR: UPLINK FAILED. BIOLOGICAL DATA UNVERIFIED. STANDARD PROTOCOL INITIATED.";
    }

    // Move to next phase
    localStorage.setItem("userName", onboardingName.trim());
    localStorage.setItem("aiMessage", message);
    setUserName(onboardingName.trim());
    setAiMessage(message);
    setAiLoading(false);
    setAppState("DIAGNOSTIC");
  };

  const handleDiagnosticSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bedTime || !wakeTime) {
       alert("Please enter both sleep and wake times.");
       return;
    }

    // Compute sleep hours
    const [bH, bM] = bedTime.split(':').map(Number);
    const [wH, wM] = wakeTime.split(':').map(Number);
    
    let bedMins = bH * 60 + bM;
    let wakeMins = wH * 60 + wM;
    
    if (wakeMins <= bedMins) {
        wakeMins += 24 * 60; // Next day
    }
    const computedSleepHours = (wakeMins - bedMins) / 60;

    try {
      const res: any = await invoke("log_morning_diagnostic", {
        sleepHours: computedSleepHours,
        wakeHours: 0.0,
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

  const toggleScheduler = async () => {
    try {
      if (isSchedulerActive) {
        await invoke("stop_scheduler");
        setIsSchedulerActive(false);
      } else {
        await invoke("start_scheduler");
        setIsSchedulerActive(true);
      }
    } catch (err) {
      console.error("Failed to toggle scheduler", err);
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
        {appState === "ONBOARDING" && (
          <motion.div key="onboarding" {...pageTransition} className="flex flex-col w-full h-full items-center justify-center relative">
            <div className="absolute inset-0 bg-gradient-to-br from-system-accent/5 to-transparent pointer-events-none" />
            <div className="p-10 border border-system-border/60 bg-[#070707]/80 backdrop-blur-2xl rounded-3xl w-[480px] shadow-[0_20px_80px_rgba(239,68,68,0.15)] flex flex-col items-center relative overflow-hidden group">
              <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-system-accent/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
              
              <div className="bg-system-accent/10 border border-system-accent/20 p-5 rounded-2xl mb-8 shadow-[0_0_30px_rgba(239,68,68,0.15)]">
                <Terminal className="w-12 h-12 text-system-accent drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
              </div>
              <h1 className="text-3xl font-bold mb-3 tracking-widest font-mono text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400 text-center">NEURAL_UPLINK</h1>
              <p className="text-gray-500 text-xs mb-10 text-center uppercase tracking-[0.2em] w-full">Identify biological operator</p>
              
              <form onSubmit={handleOnboardingSubmit} className="w-full flex flex-col gap-6">
                <div>
                  <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-system-accent transition-colors duration-300" />
                    <input 
                      type="text" autoFocus required
                      placeholder="ENTER DESIGNATION..."
                      className="w-full bg-[#030303] border border-system-border/80 rounded-xl pl-12 pr-4 py-4 outline-none focus:border-system-accent/80 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)] transition-all text-white font-mono placeholder:text-gray-700 placeholder:text-sm"
                      value={onboardingName} onChange={(e) => setOnboardingName(e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="w-1/3 group">
                    <label className="block text-[9px] uppercase tracking-[0.2em] text-gray-500 mb-2 font-mono group-focus-within:text-system-accent transition-colors">Age (YRS)</label>
                    <input 
                      type="number" required placeholder="18"
                      className="w-full bg-[#030303] border border-system-border/80 rounded-xl px-4 py-3 outline-none focus:border-system-accent/80 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)] transition-all text-white font-mono placeholder:text-gray-700 text-center"
                      value={onboardingAge} onChange={(e) => setOnboardingAge(e.target.value)}
                    />
                  </div>
                  <div className="w-1/3 group">
                    <label className="block text-[9px] uppercase tracking-[0.2em] text-gray-500 mb-2 font-mono group-focus-within:text-system-accent transition-colors">Weight (KG)</label>
                    <input 
                      type="number" required placeholder="65"
                      className="w-full bg-[#030303] border border-system-border/80 rounded-xl px-4 py-3 outline-none focus:border-system-accent/80 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)] transition-all text-white font-mono placeholder:text-gray-700 text-center"
                      value={onboardingWeight} onChange={(e) => setOnboardingWeight(e.target.value)}
                    />
                  </div>
                  <div className="w-1/3 group">
                    <label className="block text-[9px] uppercase tracking-[0.2em] text-gray-500 mb-2 font-mono group-focus-within:text-system-accent transition-colors">BP (SYS/DIA)</label>
                    <input 
                      type="text" required placeholder="120/80"
                      className="w-full bg-[#030303] border border-system-border/80 rounded-xl px-4 py-3 outline-none focus:border-system-accent/80 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)] transition-all text-white font-mono placeholder:text-gray-700 text-center text-sm"
                      value={onboardingBp} onChange={(e) => setOnboardingBp(e.target.value)}
                    />
                  </div>
                </div>

                <button disabled={aiLoading} type="submit" className="relative w-full mt-4 bg-gradient-to-b from-system-accent to-red-700 text-white font-bold rounded-xl py-4 hover:to-red-600 transition-all active:scale-[0.98] shadow-[0_0_20px_rgba(239,68,68,0.3)] hover:shadow-[0_0_30px_rgba(239,68,68,0.5)] cursor-pointer uppercase tracking-widest font-mono overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed">
                  <span className="relative z-10 drop-shadow-md">{aiLoading ? "ANALYZING BIOMETRICS..." : "Initialize Session"}</span>
                  <div className="absolute inset-0 bg-white/20 translate-y-full hover:translate-y-0 transition-transform duration-300 ease-out" />
                </button>
              </form>
            </div>
          </motion.div>
        )}

        {appState === "DIAGNOSTIC" && (
          <motion.div key="diagnostic" {...pageTransition} className="flex flex-col w-full h-full items-center justify-center relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.03)_0%,transparent_100%)] pointer-events-none" />
            <div className="p-10 border border-system-border/60 bg-[#070707]/80 backdrop-blur-2xl rounded-3xl w-[520px] shadow-[0_20px_80px_rgba(0,0,0,0.8)] relative overflow-hidden group">
              <div className="absolute bottom-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-system-accent/40 to-transparent" />

              <div className="flex items-center gap-4 mb-10 border-b border-system-border/40 pb-6">
                <div className="bg-system-accent/10 p-3 rounded-xl border border-system-accent/20">
                  <ActivitySquare className="w-7 h-7 text-system-accent shadow-system-accent drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-[0.15em] font-mono text-white">SYS_DIAGNOSTICS</h1>
                  <p className="text-gray-500 text-[10px] mt-1 uppercase font-mono tracking-widest">Auth: <span className="text-system-accent/90">[{userName}]</span></p>
                </div>
              </div>
              
              <form onSubmit={handleDiagnosticSubmit} className="space-y-8">
                <div className="flex gap-6">
                  <div className="w-1/2 group">
                    <label className="block text-[10px] uppercase tracking-[0.2em] text-gray-400 mb-2 font-mono group-focus-within:text-system-accent transition-colors">Bed Time</label>
                    <div className="relative">
                      <input 
                        type="time" required
                        className="w-full bg-[#030303] border border-system-border/80 rounded-xl px-4 py-4 outline-none focus:border-system-accent/80 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)] transition-all text-white font-mono text-lg"
                        style={{ colorScheme: 'dark' }}
                        value={bedTime} onChange={(e) => setBedTime(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="w-1/2 group">
                    <label className="block text-[10px] uppercase tracking-[0.2em] text-gray-400 mb-2 font-mono group-focus-within:text-system-accent transition-colors">Wake Time</label>
                    <div className="relative">
                      <input 
                        type="time" required
                        className="w-full bg-[#030303] border border-system-border/80 rounded-xl px-4 py-4 outline-none focus:border-system-accent/80 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)] transition-all text-white font-mono text-lg"
                        style={{ colorScheme: 'dark' }}
                        value={wakeTime} onChange={(e) => setWakeTime(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                
                <label className="flex items-center gap-4 p-5 border border-system-border/80 rounded-xl bg-[#030303] cursor-pointer hover:border-system-accent/50 hover:bg-[#0a0a0a] transition-all group relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-system-accent scale-y-0 group-hover:scale-y-100 transition-transform origin-bottom" />
                  <div className="relative flex items-center justify-center w-6 h-6 rounded-md border border-gray-600 group-hover:border-system-accent">
                    <input 
                      type="checkbox" 
                      className="absolute opacity-0 w-full h-full cursor-pointer"
                      checked={exercised} onChange={(e) => setExercised(e.target.checked)}
                    />
                    {exercised && (
                      <motion.div 
                        initial={{ scale: 0 }} animate={{ scale: 1 }} 
                        className="w-3 h-3 bg-system-accent rounded-sm shadow-[0_0_8px_rgba(239,68,68,0.8)]"
                      />
                    )}
                  </div>
                  <span className="text-xs font-semibold font-mono text-gray-300 uppercase tracking-widest group-hover:text-white transition-colors">Physically Active Today</span>
                </label>
                
                <button type="submit" className="relative w-full mt-4 bg-[#e5e5e5] text-black font-extrabold rounded-xl py-4 hover:bg-white transition-all active:scale-[0.98] shadow-[0_0_15px_rgba(255,255,255,0.2)] cursor-pointer uppercase tracking-[0.2em] font-mono text-xs overflow-hidden group/btn">
                  <span className="relative z-10 group-hover/btn:drop-shadow-[0_0_2px_rgba(0,0,0,0.5)] transition-all">Engage Core System</span>
                  <div className="absolute inset-0 bg-white translate-y-full hover:translate-y-0 transition-transform duration-300 ease-out" />
                </button>
              </form>
            </div>
          </motion.div>
        )}

        {appState === "IDLE" && (
          <motion.div key="idle" {...pageTransition} className="flex flex-col w-full h-full items-center justify-center">
             
             {/* AI DIRECTIVE HUD */}
             {aiMessage && (
               <motion.div 
                 initial={{ opacity: 0, y: -20 }} 
                 animate={{ opacity: 1, y: 0 }} 
                 className="mb-8 p-5 w-[600px] bg-gradient-to-r from-[#1a0505] to-black border border-system-accent/30 rounded-xl relative overflow-hidden group shadow-[0_0_30px_rgba(239,68,68,0.1)]"
               >
                 <div className="absolute top-0 left-0 w-1 h-full bg-system-accent shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
                 <h3 className="text-[10px] text-system-accent font-mono tracking-[0.2em] uppercase mb-2 flex items-center gap-2">
                    <Terminal className="w-3 h-3" />
                    Neural_Uplink AI Directive
                 </h3>
                 <p className="text-xs text-gray-300 font-mono leading-relaxed italic border-l border-system-accent/20 pl-3">"{aiMessage}"</p>
               </motion.div>
             )}

             {/* Dynamic Dashboard HUD */}
             {!showHistory ? (
               <motion.div 
                 key="main-hud"
                 initial={{ opacity: 0, scale: 0.9 }} 
                 animate={{ opacity: 1, scale: 1 }} 
                 exit={{ opacity: 0, scale: 0.9 }} 
                 className="relative flex items-center justify-center transform transition-all"
               >
                  <svg width="300" height="300" className="transform -rotate-90 filter drop-shadow-[0_0_15px_rgba(255,255,255,0.05)]">
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
                        {warning ? 'Limit Approaching' : 'Session Active'}
                      </p>
                  </div>
               </motion.div>
             ) : (
               <motion.div 
                 key="history-hud"
                 initial={{ opacity: 0, y: 20 }} 
                 animate={{ opacity: 1, y: 0 }} 
                 exit={{ opacity: 0, y: 20 }} 
                 className="flex flex-col items-center justify-center w-[600px] h-[300px] bg-black/40 border border-system-border/50 rounded-xl p-6 backdrop-blur-md relative"
               >
                 <div className="absolute top-4 left-6 flex items-center gap-2">
                   <Clock className="w-4 h-4 text-system-accent" />
                   <h2 className="text-xs font-mono uppercase tracking-widest text-gray-300">Activity History</h2>
                 </div>
                 
                 <div className="w-full h-full flex items-end justify-between mt-8 gap-2">
                    {usageHistory.length === 0 ? (
                       <p className="text-gray-500 font-mono text-sm w-full text-center mb-10">No history protocol found.</p>
                    ) : (
                       usageHistory.map((day, i) => {
                         // max 12 hours for scaling
                         const heightPercent = Math.min((day.active_seconds / 43200) * 100, 100);
                         const dateObj = new Date(day.date);
                         const isToday = i === usageHistory.length - 1;
                         return (
                           <div key={i} className="flex flex-col items-center flex-1 group">
                             <div className="w-full flex justify-center h-[180px] items-end relative">
                               <span className="absolute -top-6 text-[9px] font-mono text-system-accent opacity-0 group-hover:opacity-100 transition-opacity">
                                 {Math.floor(day.active_seconds / 3600)}h {Math.floor((day.active_seconds % 3600) / 60)}m
                               </span>
                               <motion.div 
                                 initial={{ height: 0 }}
                                 animate={{ height: `${heightPercent}%` }}
                                 transition={{ duration: 0.8, delay: i * 0.1, type: "spring" }}
                                 className={`w-8 rounded-t-sm ${isToday ? 'bg-system-accent/80' : 'bg-[#222] group-hover:bg-[#333]'} relative overflow-hidden`}
                               >
                                  {isToday && (
                                    <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white/20" />
                                  )}
                               </motion.div>
                             </div>
                             <span className={`text-[10px] mt-3 font-mono uppercase tracking-widest ${isToday ? 'text-white font-bold' : 'text-gray-500'}`}>
                               {dateObj.toLocaleDateString('en-US', { weekday: 'short' })}
                             </span>
                           </div>
                         );
                       })
                    )}
                 </div>
               </motion.div>
             )}

             <div className="mt-12 flex items-center justify-between w-[600px] border-t border-system-border/50 pt-8">
               <div className="flex flex-col items-center">
                 <Activity className="w-5 h-5 text-gray-500 mb-2" />
                 <span className="text-xl font-mono text-white">{stats.sleep_hours.toFixed(1)}h</span>
                 <span className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">Sleep Logs</span>
               </div>
               
               <button 
                 onClick={() => setShowHistory(!showHistory)}
                 className="group flex flex-col items-center justify-center bg-[#0a0a0a] border border-system-border hover:border-system-accent/50 rounded-lg p-3 px-6 transition-all active:scale-95 cursor-pointer relative overflow-hidden shadow-[0_0_15px_rgba(0,0,0,0.5)]"
               >
                 <div className="absolute inset-0 bg-system-accent/5 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                 <BarChart3 className={`w-5 h-5 mb-2 transition-colors ${showHistory ? 'text-system-accent' : 'text-gray-400 group-hover:text-white'}`} />
                 <span className="text-[10px] text-gray-400 group-hover:text-white uppercase tracking-widest mt-1 relative z-10">
                   {showHistory ? 'Close HUD' : 'Digital HUD'}
                 </span>
               </button>

               <button 
                 onClick={toggleScheduler}
                 className={`group flex flex-col items-center justify-center bg-[#0a0a0a] border ${isSchedulerActive ? 'border-green-900/50 hover:border-green-500/50' : 'border-yellow-900/50 hover:border-yellow-500/50'} rounded-lg p-3 px-6 transition-all active:scale-95 cursor-pointer relative overflow-hidden shadow-[0_0_15px_rgba(0,0,0,0.5)]`}
               >
                 <div className="absolute inset-0 bg-system-accent/5 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                 {isSchedulerActive ? (
                    <Pause className="w-5 h-5 mb-2 text-green-400" />
                 ) : (
                    <Play className="w-5 h-5 mb-2 text-yellow-400" />
                 )}
                 <span className="text-[10px] text-gray-400 group-hover:text-white uppercase tracking-widest mt-1 relative z-10">
                   {isSchedulerActive ? 'Pause' : 'Resume'}
                 </span>
               </button>

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
