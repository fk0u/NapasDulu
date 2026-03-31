import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Terminal, 
  Pause,
  ChevronRight,
  TrendingUp,
  Zap,
  ActivitySquare
} from 'lucide-react';

import { ActiveSessionHUD } from './components/ActiveSessionHUD';
import { LockdownSequence } from './components/LockdownSequence';
import { MicroBreak } from './components/MicroBreak';
import { Sidebar } from './components/Sidebar';
import { StatCard } from './components/StatCard';
import { ActivityFeed } from './components/ActivityFeed';

// Views
import { Diagnostic } from './views/Diagnostic';
import { Analytics } from './views/Analytics';
import { Settings } from './views/Settings';

import { useOverseer } from './hooks/useOverseer';
import { getHealthVerdict } from './lib/utils';
import { overseerVoice } from './lib/voice';
import { generateHealthProtocol } from "./lib/gemini";

function App() {
  const [lang, setLang] = useState<"ID" | "EN">("ID");

  const overseer = useOverseer(lang);
  
  // UI states for onboarding
  const [onboardingName, setOnboardingName] = useState("");
  const [onboardingAge, setOnboardingAge] = useState("");
  const [onboardingBp, setOnboardingBp] = useState("");
  const [onboardingWeight, setOnboardingWeight] = useState("");
  const [bedTime, setBedTime] = useState("");
  const [wakeTime, setWakeTime] = useState("");

  const pageTransition = {
    initial: { opacity: 0, scale: 0.98, y: 10 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.95, y: -10 },
    transition: { duration: 0.4, ease: "easeOut" as const }
  };

  const handleOnboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onboardingName || !onboardingAge || !onboardingBp) return;
    
    overseer.setAiLoading(true);
    try {
      const protocol = await generateHealthProtocol({
        name: onboardingName,
        age: onboardingAge,
        bloodPressure: onboardingBp,
        weight: onboardingWeight || "70", 
        bedtime: bedTime || "23:00",
        wakeTime: wakeTime || "07:00"
      }, lang);
      
      localStorage.setItem("userName", onboardingName);
      localStorage.setItem("userAge", onboardingAge);
      localStorage.setItem("userBp", onboardingBp);
      localStorage.setItem("userWeight", onboardingWeight || "70");
      localStorage.setItem("userBed", bedTime || "23:00");
      localStorage.setItem("userWake", wakeTime || "07:00");
      localStorage.setItem("aiProtocol", JSON.stringify(protocol));
      localStorage.setItem("sessionLimitSeconds", protocol.workDurationSeconds.toString());
      
      await invoke("set_dynamic_limit", { limitSeconds: protocol.workDurationSeconds });
      overseer.setAiProtocol(protocol);
      overseer.setAppState("DIAGNOSTIC");
      overseer.addEvent("Neural Profile Synchronized", "BIO");
      overseerVoice.speak(lang === "ID" ? "Profil sinkron. Memulai protokol kesehatan." : "Profile synced. Commencing health protocol.");
    } catch (err) {
      console.error(err);
    }
    overseer.setAiLoading(false);
  };

  return (
    <div className="flex h-screen bg-system-bg text-system-text font-sans overflow-hidden text-sm">
      {/* Background FX */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,210,255,0.03)_0%,transparent_100%)]" />
        <div className={`absolute inset-0 transition-opacity duration-1000 ${overseer.warning ? 'opacity-20' : 'opacity-0'} bg-red-900/20`} />
        {/* Animated Grid Scan */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:100px_100px] [mask-image:radial-gradient(ellipse_at_center,black,transparent)]" />
      </div>

      <MicroBreak />

      {/* Sidebar Navigation */}
      {overseer.appState !== "ONBOARDING" && overseer.appState !== "LOCKDOWN" && overseer.appState !== "DIAGNOSTIC" && (
        <Sidebar 
          activeView={overseer.appState} 
          onViewChange={(v: any) => {
            overseer.setAppState(v);
            if (v === 'HISTORY' || v === 'ANALYTICS') overseer.refreshAnalytics();
          }}
          userName={localStorage.getItem("userName") || ""}
          healthScore={overseer.healthScore}
        />
      )}

      {/* Main Content Area */}
      <main className={`flex-1 relative z-10 overflow-y-auto custom-scrollbar transition-all duration-500 ${
        ['ONBOARDING', 'LOCKDOWN', 'DIAGNOSTIC'].includes(overseer.appState) ? 'p-0' : 'ml-24 md:ml-64 p-8 md:p-12'
      }`}>
        <AnimatePresence mode="wait">
          
          {/* 1. ONBOARDING */}
          {overseer.appState === "ONBOARDING" && (
            <motion.div key="onboarding" {...pageTransition} className="flex min-h-screen items-center justify-center p-6">
               <div className="w-full max-w-xl glass-card rounded-[3rem] p-12 space-y-10">
                  <div className="flex flex-col items-center gap-6">
                    <div className="w-20 h-20 rounded-3xl bg-system-accent flex items-center justify-center shadow-lg shadow-red-500/20">
                      <Terminal className="w-10 h-10 text-white" />
                    </div>
                    <div className="text-center">
                      <h1 className="text-4xl font-bold tracking-tighter text-white">THE OVERSEER</h1>
                      <p className="text-[10px] font-mono text-gray-500 uppercase tracking-[0.4em] mt-2">Neural Enrollment Protocol</p>
                    </div>
                  </div>
                  
                  <form onSubmit={handleOnboardingSubmit} className="space-y-6">
                    <div className="space-y-4">
                      <input 
                        required placeholder="Operator Alias"
                        className="w-full bg-white/[0.02] border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-medical-blue/50 transition-all font-mono text-sm"
                        value={onboardingName} onChange={e => setOnboardingName(e.target.value)}
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <input required type="number" placeholder="Age" className="bg-white/[0.02] border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-medical-blue/50 transition-all font-mono text-sm" value={onboardingAge} onChange={e => setOnboardingAge(e.target.value)} />
                        <input required placeholder="BP (120/80)" className="bg-white/[0.02] border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-medical-blue/50 transition-all font-mono text-sm" value={onboardingBp} onChange={e => setOnboardingBp(e.target.value)} />
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <input placeholder="Weight (kg)" className="bg-white/[0.02] border border-white/10 rounded-2xl px-4 py-3 outline-none focus:border-medical-blue/50 transition-all font-mono text-xs" value={onboardingWeight} onChange={e => setOnboardingWeight(e.target.value)} />
                        <input type="time" placeholder="Sleep" className="bg-white/[0.02] border border-white/10 rounded-2xl px-4 py-3 outline-none focus:border-medical-blue/50 transition-all font-mono text-xs" value={bedTime} onChange={e => setBedTime(e.target.value)} />
                        <input type="time" placeholder="Wake" className="bg-white/[0.02] border border-white/10 rounded-2xl px-4 py-3 outline-none focus:border-medical-blue/50 transition-all font-mono text-xs" value={wakeTime} onChange={e => setWakeTime(e.target.value)} />
                      </div>
                    </div>
                    <button 
                      type="submit" disabled={overseer.aiLoading}
                      className="w-full py-5 rounded-2xl bg-white text-black font-bold tracking-[0.3em] hover:bg-gray-200 transition-all active:scale-95 disabled:opacity-50"
                    >
                      {overseer.aiLoading ? "ANALYZING..." : "BEGIN SYNC"}
                    </button>
                  </form>
               </div>
            </motion.div>
          )}

          {/* 2. DIAGNOSTIC */}
          {overseer.appState === "DIAGNOSTIC" && (
            <motion.div key="diagnostic" {...pageTransition}>
              <Diagnostic 
                userName={localStorage.getItem("userName") || "Operator"} 
                onComplete={() => overseer.setAppState("IDLE")} 
              />
            </motion.div>
          )}

          {/* 3. DASHBOARD / IDLE */}
          {overseer.appState === "IDLE" && (
            <motion.div key="dashboard" {...pageTransition} className="space-y-10">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-3 text-medical-blue">
                    <Zap className="w-4 h-4 cyber-glow-blue" />
                    <span className="text-[10px] font-mono font-bold tracking-[0.4em] uppercase">Status: Online</span>
                  </div>
                  <h1 className="text-4xl font-bold tracking-tighter text-white">System Overview</h1>
                </div>
                <div className="flex gap-4">
                   {overseer.isAfk && (
                     <div className="px-6 py-3 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl flex items-center gap-3 animate-pulse">
                        <Pause className="w-4 h-4 text-yellow-500" />
                        <span className="text-[10px] font-mono font-bold tracking-widest text-yellow-500 uppercase">Neural_Sync_Suspended</span>
                     </div>
                   )}
                   <div className="px-6 py-3 glass rounded-2xl flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-[10px] font-mono font-bold tracking-widest text-gray-400">BIOSYNC_LOCKED</span>
                   </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-7 space-y-8">
                  <div className="glass-card rounded-[3.5rem] p-12 flex flex-col items-center justify-center min-h-[550px] relative overflow-hidden group">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,210,255,0.05)_0%,transparent_100%)] opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                    <ActiveSessionHUD 
                      timeRemaining={Math.max(0, overseer.sessionLimit - overseer.activeTime)} 
                      totalTime={overseer.sessionLimit || 1} 
                    />
                    <div className="mt-12 text-center space-y-2">
                       <p className="text-[10px] font-mono text-gray-600 uppercase tracking-[0.3em]">Current Biometric Verdict</p>
                       <div className="flex items-center justify-center gap-2 text-medical-blue font-bold tracking-tight">
                          <TrendingUp className="w-4 h-4" />
                          <span>{getHealthVerdict(overseer.healthScore, lang)}</span>
                       </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard label="APM" value={overseer.predictiveScore.apm} subValue="ACT" icon={Zap} color="medical" />
                    <StatCard label="Frustration" value={overseer.predictiveScore.frustrationLevel} subValue="%" icon={Zap} color={overseer.predictiveScore.frustrationLevel > 40 ? 'accent' : 'default'} />
                    <StatCard label="Health" value={overseer.healthScore} subValue="PTS" icon={Zap} color={overseer.healthScore < 50 ? 'accent' : 'medical'} />
                  </div>
                </div>

                <div className="lg:col-span-5 space-y-8">
                  <div className="glass-card rounded-[2.5rem] p-8 border-l-4 border-l-system-accent bg-gradient-to-br from-system-accent/5 to-transparent">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <Terminal className="w-4 h-4 text-system-accent" />
                        <span className="text-[10px] font-mono font-bold tracking-[0.3em] text-gray-500 uppercase">AI_Directive</span>
                      </div>
                      <div className="px-2 py-1 glass rounded text-[8px] font-mono text-gray-500">UPLINK_STABLE</div>
                    </div>
                    <p className="text-sm text-gray-200 font-mono italic leading-relaxed mb-8">
                      "{overseer.aiProtocol?.sarcasticGreeting || "Awaiting neural link..."}"
                    </p>
                    <div className="space-y-4">
                      {overseer.aiProtocol?.healthTips.map((tip, i) => (
                        <div key={i} className="flex items-start gap-3 text-[10px] text-gray-400 font-mono leading-tight group/tip">
                          <ChevronRight className="w-3 h-3 text-system-accent flex-shrink-0 group-hover:translate-x-1 transition-transform" />
                          <span className="group-hover:text-gray-200 transition-colors">{tip}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="h-[420px]">
                    <ActivityFeed events={overseer.events} />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* 4. HISTORY */}
          {overseer.appState === "HISTORY" && (
            <motion.div key="history" {...pageTransition} className="space-y-10">
               <div className="space-y-2">
                  <div className="text-medical-blue flex items-center gap-2">
                    <ActivitySquare className="w-4 h-4" />
                    <span className="text-[10px] font-mono font-bold tracking-[0.4em] uppercase">Chronological_Data</span>
                  </div>
                  <h1 className="text-4xl font-bold tracking-tighter text-white">Bio-History</h1>
               </div>
               
               <div className="glass-card rounded-[3rem] p-12 min-h-[500px] flex items-end justify-between gap-6">
                  {overseer.usageHistory.map((day, i) => {
                    const h = Math.min((day.active_seconds / 43200) * 100, 100);
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center group max-w-[60px]">
                         <div className="relative w-full flex justify-center items-end h-[350px]">
                            <motion.div 
                              initial={{ height: 0 }}
                              animate={{ height: `${h}%` }}
                              className={`w-full rounded-2xl transition-all duration-500 ${
                                i === overseer.usageHistory.length - 1 
                                  ? 'bg-medical-blue shadow-[0_0_30px_rgba(0,210,255,0.4)]' 
                                  : 'bg-white/5 group-hover:bg-white/10'
                              }`}
                            />
                            <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-mono font-bold text-white">
                               {Math.floor(day.active_seconds/3600)}h
                            </div>
                         </div>
                         <span className="mt-8 text-[10px] font-mono font-bold tracking-[0.2em] text-gray-600 uppercase">
                            {new Date(day.date).toLocaleDateString(undefined, { weekday: 'short' })}
                         </span>
                      </div>
                    );
                  })}
               </div>
            </motion.div>
          )}

          {/* 5. ANALYTICS */}
          {overseer.appState === "ANALYTICS" && (
            <motion.div key="analytics" {...pageTransition}>
              <Analytics appHistory={overseer.appHistory} />
            </motion.div>
          )}

          {/* 6. SETTINGS */}
          {overseer.appState === "SETTINGS" && (
            <motion.div key="settings" {...pageTransition}>
              <Settings lang={lang} setLang={setLang} onSave={() => overseer.setAppState("IDLE")} />
            </motion.div>
          )}

          {/* 7. LOCKDOWN (Global Overlay) */}
          {overseer.appState === "LOCKDOWN" && (
            <motion.div key="lockdown" {...pageTransition} className="fixed inset-0 z-[1000] bg-black">
              <LockdownSequence 
                countdown={overseer.countdown}
                onBypassSuccess={() => overseer.setAppState("IDLE")}
                aiProtocol={overseer.aiProtocol}
                language={lang}
                mostUsedApp={overseer.appHistory[0]?.app_name || "General Desktop"}
                predictiveScore={overseer.predictiveScore}
              />
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  );
}

export default App;
