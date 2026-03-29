$content = Get-Content "D:\Project\NapasDulu\src\App.tsx" -Raw

$oldLogic = @"
  useEffect(() => {
    let interval: number;
    
    if (appState === `"IDLE`") {
      audioSynth.playBootSequence();
      
      const fetchStats = async () => {
        try {
          const res: any = await invoke(`"get_stats`");
          setStats(res);
          setActiveTime(res.active_time);
          setSessionLimit(res.session_limit);
          
          if (res.active_time >= res.session_limit - 60) {
              setWarning(true);
          } else {
              setWarning(false);
          }
          
          if (activeHud === `"HISTORY`") {
              const hist: UsageDay[] = await invoke(`"get_usage_history`");
              setUsageHistory(hist);
          } else if (activeHud === `"WAKATIME`") {
              const apps: AppUsageStat[] = await invoke(`"get_app_usage_stats`");
              setAppHistory(apps);
          }
        } catch(e) {}
      };
      
      fetchStats();
      interval = window.setInterval(fetchStats, 1000);
    }
    return () => clearInterval(interval);
  }, [appState, activeHud]);
"@

$newLogic = @"
  // Run heavy DB fetches ONLY on mount or HUD toggle
  useEffect(() => {
    if (appState === "IDLE") {
      const fetchHeavyStats = async () => {
        try {
          const res: any = await invoke("get_stats");
          setStats(res);
          setActiveTime(res.active_time);
          setSessionLimit(res.session_limit);
          
          if (activeHud === "HISTORY") {
              const hist: UsageDay[] = await invoke("get_usage_history");
              setUsageHistory(hist);
          } else if (activeHud === "WAKATIME") {
              const apps: AppUsageStat[] = await invoke("get_app_usage_stats");
              setAppHistory(apps);
          }
        } catch(e) {}
      };
      fetchHeavyStats();
    }
  }, [appState, activeHud]);

  // Ultra-lightweight 1000ms polling (Memory-only)
  useEffect(() => {
    let interval: number;
    if (appState === "IDLE") {
      audioSynth.playBootSequence();
      interval = window.setInterval(async () => {
        try {
          const activeSeconds: number = await invoke("get_active_time");
          setActiveTime(activeSeconds);
          
          // Use latest session limit from state
          setSessionLimit((currentLimit) => {
            if (activeSeconds >= currentLimit - 60) {
                setWarning(true);
            } else {
                setWarning(false);
            }
            return currentLimit;
          });
        } catch(e) {}
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [appState]);
"@

$content = $content.Replace($oldLogic, $newLogic)
Set-Content "D:\Project\NapasDulu\src\App.tsx" $content