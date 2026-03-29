$content = Get-Content "D:\Project\NapasDulu\src\App.tsx" -Raw

# Add imports
$content = $content -replace "import \{ ShieldAlert, Terminal", "import { ActiveSessionHUD } from './components/ActiveSessionHUD';`nimport { LockdownSequence } from './components/LockdownSequence';`nimport { ShieldAlert, Terminal"

# Replace the giant HUD circle inside App.tsx with the ActiveSessionHUD component
$oldHud = @"
                 <div className=`"relative group mb-12`">
                   <div className=`"absolute inset-0 bg-system-accent opacity-20 blur-3xl group-hover:opacity-30 transition-opacity rounded-full`" />
                   <div className=`"w-[400px] h-[400px] rounded-full border border-system-border/50 bg-black/40 flex flex-col items-center justify-center relative overflow-hidden backdrop-blur-xl shadow-[0_0_50px_rgba(0,0,0,0.8)]`">
                     <div className=`"absolute inset-0 border-[4px] border-system-border rounded-full border-t-system-accent opacity-30 animate-spin-slow`" />
                     <div className=`"absolute inset-2 border-[1px] border-system-border rounded-full border-b-system-accent opacity-20 animate-spin-reverse-slow`" />
                     <div className=`"absolute inset-4 border-[2px] border-dotted border-white/10 rounded-full`" />
                     <div className=`"flex flex-col items-center z-10 relative`">
                       <Clock className=`"w-8 h-8 text-system-accent mb-4 opacity-80 shadow-[0_0_15px_rgba(239,68,68,0.5)]`" />
                       <div className=`"text-[100px] font-mono font-bold leading-none tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-600 drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]`">
                         {formatTime(activeTime)}
                       </div>
                       <div className=`"text-xs tracking-[0.4em] text-system-accent uppercase mt-2 font-mono ml-2`">{t(`"active_session`")}</div>
                     </div>
                   </div>
                 </div>
"@
$newHud = "                 <div className=`"mb-12`"><ActiveSessionHUD timeRemaining={Math.max(0, sessionLimit - activeTime)} totalTime={sessionLimit || 1} t={t} /></div>`n"
$content = $content.Replace($oldHud, $newHud)

# Replace the lockdown sequence
$oldLockdownRegex = "<motion\.div key=`"lockdown`".*?NAPASDULU // OVERSEER-V1\.2\.0\s*</div>\s*</motion\.div>"
$newLockdown = @"
          <motion.div key="lockdown" {...pageTransition}>
            <LockdownSequence 
              t={t} aiProtocol={aiProtocol} countdown={countdown}
              showBypassInput={showBypassInput} setShowBypassInput={setShowBypassInput}
              emergencyReason={emergencyReason} setEmergencyReason={setEmergencyReason}
              emergencyDuration={emergencyDuration} setEmergencyDuration={setEmergencyDuration}
              bypassInput={bypassInput} setBypassInput={setBypassInput}
              attemptBypass={attemptBypass}
            />
          </motion.div>
"@
$content = [System.Text.RegularExpressions.Regex]::Replace($content, $oldLockdownRegex, $newLockdown, [System.Text.RegularExpressions.RegexOptions]::Singleline)

Set-Content "D:\Project\NapasDulu\src\App.tsx" $content