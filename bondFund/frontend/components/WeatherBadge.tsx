import React from 'react';

interface WeatherBadgeProps {
  weather: string;
  score: number;
}

export const WeatherBadge: React.FC<WeatherBadgeProps> = ({ weather, score }) => {
  // Determine color based on score ranges provided in the prompt
  // Dark mode colors: Using bg-opacity/20 and lighter text colors

  let bgClass = 'bg-slate-800 text-slate-300';
  let borderClass = 'border-slate-700';

  if (score >= 80) {
    // 烈日 (Extreme Opportunity) -> Orange/Red
    bgClass = 'bg-orange-900/30 text-orange-200';
    borderClass = 'border-orange-500/30';
  } else if (score >= 60) {
    // 晴朗 (Good) -> Amber/Yellow
    bgClass = 'bg-amber-900/30 text-amber-200';
    borderClass = 'border-amber-500/30';
  } else if (score >= 40) {
    // 多云 (Neutral) -> Blue
    bgClass = 'bg-blue-900/30 text-blue-200';
    borderClass = 'border-blue-500/30';
  } else if (score >= 20) {
    // 小雨 (Risk) -> Indigo
    bgClass = 'bg-indigo-900/30 text-indigo-200';
    borderClass = 'border-indigo-500/30';
  } else {
    // 暴雨 (Extreme Risk) -> Purple/Dark
    bgClass = 'bg-slate-800/80 text-slate-400';
    borderClass = 'border-slate-600';
  }

  // Extract just the text description if it contains emojis (simple split)
  // Usually format is "🌤️ 晴朗"
  const [icon, text] = weather.split(' ');

  return (
    <div className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 ${bgClass} ${borderClass} transition-all duration-300 shadow-inner relative z-10`}>
      <span className="text-5xl mb-2 filter drop-shadow-[0_2px_5px_rgba(0,0,0,0.5)]">{icon || '❓'}</span>
      <span className="text-lg font-bold tracking-wide">{text || weather}</span>
    </div>
  );
};