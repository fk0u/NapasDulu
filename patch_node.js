import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf-8');

code = code.replace(
  'import { getCurrentWindow } from "@tauri-apps/api/window";',
  'import { getCurrentWindow } from "@tauri-apps/api/window";\nimport { isEnabled as isAutostartEnabled, enable as enableAutostart, disable as disableAutostart } from "@tauri-apps/plugin-autostart";'
);

code = code.replace(
  'import { generateHealthProtocol',
  'import { formatProcessName } from "./lib/utils";\nimport { generateHealthProtocol'
);

code = code.replace(
  'const [onboardingWeight, setOnboardingWeight] = useState("");',
  'const [onboardingWeight, setOnboardingWeight] = useState("");\n  const [autostart, setAutostart] = useState(false);'
);

code = code.replace(
  'useEffect(() => {\n    if (!userName) {',
  'useEffect(() => {\n    isAutostartEnabled().then(setAutostart).catch(console.error);\n    if (!userName) {'
);

code = code.replace(
  'setAppHistory(apps);',
  'setAppHistory(apps.map((app: any) => ({...app, app_name: formatProcessName(app.app_name)})));'
);

code = code.replace(
  'const simulateLockdown = async () => {',
  `const toggleAutostart = async () => {
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

  const simulateLockdown = async () => {`
);

code = code.replace(
  '<div className="flex gap-3 mt-4">',
  `<div className="flex items-center justify-between bg-[#030303] border border-system-border/80 rounded-lg p-4 mt-2 mb-4">
                  <div>
                    <h3 className="text-[10px] text-gray-300 font-mono uppercase tracking-widest">System Boot Sequence</h3>
                    <p className="text-[9px] text-gray-500 font-mono mt-1">Launch NapasDulu automatically when OS starts</p>
                  </div>
                  <button 
                    type="button" 
                    onClick={toggleAutostart}
                    className={\`relative inline-flex h-5 w-10 items-center rounded-full transition-colors \${autostart ? 'bg-blue-600' : 'bg-gray-700'}\`}
                  >
                    <span className={\`inline-block h-3 w-3 transform rounded-full bg-white transition-transform \${autostart ? 'translate-x-6' : 'translate-x-1'}\`} />
                  </button>
                </div>
                
                <div className="flex gap-3 mt-4">`
);

fs.writeFileSync('src/App.tsx', code);
