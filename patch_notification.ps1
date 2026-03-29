$content = Get-Content "D:\Project\NapasDulu\src\App.tsx" -Raw
$content = $content -replace "import \{ getCurrentWindow \}", "import { getCurrentWindow } from `"@tauri-apps/api/window`";`nimport { isPermissionGranted, requestPermission, sendNotification } from `'@tauri-apps/plugin-notification`';"
$content = $content -replace "import \{ getCurrentWindow \} from `"@tauri-apps/api/window`";`nimport \{ getCurrentWindow \} from `"@tauri-apps/api/window`";", "import { getCurrentWindow } from `"@tauri-apps/api/window`";"

$mountEffect = @"
  useEffect(() => {
    isAutostartEnabled().then(setAutostart).catch(console.error);
    if (!userName) {
"@
$newMountEffect = @"
  useEffect(() => {
    isAutostartEnabled().then(setAutostart).catch(console.error);
    
    // Request OS Notification Permissions
    isPermissionGranted().then(granted => {
      if (!granted) requestPermission().catch(console.error);
    }).catch(console.error);

    if (!userName) {
"@
$content = $content.Replace($mountEffect, $newMountEffect)

$triggerWarning = @"
    const unlistenWarning = listen("trigger-warning", () => {
      if (!warning) {
        setWarning(true);
        audioSynth.playWarningSiren();
      }
    });
"@
$newTriggerWarning = @"
    const unlistenWarning = listen("trigger-warning", () => {
      if (!warning) {
        setWarning(true);
        audioSynth.playWarningSiren();
        sendNotification({
          title: 'NapasDulu: CRITICAL',
          body: 'Biological boundaries will be exceeded in 60 seconds. Wrap up your work.',
        });
      }
    });
"@
$content = $content.Replace($triggerWarning, $newTriggerWarning)

$triggerLockdown = @"
    const unlistenLockdown = listen("trigger-lockdown", () => {
      setAppState("LOCKDOWN");
      setCountdown(600);
      setShowBypassInput(false);
      setBypassInput("");
    });
"@
$newTriggerLockdown = @"
    const unlistenLockdown = listen("trigger-lockdown", () => {
      setAppState("LOCKDOWN");
      setCountdown(600);
      setShowBypassInput(false);
      setBypassInput("");
      sendNotification({
        title: 'NapasDulu: SYSTEM LOCKDOWN',
        body: 'Mandatory rest sequence initiated. Disconnect from terminal immediately.',
      });
    });
"@
$content = $content.Replace($triggerLockdown, $newTriggerLockdown)

Set-Content "D:\Project\NapasDulu\src\App.tsx" $content