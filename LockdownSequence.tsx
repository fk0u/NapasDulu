import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export const LockdownSequence: React.FC = () => {
  const { t } = useTranslation();
  const [sequenceStep, setSequenceStep] = useState(0);

  useEffect(() => {
    // Progress through the scanning sequence
    const timers = [
      setTimeout(() => setSequenceStep(1), 2000), // Show 'Analyzing Vitals' after 2s
      setTimeout(() => setSequenceStep(2), 4500), // Trigger Full Lockdown after 4.5s
    ];
    
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-system-bg flex flex-col items-center justify-center p-8 font-mono select-none overflow-hidden">
      {/* Subtle background radar scan line */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="w-full h-2 bg-system-accent blur-[2px] animate-scan" />
      </div>

      {/* Step 0: Initial Scan */}
      {sequenceStep === 0 && (
        <div className="text-system-accent flex flex-col items-center space-y-6">
          <div className="relative w-24 h-24 flex items-center justify-center">
            <div className="absolute inset-0 border-t-2 border-l-2 border-system-accent animate-pulse rounded-tl-xl" />
            <div className="absolute inset-0 border-b-2 border-r-2 border-system-accent animate-pulse rounded-br-xl rotate-180" />
          </div>
          <p className="text-2xl tracking-widest animate-pulse uppercase">{t('scanning_operator')}</p>
        </div>
      )}

      {/* Step 1: Processing Analysis */}
      {sequenceStep === 1 && (
        <div className="text-orange-500 flex flex-col items-center space-y-4">
          <p className="text-xl tracking-wider uppercase animate-pulse">Analyzing Vitals... calculating degradation...</p>
        </div>
      )}

      {/* Step 2: Biological Boundary Exceeded (Full Lockdown) */}
      {sequenceStep >= 2 && (
        <div className="z-10 flex flex-col items-center space-y-8 animate-fade-in max-w-3xl text-center">
          <div className="space-y-4">
            <h1 className="text-4xl md:text-6xl font-bold tracking-widest text-system-accent drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]">
              {t('lockdown_biological')}
            </h1>
            <p className="text-xl md:text-2xl text-system-text uppercase tracking-widest">
              {t('biological_degradation')}: <span className="text-system-accent font-bold animate-pulse">CRITICAL (89%)</span>
            </p>
          </div>
          
          <div className="p-8 border border-system-border bg-black/40 backdrop-blur-md rounded-sm">
            <p className="text-lg text-system-text/90 leading-relaxed tracking-wide">
              {t('lockdown_description')}
            </p>
          </div>
          
          <button className="mt-12 px-8 py-3 border border-system-accent/50 text-system-accent hover:bg-system-accent hover:text-system-bg transition-colors duration-300 uppercase tracking-widest text-sm font-bold">
            {t('initiate_emergency')}
          </button>
        </div>
      )}
    </div>
  );
};