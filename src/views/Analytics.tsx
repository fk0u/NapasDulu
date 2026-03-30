import React from 'react';
import { motion } from 'framer-motion';
import { PieChart, Monitor, Zap, ChevronRight } from 'lucide-react';

interface AppUsageStat {
  app_name: string;
  active_seconds: number;
}

interface AnalyticsProps {
  appHistory: AppUsageStat[];
}

export const Analytics: React.FC<AnalyticsProps> = ({ appHistory }) => {
  return (
    <div className="space-y-10">
      <div className="space-y-2">
        <div className="text-medical-blue flex items-center gap-2">
          <PieChart className="w-4 h-4" />
          <span className="text-[10px] font-mono font-bold tracking-[0.4em] uppercase">Neural_Resource_Allocation</span>
        </div>
        <h1 className="text-4xl font-bold tracking-tighter text-white">Application Analytics</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 glass-card rounded-[3rem] p-10 space-y-8">
          <div className="flex items-center justify-between border-b border-white/5 pb-6">
             <div className="flex items-center gap-3">
                <Monitor className="w-5 h-5 text-gray-500" />
                <span className="text-[10px] font-mono tracking-widest text-gray-400 uppercase">Top Processes Detected</span>
             </div>
             <span className="text-[9px] font-mono text-gray-600">SAMPLE_RATE: 1.0Hz</span>
          </div>

          <div className="space-y-6">
            {appHistory.length === 0 ? (
              <div className="py-20 text-center opacity-20 font-mono tracking-widest">
                SCANNING ACTIVE PROCESSES...
              </div>
            ) : (
              appHistory.map((app, i) => (
                <div key={i} className="group space-y-3">
                  <div className="flex justify-between items-end">
                    <div className="flex items-center gap-3">
                       <span className="text-[10px] font-mono text-gray-600">0{i+1}</span>
                       <span className="text-sm font-bold tracking-tight group-hover:text-medical-blue transition-colors text-white">{app.app_name}</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                       <span className="text-sm font-mono font-bold text-gray-300">{Math.floor(app.active_seconds / 60)}</span>
                       <span className="text-[9px] font-mono text-gray-600 uppercase">min</span>
                    </div>
                  </div>
                  <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min((app.active_seconds / (appHistory[0].active_seconds || 1)) * 100, 100)}%` }}
                      transition={{ duration: 1, delay: i * 0.1 }}
                      className={`h-full ${i === 0 ? 'bg-system-accent shadow-[0_0_10px_rgba(255,45,45,0.4)]' : 'bg-medical-blue/60'}`}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-8">
           <div className="glass-card rounded-[2.5rem] p-8 space-y-6">
              <div className="w-12 h-12 rounded-2xl bg-medical-blue/10 border border-medical-blue/20 flex items-center justify-center">
                 <Zap className="w-6 h-6 text-medical-blue" />
              </div>
              <h3 className="text-xl font-bold tracking-tight text-white">System Insight</h3>
              <p className="text-xs text-gray-400 font-mono leading-relaxed">
                "Operator, your primary cognitive load is currently allocated to <span className="text-white">[{appHistory[0]?.app_name || 'N/A'}]</span>. 
                This specific activity pattern correlates with high cervical strain. Adjust posture immediately."
              </p>
              <div className="pt-4 border-t border-white/5">
                 <button className="text-[10px] font-mono font-bold text-medical-blue hover:text-white transition-colors flex items-center gap-2 group">
                    VIEW DETAILED NEURAL MAP
                    <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                 </button>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};
