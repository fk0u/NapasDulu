import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, ShieldAlert, Ghost, Activity, Brain, Zap } from 'lucide-react';
import { invoke } from "@tauri-apps/api/core";
import { AIEmergencyEvaluation, evaluateEmergencyExcuse, AIProtocolResponse, UserHealthProfile } from '../lib/gemini';
import { overseerVoice } from '../lib/voice';

interface LockdownSequenceProps {
  countdown: number;
  onBypassSuccess: () => void;
  aiProtocol: AIProtocolResponse | null;
  language: "ID" | "EN";
  mostUsedApp: string;
  predictiveScore?: { apm: number; frustrationLevel: number };
}

export const LockdownSequence: React.FC<LockdownSequenceProps> = ({ 
  countdown, 
  onBypassSuccess, 
  aiProtocol, 
  language, 
  mostUsedApp,
  predictiveScore 
}) => {
  const [showExcuse, setShowExcuse] = useState(false);
  const [excuse, setExcuse] = useState("");
  const [requestMins, setRequestMins] = useState(5);
  const [evaluation, setEvaluation] = useState<AIEmergencyEvaluation | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRequestBypass = async () => {
    setLoading(true);
    const profile: UserHealthProfile = {
      name: localStorage.getItem("userName") || "Operator",
      age: localStorage.getItem("userAge") || "18",
      bloodPressure: localStorage.getItem("userBP") || "120/80",
      weight: localStorage.getItem("userWeight") || "70",
      bedtime: localStorage.getItem("userBedtime") || "23:00",
      wakeTime: localStorage.getItem("userWakeTime") || "06:00"
    };

    const res = await evaluateEmergencyExcuse(excuse, requestMins, profile, language, mostUsedApp);
    setEvaluation(res);
    setLoading(false);
    
    overseerVoice.speak(res.aiResponse, true);

    if (res.approved && res.grantedSeconds > 0) {
      await invoke("attempt_bypass", { logs: `Approved: ${excuse}` });
      setTimeout(() => onBypassSuccess(), 3000);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center p-12 overflow-hidden select-none">
      {/* Background Glitch Effect */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-medical-blue/20 via-transparent to-transparent animate-pulse" />
        <div className="h-full w-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20" />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-4xl space-y-12 text-center relative z-10"
      >
        <div className="flex justify-center gap-8 mb-4">
            <motion.div 
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ repeat: Infinity, duration: 4 }}
                className="p-6 rounded-3xl bg-red-500/10 border border-red-500/20"
            >
                <ShieldAlert className="w-16 h-16 text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.4)]" />
            </motion.div>
        </div>

        <div className="space-y-4">
          <h1 className="text-6xl font-black tracking-tighter text-white uppercase italic italic-glitch">
            System Lockdown
          </h1>
          <p className="text-xs font-mono text-gray-500 uppercase tracking-[0.5em]">
            Neural Integrity Failure • Biological Recovery in Progress
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-card p-8 rounded-[2rem] border-white/5 flex flex-col items-center justify-center space-y-2">
                <Clock className="w-6 h-6 text-medical-blue mb-2" />
                <span className="text-4xl font-black text-white font-mono tracking-widest">{formatTime(countdown)}</span>
                <span className="text-[10px] text-gray-500 uppercase font-mono tracking-widest">Recovery Time Remaining</span>
            </div>

            <div className="glass-card p-8 rounded-[2rem] border-white/5 flex flex-col items-center justify-center space-y-2">
                <Brain className="w-6 h-6 text-purple-500 mb-2" />
                <span className="text-4xl font-black text-white font-mono tracking-widest">{predictiveScore?.frustrationLevel || 0}%</span>
                <span className="text-[10px] text-gray-500 uppercase font-mono tracking-widest">Detected Frustration</span>
            </div>

            <div className="glass-card p-8 rounded-[2rem] border-white/5 flex flex-col items-center justify-center space-y-2">
                <Zap className="w-6 h-6 text-yellow-500 mb-2" />
                <span className="text-4xl font-black text-white font-mono tracking-widest">{predictiveScore?.apm || 0}</span>
                <span className="text-[10px] text-gray-500 uppercase font-mono tracking-widest">Actions Last Interval</span>
            </div>
        </div>

        <div className="max-w-2xl mx-auto space-y-6">
            <p className="text-xl text-gray-300 font-medium leading-relaxed italic">
                "{aiProtocol?.lockdownMessage || "Step away from the machine. Now."}"
            </p>
            <div className="flex items-center justify-center gap-4 text-xs font-mono text-medical-blue/60 uppercase tracking-widest">
                <Activity className="w-4 h-4" />
                <span>Primary Context: {mostUsedApp}</span>
            </div>
        </div>

        <AnimatePresence mode="wait">
          {!showExcuse ? (
            <motion.button
              key="request-btn"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              onClick={() => setShowExcuse(true)}
              className="text-[10px] font-mono text-gray-600 hover:text-red-500 uppercase tracking-[0.4em] transition-colors flex items-center gap-2 mx-auto"
            >
              <Ghost className="w-4 h-4" />
              Request Emergency Neural Uplink Bypass
            </motion.button>
          ) : (
            <motion.div
              key="excuse-form"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-md mx-auto space-y-6 p-8 glass-card rounded-[2.5rem] border-red-500/20"
            >
              {!evaluation ? (
                <>
                  <div className="space-y-4">
                    <p className="text-[10px] font-mono text-red-400 uppercase tracking-widest">State your logical justification:</p>
                    <textarea 
                      value={excuse}
                      onChange={(e) => setExcuse(e.target.value)}
                      placeholder="Why do you deserve more screen time, biological entity?"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white placeholder:text-gray-700 focus:outline-none focus:border-medical-blue transition-colors min-h-[100px]"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-gray-500 uppercase">Extension: {requestMins}m</span>
                    <input 
                      type="range" min="1" max="15" value={requestMins}
                      onChange={(e) => setRequestMins(parseInt(e.target.value))}
                      className="w-1/2 accent-medical-blue"
                    />
                  </div>
                  <div className="flex gap-4">
                    <button 
                      onClick={() => setShowExcuse(false)}
                      className="flex-1 py-4 rounded-xl border border-white/10 text-[10px] font-mono text-gray-500 hover:bg-white/5 uppercase tracking-widest"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleRequestBypass}
                      disabled={loading || excuse.length < 5}
                      className="flex-1 py-4 rounded-xl bg-red-500 text-black font-black text-[10px] font-mono uppercase tracking-widest hover:brightness-110 disabled:opacity-50 transition-all"
                    >
                      {loading ? "EVALUATING..." : "SUBMIT FOR JUDGMENT"}
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-6 text-left">
                  <div className={`p-4 rounded-2xl border ${evaluation.approved ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                    <p className="text-[10px] font-mono uppercase tracking-widest mb-1">
                      Verdict: {evaluation.approved ? 'Conditional Access Granted' : 'Access Denied'}
                    </p>
                    <p className="text-sm font-medium leading-relaxed italic">"{evaluation.aiResponse}"</p>
                  </div>
                  {evaluation.approved && evaluation.grantedSeconds > 0 && (
                    <div className="text-center animate-pulse">
                        <p className="text-[10px] font-mono text-medical-blue uppercase tracking-[0.3em]">Resuming system in 3s...</p>
                    </div>
                  )}
                  {!evaluation.approved && (
                    <button 
                        onClick={() => { setEvaluation(null); setExcuse(""); }}
                        className="w-full py-4 rounded-xl border border-white/10 text-[10px] font-mono text-gray-500 uppercase tracking-widest"
                    >
                        Try a better excuse
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Decorative Sidebar Elements */}
      <div className="absolute top-0 bottom-0 left-0 w-1 bg-medical-blue/20" />
      <div className="absolute top-0 bottom-0 right-0 w-1 bg-medical-blue/20" />
      
      <div className="absolute bottom-12 left-12 flex items-center gap-4 opacity-30">
        <div className="h-px w-12 bg-white/20" />
        <span className="text-[8px] font-mono text-white uppercase tracking-[0.5em]">KILOUX CORE v2.0.0</span>
      </div>
    </div>
  );
};
