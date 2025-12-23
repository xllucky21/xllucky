import React, { useState } from 'react';
import { DividendReportData, SIGNAL_COLORS, SIGNAL_TEXT } from '../types';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown } from 'lucide-react';

interface Props {
  reports: DividendReportData[];
}

export const HistoryList: React.FC<Props> = ({ reports }) => {
  const [expanded, setExpanded] = useState(false);
  
  // 显示的记录数
  const displayCount = expanded ? reports.length : 10;
  const displayReports = reports.slice(0, displayCount);
  
  // 获取评分颜色
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 65) return 'text-lime-400';
    if (score >= 50) return 'text-yellow-400';
    if (score >= 35) return 'text-orange-400';
    return 'text-red-400';
  };
  
  // 获取评分背景
  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-500/10';
    if (score >= 65) return 'bg-lime-500/10';
    if (score >= 50) return 'bg-yellow-500/10';
    if (score >= 35) return 'bg-orange-500/10';
    return 'bg-red-500/10';
  };

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          📋 历史记录
        </h3>
        <span className="text-xs text-slate-500">共 {reports.length} 条</span>
      </div>
      
      {/* 表头 */}
      <div className="grid grid-cols-6 gap-2 px-4 py-2 bg-slate-800/50 text-xs text-slate-400 font-medium">
        <div>日期</div>
        <div className="text-center">评分</div>
        <div className="text-center">信号</div>
        <div className="text-right">指数</div>
        <div className="text-right">股息率</div>
        <div className="text-right">利差</div>
      </div>
      
      {/* 数据行 */}
      <div className="divide-y divide-slate-800/50">
        {displayReports.map((report, index) => {
          const { conclusion } = report;
          const prevReport = reports[index + 1];
          const scoreChange = prevReport 
            ? conclusion.score - prevReport.conclusion.score 
            : 0;
          
          return (
            <div 
              key={report.generated_at}
              className="grid grid-cols-6 gap-2 px-4 py-3 text-sm hover:bg-slate-800/30 transition-colors"
            >
              {/* 日期 */}
              <div className="text-slate-300">{conclusion.last_date}</div>
              
              {/* 评分 */}
              <div className="text-center">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded ${getScoreBg(conclusion.score)} ${getScoreColor(conclusion.score)}`}>
                  {conclusion.score.toFixed(0)}
                  {scoreChange !== 0 && (
                    scoreChange > 0 
                      ? <TrendingUp size={10} className="text-green-400" />
                      : <TrendingDown size={10} className="text-red-400" />
                  )}
                </span>
              </div>
              
              {/* 信号 */}
              <div className="text-center">
                <span 
                  className="text-xs px-2 py-0.5 rounded"
                  style={{ 
                    color: SIGNAL_COLORS[conclusion.signal],
                    backgroundColor: `${SIGNAL_COLORS[conclusion.signal]}15`
                  }}
                >
                  {SIGNAL_TEXT[conclusion.signal]}
                </span>
              </div>
              
              {/* 指数 */}
              <div className="text-right text-slate-300">
                {conclusion.last_close.toFixed(2)}
              </div>
              
              {/* 股息率 */}
              <div className="text-right text-amber-400">
                {conclusion.dividend_yield !== null 
                  ? `${conclusion.dividend_yield.toFixed(2)}%` 
                  : '-'}
              </div>
              
              {/* 利差 */}
              <div className={`text-right ${
                conclusion.spread !== null
                  ? conclusion.spread >= 1 ? 'text-green-400' : conclusion.spread <= 0 ? 'text-red-400' : 'text-yellow-400'
                  : 'text-slate-500'
              }`}>
                {conclusion.spread !== null 
                  ? `${conclusion.spread.toFixed(2)}%` 
                  : '-'}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* 展开/收起按钮 */}
      {reports.length > 10 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full py-3 text-sm text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors flex items-center justify-center gap-2"
        >
          {expanded ? (
            <>
              <ChevronUp size={16} />
              收起
            </>
          ) : (
            <>
              <ChevronDown size={16} />
              展开更多 ({reports.length - 10} 条)
            </>
          )}
        </button>
      )}
    </div>
  );
};
