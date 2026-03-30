import React from 'react';
import { motion } from 'framer-motion';

interface ActiveSessionHUDProps {
  timeRemaining: number;
  totalTime: number;
}

export const ActiveSessionHUD: React.FC<ActiveSessionHUDProps> = ({ timeRemaining, totalTime }) => {
  const ratio = Math.max(0, timeRemaining / totalTime);
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  const isCritical = ratio < 0.15;
  const primaryColor = isCritical ? 'text-system-accent' : 'text-medical-blue';
  const glowClass = isCritical ? 'cyber-glow-red' : 'cyber-glow-blue';

  // Heartbeat speed increases as time runs out
  const heartbeatDuration = ratio > 0.5 ? 1.2 : ratio > 0.2 ? 0.8 : 0.4;

  return (
    <div className="relative flex items-center justify-center w-72 h-72 md:w-96 md:h-96 mx-auto">
      {/* Bio-Sync Scanner Ring */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="absolute inset-0"
      >
        <svg viewBox="0 0 100 100" className={`w-full h-full opacity-20 ${primaryColor}`}>
          <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="1 3" />
        </svg>
      </motion.div>

      {/* Main Progress Ring */}
      <svg viewBox="0 0 100 100" className="absolute w-full h-full -rotate-90">
        <circle
          cx="50" cy="50" r="45"
          fill="none"
          stroke="rgba(255,255,255,0.03)"
          strokeWidth="4"
        />
        <motion.circle
          cx="50" cy="50" r="45"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeDasharray="283"
          initial={{ strokeDashoffset: 283 }}
          animate={{ strokeDashoffset: 283 - (283 * ratio) }}
          transition={{ duration: 1, ease: "easeOut" }}
          className={primaryColor}
        />
      </svg>

      {/* Internal HUD Elements */}
      <div className="relative flex flex-col items-center">
        {/* Heartbeat EKG Line Animation */}
        <div className="h-8 w-32 mb-4 overflow-hidden relative opacity-40">
           <motion.svg 
             viewBox="0 0 100 20" 
             className={`w-full h-full ${primaryColor}`}
             initial={{ x: -100 }}
             animate={{ x: 100 }}
             transition={{ duration: heartbeatDuration, repeat: Infinity, ease: "linear" }}
           >
             <path 
               d="M0 10 L40 10 L45 2 L50 18 L55 10 L100 10" 
               fill="none" 
               stroke="currentColor" 
               strokeWidth="1" 
             />
           </motion.svg>
           <motion.svg 
             viewBox="0 0 100 20" 
             className={`absolute inset-0 w-full h-full ${primaryColor}`}
             initial={{ x: -200 }}
             animate={{ x: 0 }}
             transition={{ duration: heartbeatDuration, repeat: Infinity, ease: "linear" }}
           >
             <path 
               d="M0 10 L40 10 L45 2 L50 18 L55 10 L100 10" 
               fill="none" 
               stroke="currentColor" 
               strokeWidth="1" 
             />
           </motion.svg>
        </div>

        <motion.div
          animate={isCritical ? { scale: [1, 1.05, 1] } : {}}
          transition={{ duration: heartbeatDuration / 2, repeat: Infinity }}
          className={`text-6xl md:text-8xl font-mono font-bold tracking-tighter ${primaryColor} ${glowClass}`}
        >
          {formattedTime}
        </motion.div>
        
        <div className="mt-4 flex flex-col items-center gap-1">
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${isCritical ? 'bg-system-accent' : 'bg-medical-blue'}`} />
            <span className="text-[10px] md:text-xs font-mono uppercase tracking-[0.4em] text-gray-500">
              {isCritical ? 'BIO-INTEGRITY CRITICAL' : 'NEURAL_SYNC ACTIVE'}
            </span>
          </div>
          <div className="text-[9px] font-mono text-gray-700 uppercase tracking-widest">
            SENTIENT OVERSEER PROT // V1.3.1
          </div>
        </div>
      </div>

      {/* Decorative Corner Ornaments */}
      {[0, 90, 180, 270].map((rot) => (
        <div 
          key={rot}
          className="absolute w-8 h-8 border-t-2 border-l-2 border-white/10"
          style={{ 
            transform: `rotate(${rot}deg) translate(-140px, -140px)`,
            top: '50%', left: '50%'
          }}
        />
      ))}
    </div>
  );
};
