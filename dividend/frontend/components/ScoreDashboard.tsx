import React from 'react';
import { DividendReportData, SIGNAL_COLORS, SIGNAL_TEXT } from '../types';
import { TrendingUp, TrendingDown, Activity, Percent, BarChart3 } from 'lucide-react';

interface Props {
  data: DividendReportData;
  prevData?: DividendReportData;
}

// 名词解释
const GLOSSARY: Record<string, string> = {
  '股息率': '股息率 = 每股股息 / 股价。代表持有股票一年能获得的分红收益率，是红利投资的核心指标。股息率越高，分红收益越可观。',
  '股债利差': '股债利差 = 股息率 - 10年国债收益率。反映红利股相对于无风险债券的吸引力。利差 > 2% 时红利股极具吸引力，利差 < 0% 时债券更有吸引力。',
  'RSI': 'RSI（相对强弱指数）衡量价格涨跌的动量。RSI < 30 表示超卖（可能反弹），RSI > 70 表示超买（可能回调）。用于辅助判断短期买卖时机。',
};

// Tooltip 卡片组件
const MetricCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  colorClass: string;
  subText?: string;
}> = ({ icon, label, value, colorClass, subText }) => {
  const [showTooltip, setShowTooltip] = React.useState(false);
  const tooltip = GLOSSARY[label];
  
  return (
    <div className="relative group">
      <div 
        className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 hover:border-amber-500/30 transition-colors cursor-help"
        onClick={() => tooltip && setShowTooltip(!showTooltip)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <div className="flex items-center gap-2 text-slate-400 text-xs mb-2">
          {icon}
          {label}
        </div>
        <div className={`text-2xl font-bold ${colorClass}`}>
          {value}
        </div>
        {subText && <div className="text-xs text-slate-500 mt-1">{subText}</div>}
      </div>
      {/* Tooltip - hover 或点击触发 */}
      {tooltip && (
        <div className={`absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg shadow-xl transition-all duration-200 w-64 pointer-events-none ${
          showTooltip ? 'opacity-100 visible' : 'opacity-0 invisible group-hover:opacity-100 group-hover:visible'
        }`}>
          <div className="text-xs text-slate-300 leading-relaxed">{tooltip}</div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-800"></div>
        </div>
      )}
    </div>
  );
};

export const ScoreDashboard: React.FC<Props> = ({ data, prevData }) => {
  const { conclusion } = data;
  const prevConclusion = prevData?.conclusion;
  
  // 计算评分变化
  const scoreChange = prevConclusion ? conclusion.score - prevConclusion.score : 0;
  
  // 获取信号颜色
  const signalColor = SIGNAL_COLORS[conclusion.signal] || '#6b7280';
  const signalText = SIGNAL_TEXT[conclusion.signal] || '未知';
  
  // 评分环形进度条
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const progress = (conclusion.score / 100) * circumference;
  
  // 获取评分颜色
  const getScoreColor = (score: number) => {
    if (score >= 80) return '#22c55e';
    if (score >= 65) return '#84cc16';
    if (score >= 50) return '#eab308';
    if (score >= 35) return '#f97316';
    return '#ef4444';
  };
  
  const scoreColor = getScoreColor(conclusion.score);

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 border-b border-slate-800">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* 主评分区域 */}
        <div className="flex flex-col lg:flex-row items-center gap-8">
          {/* 左侧：评分圆环 */}
          <div className="relative flex-shrink-0">
            <svg width="200" height="200" className="transform -rotate-90">
              {/* 背景圆环 */}
              <circle
                cx="100"
                cy="100"
                r={radius}
                fill="none"
                stroke="#1e293b"
                strokeWidth="12"
              />
              {/* 进度圆环 */}
              <circle
                cx="100"
                cy="100"
                r={radius}
                fill="none"
                stroke={scoreColor}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference - progress}
                className="transition-all duration-1000 ease-out"
                style={{
                  filter: `drop-shadow(0 0 8px ${scoreColor}40)`
                }}
              />
            </svg>
            {/* 中心内容 */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-5xl font-bold text-white" style={{ color: scoreColor }}>
                {conclusion.score.toFixed(0)}
              </span>
              <span className="text-sm text-slate-400 mt-1">综合评分</span>
              {scoreChange !== 0 && (
                <span className={`text-xs mt-1 flex items-center gap-1 ${scoreChange > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {scoreChange > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {scoreChange > 0 ? '+' : ''}{scoreChange.toFixed(1)}
                </span>
              )}
            </div>
          </div>
          
          {/* 中间：天气和信号 */}
          <div className="flex-1 text-center lg:text-left">
            <div className="text-3xl mb-2">{conclusion.weather}</div>
            <div 
              className="inline-block px-4 py-1.5 rounded-full text-sm font-bold"
              style={{ 
                backgroundColor: `${signalColor}20`,
                color: signalColor,
                border: `1px solid ${signalColor}40`
              }}
            >
              {signalText}
            </div>
            <div className="mt-4 text-slate-400 text-sm">
              <span className="text-slate-500">数据日期：</span>
              {conclusion.last_date}
            </div>
            <div className="text-slate-400 text-sm">
              <span className="text-slate-500">中证红利：</span>
              <span className="text-white font-medium">{conclusion.last_close.toFixed(2)}</span>
              {conclusion.pct_change_5d !== null && (
                <span className={`ml-2 ${conclusion.pct_change_5d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {conclusion.pct_change_5d >= 0 ? '+' : ''}{conclusion.pct_change_5d.toFixed(2)}% (5日)
                </span>
              )}
            </div>
          </div>
          
          {/* 右侧：核心指标 */}
          <div className="grid grid-cols-3 gap-4 lg:gap-6">
            {/* 股息率 */}
            <MetricCard
              icon={<Percent size={14} />}
              label="股息率"
              value={conclusion.dividend_yield !== null ? `${conclusion.dividend_yield.toFixed(2)}%` : 'N/A'}
              colorClass="text-amber-400"
            />
            
            {/* 股债利差 */}
            <MetricCard
              icon={<BarChart3 size={14} />}
              label="股债利差"
              value={conclusion.spread !== null ? `${conclusion.spread.toFixed(2)}%` : 'N/A'}
              colorClass={
                conclusion.spread !== null 
                  ? conclusion.spread >= 1 ? 'text-green-400' : conclusion.spread <= 0 ? 'text-red-400' : 'text-yellow-400'
                  : 'text-slate-500'
              }
              subText={conclusion.spread_status}
            />
            
            {/* RSI */}
            <MetricCard
              icon={<Activity size={14} />}
              label="RSI"
              value={conclusion.rsi !== null ? conclusion.rsi.toFixed(1) : 'N/A'}
              colorClass={
                conclusion.rsi !== null
                  ? conclusion.rsi <= 30 ? 'text-green-400' : conclusion.rsi >= 70 ? 'text-red-400' : 'text-yellow-400'
                  : 'text-slate-500'
              }
              subText={conclusion.trend_status}
            />
          </div>
        </div>
        
        {/* 操作建议 */}
        <div className="mt-8 grid md:grid-cols-2 gap-4">
          <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/30">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
              🐢 稳健型建议
            </div>
            <p className="text-slate-200 text-sm leading-relaxed">{conclusion.suggestion_con}</p>
          </div>
          <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/30">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
              🐇 激进型建议
            </div>
            <p className="text-slate-200 text-sm leading-relaxed">{conclusion.suggestion_agg}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
