import React from 'react';

interface ActiveSessionHUDProps {
  timeRemaining: number; // in seconds
  totalTime: number; // in seconds
}

export const ActiveSessionHUD: React.FC<ActiveSessionHUDProps> = ({ timeRemaining, totalTime }) => {
  // Calculate urgency ratio (1.0 = full time, 0.0 = no time left)
  const ratio = Math.max(0, timeRemaining / totalTime);
  
  // Rings speed up as time runs out (10s down to 1s duration)
  const ringSpeed = Math.max(1, ratio * 10);
  
  // Format time remaining (MM:SS)
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  // Shift colors to critical red when under 15% time remaining
  const isCritical = ratio < 0.15;
  const ringColor = isCritical ? 'text-system-accent' : 'text-cyan-500';
  const innerRingColor = isCritical ? 'text-red-400' : 'text-cyan-400';
  const scanColor = isCritical ? 'bg-system-accent' : 'bg-cyan-400';

  return (
    <div className="relative flex items-center justify-center w-64 h-64 mx-auto">
      {/* Outer Rotating Ring */}
      <svg 
        className={`absolute w-full h-full opacity-50 animate-spin transition-colors duration-700 ${ringColor}`} 
        style={{ animationDuration: `${ringSpeed}s` }} 
        viewBox="0 0 100 100"
      >
        <circle cx="50" cy="50" r="48" fill="none" strokeWidth="1" stroke="currentColor" strokeDasharray="10 4 2 4" />
      </svg>

      {/* Inner Counter-Rotating Ring */}
      <svg 
        className={`absolute w-56 h-56 opacity-70 animate-spin-reverse transition-colors duration-700 ${innerRingColor}`} 
        style={{ animationDuration: `${ringSpeed * 0.8}s` }} 
        viewBox="0 0 100 100"
      >
        <circle cx="50" cy="50" r="48" fill="none" strokeWidth="2" stroke="currentColor" strokeDasharray="20 10 5 10" />
      </svg>

      {/* Biometric Scan Line Overlay */}
      <div className={`absolute inset-0 overflow-hidden rounded-full border border-opacity-30 transition-colors duration-700 ${isCritical ? 'border-system-accent' : 'border-cyan-500'}`}>
        <div className={`w-full h-1 blur-[1px] animate-scan opacity-60 transition-colors duration-700 ${scanColor}`} />
      </div>

      {/* Main Timer Display */}
      <div className="z-10 flex flex-col items-center">
        <span className={`text-5xl font-mono font-bold tracking-widest drop-shadow-md transition-colors duration-700 ${isCritical ? 'text-system-accent' : 'text-cyan-300'}`}>
          {formattedTime}
        </span>
        <span className={`text-xs font-mono uppercase mt-2 transition-colors duration-700 ${isCritical ? 'text-red-500 animate-pulse' : 'text-cyan-500/80'}`}>
          {isCritical ? 'Bio-Status Critical' : 'Bio-Status Normal'}
        </span>
      </div>
    </div>
  );
};