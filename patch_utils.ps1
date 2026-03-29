$content = Get-Content "D:\Project\NapasDulu\src\App.tsx" -Raw
$content = $content -replace "import \{ generateHealthProtocol", "import { formatProcessName } from './lib/utils';`n  import { generateHealthProtocol"

$content = $content -replace "setAppHistory\(apps\);", "setAppHistory(apps.map(app => ({...app, app_name: formatProcessName(app.app_name)})));"

Set-Content "D:\Project\NapasDulu\src\App.tsx" $content
