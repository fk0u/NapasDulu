import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ActivitySquare, ShieldCheck, ChevronRight } from 'lucide-react';
import { invoke } from "@tauri-apps/api/core";

interface DiagnosticProps {
  userName: string;
  onComplete: () => void;
}

export const Diagnostic: React.FC<DiagnosticProps> = ({ userName, onComplete }) => {
  const [exercised, setExercised] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await invoke("log_morning_diagnostic", { 
        sleepHours: 8.0, 
        wakeHours: 0.0, 
        exercised 
      });
      onComplete();
    } catch (err) {
      onComplete();
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-xl glass-card rounded-[3rem] p-12 space-y-10 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <ActivitySquare className="w-40 h-40" />
        </div>

        <div className="flex items-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-medical-blue/10 border border-medical-blue/20 flex items-center justify-center shadow-lg shadow-blue-500/10">
            <ShieldCheck className="w-8 h-8 text-medical-blue" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tighter text-white">Daily Diagnostic</h1>
            <p className="text-[10px] font-mono text-gray-500 uppercase tracking-[0.3em]">Operator: {userName}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-4">
            <p className="text-sm text-gray-400 font-mono leading-relaxed italic">
              "Biological verification required. State your physical activity status for the current solar cycle."
            </p>
            
            <label className="flex items-center gap-5 p-8 border border-white/5 rounded-[2rem] bg-white/[0.02] cursor-pointer hover:border-medical-blue/30 hover:bg-white/[0.04] transition-all group">
              <div className="relative flex items-center justify-center w-8 h-8 rounded-xl border-2 border-gray-700 group-hover:border-medical-blue transition-colors">
                <input 
                  type="checkbox" 
                  className="absolute opacity-0 w-full h-full cursor-pointer" 
                  checked={exercised} 
                  onChange={(e) => setExercised(e.target.checked)} 
                />
                {exercised && (
                  <motion.div 
                    initial={{ scale: 0 }} 
                    animate={{ scale: 1 }} 
                    className="w-4 h-4 bg-medical-blue rounded-md shadow-[0_0_15px_rgba(0,210,255,0.6)]" 
                  />
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold font-mono text-gray-200 uppercase tracking-widest">Physical Activity Logged</span>
                <span className="text-[10px] text-gray-500 font-mono">Completed required cardiovascular or muscular stress</span>
              </div>
            </label>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-6 rounded-2xl bg-medical-blue text-black font-bold tracking-[0.3em] hover:brightness-110 transition-all active:scale-[0.98] flex items-center justify-center gap-3 shadow-lg shadow-blue-500/20"
          >
            {loading ? "SYNCHRONIZING..." : "INITIALIZE SESSION"}
            <ChevronRight className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
};
