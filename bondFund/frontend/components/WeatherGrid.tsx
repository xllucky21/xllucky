
import React from 'react';
import { BondReportData } from '../types';
import { CalendarDays } from 'lucide-react';

interface WeatherGridProps {
  reports: BondReportData[];
}

export const WeatherGrid: React.FC<WeatherGridProps> = ({ reports }) => {
  // Show recent 12 reports for a nice desktop grid (12 cols) or mobile (3-4 cols)
  const recentReports = reports.slice(0, 12);

  // If only 1 report, show a hint
  if (recentReports.length <= 1) {
    return (
      <div className="bg-slate-900 rounded-2xl shadow-lg border border-slate-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-100 flex items-center">
            <CalendarDays className="w-5 h-5 mr-2 text-indigo-400" />
            近期天气概览
          </h3>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <span className="text-4xl mb-3">📊</span>
          <p className="text-slate-400 text-sm">历史数据积累中...</p>
          <p className="text-slate-500 text-xs mt-1">每天运行脚本后，这里会显示近12期的天气变化趋势</p>
        </div>
      </div>
    );
  }

  const getScoreColorClass = (score: number) => {
    if (score >= 80) return 'text-orange-400';
    if (score >= 60) return 'text-amber-400';
    if (score >= 40) return 'text-blue-400';
    if (score >= 20) return 'text-indigo-400';
    return 'text-slate-400';
  };

  const getBgColorClass = (score: number) => {
     if (score >= 80) return 'bg-orange-950/20 border-orange-500/20 group-hover:border-orange-500/50 hover:bg-orange-950/30';
     if (score >= 60) return 'bg-amber-950/20 border-amber-500/20 group-hover:border-amber-500/50 hover:bg-amber-950/30';
     if (score >= 40) return 'bg-blue-950/20 border-blue-500/20 group-hover:border-blue-500/50 hover:bg-blue-950/30';
     if (score >= 20) return 'bg-indigo-950/20 border-indigo-500/20 group-hover:border-indigo-500/50 hover:bg-indigo-950/30';
     return 'bg-slate-800/50 border-slate-700 group-hover:border-slate-600';
  };

  return (
    <div className="bg-slate-900 rounded-2xl shadow-lg border border-slate-800 p-6">
        <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-100 flex items-center">
                <CalendarDays className="w-5 h-5 mr-2 text-indigo-400" />
                近期天气概览
            </h3>
            <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded-full border border-slate-700">近 12 期</span>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-3">
            {recentReports.map((report, idx) => {
                const { conclusion } = report;
                const score = conclusion.score;
                const [icon] = conclusion.weather.split(' ');
                const dateObj = new Date(conclusion.last_date);
                const dateStr = `${(dateObj.getMonth() + 1).toString().padStart(2, '0')}-${dateObj.getDate().toString().padStart(2, '0')}`;

                return (
                    <div 
                        key={`${conclusion.last_date}-${idx}`} 
                        className={`group relative flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-300 cursor-default ${getBgColorClass(score)}`}
                    >
                        <span className="text-[10px] font-mono text-slate-500 mb-1">{dateStr}</span>
                        <span className="text-2xl mb-1 filter drop-shadow-md transform group-hover:scale-110 transition-transform">{icon}</span>
                        <span className={`text-xs font-bold ${getScoreColorClass(score)}`}>{score.toFixed(0)}</span>
                        
                        {/* Simple Hover Tooltip */}
                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-40 bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none z-50 text-center">
                            <div className="text-xs text-slate-300 font-bold mb-1 border-b border-slate-700 pb-1">{conclusion.last_date}</div>
                            <div className="text-xs text-slate-400 mb-1">{conclusion.weather}</div>
                            <div className={`text-sm font-bold ${getScoreColorClass(score)}`}>评分: {score.toFixed(2)}</div>
                            <div className="absolute left-1/2 transform -translate-x-1/2 -bottom-1.5 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-slate-700"></div>
                        </div>
                    </div>
                )
            })}
        </div>
    </div>
  );
}
