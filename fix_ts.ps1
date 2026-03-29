$content = Get-Content "D:\Project\NapasDulu\src\App.tsx" -Raw
$content = $content -replace "import \{ ShieldAlert, Terminal, User, Activity, ActivitySquare, BarChart3, Clock, Play, Pause, PieChart, AlertTriangle, MessageSquare, Skull, Globe, Info \} from `"lucide-react`";", "import { ShieldAlert, Terminal, User, Activity, ActivitySquare, BarChart3, Clock, Play, Pause, PieChart, Skull, Globe, Info } from `'lucide-react`';"
Set-Content "D:\Project\NapasDulu\src\App.tsx" $content

$hud = Get-Content "D:\Project\NapasDulu\src\components\ActiveSessionHUD.tsx" -Raw
$hud = $hud -replace "t: \(key: string\) => string;", "t: (key: any) => string;"
Set-Content "D:\Project\NapasDulu\src\components\ActiveSessionHUD.tsx" $hud

$seq = Get-Content "D:\Project\NapasDulu\src\components\LockdownSequence.tsx" -Raw
$seq = $seq -replace "t: \(key: string\) => string;", "t: (key: any) => string;"
$seq = $seq -replace ", Skull ", " "
Set-Content "D:\Project\NapasDulu\src\components\LockdownSequence.tsx" $seq