export const formatProcessName = (name: string): string => {
  if (!name) return "Unknown";
  // Remove .exe and common path artifacts
  let clean = name.replace(/\.exe$/i, "").replace(/_/g, " ");
  // Capitalize first letters
  return clean.replace(/\b\w/g, (l) => l.toUpperCase());
};

export const calculateHealthScore = (stats: {
  sleep_hours: number;
  bypass_count: number;
  active_time: number;
  session_limit: number;
}): number => {
  let score = 100;

  // Sleep Penalty: Expect 7-9 hours. Penalize if < 7.
  if (stats.sleep_hours < 7) {
    score -= (7 - stats.sleep_hours) * 10;
  }

  // Bypass Penalty: Strict -20 per bypass.
  score -= stats.bypass_count * 20;

  // Active Session Penalty: If active_time is > 80% of limit, start penalizing.
  const activeRatio = stats.active_time / (stats.session_limit || 1);
  if (activeRatio > 0.8) {
    score -= (activeRatio - 0.8) * 50;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
};

export const getHealthVerdict = (score: number, lang: "ID" | "EN") => {
  if (score >= 90) return lang === "ID" ? "Kondisi Optimal" : "Optimal Integrity";
  if (score >= 70) return lang === "ID" ? "Stabil" : "Stable Baseline";
  if (score >= 50) return lang === "ID" ? "Degradasi Subtle" : "Subtle Degradation";
  if (score >= 30) return lang === "ID" ? "Resiko Tinggi" : "High Risk Exposure";
  return lang === "ID" ? "Kritis: Butuh Intervensi" : "Critical: Immediate Intervention";
};
