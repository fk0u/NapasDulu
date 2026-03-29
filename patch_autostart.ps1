$content = Get-Content "D:\Project\NapasDulu\src\App.tsx" -Raw

# 1. Add Autostart import
$content = $content -replace "import \{ getCurrentWindow \} from `"@tauri-apps/api/window`";", "import { getCurrentWindow } from `"@tauri-apps/api/window`";`nimport { isEnabled as isAutostartEnabled, enable as enableAutostart, disable as disableAutostart } from `'@tauri-apps/plugin-autostart`';"

# 2. Add Autostart state
$stateRegex = "const \[onboardingWeight, setOnboardingWeight\] = useState\(`"`"\);"
$newStates = "const [onboardingWeight, setOnboardingWeight] = useState(`"`");`n  const [autostart, setAutostart] = useState(false);"
$content = $content -replace [regex]::Escape($stateRegex), $newStates

# 3. Add Autostart load effect
$mountEffectRegex = "useEffect\(\(\) => \{`n    if \(userName\) \{"
$mountNew = @"
  useEffect(() => {
    isAutostartEnabled().then(setAutostart).catch(console.error);
    if (userName) {
"@
$content = $content -replace [regex]::Escape($mountEffectRegex), $mountNew

# 4. Add Toggle Function
$toggleFunction = @"
  const toggleAutostart = async () => {
    try {
      if (autostart) {
        await disableAutostart();
        setAutostart(false);
        showToast("System Startup Launcher Disabled.", "warning");
      } else {
        await enableAutostart();
        setAutostart(true);
        showToast("System Startup Launcher Enabled.", "success");
      }
    } catch (e) {
      showToast("Failed to modify system startup.", "error");
    }
  };
"@
$content = $content -replace "const simulateLockdown", "$toggleFunction`n  const simulateLockdown"

# 5. Add Autostart Toggle UI inside SETTINGS form
$settingsUIRegex = "<div className=`"flex gap-3 mt-4`">"
$settingsNewUI = @"
                <div className="flex items-center justify-between bg-[#030303] border border-system-border/80 rounded-lg p-4 mt-2">
                  <div>
                    <h3 className="text-[10px] text-gray-300 font-mono uppercase tracking-widest">System Boot Sequence</h3>
                    <p className="text-[9px] text-gray-500 font-mono mt-1">Launch NapasDulu automatically when OS starts</p>
                  </div>
                  <button 
                    type="button" 
                    onClick={toggleAutostart}
                    className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${autostart ? 'bg-blue-600' : 'bg-gray-700'}`}
                  >
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${autostart ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
                
                <div className="flex gap-3 mt-4">
"@
$content = $content -replace [regex]::Escape($settingsUIRegex), $settingsNewUI

Set-Content "D:\Project\NapasDulu\src\App.tsx" $content
