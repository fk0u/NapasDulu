import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert, Terminal, User, Activity, ActivitySquare, BarChart3, Clock, Play, Pause, PieChart, AlertTriangle, MessageSquare, Skull, Globe, Info } from "lucide-react";
import { audioSynth } from "./lib/audio";
import { generateHealthProtocol, AIProtocolResponse, evaluateEmergencyExcuse } from "./lib/gemini";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import idLocale from "./locales/id.json";
import enLocale from "./locales/en.json";

type AppState = "ONBOARDING" | "DIAGNOSTIC" | "IDLE" | "LOCKDOWN" | "SETTINGS";

interface UsageDay {
  date: string;
  active_seconds: number;
}

interface AppUsageStat {
  app_name: string;
  active_seconds: number;
}

interface ToastData {
  id: number;
  message: string;
  type: 'error' | 'success' | 'warning';
}

function App() {
  const [lang, setLang] = useState<"ID" | "EN">("ID");
  const t = (key: keyof typeof idLocale): string => lang === "ID" ? idLocale[key as keyof typeof idLocale] : enLocale[key as keyof typeof enLocale];

  const [toasts, setToasts] = useState<ToastData[]>([]);
  const showToast = (message: string, type: 'error' | 'success' | 'warning' = 'warning') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    if (type === 'error' || type === 'warning') audioSynth.playSciFiAlarm();
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };
  const [appState, setAppState] = useState<AppState>("IDLE");
  const [countdown, setCountdown] = useState(600); // 10 minutes
  const [sessionLimit, setSessionLimit] = useState(0);
  
  // User Data
  const [userName, setUserName] = useState(() => localStorage.getItem("userName") || "");
  const [onboardingName, setOnboardingName] = useState("");
  const [onboardingAge, setOnboardingAge] = useState("");
  const [onboardingBp, setOnboardingBp] = useState("");
  const [onboardingWeight, setOnboardingWeight] = useState("");
  
  const [aiLoading, setAiLoading] = useState(false);
  const [aiProtocol, setAiProtocol] = useState<AIProtocolResponse | null>(() => {
    const saved = localStorage.getItem("aiProtocol");
    return saved ? JSON.parse(saved) : null;
  });

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
        if (appState !== 'LOCKDOWN') {
          invoke('quit_app');
        } else {
          showToast('Lockdown active. Alt+X disabled.', 'error');
        }
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
  }, [userName, warning, appState]);

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

  // Run heavy DB fetches ONLY on mount or HUD toggle
  useEffect(() => {
    if (appState === "IDLE") {
      const fetchHeavyStats = async () => {
        try {
          const res: any = await invoke("get_stats");
          setStats(res);
          setActiveTime(res.active_time);
          setSessionLimit(res.session_limit);
          
          if (activeHud === "HISTORY") {
              const hist: UsageDay[] = await invoke("get_usage_history");
              setUsageHistory(hist);
          } else if (activeHud === "WAKATIME") {
              const apps: AppUsageStat[] = await invoke("get_app_usage_stats");
              setAppHistory(apps);
          }
        } catch(e) {}
      };
      fetchHeavyStats();
    }
  }, [appState, activeHud]);

  // Ultra-lightweight 1000ms polling (Memory-only)
  useEffect(() => {
    let interval: number;
    if (appState === "IDLE") {
      audioSynth.playBootSequence();
      interval = window.setInterval(async () => {
        try {
          const activeSeconds: number = await invoke("get_active_time");
          setActiveTime(activeSeconds);
          
          // Use latest session limit from state
          setSessionLimit((currentLimit) => {
            if (activeSeconds >= currentLimit - 60) {
                setWarning(true);
            } else {
                setWarning(false);
            }
            return currentLimit;
          });
        } catch(e) {}
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [appState]);

  useEffect(() => {
    let timer: number;
    if (appState === "LOCKDOWN") {
      const appWindow = getCurrentWindow();
      appWindow.show();
      appWindow.unminimize();
      appWindow.setFullscreen(true);
      appWindow.setAlwaysOnTop(true);
      appWindow.setDecorations(false);
      
      if(countdown > 0) {
        timer = window.setInterval(() => {
          setCountdown((prev) => prev - 1);
        }, 1000);
      } else {
        setAppState("IDLE");
        const appWindow = getCurrentWindow();
        appWindow.setAlwaysOnTop(false);
        appWindow.setFullscreen(false);
        appWindow.setDecorations(true);
      }
    }
    return () => clearInterval(timer);
  }, [appState, countdown]);

  const handleOnboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onboardingName.trim() || !onboardingAge || !onboardingBp || !onboardingWeight || !bedTime || !wakeTime) {
        showToast(t("toast_onboarding_error"), "error");
        return;
    }
    
    setAiLoading(true);
    let protocolObj: AIProtocolResponse;
    
    try {
        const protocol = await generateHealthProtocol({
          name: onboardingName,
          age: onboardingAge,
          bloodPressure: onboardingBp,
          weight: onboardingWeight,
          bedtime: bedTime,
          wakeTime: wakeTime
        }, lang);
        
        await invoke("set_dynamic_limit", { limitSeconds: protocol.workDurationSeconds });
        localStorage.setItem("sessionLimitSeconds", protocol.workDurationSeconds.toString());
        protocolObj = protocol;
    } catch (err) {
        protocolObj = {
            workDurationSeconds: 2700,
            restDurationSeconds: 300,
            sarcasticGreeting: "AI Link Failed. Running generic meat-sack protocol.",
            lockdownMessage: "Get away from the screen.",
            emergencyBypassWarning: "Are you sure you want to shorten your lifespan?",
            healthVerdict: "Fail-safe engaged.",
            uninstallWarningMessage: "Is your future so meaningless that you wish to delete your only life support?",
            healthTips: ["Stand up occasionally.", "Drink plain water.", "Sleep earlier."],
            explanationPhysicallyActive: "Typing at 100 WPM is not a sport. Move your leg muscles."
        };
        showToast("Gemini AI Uplink Failed. Using defaults.", "error");
    }

    localStorage.setItem("userName", onboardingName.trim());
    localStorage.setItem("userAge", onboardingAge);
    localStorage.setItem("userBp", onboardingBp);
    localStorage.setItem("userWeight", onboardingWeight);
    localStorage.setItem("userBed", bedTime);
    localStorage.setItem("userWake", wakeTime);
    
    localStorage.setItem("aiProtocol", JSON.stringify(protocolObj));
    setUserName(onboardingName.trim());
    setAiProtocol(protocolObj);
    
    // Set rest duration globally if backend supports it, for now we will store it and use locally or send to backend
    setCountdown(protocolObj.restDurationSeconds || 600);
    
    setAiLoading(false);
    setAppState("DIAGNOSTIC");
  };

  const openSettings = () => {
    setOnboardingName(localStorage.getItem("userName") || "");
    setOnboardingAge(localStorage.getItem("userAge") || "");
    setOnboardingWeight(localStorage.getItem("userWeight") || "");
    setOnboardingBp(localStorage.getItem("userBp") || "");
    setBedTime(localStorage.getItem("userBed") || "");
    setWakeTime(localStorage.getItem("userWake") || "");
    setAppState("SETTINGS");
  };

  const handleSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAiLoading(true);

    const protocolObj = await generateHealthProtocol(
      { name: onboardingName, age: onboardingAge, bloodPressure: onboardingBp, weight: onboardingWeight, bedtime: bedTime, wakeTime: wakeTime },
      lang
    );

    localStorage.setItem("userName", onboardingName.trim());
    localStorage.setItem("userAge", onboardingAge);
    localStorage.setItem("userBp", onboardingBp);
    localStorage.setItem("userWeight", onboardingWeight);
    localStorage.setItem("userBed", bedTime);
    localStorage.setItem("userWake", wakeTime);
    
    localStorage.setItem("aiProtocol", JSON.stringify(protocolObj));
    setUserName(onboardingName.trim());
    setAiProtocol(protocolObj);
    localStorage.setItem("sessionLimitSeconds", protocolObj.workDurationSeconds.toString());
    await invoke("set_dynamic_limit", { limitSeconds: protocolObj.workDurationSeconds });

    setAiLoading(false);
    showToast("Profile updated. Protocol Re-calibrated.", "success");
    setAppState("IDLE");
  };

  const handleDiagnosticSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res: any = await invoke("log_morning_diagnostic", { sleepHours: 8.0, wakeHours: 0.0, exercised });
      if (res.success) setAppState("IDLE");
    } catch (err) {
      setAppState("IDLE");
    }
  };

  const simulateLockdown = async () => {
    try {
      await invoke("simulate_lockdown");
      showToast(lang === 'ID' ? "Simulasi Lockdown Dimulai" : "Lockdown Simulation Initiated", "warning");
    } catch (err) {
      showToast("Simulation failed", "error");
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
    if (bypassInput !== t("signature_text")) {
      showToast(t("toast_invalid_signature"), "error");
      return;
    }
    
    if (emergencyReason.trim().length < 10) {
      showToast(t("toast_onboarding_error"), "warning");
      return;
    }

    // Evaluate using Sarcastic AI
    setAiLoading(true);
    let evaluationRes;
    try {
      evaluationRes = await evaluateEmergencyExcuse(
        emergencyReason,
        parseInt(emergencyDuration) || 5,
        {
          name: userName,
          age: localStorage.getItem("userAge") || "25",
          bloodPressure: localStorage.getItem("userBp") || "120/80",
          weight: localStorage.getItem("userWeight") || "70",
          bedtime: localStorage.getItem("userBed") || "23:00",
          wakeTime: localStorage.getItem("userWake") || "07:00"
        },
        lang
      );
    } catch(err) {
      evaluationRes = {
        approved: true,
        aiResponse: "Fallback: AI evaluation failed.",
        grantedSeconds: parseInt(emergencyDuration) * 60 || 300
      };
    }
    setAiLoading(false);

    if (!evaluationRes.approved || evaluationRes.grantedSeconds <= 0) {
      showToast(evaluationRes.aiResponse, "error");
      setEmergencyReason("");
      setBypassInput("");
      return; // Denied by AI
    }
    
    // Partially or fully approved
    showToast(evaluationRes.aiResponse, "warning");

    try {
      const resp: any = await invoke("attempt_bypass", { logs: `EMERGENCY [${evaluationRes.grantedSeconds}s]: ${emergencyReason} | AI: ${evaluationRes.aiResponse}` });
      if (resp.success) {
        await invoke("set_dynamic_limit", { limitSeconds: evaluationRes.grantedSeconds });
        localStorage.setItem("sessionLimitSeconds", evaluationRes.grantedSeconds.toString());

        setBypassInput("");
        setEmergencyReason("");
        setShowBypassInput(false);
        setAppState("IDLE");
      } else {
        showToast("Backend rejection: " + resp.message, "error");
      }
    } catch(err) {
      showToast("Unknown error executing unlock", "error");
    }
  };

  const attemptUninstall = async () => {
    const warningText = aiProtocol?.uninstallWarningMessage || t("toast_unlink_warning");
    showToast(warningText, "error");
    const confirmation = window.confirm(warningText);
    if (confirmation) {
       showToast(t("toast_unlinked"), "error");
       setTimeout(async () => {
         await invoke("quit_app");
       }, 2000);
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
    <div className="relative w-full h-full overflow-x-hidden overflow-y-auto bg-[#050505] text-system-text font-sans selection:bg-system-accent/30 selection:text-white pb-10">
      {/* Toast Notification Container */}
      <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border backdrop-blur-xl shadow-2xl max-w-sm ${
                toast.type === "error" ? "bg-red-950/80 border-red-500/50 text-red-100" :
                toast.type === "warning" ? "bg-yellow-950/80 border-yellow-500/50 text-yellow-100" :
                "bg-blue-950/80 border-blue-500/50 text-blue-100"
              }`}
            >
              <div className="mt-0.5">
                {toast.type === "error" ? <Skull className="w-4 h-4" /> : toast.type === "warning" ? <AlertTriangle className="w-4 h-4" /> : <Info className="w-4 h-4" />}
              </div>
              <p className="text-sm font-mono leading-relaxed">{toast.message}</p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {warning && appState === "IDLE" && (
        <motion.div 
          animate={{ opacity: [0, 0.2, 0, 0.4, 0] }}
          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
          className="pointer-events-none fixed inset-0 bg-red-600/20 mix-blend-screen z-[50]"
        />
      )}

      {/* Top Navigation Bar */}
      {appState === "IDLE" && (
        <motion.div 
          initial={{ y: -50 }} animate={{ y: 0 }}
          className="fixed top-0 inset-x-0 h-16 bg-black/40 backdrop-blur-xl border-b border-system-border/30 z-[60] flex items-center justify-between px-8"
        >
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-system-accent animate-pulse shadow-[0_0_8px_rgba(239,68,68,1)]" />
              <span className="text-[10px] font-mono tracking-widest text-white uppercase">{t("status_system")}: {t("status_active")}</span>
            </div>
            <div className="h-4 w-[1px] bg-system-border/50" />
            <div className="flex flex-col gap-1 group cursor-help min-w-[150px]">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-gray-500 group-hover:text-system-accent transition-colors" />
                <span className="text-[10px] font-mono tracking-widest text-gray-400">
                  {t("next_lockdown")}: <span className="text-white font-bold">{formatTime(Math.max(0, sessionLimit - activeTime))}</span>
                </span>
              </div>
              <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  className={`h-full ${warning ? 'bg-system-accent' : 'bg-blue-500'}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (activeTime / sessionLimit) * 100)}%` }}
                  transition={{ duration: 1 }}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={() => showToast(aiProtocol?.healthVerdict || "System Optimal", "success")}
              className="px-4 py-2 rounded-xl border border-white/5 bg-white/[0.03] hover:bg-white/[0.08] hover:border-system-accent/30 transition-all flex items-center gap-2 group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-system-accent/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <Activity className="w-3.5 h-3.5 text-system-accent group-hover:scale-110 transition-transform" />
              <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-gray-400 group-hover:text-white transition-colors relative z-10">{t("profile")}</span>
            </button>
            <button 
              onClick={openSettings}
              className="px-4 py-2 rounded-xl border border-white/5 bg-white/[0.03] hover:bg-white/[0.08] hover:border-blue-500/30 transition-all flex items-center gap-2 group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <Terminal className="w-3.5 h-3.5 text-gray-400 group-hover:text-blue-400 transition-transform" />
              <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-gray-400 group-hover:text-white transition-colors relative z-10">{t("settings")}</span>
            </button>
            <div className="h-8 w-[1px] bg-white/10 mx-2" />
            <button 
              onClick={simulateLockdown}
              className="px-5 py-2 rounded-xl bg-gradient-to-b from-system-accent to-red-800 text-white hover:from-red-500 hover:to-red-700 transition-all flex items-center gap-2 group shadow-[0_0_20px_rgba(239,68,68,0.2)] hover:shadow-[0_0_30px_rgba(239,68,68,0.4)] active:scale-95"
            >
              <Skull className="w-3.5 h-3.5 group-hover:rotate-12 transition-transform" />
              <span className="text-[9px] font-bold uppercase tracking-[0.2em]">{t("simulate_lockdown_btn")}</span>
            </button>
          </div>
        </motion.div>
      )}

      {/* Language Toggle */}
      <div className="fixed bottom-6 right-6 z-40 bg-black/50 backdrop-blur-md rounded-full border border-gray-800 p-1 flex items-center">
         <Globe className="w-4 h-4 text-gray-500 ml-2" />
         <button onClick={() => setLang("EN")} className={`px-3 py-1 text-xs font-mono rounded-full transition-colors ${lang === "EN" ? "bg-system-accent text-black" : "text-gray-400 hover:text-white"}`}>EN</button>
         <button onClick={() => setLang("ID")} className={`px-3 py-1 text-xs font-mono rounded-full transition-colors ${lang === "ID" ? "bg-system-accent text-black" : "text-gray-400 hover:text-white"}`}>ID</button>
      </div>

      <AnimatePresence mode="wait">
        {appState === "ONBOARDING" && (
          <motion.div key="onboarding" {...pageTransition} className="flex flex-col w-full h-full items-center justify-center relative">
            <div className="absolute inset-0 bg-gradient-to-br from-system-accent/5 to-transparent pointer-events-none" />
            <div className="p-8 md:p-10 border border-system-border/60 bg-[#070707]/80 backdrop-blur-2xl rounded-3xl w-[90%] max-w-lg shadow-[0_20px_80px_rgba(239,68,68,0.15)] flex flex-col items-center relative overflow-hidden group">
              <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-system-accent/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
              <div className="bg-system-accent/10 border border-system-accent/20 p-5 rounded-2xl mb-8 shadow-[0_0_30px_rgba(239,68,68,0.15)]">
                <Terminal className="w-12 h-12 text-system-accent drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
              </div>
              <h1 className="text-3xl font-bold mb-3 tracking-widest font-mono text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400 text-center">{t("onboarding_title")}</h1>
              <p className="text-gray-500 text-xs mb-10 text-center uppercase tracking-[0.2em] w-full">Identify biological operator</p>
              <form onSubmit={handleOnboardingSubmit} className="w-full flex flex-col gap-6">
                <div>
                  <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-system-accent transition-colors duration-300" />
                    <input 
                      type="text" autoFocus required
                      placeholder={t("onboarding_name")}
                      className="w-full bg-[#030303] border border-system-border/80 rounded-xl pl-12 pr-4 py-4 outline-none focus:border-system-accent/80 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)] transition-all text-white font-mono placeholder:text-gray-700 placeholder:text-sm"
                      value={onboardingName} onChange={(e) => setOnboardingName(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-1/3 group">
                    <label className="block text-[9px] uppercase tracking-[0.2em] text-gray-500 mb-2 font-mono group-focus-within:text-system-accent transition-colors">{t("onboarding_age")}</label>
                    <input 
                      type="number" required placeholder="18"
                      className="w-full bg-[#030303] border border-system-border/80 rounded-xl px-4 py-3 outline-none focus:border-system-accent/80 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)] transition-all text-white font-mono placeholder:text-gray-700 text-center"
                      value={onboardingAge} onChange={(e) => setOnboardingAge(e.target.value)}
                    />
                  </div>
                  <div className="w-1/3 group">
                    <label className="block text-[9px] uppercase tracking-[0.2em] text-gray-500 mb-2 font-mono group-focus-within:text-system-accent transition-colors">{t("onboarding_weight")}</label>
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
                <div className="flex gap-4">
                  <div className="w-1/2 group">
                    <label className="block text-[10px] uppercase tracking-[0.2em] text-gray-400 mb-2 font-mono group-focus-within:text-system-accent transition-colors">{t("onboarding_sleep")}</label>
                    <input 
                      type="time" required
                      className="w-full bg-[#030303] border border-system-border/80 rounded-xl px-4 py-4 outline-none focus:border-system-accent/80 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)] transition-all text-white font-mono text-lg"
                      style={{ colorScheme: 'dark' }}
                      value={bedTime} onChange={(e) => setBedTime(e.target.value)}
                    />
                  </div>
                  <div className="w-1/2 group">
                    <label className="block text-[10px] uppercase tracking-[0.2em] text-gray-400 mb-2 font-mono group-focus-within:text-system-accent transition-colors">{t("onboarding_wake")}</label>
                    <input 
                      type="time" required
                      className="w-full bg-[#030303] border border-system-border/80 rounded-xl px-4 py-4 outline-none focus:border-system-accent/80 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)] transition-all text-white font-mono text-lg"
                      style={{ colorScheme: 'dark' }}
                      value={wakeTime} onChange={(e) => setWakeTime(e.target.value)}
                    />
                  </div>
                </div>
                <button disabled={aiLoading} type="submit" className="relative w-full mt-4 bg-gradient-to-b from-system-accent to-red-700 text-white font-bold rounded-xl py-4 hover:to-red-600 transition-all active:scale-[0.98] shadow-[0_0_20px_rgba(239,68,68,0.3)] hover:shadow-[0_0_30px_rgba(239,68,68,0.5)] cursor-pointer uppercase tracking-widest font-mono overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed">
                  <span className="relative z-10 drop-shadow-md">{aiLoading ? "ANALYZING BIOMETRICS..." : t("onboarding_start")}</span>
                  <div className="absolute inset-0 bg-white/20 translate-y-full hover:translate-y-0 transition-transform duration-300 ease-out" />
                </button>
              </form>
            </div>
          </motion.div>
        )}

        {appState === "DIAGNOSTIC" && (
          <motion.div key="diagnostic" {...pageTransition} className="flex flex-col w-full h-full items-center justify-center relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.03)_0%,transparent_100%)] pointer-events-none" />
            <div className="p-8 md:p-10 border border-system-border/60 bg-[#070707]/80 backdrop-blur-2xl rounded-3xl w-[90%] max-w-lg shadow-[0_20px_80px_rgba(0,0,0,0.8)] relative overflow-hidden group">
              <div className="absolute bottom-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-system-accent/40 to-transparent" />
              <div className="flex items-center gap-4 mb-10 border-b border-system-border/40 pb-6">
                <div className="bg-system-accent/10 p-3 rounded-xl border border-system-accent/20">
                  <ActivitySquare className="w-7 h-7 text-system-accent shadow-system-accent drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
                </div>
                <div>
                  <h1 className="text-xl md:text-2xl font-bold tracking-[0.15em] font-mono text-white">{t("diagnostic_mode")}</h1>
                  <p className="text-gray-500 text-[10px] mt-1 uppercase font-mono tracking-widest">Auth: <span className="text-system-accent/90">[{userName}]</span></p>
                </div>
              </div>
              <form onSubmit={handleDiagnosticSubmit} className="space-y-8">
                {/* Checkbox with custom tooltip */}
                <div className="relative group/tooltip">
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
                    <span className="text-xs font-semibold font-mono text-gray-300 uppercase tracking-widest group-hover:text-white transition-colors">{t("physically_active_today")}</span>
                  </label>
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover/tooltip:opacity-100 transition-opacity bg-system-accent text-black text-[10px] font-mono p-2 rounded w-48 text-center pointer-events-none z-50">
                    {aiProtocol?.explanationPhysicallyActive || t("physically_active_tooltip")}
                  </div>
                </div>

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
             {aiProtocol && (
               <motion.div 
                 initial={{ opacity: 0, y: -20 }} 
                 animate={{ opacity: 1, y: 0 }} 
                 className="mb-8 p-5 w-[90%] max-w-2xl bg-gradient-to-r from-[#1a0505] to-black border border-system-accent/30 rounded-xl relative overflow-hidden group shadow-[0_0_30px_rgba(239,68,68,0.1)] flex flex-col md:flex-row gap-4"
               >
                 <div className="absolute top-0 left-0 w-1 h-full bg-system-accent shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
                 
                 <div className="flex-1">
                   <h3 className="text-[10px] text-system-accent font-mono tracking-[0.2em] uppercase mb-2 flex items-center gap-2">
                      <Terminal className="w-3 h-3" />
                      Neural_Uplink AI Directive
                   </h3>
                   <p className="text-xs md:text-sm text-gray-300 font-mono leading-relaxed italic border-l border-system-accent/20 pl-3">"{aiProtocol.sarcasticGreeting}"</p>
                   <p className="text-[10px] text-red-400/80 font-mono mt-3 uppercase">Verdict: {aiProtocol.healthVerdict}</p>
                 </div>
                 
                 {aiProtocol.healthTips && aiProtocol.healthTips.length > 0 && (
                   <div className="flex-1 border-t md:border-t-0 md:border-l border-system-border/40 pt-4 md:pt-0 md:pl-4">
                      <h4 className="text-[10px] text-gray-500 font-mono tracking-widest uppercase mb-2">Protocol Directives</h4>
                      <ul className="space-y-2">
                        {aiProtocol.healthTips.map((tip, idx) => (
                          <li key={idx} className="text-[10px] text-gray-400 font-mono leading-relaxed flex items-start gap-2">
                            <span className="text-system-accent opacity-50">▹</span> {tip}
                          </li>
                        ))}
                      </ul>
                   </div>
                 )}

                 <span className="absolute bottom-2 right-4 text-[9px] text-gray-600 font-mono z-10 bg-black/80 px-2 py-1 rounded">Boundaries: {(aiProtocol.workDurationSeconds / 60).toFixed(0)}m WORK / {(aiProtocol.restDurationSeconds / 60).toFixed(0)}m REST</span>
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
                       <div className="text-xs tracking-[0.4em] text-system-accent uppercase mt-2 font-mono ml-2">{t("active_session")}</div>
                     </div>
                   </div>
                 </div>
                 <div className="flex flex-col md:flex-row gap-4 mb-8 w-[90%] max-w-2xl">
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
                         <div className="text-sm font-bold tracking-wider text-gray-200 mb-1 group-hover:text-white">{t("track_record")}</div>
                         <div className="text-[10px] text-gray-500 uppercase tracking-widest font-mono group-hover:text-system-accent/70 transition-colors">{t("historical_logs")}</div>
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
                         <div className="text-sm font-bold tracking-wider text-gray-200 mb-1 group-hover:text-white">{t("app_usage")}</div>
                         <div className="text-[10px] text-gray-500 uppercase tracking-widest font-mono group-hover:text-blue-400/70 transition-colors">{t("digital_analytics")}</div>
                       </div>
                     </div>
                   </button>
                 </div>
               </motion.div>
             ) : activeHud === "HISTORY" ? (
               <motion.div 
                 initial={{ opacity: 0, y: 20 }} 
                 animate={{ opacity: 1, y: 0 }} 
                 className="flex flex-col items-center justify-center w-[90%] max-w-2xl h-[300px] bg-black/40 border border-system-border/50 rounded-xl p-6 backdrop-blur-md relative"
               >
                 <div className="absolute top-4 left-6 flex items-center gap-2">
                   <Clock className="w-4 h-4 text-system-accent" />
                   <h2 className="text-xs font-mono uppercase tracking-widest text-gray-300">{t("activity_history")}</h2>
                 </div>
                 <div className="w-full h-full flex items-end justify-between mt-8 gap-2">
                    {usageHistory.length === 0 ? (
                       <p className="text-gray-500 font-mono text-sm w-full text-center mb-10">{t("no_history")}</p>
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
                               {dateObj.toLocaleDateString(lang === 'ID' ? 'id-ID' : 'en-US', { weekday: 'short' })}
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
                 className="flex flex-col w-[90%] max-w-3xl h-[450px] bg-[#0a0a0a] border border-blue-900/40 rounded-2xl relative overflow-hidden shadow-[0_0_50px_rgba(59,130,246,0.1)] p-8"
               >
                 <div className="absolute top-4 left-6 flex items-center gap-2">
                   <PieChart className="w-4 h-4 text-blue-500" />
                   <h2 className="text-xs font-mono uppercase tracking-widest text-gray-300">{t("wakatime_tracking")}</h2>
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

             <div className="mt-12 flex flex-wrap items-center justify-center gap-6 md:gap-10 w-[90%] max-w-2xl border-t border-system-border/50 pt-8">
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
                   <button 
                     onClick={openSettings} 
                     className="group flex flex-col items-center justify-center p-2 rounded-lg transition-all active:scale-95 cursor-pointer relative overflow-hidden"
                     title="Access Profile & Settings"
                   >
                     <User className="w-5 h-5 text-gray-500 mb-2 group-hover:text-system-accent transition-colors" />
                     <span className="text-lg font-mono text-white tracking-widest truncate max-w-[120px]">{userName}</span>
                   </button>
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

        {appState === "SETTINGS" && (
          <motion.div key="settings" {...pageTransition} className="flex flex-col w-full h-full items-center justify-center relative">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-900/5 to-transparent pointer-events-none" />
            <div className="p-8 md:p-10 border border-system-border/60 bg-[#070707]/90 backdrop-blur-2xl rounded-3xl w-[90%] max-w-lg shadow-[0_20px_80px_rgba(59,130,246,0.1)] flex flex-col items-center relative overflow-hidden">
              <div className="bg-blue-900/20 border border-blue-500/30 p-4 rounded-2xl mb-6 shadow-[0_0_30px_rgba(59,130,246,0.15)]">
                <User className="w-8 h-8 text-blue-500" />
              </div>
              <h1 className="text-2xl font-bold mb-2 tracking-widest font-mono text-white text-center">BIOMETRIC CONFIG</h1>
              <p className="text-gray-500 text-[10px] mb-8 text-center uppercase tracking-[0.2em] w-full border-b border-system-border/50 pb-4">Update biological parameters to recalibrate AI restrictions.</p>
              
              <form onSubmit={handleSettingsSubmit} className="w-full flex flex-col gap-5">
                <div>
                  <label className="block text-[9px] uppercase tracking-[0.2em] text-gray-500 mb-1 font-mono">Operator Alias</label>
                  <input 
                    type="text" required
                    className="w-full bg-[#030303] border border-system-border/80 rounded-lg px-4 py-3 outline-none focus:border-blue-500/80 transition-all text-white font-mono text-sm"
                    value={onboardingName} onChange={(e) => setOnboardingName(e.target.value)}
                  />
                </div>
                <div className="flex gap-4">
                  <div className="w-1/3">
                    <label className="block text-[9px] uppercase tracking-[0.2em] text-gray-500 mb-1 font-mono">Age</label>
                    <input 
                      type="number" required
                      className="w-full bg-[#030303] border border-system-border/80 rounded-lg px-4 py-3 outline-none focus:border-blue-500/80 transition-all text-white font-mono text-sm text-center"
                      value={onboardingAge} onChange={(e) => setOnboardingAge(e.target.value)}
                    />
                  </div>
                  <div className="w-1/3">
                    <label className="block text-[9px] uppercase tracking-[0.2em] text-gray-500 mb-1 font-mono">Weight (kg)</label>
                    <input 
                      type="number" required
                      className="w-full bg-[#030303] border border-system-border/80 rounded-lg px-4 py-3 outline-none focus:border-blue-500/80 transition-all text-white font-mono text-sm text-center"
                      value={onboardingWeight} onChange={(e) => setOnboardingWeight(e.target.value)}
                    />
                  </div>
                  <div className="w-1/3">
                    <label className="block text-[9px] uppercase tracking-[0.2em] text-gray-500 mb-1 font-mono">BP</label>
                    <input 
                      type="text" required
                      className="w-full bg-[#030303] border border-system-border/80 rounded-lg px-4 py-3 outline-none focus:border-blue-500/80 transition-all text-white font-mono text-sm text-center"
                      value={onboardingBp} onChange={(e) => setOnboardingBp(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-1/2">
                    <label className="block text-[9px] uppercase tracking-[0.2em] text-gray-500 mb-1 font-mono">Expected Bedtime</label>
                    <input 
                      type="time" required
                      className="w-full bg-[#030303] border border-system-border/80 rounded-lg px-4 py-3 outline-none focus:border-blue-500/80 transition-all text-white font-mono text-sm"
                      style={{ colorScheme: 'dark' }}
                      value={bedTime} onChange={(e) => setBedTime(e.target.value)}
                    />
                  </div>
                  <div className="w-1/2">
                    <label className="block text-[9px] uppercase tracking-[0.2em] text-gray-500 mb-1 font-mono">Expected Wake Time</label>
                    <input 
                      type="time" required
                      className="w-full bg-[#030303] border border-system-border/80 rounded-lg px-4 py-3 outline-none focus:border-blue-500/80 transition-all text-white font-mono text-sm"
                      style={{ colorScheme: 'dark' }}
                      value={wakeTime} onChange={(e) => setWakeTime(e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="flex gap-3 mt-4">
                  <button 
                    type="button" 
                    onClick={() => setAppState("IDLE")} 
                    className="flex-1 bg-transparent border border-gray-800 text-gray-400 rounded-lg py-3 hover:bg-gray-900 transition-colors uppercase tracking-widest font-mono text-xs"
                  >
                    Cancel
                  </button>
                  <button 
                    disabled={aiLoading} 
                    type="submit" 
                    className="flex-[2] relative bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-lg py-3 hover:from-blue-500 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden uppercase tracking-widest font-mono text-xs font-bold"
                  >
                    <span className="relative z-10">{aiLoading ? "RE-CALIBRATING..." : "Save & Re-Evaluate"}</span>
                  </button>
                </div>
              </form>
            </div>
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
            
            <div className="relative z-10 flex flex-col items-center max-w-2xl px-8 text-center mt-10 md:mt-0 w-[90%]">
              <ShieldAlert className="w-24 h-24 text-system-accent mb-8 drop-shadow-[0_0_20px_rgba(239,68,68,1)] animate-pulse" />
              
              <h1 className="text-4xl md:text-5xl font-mono font-bold text-white mb-6 tracking-tighter uppercase drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
                {t("lockdown_title")}
              </h1>
              
              <div className="space-y-4 mb-12">
                <p className="text-system-accent font-mono text-lg tracking-widest uppercase">
                  {t("lockdown_subtitle")}
                </p>
                <p className="text-gray-400 font-mono text-sm leading-relaxed max-w-xl mx-auto">
                  {aiProtocol ? aiProtocol.lockdownMessage : t("lockdown_description")}
                </p>
                {aiProtocol && (
                  <div className="bg-red-900/10 border-l-4 border-red-500 p-4 mt-4 italic text-xs text-red-200 font-serif">
                    " {aiProtocol.healthVerdict} "
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
                    <MessageSquare className="w-4 h-4" /> {t("emergency_override")}
                  </p>
                  <input 
                    autoFocus
                    type="text"
                    placeholder={t("bypass_reason_placeholder")}
                    value={emergencyReason}
                    onChange={(e) => setEmergencyReason(e.target.value)}
                    className="bg-black/80 border border-system-border rounded px-4 py-3 text-sm font-mono text-white focus:outline-none focus:border-system-accent w-full transition-colors"
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
                      placeholder={t("signature_placeholder")}
                      value={bypassInput}
                      onChange={(e) => setBypassInput(e.target.value)}
                      className="flex-1 bg-black/80 border border-system-border rounded px-4 py-3 text-[10px] font-mono text-white focus:outline-none focus:border-system-accent w-full transition-colors"
                    />
                  </div>
                  <div className="flex flex-col md:flex-row gap-2 w-full mt-2">
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
                   {t("initiate_emergency")}
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



