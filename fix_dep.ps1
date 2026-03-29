$content = Get-Content "D:\Project\NapasDulu\src\App.tsx" -Raw
$content = $content -replace "}, \[userName, warning\]\);", "}, [userName, warning, appState]);"
Set-Content "D:\Project\NapasDulu\src\App.tsx" $content