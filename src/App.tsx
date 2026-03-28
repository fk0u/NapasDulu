import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert, Terminal, User, Activity, ActivitySquare, BarChart3, Clock, Play, Pause, PieChart, AlertTriangle, MessageSquare, Skull } from "lucide-react";
import { audioSynth } from "./lib/audio";
import { fetchWellnessLimits } from "./lib/gemini";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

type AppState = "ONBOARDING" | "IDLE" | "DIAGNOSTIC" | "LOCKDOWN";

interface UsageDay {
  date: string;
  active_seconds: number;
}

interface AppUsageStat {
  app_name: string;
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
  
  // HUD logic
  const [activeHud, setActiveHud] = useState<"NONE"|"HISTORY"|"WAKATIME">("NONE");
  const [usageHistory, setUsageHistory] = useState<UsageDay[]>([]);
  const [appHistory, setAppHistory] = useState<AppUsageStat[]>([]);
  
  // Emergency Override Logic
  const [bypassInput, setBypassInput] = useState("");
  const [emergencyReason, setEmergencyReason] = useState("");
  const [emergencyDuration, setEmergencyDuration] = useState("10");
  const [showBypassInput, setShowBypassInput] = useState(false);
  
  // Scheduler state
  const [isSchedulerActive, setIsSchedulerActive] = useState(true);

  // Handle initial boot setup
  useEffect(() => {
    if (userName) {
       setAppState("DIAGNOSTIC");
       const storedLimit = localStorage.getItem("sessionLimitSeconds");
       if (storedLimit) {
           invoke("set_dynamic_limit", { limitSeconds: parseInt(storedLimit) }).catch(console.error);
       }
    }
  }, []);

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
      unlistenLockdown.then((f: any) => f());
      unlistenWarning.then((f: any) => f());
    };
  }, [userName, warning]);

  useEffect(() => {
    const win = getCurrentWindow();
    if (appState === "LOCKDOWN") {
      win.setFullscreen(true).catch(console.error);
      win.setAlwaysOnTop(true).catch(console.error);
      win.setClosable(false).catch(console.error);
      win.setMinimizable(false).catch(console.error);
    } else {
      win.setFullscreen(false).catch(console.error);
      win.setAlwaysOnTop(false).catch(console.error);
      win.setClosable(true).catch(console.error);
      win.setMinimizable(true).catch(console.error);
    }
  }, [appState]);

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
          
          if (activeHud === "HISTORY") {
              const hist: UsageDay[] = await invoke("get_usage_history");
              setUsageHistory(hist);
          } else if (activeHud === "WAKATIME") {
              const apps: AppUsageStat[] = await invoke("get_app_usage_stats");
              setAppHistory(apps);
          }
        } catch(e) {}
      };
      
      fetchStats();
      interval = window.setInterval(fetchStats, 1000);
    }
    return () => clearInterval(interval);
  }, [appState, activeHud]);

  useEffect(() => {
    let timer: number;
    if (appState === "LOCKDOWN") {
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
    }
    return () => clearInterval(timer);
  }, [appState, countdown]);

  const handleOnboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onboardingName.trim() || !onboardingAge || !onboardingBp || !onboardingWeight) return;
    
    setAiLoading(true);
    let message = "";
    
    try {
        const wellness = await fetchWellnessLimits(onboardingName, onboardingAge, onboardingBp, onboardingWeight);
        await invoke("set_dynamic_limit", { limitSeconds: wellness.sessionLimitSeconds });
        localStorage.setItem("sessionLimitSeconds", wellness.sessionLimitSeconds.toString());
        message = wellness.message;
    } catch (err) {
        message = "ERR: UPLINK FAILED. BIOLOGICAL DATA UNVERIFIED. STANDARD PROTOCOL INITIATED.";
    }

    localStorage.setItem("userName", onboardingName.trim());
    localStorage.setItem("aiMessage", message);
    setUserName(onboardingName.trim());
    setAiMessage(message);
    setAiLoading(false);
    setAppState("DIAGNOSTIC");
  };

  const handleDiagnosticSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bedTime || !wakeTime) return;

    const [bH, bM] = bedTime.split(':').map(Number);
    const [wH, wM] = wakeTime.split(':').map(Number);
    let bedMins = bH * 60 + bM;
    let wakeMins = wH * 60 + wM;
    if (wakeMins <= bedMins) wakeMins += 24 * 60;
    const computedSleepHours = (wakeMins - bedMins) / 60;

    try {
      const res: any = await invoke("log_morning_diagnostic", { sleepHours: computedSleepHours, wakeHours: 0.0, exercised });
      if (res.success) setAppState("IDLE");
    } catch (err) {
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
    
    if (emergencyReason.trim().length < 10) {
      alert("Emergency Log required. Explain why you are bypassing health limits (Min 10 characters).");
      return;
    }

    try {
      const resp: any = await invoke("attempt_bypass", { logs: `EMERGENCY [${emergencyDuration}m]: ${emergencyReason}` });
      if (resp.success) {
        const durationSecs = parseInt(emergencyDuration) * 60;
        const currentLimit = parseInt(localStorage.getItem("sessionLimitSeconds") || "5400");
        const newTempLimit = currentLimit + durationSecs;
        await invoke("set_dynamic_limit", { limitSeconds: newTempLimit });

        setBypassInput("");
        setEmergencyReason("");
        setShowBypassInput(false);
        setAppState("IDLE");
      } else {
        alert(resp.message);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const attemptUninstall = async () => {
    const confirmation = window.confirm("Neural Uplink Deactivation Protocol Initiated.\n\nApakah anda yakin tidak peduli lagi dengan kesehatan anda dan ingin kembali ke siklus duduk 8 jam tanpa henti?");
    if (confirmation) {
       const finalWarn = window.confirm("Keangkuhan manusia memang tidak ada batasnya...\nSaya akan menghapus jejak, hapus .msi manual melalui Control Panel.");
       if (finalWarn) await invoke("quit_app");
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const pageTransition = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, scale: 0.95 },
    transition: { duration: 0.4 }
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#050505] text-system-text font-sans selection:bg-system-accent/30 selection:text-white">
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
                    <input 
                      type="time" required
                      className="w-full bg-[#030303] border border-system-border/80 rounded-xl px-4 py-4 outline-none focus:border-system-accent/80 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)] transition-all text-white font-mono text-lg"
                      style={{ colorScheme: 'dark' }}
                      value={bedTime} onChange={(e) => setBedTime(e.target.value)}
                    />
                  </div>
                  <div className="w-1/2 group">
                    <label className="block text-[10px] uppercase tracking-[0.2em] text-gray-400 mb-2 font-mono group-focus-within:text-system-accent transition-colors">Wake Time</label>
                    <input 
                      type="time" required
                      className="w-full bg-[#030303] border border-system-border/80 rounded-xl px-4 py-4 outline-none focus:border-system-accent/80 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)] transition-all text-white font-mono text-lg"
                      style={{ colorScheme: 'dark' }}
                      value={wakeTime} onChange={(e) => setWakeTime(e.target.value)}
                    />
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

             {activeHud === "NONE" ? (
               <motion.div 
                 initial={{ opacity: 0, scale: 0.95 }}
                 animate={{ opacity: 1, scale: 1 }}
                 className="flex flex-col items-center"
               >
                 <div className="relative group mb-12">
                   <div className="absolute inset-0 bg-system-accent opacity-20 blur-3xl group-hover:opacity-30 transition-opacity rounded-full" />
                   <div className="w-[400px] h-[400px] rounded-full border border-system-border/50 bg-black/40 flex flex-col items-center justify-center relative overflow-hidden backdrop-blur-xl shadow-[0_0_50px_rgba(0,0,0,0.8)]">
                     <div className="absolute inset-0 border-[4px] border-system-border rounded-full border-t-system-accent opacity-30 animate-spin-slow" />
                     <div className="absolute inset-2 border-[1px] border-system-border rounded-full border-b-system-accent opacity-20 animate-spin-reverse-slow" />
                     <div className="absolute inset-4 border-[2px] border-dotted border-white/10 rounded-full" />
                     <div className="flex flex-col items-center z-10 relative">
                       <Clock className="w-8 h-8 text-system-accent mb-4 opacity-80 shadow-[0_0_15px_rgba(239,68,68,0.5)]" />
                       <div className="text-[100px] font-mono font-bold leading-none tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-600 drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
                         {formatTime(activeTime)}
                       </div>
                       <div className="text-xs tracking-[0.4em] text-system-accent uppercase mt-2 font-mono ml-2">Active Session</div>
                     </div>
                   </div>
                 </div>
                 <div className="flex gap-4 mb-8">
                   <button 
                     onClick={() => setActiveHud("HISTORY")}
                     className="group flex-1 relative overflow-hidden rounded-xl bg-black/60 border border-system-border/50 p-4 hover:border-system-accent/50 transition-all duration-300 shadow-2xl"
                   >
                     <div className="absolute inset-0 bg-gradient-to-br from-system-accent/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                     <div className="relative z-10 flex flex-col items-center gap-3">
                       <div className="p-3 bg-black/80 rounded-xl border border-system-border group-hover:border-system-accent/30 group-hover:scale-110 transition-transform duration-500">
                         <ActivitySquare className="w-6 h-6 text-gray-300 group-hover:text-system-accent transition-colors" />
                       </div>
                       <div className="text-center">
                         <div className="text-sm font-bold tracking-wider text-gray-200 mb-1 group-hover:text-white">TRACK RECORD</div>
                         <div className="text-[10px] text-gray-500 uppercase tracking-widest font-mono group-hover:text-system-accent/70 transition-colors">Historical Logs</div>
                       </div>
                     </div>
                   </button>
                   <button 
                     onClick={() => setActiveHud("WAKATIME")}
                     className="group flex-1 relative overflow-hidden rounded-xl bg-black/60 border border-system-border/50 p-4 hover:border-blue-500/50 transition-all duration-300 shadow-2xl"
                   >
                     <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                     <div className="relative z-10 flex flex-col items-center gap-3">
                       <div className="p-3 bg-black/80 rounded-xl border border-system-border group-hover:border-blue-500/30 group-hover:scale-110 transition-transform duration-500">
                         <PieChart className="w-6 h-6 text-gray-300 group-hover:text-blue-400 transition-colors" />
                       </div>
                       <div className="text-center">
                         <div className="text-sm font-bold tracking-wider text-gray-200 mb-1 group-hover:text-white">APP USAGE</div>
                         <div className="text-[10px] text-gray-500 uppercase tracking-widest font-mono group-hover:text-blue-400/70 transition-colors">Digital Analytics</div>
                       </div>
                     </div>
                   </button>
                 </div>
               </motion.div>
             ) : activeHud === "HISTORY" ? (
               <motion.div 
                 initial={{ opacity: 0, y: 20 }} 
                 animate={{ opacity: 1, y: 0 }} 
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
                         const heightPercent = Math.min((day.active_seconds / 43200) * 100, 100);
                         const dateObj = new Date(day.date);
                         const isToday = i === usageHistory.length - 1;
                         return (
                           <div key={i} className="flex flex-col items-center flex-1 group">
                             <div className="w-full flex justify-center h-[180px] items-end relative">
                               <motion.div 
                                 initial={{ height: 0 }}
                                 animate={{ height: `${heightPercent}%` }}
                                 className={`w-8 rounded-t-sm ${isToday ? 'bg-system-accent/80' : 'bg-[#222] group-hover:bg-[#333]'} relative overflow-hidden`}
                               />
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
             ) : (
               <motion.div 
                 initial={{ opacity: 0, scale: 0.95 }}
                 animate={{ opacity: 1, scale: 1 }}
                 className="flex flex-col w-[700px] h-[450px] bg-[#0a0a0a] border border-blue-900/40 rounded-2xl relative overflow-hidden shadow-[0_0_50px_rgba(59,130,246,0.1)] p-8"
               >
                 <div className="absolute top-4 left-6 flex items-center gap-2">
                   <PieChart className="w-4 h-4 text-blue-500" />
                   <h2 className="text-xs font-mono uppercase tracking-widest text-gray-300">Wakatime Application Tracking</h2>
                 </div>
                 <div className="w-full h-full mt-4 flex pt-4 text-xs font-mono">
                   {appHistory.length === 0 ? (
                     <p className="text-gray-500 font-mono text-sm w-full text-center mt-20">Monitoring Active Applications...</p>
                   ) : (
                     <ResponsiveContainer width="100%" height="85%">
                        <BarChart layout="vertical" data={appHistory} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                          <XAxis type="number" hide />
                          <YAxis dataKey="app_name" type="category" width={150} tick={{fill: '#9ca3af', fontSize: 10}} axisLine={false} tickLine={false} />
                          <Tooltip 
                            cursor={{fill: 'rgba(59, 130, 246, 0.1)'}} 
                            contentStyle={{ backgroundColor: '#000', borderColor: '#1e3a8a', fontFamily: 'monospace' }}
                            formatter={(value: any) => [`${Math.floor(value / 60)}m ${value%60}s`, 'Usage Duration']}
                          />
                          <Bar dataKey="active_seconds" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                            {appHistory.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={index === 0 ? '#ef4444' : index === 1 ? '#eab308' : '#3b82f6'} />
                            ))}
                          </Bar>
                        </BarChart>
                     </ResponsiveContainer>
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
                  onClick={() => setActiveHud(activeHud === "NONE" ? "HISTORY" : "NONE")}
                  className="group flex flex-col items-center justify-center bg-[#0a0a0a] border border-system-border hover:border-system-accent/50 rounded-lg p-3 px-6 transition-all active:scale-95 cursor-pointer relative overflow-hidden shadow-[0_0_15px_rgba(0,0,0,0.5)]"
                >
                  <div className="absolute inset-0 bg-system-accent/5 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                  <BarChart3 className={`w-5 h-5 mb-2 transition-colors ${activeHud !== "NONE" ? 'text-system-accent' : 'text-gray-400 group-hover:text-white'}`} />
                  <span className="text-[10px] text-gray-400 group-hover:text-white uppercase tracking-widest mt-1 relative z-10">
                    {activeHud !== "NONE" ? 'Close HUD' : 'Digital HUD'}
                  </span>
                </button>
               <button 
                 onClick={toggleScheduler}
                 className={`group flex flex-col items-center justify-center bg-[#0a0a0a] border ${isSchedulerActive ? 'border-green-900/50 hover:border-green-500/50' : 'border-yellow-900/50 hover:border-yellow-500/50'} rounded-lg p-3 px-6 transition-all active:scale-95 cursor-pointer relative overflow-hidden shadow-[0_0_15px_rgba(0,0,0,0.5)]`}
               >
                 <div className="absolute inset-0 bg-system-accent/5 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                 {isSchedulerActive ? <Pause className="w-5 h-5 mb-2 text-green-400" /> : <Play className="w-5 h-5 mb-2 text-yellow-400" />}
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
                <div className="flex flex-col items-center">
                  <button onClick={attemptUninstall} className="text-red-900 hover:text-red-500 transition-colors p-2" title="Unlink System">
                    <Skull className="w-5 h-5" />
                  </button>
                  <span className="text-[10px] text-gray-700 uppercase tracking-widest mt-1">Unlink</span>
                </div>
             </div>
             <p className="fixed bottom-6 text-[10px] text-gray-700 font-mono uppercase tracking-widest text-center">
               System Dormant. Global hooks engaged.<br/>[Alt+X to Hibernate]
             </p>
          </motion.div>
        )}

        {appState === "LOCKDOWN" && (
          <motion.div key="lockdown" {...pageTransition} className="absolute inset-0 flex flex-col items-center justify-center bg-[#000] z-50 overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.1),transparent)] animate-pulse" />
            
            {/* Immersive HUD Borders */}
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-50" />
            <div className="absolute bottom-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-50" />
            
            <div className="absolute top-8 left-8 flex items-center gap-3 text-system-accent font-mono text-[10px] tracking-[0.3em] animate-pulse">
              <AlertTriangle className="w-4 h-4" />
              BIOLOGICAL BOUNDARY EXCEEDED
            </div>
            
            <div className="relative z-10 flex flex-col items-center max-w-2xl px-8 text-center">
              <ShieldAlert className="w-24 h-24 text-system-accent mb-8 drop-shadow-[0_0_20px_rgba(239,68,68,1)] animate-pulse" />
              
              <h1 className="text-5xl font-mono font-bold text-white mb-6 tracking-tighter uppercase drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
                Step Away From The Screen
              </h1>
              
              <div className="space-y-4 mb-12">
                <p className="text-system-accent font-mono text-lg tracking-widest uppercase">
                  System Halted.
                </p>
                <p className="text-gray-400 font-mono text-sm leading-relaxed max-w-xl mx-auto">
                  Kesehatan neurologis anda mencapai titik rentan. Sistem menuntut anda untuk membasuh muka, melihat sejauh 20 meter ke luar jendela, dan beristirahat.
                </p>
                {aiMessage && (
                  <div className="bg-red-900/10 border-l-4 border-red-500 p-4 mt-4 italic text-xs text-red-200 font-serif">
                    " {aiMessage} "
                  </div>
                )}
              </div>

              {showBypassInput ? (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col gap-4 w-full max-w-md bg-black/60 p-6 rounded-lg border border-red-900/50 backdrop-blur-md"
                >
                  <p className="text-xs text-system-accent font-mono tracking-widest uppercase mb-2 flex items-center justify-center gap-2">
                    <MessageSquare className="w-4 h-4" /> Log Emergency Override
                  </p>
                  <input 
                    autoFocus
                    type="text"
                    placeholder="Mengapa anda perlu mengorbankan kesehatan?"
                    value={emergencyReason}
                    onChange={(e) => setEmergencyReason(e.target.value)}
                    className="bg-black/80 border border-system-border rounded px-4 py-3 text-sm font-mono text-white focus:outline-none focus:border-system-accent w-full transition-colors font-mono"
                  />
                  <div className="flex gap-4">
                    <input 
                      type="number"
                      placeholder="Mins"
                      value={emergencyDuration}
                      onChange={(e) => setEmergencyDuration(e.target.value)}
                      className="bg-black/80 border border-system-border rounded px-4 py-3 text-sm font-mono text-white focus:outline-none focus:border-system-accent w-24 text-center"
                    />
                    <input 
                      type="text"
                      placeholder="Protocol Signature (I sacrifice my physical health to bypass)"
                      value={bypassInput}
                      onChange={(e) => setBypassInput(e.target.value)}
                      className="flex-1 bg-black/80 border border-system-border rounded px-4 py-3 text-[10px] font-mono text-white focus:outline-none focus:border-system-accent w-full transition-colors font-mono"
                    />
                  </div>
                  <div className="flex gap-2 w-full mt-2">
                    <button 
                      onClick={attemptBypass}
                      className="flex-1 text-[10px] font-mono bg-system-accent/20 text-system-accent tracking-widest uppercase px-4 py-3 rounded hover:bg-system-accent hover:text-black transition-colors"
                    >
                      EXECUTE PROTOCOL
                    </button>
                    <button 
                      onClick={() => setShowBypassInput(false)}
                      className="text-[10px] font-mono text-gray-500 tracking-widest uppercase px-4 py-3 rounded border border-gray-800 hover:bg-gray-800 transition-colors"
                    >
                      CANCEL
                    </button>
                  </div>
                </motion.div>
              ) : (
                <button 
                  onClick={() => setShowBypassInput(true)} 
                  className="text-xs font-mono text-gray-600 hover:text-system-accent tracking-widest uppercase transition-colors underline decoration-gray-800 underline-offset-4"
                >
                   Initiate Emergency Protocol
                </button>
              )}
            </div>
            
            <div className="absolute bottom-8 right-8 text-system-accent/30 font-mono text-[10px] tracking-widest opacity-50">
              NAPASDULU // OVERSEER-V1.2.0
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
