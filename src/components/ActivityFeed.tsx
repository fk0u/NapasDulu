import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, Shield, Zap, AlertCircle } from 'lucide-react';

export interface FeedEvent {
  id: string;
  timestamp: string;
  message: string;
  type: 'INFO' | 'SECURITY' | 'BIO' | 'WARNING';
}

interface ActivityFeedProps {
  events: FeedEvent[];
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ events }) => {
  return (
    <div className="flex flex-col h-full glass-card rounded-[2rem] overflow-hidden">
      <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
        <div className="flex items-center gap-3">
          <Terminal className="w-4 h-4 text-gray-500" />
          <span className="text-[10px] font-mono font-bold tracking-[0.3em] text-gray-400 uppercase">Overseer_Event_Log</span>
        </div>
        <div className="flex gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-system-accent animate-pulse" />
          <div className="w-1.5 h-1.5 rounded-full bg-medical-blue animate-pulse [animation-delay:0.2s]" />
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
        <AnimatePresence initial={false}>
          {events.map((event) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex gap-4 group"
            >
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
                  event.type === 'SECURITY' ? 'bg-system-accent/10 border-system-accent/20 text-system-accent' :
                  event.type === 'BIO' ? 'bg-medical-blue/10 border-medical-blue/20 text-medical-blue' :
                  event.type === 'WARNING' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500' :
                  'bg-white/5 border-white/10 text-gray-500'
                }`}>
                  {event.type === 'SECURITY' ? <Shield className="w-4 h-4" /> :
                   event.type === 'BIO' ? <Zap className="w-4 h-4" /> :
                   <AlertCircle className="w-4 h-4" />}
                </div>
                <div className="w-[1px] flex-1 bg-white/5 my-2 group-last:hidden" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-1">
                  <span className={`text-[9px] font-mono font-bold tracking-widest ${
                    event.type === 'SECURITY' ? 'text-system-accent' :
                    event.type === 'BIO' ? 'text-medical-blue' :
                    'text-gray-500'
                  }`}>
                    {event.type}
                  </span>
                  <span className="text-[8px] font-mono text-gray-700">{event.timestamp}</span>
                </div>
                <p className="text-[11px] font-mono text-gray-400 leading-relaxed break-words">
                  {event.message}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {events.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center opacity-20 py-20">
            <Terminal className="w-12 h-12 mb-4" />
            <span className="text-[10px] font-mono tracking-widest">Awaiting system events...</span>
          </div>
        )}
      </div>
    </div>
  );
};
