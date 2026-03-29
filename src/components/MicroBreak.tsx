import React, { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { motion, AnimatePresence } from 'framer-motion';
import { Droplet, Eye } from 'lucide-react';

export const MicroBreak: React.FC = () => {
  const [active, setActive] = useState(false);
  const [countdown, setCountdown] = useState(20);
  const [type, setType] = useState<'EYES' | 'WATER'>('EYES');

  useEffect(() => {
    const unlisten = listen("trigger-microbreak", () => {
      // Randomly choose between Eye rest (20-20-20 rule) and Hydration
      setType(Math.random() > 0.5 ? 'EYES' : 'WATER');
      setCountdown(20);
      setActive(true);
    });
    return () => { unlisten.then(f => f()); };
  }, []);

  useEffect(() => {
    let timer: number;
    if (active && countdown > 0) {
      timer = window.setInterval(() => setCountdown(c => c - 1), 1000);
    } else if (active && countdown <= 0) {
      setActive(false);
    }
    return () => clearInterval(timer);
  }, [active, countdown]);

  return (
    <AnimatePresence>
      {active && (
        <motion.div 
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          className="fixed top-6 left-1/2 -translate-x-1/2 z-[99999] bg-[#050505]/95 border border-blue-500/50 p-4 rounded-2xl shadow-[0_0_40px_rgba(59,130,246,0.3)] backdrop-blur-xl flex items-center gap-6 min-w-[320px]"
        >
          <div className="bg-blue-500/20 p-3 rounded-full border border-blue-500/30 animate-pulse shadow-[0_0_15px_rgba(59,130,246,0.5)]">
            {type === 'EYES' ? <Eye className="w-6 h-6 text-blue-400" /> : <Droplet className="w-6 h-6 text-blue-400" />}
          </div>
          <div className="flex-1">
            <h3 className="text-blue-400 font-mono text-sm font-bold uppercase tracking-widest">
              {type === 'EYES' ? '20-20-20 Protocol' : 'Hydration Check'}
            </h3>
            <p className="text-gray-300 font-mono text-[10px] mt-1 leading-relaxed">
              {type === 'EYES' 
                ? 'Look at something 20 feet away to rest your eyes.' 
                : 'Drink a glass of water immediately to flush toxins.'}
            </p>
          </div>
          <div className="text-3xl font-mono font-bold text-white border-l border-blue-900/50 pl-4">
            {countdown}<span className="text-sm text-blue-500">s</span>
          </div>
          
          {/* Progress Bar overlay at the bottom */}
          <motion.div 
            className="absolute bottom-0 left-0 h-1 bg-blue-500 rounded-b-2xl"
            initial={{ width: '100%' }}
            animate={{ width: '0%' }}
            transition={{ duration: 20, ease: "linear" }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};