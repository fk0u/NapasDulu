import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings as SettingsIcon, User, Power, Shield, Info, Save } from 'lucide-react';
import { isEnabled as isAutostartEnabled, enable as enableAutostart, disable as disableAutostart } from "@tauri-apps/plugin-autostart";

interface SettingsProps {
  lang: "ID" | "EN";
  setLang: (l: "ID" | "EN") => void;
  onSave: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ lang, setLang, onSave }) => {
  const [autostart, setAutostart] = useState(false);
  const [userName, setUserName] = useState(localStorage.getItem("userName") || "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    isAutostartEnabled().then(setAutostart);
  }, []);

  const toggleAutostart = async () => {
    if (autostart) {
      await disableAutostart();
      setAutostart(false);
    } else {
      await enableAutostart();
      setAutostart(true);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    localStorage.setItem("userName", userName);
    // Add other saves here if needed
    setTimeout(() => {
      setLoading(false);
      onSave();
    }, 1000);
  };

  return (
    <div className="space-y-10">
      <div className="space-y-2">
        <div className="text-gray-500 flex items-center gap-2">
          <SettingsIcon className="w-4 h-4" />
          <span className="text-[10px] font-mono font-bold tracking-[0.4em] uppercase">System_Configuration</span>
        </div>
        <h1 className="text-4xl font-bold tracking-tighter text-white">Overseer Settings</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <form onSubmit={handleSave} className="lg:col-span-8 space-y-8">
          {/* Profile Section */}
          <div className="glass-card rounded-[3rem] p-10 space-y-8">
            <div className="flex items-center gap-4 border-b border-white/5 pb-6">
               <User className="w-5 h-5 text-medical-blue" />
               <h2 className="text-lg font-bold tracking-tight text-white">Operator Profile</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="space-y-3">
                  <label className="block text-[10px] font-mono font-bold text-gray-500 uppercase tracking-widest">Neural Alias</label>
                  <input 
                    type="text" 
                    className="w-full bg-white/[0.02] border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-medical-blue/50 transition-all font-mono text-sm text-white"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                  />
               </div>
               <div className="space-y-3">
                  <label className="block text-[10px] font-mono font-bold text-gray-500 uppercase tracking-widest">Language Matrix</label>
                  <div className="flex bg-white/[0.02] border border-white/10 rounded-2xl p-1">
                     <button 
                       type="button"
                       onClick={() => setLang("EN")}
                       className={`flex-1 py-3 rounded-xl font-mono text-[10px] font-bold transition-all ${lang === 'EN' ? 'bg-white text-black' : 'text-gray-500 hover:text-white'}`}
                     >
                       ENGLISH
                     </button>
                     <button 
                       type="button"
                       onClick={() => setLang("ID")}
                       className={`flex-1 py-3 rounded-xl font-mono text-[10px] font-bold transition-all ${lang === 'ID' ? 'bg-white text-black' : 'text-gray-500 hover:text-white'}`}
                     >
                       INDONESIA
                     </button>
                  </div>
               </div>
            </div>
          </div>

          {/* System Section */}
          <div className="glass-card rounded-[3rem] p-10 space-y-8">
            <div className="flex items-center gap-4 border-b border-white/5 pb-6">
               <Shield className="w-5 h-5 text-system-accent" />
               <h2 className="text-lg font-bold tracking-tight text-white">Core System</h2>
            </div>
            
            <div className="space-y-6">
               <div className="flex items-center justify-between p-6 rounded-[2rem] bg-white/[0.02] border border-white/5">
                  <div className="flex items-center gap-4">
                     <div className="p-3 rounded-xl bg-white/5">
                        <Power className={`w-5 h-5 ${autostart ? 'text-green-500' : 'text-gray-500'}`} />
                     </div>
                     <div>
                        <div className="text-sm font-bold tracking-tight text-white">Auto-Initialize on Boot</div>
                        <div className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">OS Startup Integration</div>
                     </div>
                  </div>
                  <button 
                    type="button"
                    onClick={toggleAutostart}
                    className={`relative w-14 h-7 rounded-full transition-all duration-500 ${autostart ? 'bg-medical-blue shadow-[0_0_15px_rgba(0,210,255,0.4)]' : 'bg-white/10'}`}
                  >
                    <motion.div 
                      animate={{ x: autostart ? 32 : 4 }}
                      className="absolute top-1 w-5 h-5 rounded-full bg-white shadow-lg"
                    />
                  </button>
               </div>
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-6 rounded-3xl bg-white text-black font-bold tracking-[0.4em] hover:bg-gray-200 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
          >
            {loading ? "COMMITTING CHANGES..." : "SAVE CONFIGURATION"}
            <Save className="w-5 h-5" />
          </button>
        </form>

        <div className="lg:col-span-4 space-y-8">
           <div className="glass-card rounded-[2.5rem] p-8 space-y-6 opacity-50 grayscale">
              <div className="flex items-center gap-3">
                 <Info className="w-4 h-4" />
                 <span className="text-[10px] font-mono font-bold tracking-widest uppercase">Version_Info</span>
              </div>
              <div className="space-y-2">
                 <div className="flex justify-between text-[10px] font-mono uppercase">
                    <span className="text-gray-500">Core Engine</span>
                    <span className="text-white">v1.3.1</span>
                 </div>
                 <div className="flex justify-between text-[10px] font-mono uppercase">
                    <span className="text-gray-500">Neural Model</span>
                    <span className="text-white">Gemini-2.0</span>
                 </div>
                 <div className="flex justify-between text-[10px] font-mono uppercase">
                    <span className="text-gray-500">Build Target</span>
                    <span className="text-white">Windows x64</span>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};
