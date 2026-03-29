$content = Get-Content "D:\Project\NapasDulu\src-tauri\src\activity.rs" -Raw
$oldBlock = "// --- THRESHOLD VALIDATION ---"
$newBlock = @"
// --- THRESHOLD VALIDATION ---
            // Micro-break every 20 mins (1200 seconds)
            if total_active > 0 && total_active % 1200 == 0 {
                let _ = app_handle.emit("trigger-microbreak", ());
            }
"@
$content = $content.Replace($oldBlock, $newBlock)
Set-Content "D:\Project\NapasDulu\src-tauri\src\activity.rs" $content

$appContent = Get-Content "D:\Project\NapasDulu\src\App.tsx" -Raw
$appContent = $appContent -replace "import \{ ShieldAlert", "import { MicroBreak } from './components/MicroBreak';`nimport { ShieldAlert"
$appContent = $appContent -replace "<div className=`"relative w-full h-full overflow-x-hidden overflow-y-auto bg-\[\#050505\] text-system-text font-sans selection:bg-system-accent/30 selection:text-white pb-10`">", "<div className=`"relative w-full h-full overflow-x-hidden overflow-y-auto bg-[#050505] text-system-text font-sans selection:bg-system-accent/30 selection:text-white pb-10`">`n      <MicroBreak />"
Set-Content "D:\Project\NapasDulu\src\App.tsx" $appContent