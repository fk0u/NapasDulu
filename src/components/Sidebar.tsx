import React from 'react';
import { motion } from 'framer-motion';
import { 
  Activity, 
  BarChart3, 
  PieChart, 
  Settings, 
  User, 
  Terminal
} from 'lucide-react';

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
  userName: string;
  healthScore: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeView, 
  onViewChange, 
  userName, 
  healthScore 
}) => {
  const menuItems = [
    { id: 'IDLE', icon: Activity, label: 'OVERVIEW' },
    { id: 'HISTORY', icon: BarChart3, label: 'TRACKS' },
    { id: 'ANALYTICS', icon: PieChart, label: 'NEURAL' },
    { id: 'SETTINGS', icon: Settings, label: 'CONFIG' },
  ];

  return (
    <motion.div 
      initial={{ x: -100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="fixed left-0 top-0 bottom-0 w-24 md:w-64 border-r border-white/5 glass z-50 flex flex-col items-center py-8"
    >
      {/* App Logo/Header */}
      <div className="flex flex-col items-center gap-3 mb-12">
        <div className="w-12 h-12 rounded-2xl bg-system-accent flex items-center justify-center shadow-[0_0_20px_rgba(255,45,45,0.3)]">
          <Terminal className="w-6 h-6 text-white" />
        </div>
        <div className="hidden md:flex flex-col items-center">
          <span className="text-sm font-bold tracking-tighter">NAPASDULU</span>
          <span className="text-[9px] text-gray-500 font-mono tracking-[0.3em]">OVERSEER-V1.3.1</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 w-full space-y-2 px-4">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 group relative ${
              activeView === item.id 
                ? 'bg-white/5 text-white' 
                : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.02]'
            }`}
          >
            {activeView === item.id && (
              <motion.div 
                layoutId="active-pill" 
                className="absolute left-0 w-1 h-6 bg-system-accent rounded-r-full"
              />
            )}
            <item.icon className={`w-5 h-5 ${activeView === item.id ? 'text-system-accent' : 'group-hover:text-white'}`} />
            <span className="hidden md:inline text-[10px] font-mono tracking-[0.2em] font-bold">
              {item.label}
            </span>
          </button>
        ))}
      </nav>

      {/* Operator Status */}
      <div className="mt-auto w-full px-4 space-y-6">
        <div className="hidden md:flex flex-col gap-4 p-5 glass-card rounded-[2rem]">
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-gray-500 font-mono uppercase tracking-widest">Operator Status</span>
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          </div>
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-medical-blue/10 flex items-center justify-center border border-medical-blue/20">
                <User className="w-5 h-5 text-medical-blue" />
             </div>
             <div className="flex-1 overflow-hidden">
                <div className="text-[11px] font-bold truncate">{userName || 'GUEST_01'}</div>
                <div className="text-[9px] text-gray-500 font-mono uppercase">ID: {Math.random().toString(16).slice(2,8).toUpperCase()}</div>
             </div>
          </div>
          <div className="space-y-1.5 pt-2 border-t border-white/5">
             <div className="flex justify-between text-[9px] font-mono uppercase">
                <span>Health Score</span>
                <span className={healthScore < 50 ? 'text-system-accent' : 'text-medical-blue'}>{healthScore}%</span>
             </div>
             <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${healthScore}%` }}
                  className={`h-full ${healthScore < 50 ? 'bg-system-accent' : 'bg-medical-blue'}`}
                />
             </div>
          </div>
        </div>

        <div className="flex md:hidden flex-col items-center gap-6">
           <User className="w-5 h-5 text-gray-500" />
           <div className={`w-3 h-3 rounded-full border-2 ${healthScore < 50 ? 'border-system-accent' : 'border-medical-blue'}`} />
        </div>
      </div>
    </motion.div>
  );
};
