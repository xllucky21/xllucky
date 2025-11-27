
import React from 'react';
import { BondReportData } from '../types';
import { Calendar, Activity, TrendingUp, TrendingDown } from 'lucide-react';
import { InfoTooltip } from './InfoTooltip';

interface HistoryListProps {
  reports: BondReportData[];
}

export const HistoryList: React.FC<HistoryListProps> = ({ reports }) => {
  
  const getScoreColorClass = (score: number) => {
    if (score >= 80) return 'text-orange-400';
    if (score >= 60) return 'text-amber-400';
    if (score >= 40) return 'text-blue-400';
    if (score >= 20) return 'text-indigo-400';
    return 'text-slate-400';
  };

  const getTrendIcon = (trendVal: string) => {
    return trendVal === '牛' ? (
      <span className="flex items-center text-emerald-400 text-xs font-bold bg-emerald-950/30 px-2 py-1 rounded border border-emerald-500/20">
        <TrendingUp className="w-3 h-3 mr-1" /> 牛市
      </span>
    ) : (
      <span className="flex items-center text-rose-400 text-xs font-bold bg-rose-950/30 px-2 py-1 rounded border border-rose-500/20">
        <TrendingDown className="w-3 h-3 mr-1" /> 熊市
      </span>
    );
  };

  return (
    <div className="bg-slate-900 rounded-2xl shadow-lg border border-slate-800 overflow-hidden">
      <div className="p-6 border-b border-slate-800 flex justify-between items-center">
        <h3 className="text-lg font-bold text-slate-100 flex items-center">
          <Calendar className="w-5 h-5 mr-2 text-indigo-400" />
          历史晴雨表
        </h3>
        <span className="text-xs text-slate-500">共 {reports.length} 期报告</span>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-950/50">
              <th className="p-4 text-slate-500 font-medium text-xs uppercase tracking-wider border-b border-slate-800">日期</th>
              <th className="p-4 text-slate-500 font-medium text-xs uppercase tracking-wider border-b border-slate-800">
                <InfoTooltip position="bottom" term="天气状况" content={`☀️ 烈日 (80-100)：极度低估，重仓\n🌤️ 晴朗 (60-80)：机会区间，加仓\n☁️ 多云 (40-60)：震荡市，观望\n🌧️ 小雨 (20-40)：风险区间，减仓\n⛈️ 暴雨 (0-20)：极度高估，清仓`} showIcon={false} />
              </th>
              <th className="p-4 text-slate-500 font-medium text-xs uppercase tracking-wider border-b border-slate-800">
                <InfoTooltip position="bottom" term="综合评分" content={`0-100分，分数越高机会越大。\n\n计算维度：\n• 估值分位\n• MA60趋势\n• RSI/MACD动量\n• 宏观/资金面修正`} showIcon={false} />
              </th>
              <th className="p-4 text-slate-500 font-medium text-xs uppercase tracking-wider border-b border-slate-800">
                <InfoTooltip position="bottom" term="市场趋势" content={`基于 MA60 (60日均线) 判定\n\n🐂 牛：利率 < MA60\n🐻 熊：利率 > MA60`} showIcon={false} />
              </th>
              <th className="p-4 text-slate-500 font-medium text-xs uppercase tracking-wider border-b border-slate-800 hidden md:table-cell">
                <InfoTooltip position="bottom" term="利率 (10y)" content="10年期国债收益率。收益率越低，债基净值越高。" showIcon={false} />
              </th>
              <th className="p-4 text-slate-500 font-medium text-xs uppercase tracking-wider border-b border-slate-800 hidden lg:table-cell">操作建议</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {reports.map((report, index) => {
              const { conclusion } = report;
              // Parse weather icon and text
              const [icon, weatherText] = conclusion.weather.split(' ');
              
              return (
                <tr key={report.report_folder} className="hover:bg-slate-800/50 transition-colors group">
                  <td className="p-4 text-sm font-mono text-slate-400">
                    {conclusion.last_date}
                    {index === 0 && (
                      <span className="ml-2 inline-block px-1.5 py-0.5 rounded text-[10px] bg-indigo-500 text-white font-bold">
                        NEW
                      </span>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center text-slate-200">
                      <span className="text-xl mr-2">{icon}</span>
                      <span className="text-sm font-medium">{weatherText || conclusion.weather}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center">
                      <span className={`text-lg font-bold ${getScoreColorClass(conclusion.score)}`}>
                        {conclusion.score.toFixed(2)}
                      </span>
                      <span className="text-slate-600 text-xs ml-1">/100</span>
                    </div>
                  </td>
                  <td className="p-4">
                    {getTrendIcon(conclusion.trend_val)}
                  </td>
                  <td className="p-4 hidden md:table-cell">
                    <span className="text-sm text-slate-300 font-mono">{conclusion.last_yield.toFixed(4)}%</span>
                  </td>
                  <td className="p-4 hidden lg:table-cell max-w-xs">
                    <p className="text-xs text-slate-500 truncate group-hover:text-slate-400 transition-colors">
                      {conclusion.suggestion_con}
                    </p>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
