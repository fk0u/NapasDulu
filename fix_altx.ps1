$content = Get-Content "D:\Project\NapasDulu\src\App.tsx" -Raw
$content = $content -replace "const handleKeyDown = \(e: KeyboardEvent\) => \{[\s\S]*?invoke\(`"quit_app`"\);[\s\S]*?\}[\s\S]*?\};", `
"const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'x') {
        if (appState !== 'LOCKDOWN') {
          invoke('quit_app');
        } else {
          showToast('Lockdown active. Alt+X disabled.', 'error');
        }
      }
    };"
Set-Content "D:\Project\NapasDulu\src\App.tsx" $content