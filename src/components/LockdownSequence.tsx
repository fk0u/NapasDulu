import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, AlertTriangle, MessageSquare } from 'lucide-react';
import { AIProtocolResponse } from '../lib/gemini';

interface LockdownSequenceProps {
  t: (key: any) => string;
  aiProtocol: AIProtocolResponse | null;
  countdown: number;
  showBypassInput: boolean;
  setShowBypassInput: (v: boolean) => void;
  emergencyReason: string;
  setEmergencyReason: (v: string) => void;
  emergencyDuration: string;
  setEmergencyDuration: (v: string) => void;
  bypassInput: string;
  setBypassInput: (v: string) => void;
  attemptBypass: () => void;
}

export const LockdownSequence: React.FC<LockdownSequenceProps> = ({
  t, aiProtocol, countdown, showBypassInput, setShowBypassInput,
  emergencyReason, setEmergencyReason, emergencyDuration, setEmergencyDuration,
  bypassInput, setBypassInput, attemptBypass
}) => {
  const [sequenceStep, setSequenceStep] = useState(0);

  useEffect(() => {
    // Quick immersive boot up sequence
    const timers = [
      setTimeout(() => setSequenceStep(1), 1500), 
      setTimeout(() => setSequenceStep(2), 3500), 
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#000] z-50 overflow-hidden select-none">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.1),transparent)] animate-pulse" />
      <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-50" />
      <div className="absolute bottom-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-50" />
      
      <div className="absolute top-8 left-8 flex items-center gap-3 text-system-accent font-mono text-[10px] tracking-[0.3em] animate-pulse">
        <AlertTriangle className="w-4 h-4" />
        BIOLOGICAL BOUNDARY EXCEEDED
      </div>
      
      <div className="absolute top-8 right-8 text-system-accent/80 font-mono text-2xl tracking-[0.3em]">
        {formatTime(countdown)}
      </div>

      <AnimatePresence mode="wait">
        {sequenceStep === 0 && (
          <motion.div key="step0" initial={{opacity: 0, scale: 0.9}} animate={{opacity: 1, scale: 1}} exit={{opacity: 0}} className="text-system-accent flex flex-col items-center space-y-6">
            <div className="relative w-24 h-24 flex items-center justify-center">
              <div className="absolute inset-0 border-t-2 border-l-2 border-system-accent animate-spin-slow rounded-tl-xl" />
              <div className="absolute inset-0 border-b-2 border-r-2 border-system-accent animate-spin-reverse-slow rounded-br-xl" />
            </div>
            <p className="text-2xl tracking-[0.3em] animate-pulse uppercase font-mono">SCANNING OPERATOR...</p>
          </motion.div>
        )}

        {sequenceStep === 1 && (
          <motion.div key="step1" initial={{opacity: 0, scale: 1.1}} animate={{opacity: 1, scale: 1}} exit={{opacity: 0}} className="text-orange-500 flex flex-col items-center space-y-4">
            <ShieldAlert className="w-20 h-20 animate-bounce drop-shadow-[0_0_20px_rgba(249,115,22,0.8)]" />
            <p className="text-xl tracking-[0.2em] uppercase font-mono">Analyzing Vitals... calculating degradation...</p>
          </motion.div>
        )}

        {sequenceStep >= 2 && (
          <motion.div key="step2" initial={{opacity: 0, y: 30}} animate={{opacity: 1, y: 0}} className="relative z-10 flex flex-col items-center max-w-2xl px-8 text-center mt-10 md:mt-0 w-[90%]">
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
                  autoFocus type="text" placeholder={t("bypass_reason_placeholder")}
                  value={emergencyReason} onChange={(e) => setEmergencyReason(e.target.value)}
                  className="bg-black/80 border border-system-border rounded px-4 py-3 text-sm font-mono text-white focus:outline-none focus:border-system-accent w-full transition-colors"
                />
                <div className="flex gap-4">
                  <input 
                    type="number" placeholder="Mins"
                    value={emergencyDuration} onChange={(e) => setEmergencyDuration(e.target.value)}
                    className="bg-black/80 border border-system-border rounded px-4 py-3 text-sm font-mono text-white focus:outline-none focus:border-system-accent w-24 text-center"
                  />
                  <input 
                    type="text" placeholder={t("signature_placeholder")}
                    value={bypassInput} onChange={(e) => setBypassInput(e.target.value)}
                    className="flex-1 bg-black/80 border border-system-border rounded px-4 py-3 text-[10px] font-mono text-white focus:outline-none focus:border-system-accent w-full transition-colors"
                  />
                </div>
                <div className="flex flex-col md:flex-row gap-2 w-full mt-2">
                  <button onClick={attemptBypass} className="flex-1 text-[10px] font-mono bg-system-accent/20 text-system-accent tracking-widest uppercase px-4 py-3 rounded hover:bg-system-accent hover:text-black transition-colors shadow-[0_0_10px_rgba(239,68,68,0.2)]">
                    EXECUTE PROTOCOL
                  </button>
                  <button onClick={() => setShowBypassInput(false)} className="text-[10px] font-mono text-gray-500 tracking-widest uppercase px-4 py-3 rounded border border-gray-800 hover:bg-gray-800 transition-colors">
                    CANCEL
                  </button>
                </div>
              </motion.div>
            ) : (
              <button onClick={() => setShowBypassInput(true)} className="text-xs font-mono text-gray-600 hover:text-system-accent tracking-widest uppercase transition-colors underline decoration-gray-800 underline-offset-4">
                 {t("initiate_emergency")}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="absolute bottom-8 right-8 text-system-accent/30 font-mono text-[10px] tracking-widest opacity-50">
        NAPASDULU // OVERSEER-V1.2.0
      </div>
    </div>
  );
};
