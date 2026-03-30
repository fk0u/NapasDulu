import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon: LucideIcon;
  color?: 'default' | 'accent' | 'medical';
}

export const StatCard: React.FC<StatCardProps> = ({ 
  label, 
  value, 
  subValue, 
  icon: Icon, 
  color = 'default' 
}) => {
  const colorMap = {
    default: 'text-gray-400 bg-white/5 border-white/10',
    accent: 'text-system-accent bg-system-accent/5 border-system-accent/20',
    medical: 'text-medical-blue bg-medical-blue/5 border-medical-blue/20'
  };

  return (
    <motion.div 
      whileHover={{ y: -5, scale: 1.02 }}
      className="p-6 glass-card rounded-3xl flex flex-col gap-4 relative overflow-hidden group"
    >
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-current to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <div className="flex items-center justify-between">
        <div className={`p-3 rounded-2xl border ${colorMap[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] font-mono font-bold tracking-[0.2em] text-gray-500 uppercase">{label}</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tighter text-white">{value}</span>
            {subValue && <span className="text-[10px] font-mono text-gray-600">{subValue}</span>}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
