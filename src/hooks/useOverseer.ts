import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { isEnabled as isAutostartEnabled } from "@tauri-apps/plugin-autostart";
import { audioSynth } from "../lib/audio";
import { overseerVoice } from "../lib/voice";
import { formatProcessName, calculateHealthScore } from "../lib/utils";
import { AIProtocolResponse, generateHealthProtocol } from "../lib/gemini";
import { FeedEvent } from "../components/ActivityFeed";

export type AppState = "ONBOARDING" | "DIAGNOSTIC" | "IDLE" | "LOCKDOWN" | "SETTINGS" | "HISTORY" | "ANALYTICS";

export function useOverseer(_lang: "ID" | "EN") {
  const [appState, setAppState] = useState<AppState>(() => {
    return localStorage.getItem("userName") ? "DIAGNOSTIC" : "ONBOARDING";
  });
  
  const [activeTime, setActiveTime] = useState(0);
  const [sessionLimit, setSessionLimit] = useState(0);
  const [countdown, setCountdown] = useState(600);
  const [warning, setWarning] = useState(false);
  const [stats, setStats] = useState({ bypass_count: 0, sleep_hours: 0, exercised: false });
  const [usageHistory, setUsageHistory] = useState<any[]>([]);
  const [appHistory, setAppHistory] = useState<any[]>([]);
  const [aiProtocol, setAiProtocol] = useState<AIProtocolResponse | null>(() => {
    const saved = localStorage.getItem("aiProtocol");
    return saved ? JSON.parse(saved) : null;
  });
  
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [autostart, setAutostart] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [healthScore, setHealthScore] = useState(100);
  const [isAfk, setIsAfk] = useState(false);
  const [predictiveScore, setPredictiveScore] = useState({ apm: 0, frustrationLevel: 0 });

  const addEvent = useCallback((message: string, type: FeedEvent['type']) => {
    const newEvent: FeedEvent = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      message,
      type
    };
    setEvents(prev => [newEvent, ...prev].slice(0, 50));
  }, []);

  // Update health score whenever stats or time change
  useEffect(() => {
    const score = calculateHealthScore({
      sleep_hours: stats.sleep_hours,
      bypass_count: stats.bypass_count,
      active_time: activeTime,
      session_limit: sessionLimit
    });
    setHealthScore(score);
  }, [stats, activeTime, sessionLimit]);

  // Initial Sync
  useEffect(() => {
    isAutostartEnabled().then(setAutostart);
    if (localStorage.getItem("userName")) {
      const storedLimit = localStorage.getItem("sessionLimitSeconds");
      if (storedLimit) {
        invoke("set_dynamic_limit", { limitSeconds: parseInt(storedLimit) });
      }
      addEvent("Overseer System Initialized", "INFO");
      
      // Voice greeting
      if (aiProtocol) {
        overseerVoice.speak(aiProtocol.sarcasticGreeting);
      }
    }
  }, []);

  // Global Event Listeners
  useEffect(() => {
    const unlistenLockdown = listen("trigger-lockdown", async () => {
      setAppState("LOCKDOWN");
      setCountdown(aiProtocol?.restDurationSeconds || 600);
      invoke("set_lockdown_state", { active: true });
      addEvent("Bio-Integrity Failure: Initiating Lockdown", "SECURITY");
      
      // Update protocol with predictive context right before lockdown for maximum impact
      try {
        const apps: any[] = await invoke("get_app_usage_stats");
        const mostUsed = apps[0]?.app_name || "General Desktop";
        const score: any = await invoke("get_predictive_score");
        
        const profile = {
          name: localStorage.getItem("userName") || "Operator",
          age: localStorage.getItem("userAge") || "18",
          bloodPressure: localStorage.getItem("userBP") || "120/80",
          weight: localStorage.getItem("userWeight") || "70",
          bedtime: localStorage.getItem("userBedtime") || "23:00",
          wakeTime: localStorage.getItem("userWakeTime") || "06:00"
        };

        const newProtocol = await generateHealthProtocol(profile, _lang, {
          apm: score.apm,
          frustrationLevel: score.frustration_level,
          mostUsedApp: mostUsed
        });
        
        setAiProtocol(newProtocol);
        localStorage.setItem("aiProtocol", JSON.stringify(newProtocol));
        overseerVoice.speak(newProtocol.lockdownMessage, true);
      } catch (e) {
        if (aiProtocol) {
          overseerVoice.speak(aiProtocol.lockdownMessage, true);
        }
      }
    });

    const unlistenWarning = listen("trigger-warning", () => {
      if (!warning) {
        setWarning(true);
        audioSynth.playWarningSiren();
        addEvent("Biological Degradation Detected: Rest Imminent", "WARNING");
        overseerVoice.speak(_lang === "ID" ? "Peringatan! Integritas biologis menurun. Istirahat segera." : "Warning! Biological integrity degrading. Rest immediately.");
      }
    });

    const unlistenBreak = listen("trigger-microbreak", () => {
      addEvent("Micro-Break Required: Relax Optical Nerves", "BIO");
      overseerVoice.speak(_lang === "ID" ? "Waktunya peregangan mata." : "Time for eye stretches.");
    });

    const unlistenAfk = listen("afk-status", (event: any) => {
      const isAway = event.payload as boolean;
      setIsAfk(prev => {
        if (prev && !isAway) {
          addEvent("Operator Returned: Resuming Neural Sync", "INFO");
          overseerVoice.speak(_lang === "ID" ? "Selamat datang kembali, Operator. Melanjutkan sinkronisasi." : "Welcome back, Operator. Resuming synchronization.");
        } else if (!prev && isAway) {
          addEvent("Operator AFK: Pausing Bio-Monitoring", "INFO");
        }
        return isAway;
      });
    });

    return () => {
      unlistenLockdown.then(f => f());
      unlistenWarning.then(f => f());
      unlistenBreak.then(f => f());
      unlistenAfk.then(f => f());
    };
  }, [warning, aiProtocol, addEvent, _lang]);

  // Polling for Active Time & Predictive Metrics
  useEffect(() => {
    let interval: number;
    if (appState !== "LOCKDOWN" && appState !== "ONBOARDING") {
      interval = window.setInterval(async () => {
        try {
          const time: number = await invoke("get_active_time");
          setActiveTime(time);
          
          // Poll predictive score every 10 seconds for UI updates
          if (time % 10 === 0) {
            const score: any = await invoke("get_predictive_score");
            setPredictiveScore({ apm: score.apm, frustrationLevel: score.frustration_level });
          }

          // Dynamic stats refresh every minute
          if (time > 0 && time % 60 === 0) {
            const res: any = await invoke("get_stats");
            setStats(res);
            setSessionLimit(res.session_limit);
          }
        } catch(e) {}
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [appState]);

  // Lockdown Timer
  useEffect(() => {
    let timer: number;
    if (appState === "LOCKDOWN") {
      if (countdown > 0) {
        timer = window.setInterval(() => setCountdown(c => c - 1), 1000);
      } else {
        setAppState("IDLE");
        invoke("set_lockdown_state", { active: false });
        addEvent("Neural Sync Restored: System Resumed", "INFO");
      }
    }
    return () => clearInterval(timer);
  }, [appState, countdown, addEvent]);

  const refreshAnalytics = async () => {
    try {
      const hist: any[] = await invoke("get_usage_history");
      setUsageHistory(hist);
      const apps: any[] = await invoke("get_app_usage_stats");
      setAppHistory(apps.map(a => ({...a, app_name: formatProcessName(a.app_name)})));
    } catch(e) {}
  };

  return {
    appState, setAppState,
    activeTime, sessionLimit, countdown, setCountdown,
    warning, setWarning,
    stats, setStats,
    usageHistory, appHistory,
    aiProtocol, setAiProtocol,
    events, addEvent,
    autostart, setAutostart,
    aiLoading, setAiLoading,
    healthScore, isAfk,
    refreshAnalytics,
    predictiveScore
  };
}
