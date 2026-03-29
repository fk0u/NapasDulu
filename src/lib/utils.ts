export function formatProcessName(exeName: string): string {
  const lowerName = exeName.toLowerCase();
  
  const mappings: Record<string, string> = {
    'code.exe': 'VS Code',
    'chrome.exe': 'Google Chrome',
    'msedge.exe': 'Microsoft Edge',
    'firefox.exe': 'Firefox',
    'brave.exe': 'Brave Browser',
    'explorer.exe': 'File Explorer',
    'spotify.exe': 'Spotify',
    'discord.exe': 'Discord',
    'slack.exe': 'Slack',
    'telegram.exe': 'Telegram',
    'whatsapp.exe': 'WhatsApp',
    'obs64.exe': 'OBS Studio',
    'figma.exe': 'Figma',
    'idea64.exe': 'IntelliJ IDEA',
    'webstorm64.exe': 'WebStorm',
    'studio64.exe': 'Android Studio',
    'devenv.exe': 'IntelliJ / WebStorm',
    'postman.exe': 'Postman',
    'insomnia.exe': 'Insomnia',
    'datagrip64.exe': 'DataGrip',
    'dbeaver64.exe': 'DBeaver',
    'cmd.exe': 'Command Prompt',
    'powershell.exe': 'PowerShell',
    'windowsterminal.exe': 'Windows Terminal',
    'wezterm-gui.exe': 'WezTerm',
    'alacritty.exe': 'Alacritty',
    'steam.exe': 'Steam',
    'vlc.exe': 'VLC Media Player',
    'zoom.exe': 'Zoom',
    'teams.exe': 'Microsoft Teams',
    'notion.exe': 'Notion',
    'obsidian.exe': 'Notion / Obsidian',
    'word.exe': 'Microsoft Word',
    'excel.exe': 'Microsoft Excel',
    'powerpnt.exe': 'Microsoft PowerPoint',
    'cursor.exe': 'Cursor IDE',
    'warp.exe': 'Warp Terminal',
    'githubdesktop.exe': 'GitHub Desktop',
    'sublime_text.exe': 'Sublime Text',
    'phpstorm64.exe': 'PhpStorm',
  };

  // Remove .exe extension if present
  let cleanName = exeName.replace(/\.exe$/i, '');
  
  if (mappings[lowerName]) {
    return mappings[lowerName];
  }
  
  // Title case the raw name if no mapping found
  return cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
}
