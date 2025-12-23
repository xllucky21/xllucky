
import React, { useState } from 'react';
import { BondReportData } from '../types';
import { WeatherBadge } from './WeatherBadge';
import { TrendingUp, TrendingDown, Anchor, BarChart3, Activity, Droplets, ChevronDown, ChevronUp, Globe, Calculator, X } from 'lucide-react';
import { InfoTooltip } from './InfoTooltip';
import { ScoreHistoryChart } from './ScoreHistoryChart';

interface ScoreDashboardProps {
  data: BondReportData;
  prevData?: BondReportData;
}

export const ScoreDashboard: React.FC<ScoreDashboardProps> = ({ data, prevData }) => {
  const { conclusion } = data;
  const backtest: any = (data as any).backtest;
  const [showBacktestDetails, setShowBacktestDetails] = useState(false);
  const [showScoringLogic, setShowScoringLogic] = useState(false);
  
  let backtestBucket: any = null;
  if (backtest && Array.isArray(backtest.buckets)) {
    backtestBucket = backtest.buckets.find((bucket: any) => {
      const min = bucket.min_score ?? 0;
      const max = bucket.max_score ?? 100;
      if (conclusion.score === 100 && max === 100) return true;
      return conclusion.score >= min && conclusion.score < max;
    });
  }

  // Calculate total samples and average yield change
  const totalSamples = backtest?.buckets?.reduce((sum: number, b: any) => sum + (b.count || 0), 0) || 0;
  
  // Calculate weighted average yield change across all buckets
  const avgYieldChange = backtest?.buckets && totalSamples > 0
    ? backtest.buckets.reduce((sum: number, b: any) => sum + (b.avg_forward_yield_change_bp || 0) * (b.count || 0), 0) / totalSamples
    : 0;
  
  // Check if all buckets are positive (bull market) or all negative (bear market)
  const allPositive = backtest?.buckets?.every((b: any) => b.avg_forward_yield_change_bp > 0);
  const allNegative = backtest?.buckets?.every((b: any) => b.avg_forward_yield_change_bp < 0);
  const isTrendingMarket = allPositive || allNegative;
  
  // Helper to get relative performance (vs average)
  const getRelativePerformance = (bucketYieldChange: number) => bucketYieldChange - avgYieldChange;

  // --- Change Calculation Helpers ---
  
  const renderChangeBadge = (current: number, previous: number | undefined, type: 'score' | 'yield') => {
    if (previous === undefined) return null;
    
    const diff = current - previous;
    if (Math.abs(diff) < 0.001) return <span className="text-slate-500 text-xs font-medium ml-2 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">Flat</span>;

    // For Score: Increase is Good (Red/Orange), Decrease is Bad (Green/Blue) - or standard Red=Up Green=Down
    // For Yield: Increase (Red) is Bad for price, Decrease (Green) is Good for price.
    // Standard Chinese Market Colors: Red = Rise, Green = Fall.
    // We will stick to standard market colors indicating direction, user interprets implication.
    
    const isPositive = diff > 0;
    const colorClass = isPositive ? 'text-rose-400 bg-rose-950/30 border-rose-500/30' : 'text-emerald-400 bg-emerald-950/30 border-emerald-500/30';
    const Icon = isPositive ? TrendingUp : TrendingDown;
    const sign = isPositive ? '+' : '';
    const formattedDiff = type === 'yield' ? `${sign}${diff.toFixed(2)}%` : `${sign}${diff.toFixed(2)}`;

    return (
        <span className={`inline-flex items-center ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold border ${colorClass}`}>
            <Icon className="w-3 h-3 mr-0.5" />
            {formattedDiff}
        </span>
    );
  };


  // --- Logic to process ERP data ---
  let erpDisplayValue = conclusion.pe_val;
  let erpSubText = conclusion.macro_msg;
  let erpTooltip = `⚖️ 股债性价比 (股权风险溢价)\n⚠️ 警戒线：5.5%\n\n当 ERP > 5.5% 时，说明股票比债券便宜太多了。主力资金可能"卖债买股"，对债市构成抽血风险。`;

  // Try to parse PE value from string like "PE=14.7"
  const peMatch = conclusion.pe_val.match(/[\d\.]+/);
  if (peMatch) {
      const pe = parseFloat(peMatch[0]);
      if (!isNaN(pe) && pe > 0) {
          // ERP Calculation: (1 / PE) * 100 - Yield
          // (1/PE) is the E/P yield of stock market
          const erp = (100 / pe) - conclusion.last_yield;
          erpDisplayValue = `${erp.toFixed(2)}%`;
          
          // Show PE in subtext
          erpSubText = `PE=${pe} • ${conclusion.macro_msg}`;

          // Rich tooltip with calculation
          erpTooltip = `⚖️ 股债性价比 (股权风险溢价)\n🧮 公式：(1 / PE) - 国债收益率\n\n👉 (1 / ${pe}) - ${conclusion.last_yield.toFixed(2)}% ≈ ${erpDisplayValue}\n\n⚠️ 警戒线：> 5.5%\n当 ERP 高于 5.5% 且显示"⚠️ 股市极具性价比"时，模型会对债券评分进行扣分；\n当出现"✅ 股市泡沫"时，则会对债券评分加分。`;
      }
  }

  // Helpers for Dynamic Colors
  const getValuationColor = (status: string) => {
    if (status.includes('便宜') || status.includes('低估')) return 'text-emerald-400';
    if (status.includes('贵') || status.includes('高估')) return 'text-rose-400';
    return 'text-slate-400';
  };

  const getShiborColor = (liquidityMsg: string) => {
    if (liquidityMsg.includes('资金宽松')) return 'text-emerald-400';
    if (liquidityMsg.includes('资金收紧')) return 'text-rose-400';
    return 'text-cyan-400'; // 资金平稳
  };

  const getMacdColor = (val: string, status: string) => {
    // 动量向好 (Green) OR 死叉 (Green for bonds as yield drops)
    if (val === '向好' || status.includes('绿') || status.includes('死叉')) return 'text-emerald-400';
    // 动量恶化 (Red) OR 金叉 (Red for bonds as yield rises)
    if (val === '恶化' || status.includes('红') || status.includes('金叉')) return 'text-rose-400';
    return 'text-slate-400';
  };

  const getSpreadColor = (spreadMsg: string | undefined) => {
    if (!spreadMsg) return 'text-slate-400';
    if (spreadMsg.includes('利差收窄')) return 'text-emerald-400';
    if (spreadMsg.includes('利差走阔')) return 'text-rose-400';
    return 'text-cyan-400';
  };

  // Helper for KPI Cards
  const KpiCard = ({ title, value, sub, icon: Icon, color = "text-slate-400", tooltip, rightBadge }: any) => (
    <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-sm flex flex-col justify-between hover:border-slate-700 hover:shadow-md transition-all group/card">
      <div className="flex justify-between items-start mb-2">
        <div className="text-sm font-medium text-slate-400">
          {tooltip ? <InfoTooltip term={title} content={tooltip} /> : title}
        </div>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div>
        <div className="flex items-center">
            <div className="text-2xl font-bold text-slate-100 tracking-tight">{value}</div>
            {rightBadge}
        </div>
        <div className="text-xs text-slate-500 mt-1 font-medium">{sub}</div>
      </div>
    </div>
  );

  // Strategy Section
  const StrategyCard = ({ title, content, type, tooltip }: { title: string, content: string, type: 'safe' | 'risk', tooltip: string }) => {
    const isSafe = type === 'safe';
    // Dark mode colors for strategy cards
    const bgClass = isSafe ? 'bg-emerald-950/20' : 'bg-indigo-950/20';
    const borderClass = isSafe ? 'border-emerald-500/30' : 'border-indigo-500/30';
    const titleColor = isSafe ? 'text-emerald-400' : 'text-indigo-400';
    const textColor = isSafe ? 'text-emerald-100/80' : 'text-indigo-100/80';
    const icon = isSafe ? '🐢' : '🐇';

    return (
      <div className={`p-6 rounded-xl border-l-4 ${bgClass} ${borderClass} border border-transparent hover:bg-opacity-100 transition-colors`}>
        <div className="flex items-center mb-2">
            <h3 className={`font-bold text-lg flex items-center ${titleColor} mr-2`}>
            <span className="mr-2">{icon}</span> {title}建议
            </h3>
            <InfoTooltip term="" content={tooltip} showIcon={true} />
        </div>
        <p className={`text-sm leading-relaxed ${textColor}`}>
          {content}
        </p>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      
      {/* Header Section */}
      <div className="text-center mb-10">
        <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-2 tracking-tight">
          债基智能投顾 <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">晴雨表</span>
        </h1>
        <div className="flex items-center justify-center gap-4 mt-3">
          <p className="text-slate-500 text-sm font-mono">
            数据生成时间: <span className="text-slate-400">{data.generated_at}</span>
          </p>
          <button
            onClick={() => setShowScoringLogic(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-950/50 hover:bg-indigo-900/50 border border-indigo-500/30 hover:border-indigo-500/50 rounded-lg text-xs text-indigo-400 hover:text-indigo-300 transition-all"
          >
            <Calculator className="w-3.5 h-3.5" />
            评分逻辑
          </button>
        </div>
      </div>

      {/* Scoring Logic Modal */}
      {showScoringLogic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setShowScoringLogic(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="sticky top-0 bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                  <Calculator className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">评分计算逻辑</h2>
                  <p className="text-xs text-slate-500">了解每个因子如何影响最终评分</p>
                </div>
              </div>
              <button onClick={() => setShowScoringLogic(false)} className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="px-6 py-5 space-y-6">
              {/* Score Formula */}
              <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <span className="text-lg">🧮</span> 评分公式
                </h3>
                <div className="bg-slate-950 rounded-lg p-4 font-mono text-sm text-slate-300 overflow-x-auto">
                  <div className="text-indigo-400 mb-2">// 基础分 = 50 分</div>
                  <div>评分 = 50</div>
                  <div className="text-emerald-400 mt-2">// 核心因子：估值（权重最大）</div>
                  <div className="pl-4">+ (分位数 - 50) × 0.6</div>
                  <div className="text-orange-400 mt-2">// 动态因子：趋势（连续评分，熊市时权重降低避免重复计分）</div>
                  <div className="pl-4">+ ((Yield - MA60) / MA60 / 5%) × 8 × 趋势权重 × 熊市系数  <span className="text-slate-500">// 范围 [-8, +8]</span></div>
                  <div className="text-pink-400 mt-2">// 动态因子：RSI（连续评分，偏离中性值）</div>
                  <div className="pl-4">+ ((RSI - 50) / 50) × 6 × 趋势权重  <span className="text-slate-500">// 范围 [-6, +6]</span></div>
                  <div className="text-cyan-400 mt-2">// 辅助因子：资金面变化（20日，历史波动率归一化）</div>
                  <div className="pl-4">+ (-Shibor变化 / 历史波动率 / 2) × 8  <span className="text-slate-500">// z-score归一化</span></div>
                  <div className="text-purple-400 mt-2">// 辅助因子：中美利差变化（60日，历史波动率归一化）</div>
                  <div className="pl-4">+ (利差变化 / 历史波动率 / 2) × 8  <span className="text-slate-500">// z-score归一化</span></div>
                  <div className="text-amber-400 mt-2">// 辅助因子：宏观对冲（ERP，阶梯式过滤器）</div>
                  <div className="pl-4">+ ERP {'<'} 1.5 → +5分 | ERP {'>'} 6 → -10分 | 其他 → 0分</div>
                  <div className="text-slate-500 mt-3 text-xs">// 注：MACD 仅用于展示趋势解释，不参与评分计算</div>
                </div>
              </div>

              {/* Current Calculation */}
              <div className="bg-gradient-to-r from-indigo-950/30 to-purple-950/30 rounded-xl p-5 border border-indigo-500/20">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="text-lg">📊</span> 当前评分拆解
                </h3>
                {(() => {
                  // 计算各因子贡献
                  const baseScore = 50;
                  const valuationScore = (conclusion.percentile - 50) * 0.6;
                  
                  // 获取市场状态
                  const marketRegime = (conclusion as any).market_regime;
                  const trendWeight = marketRegime?.trend_weight ?? 1.0;
                  const regimeMsg = marketRegime?.regime_msg || '未知';
                  const consecutiveDays = marketRegime?.consecutive_days || 0;
                  const regime = marketRegime?.regime || 'mean-reverting';
                  const direction = marketRegime?.direction || 'bull';
                  
                  // 趋势因子（连续评分）
                  // 需要从数据中获取MA60，这里用简化计算
                  const isAboveMA = conclusion.trend_val === '熊';
                  // 假设偏离程度约为2%（实际需要从后端获取）
                  const estimatedDeviation = isAboveMA ? 0.02 : -0.02;
                  const normalizedDeviation = Math.max(-1, Math.min(1, estimatedDeviation / 0.05));
                  // 持续偏离熊市时额外降低权重
                  const bearPenalty = (regime === 'extended' && direction === 'bear') ? 0.3 : 1.0;
                  const trendScore = normalizedDeviation * 8 * trendWeight * bearPenalty;
                  
                  // RSI因子（连续评分）
                  const rsi = (conclusion as any).rsi;
                  let rsiScore = 0;
                  if (rsi !== undefined && rsi !== null) {
                    const rsiDeviation = (rsi - 50) / 50;
                    rsiScore = rsiDeviation * 6 * trendWeight;
                  }
                  
                  // 解析 shibor_change（前端简化计算，实际用历史波动率归一化）
                  const shiborChangeMatch = conclusion.shibor_change?.match(/([+-]?[\d.]+)/);
                  const shiborChange = shiborChangeMatch ? parseFloat(shiborChangeMatch[1]) : 0;
                  const liquidityScore = shiborChange ? Math.max(-1, Math.min(1, -shiborChange / 0.5)) * 8 : 0;
                  
                  // 解析 spread_change（前端简化计算，实际用历史波动率归一化）
                  const spreadChangeMatch = conclusion.spread_change?.match(/([+-]?[\d.]+)/);
                  const spreadChange = spreadChangeMatch ? parseFloat(spreadChangeMatch[1]) : 0;
                  const spreadScore = spreadChange ? Math.max(-1, Math.min(1, spreadChange / 0.5)) * 8 : 0;
                  
                  // 解析 ERP（阶梯式过滤器）
                  const peMatch = conclusion.pe_val.match(/[\d.]+/);
                  const pe = peMatch ? parseFloat(peMatch[0]) : 0;
                  const erp = pe > 0 ? (100 / pe) - conclusion.last_yield : 0;
                  let macroScore = 0;
                  if (erp < 1.5) macroScore = 5;
                  else if (erp > 6) macroScore = -10;
                  
                  const totalCalculated = baseScore + valuationScore + trendScore + rsiScore + liquidityScore + spreadScore + macroScore;
                  
                  return (
                    <div className="space-y-3">
                      {/* 市场状态提示 */}
                      <div className={`flex items-center justify-between py-2 px-3 rounded-lg ${regime === 'extended' ? 'bg-amber-950/30 border border-amber-500/20' : 'bg-cyan-950/30 border border-cyan-500/20'}`}>
                        <div className="flex items-center gap-2">
                          <span className={marketRegime?.regime === 'trending' ? 'text-amber-400' : 'text-cyan-400'}>
                            {marketRegime?.regime === 'trending' ? '📈' : '🔄'}
                          </span>
                          <span className="text-slate-300 text-sm">市场状态</span>
                        </div>
                        <div className="text-right">
                          <span className={`font-semibold ${marketRegime?.regime === 'trending' ? 'text-amber-400' : 'text-cyan-400'}`}>
                            {regimeMsg}
                          </span>
                          <span className="text-xs text-slate-500 ml-2">
                            (趋势权重: {(trendWeight * 100).toFixed(0)}%)
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between py-2 border-b border-slate-700/50">
                        <span className="text-slate-400">基础分</span>
                        <span className="font-mono text-white">50.00</span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b border-slate-700/50">
                        <div>
                          <span className="text-slate-400">估值因子</span>
                          <span className="text-xs text-slate-500 ml-2">({conclusion.percentile.toFixed(1)}% - 50) × 0.6</span>
                        </div>
                        <span className={`font-mono ${valuationScore >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {valuationScore >= 0 ? '+' : ''}{valuationScore.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b border-slate-700/50">
                        <div>
                          <span className="text-slate-400">趋势因子</span>
                          <span className="text-xs text-slate-500 ml-2">
                            {isAboveMA ? 'Yield > MA60' : 'Yield < MA60'} (连续) × {(trendWeight * 100).toFixed(0)}%
                          </span>
                        </div>
                        <span className={`font-mono ${trendScore >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {trendScore >= 0 ? '+' : ''}{trendScore.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b border-slate-700/50">
                        <div>
                          <span className="text-slate-400">RSI因子</span>
                          <span className="text-xs text-slate-500 ml-2">
                            RSI={rsi?.toFixed(1) || 'N/A'} (连续) × {(trendWeight * 100).toFixed(0)}%
                          </span>
                        </div>
                        <span className={`font-mono ${rsiScore >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {rsiScore >= 0 ? '+' : ''}{rsiScore.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b border-slate-700/50">
                        <div>
                          <span className="text-slate-400">资金面</span>
                          <span className="text-xs text-slate-500 ml-2">Shibor变化 {conclusion.shibor_change || 'N/A'}</span>
                        </div>
                        <span className={`font-mono ${liquidityScore >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {liquidityScore >= 0 ? '+' : ''}{liquidityScore.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b border-slate-700/50">
                        <div>
                          <span className="text-slate-400">中美利差</span>
                          <span className="text-xs text-slate-500 ml-2">利差变化 {conclusion.spread_change || 'N/A'}</span>
                        </div>
                        <span className={`font-mono ${spreadScore >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {spreadScore >= 0 ? '+' : ''}{spreadScore.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b border-slate-700/50">
                        <div>
                          <span className="text-slate-400">宏观对冲</span>
                          <span className="text-xs text-slate-500 ml-2">ERP = {erp.toFixed(2)}%</span>
                        </div>
                        <span className={`font-mono ${macroScore >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {macroScore >= 0 ? '+' : ''}{macroScore.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-3 bg-slate-800/50 rounded-lg px-3 -mx-1">
                        <span className="font-semibold text-white">最终评分</span>
                        <div className="text-right">
                          <span className="font-mono text-xl font-bold text-indigo-400">{conclusion.score.toFixed(2)}</span>
                          <span className="text-xs text-slate-500 ml-2">(计算值: {Math.max(0, Math.min(100, totalCalculated)).toFixed(2)})</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Factor Details */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <span className="text-lg">📖</span> 因子详解
                </h3>

                {/* Valuation */}
                <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-emerald-400 text-lg">📈</span>
                    <span className="font-semibold text-white">估值因子（核心）</span>
                    <span className="text-xs px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded">权重最大</span>
                  </div>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    基于历史分位数判断债券贵贱。分位数越高 = 收益率越高 = 债券越便宜 = 越值得买。
                    <br />
                    <span className="text-slate-500">公式：(分位数 - 50) × 0.6，分位数90%可加24分，分位数10%会扣24分。</span>
                  </p>
                </div>

                {/* Market Regime */}
                <div className="bg-amber-950/20 rounded-xl p-4 border border-amber-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-amber-400 text-lg">🔄</span>
                    <span className="font-semibold text-white">市场状态检测</span>
                    <span className="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded">动态调整</span>
                  </div>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    根据收益率在MA60同一侧的连续天数判断市场状态。
                    <br />
                    <span className="text-slate-500">
                      • <strong>震荡市场</strong>（连续 &lt; 40天）：趋势和RSI正常参与评分<br />
                      • <strong>单边市场</strong>（连续 ≥ 40天）：趋势和RSI权重逐渐降低<br />
                      • 权重衰减公式：1 - (连续天数 - 40) / 40，最低为0<br />
                      • 这样可以避免在单边市场中持续扣分/加分的问题
                    </span>
                  </p>
                </div>

                {/* Trend */}
                <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-orange-400 text-lg">📊</span>
                    <span className="font-semibold text-white">趋势因子（MA60）</span>
                    <span className="text-xs px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded">连续评分</span>
                  </div>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    基于均值回归逻辑，收益率偏离均线时可能回归。<strong>连续评分</strong>，偏离越大影响越大。
                    <br />
                    <span className="text-slate-500">
                      • 公式：((Yield - MA60) / MA60 / 5%) × 8 × 权重<br />
                      • 偏离 +5% 以上 → +8分（满分）<br />
                      • 偏离 -5% 以下 → -8分（最低）<br />
                      • 在均线附近时影响很小，避免频繁穿越时评分突变
                    </span>
                  </p>
                </div>

                {/* RSI */}
                <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-pink-400 text-lg">⚡</span>
                    <span className="font-semibold text-white">RSI因子</span>
                    <span className="text-xs px-2 py-0.5 bg-pink-500/20 text-pink-400 rounded">连续评分</span>
                  </div>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    RSI超买超卖指标，判断短期动量。<strong>连续评分</strong>，偏离中性值越大影响越大。
                    <br />
                    <span className="text-slate-500">
                      • 公式：((RSI - 50) / 50) × 6 × 权重<br />
                      • RSI = 100 → +6分（满分，超买）<br />
                      • RSI = 0 → -6分（最低，超卖）<br />
                      • RSI = 50 → 0分（中性，不影响评分）<br />
                      • 权重根据市场状态动态调整，单边市场时权重降低
                    </span>
                  </p>
                </div>

                {/* Liquidity */}
                <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-cyan-400 text-lg">💧</span>
                    <span className="font-semibold text-white">资金面变化</span>
                    <span className="text-xs px-2 py-0.5 bg-cyan-500/20 text-cyan-400 rounded">连续评分</span>
                  </div>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    看 Shibor 隔夜利率的 <strong>20日变化</strong>，线性映射到 [-8, +8] 分。
                    <br />
                    <span className="text-slate-500">
                      • 公式：(-Shibor变化 / 0.5) × 8，限制在 [-8, +8]<br />
                      • Shibor 下降 50bp → +8分（满分）<br />
                      • Shibor 上升 50bp → -8分（最低）<br />
                      • 变化幅度越大，影响越大；变化小则影响小
                    </span>
                  </p>
                </div>

                {/* Spread */}
                <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-purple-400 text-lg">🌐</span>
                    <span className="font-semibold text-white">中美利差变化</span>
                    <span className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded">连续评分</span>
                  </div>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    看利差的 <strong>60日变化</strong>，线性映射到 [-8, +8] 分。
                    <br />
                    <span className="text-slate-500">
                      • 公式：(利差变化 / 0.5) × 8，限制在 [-8, +8]<br />
                      • 利差收窄 50bp → +8分（满分）<br />
                      • 利差走阔 50bp → -8分（最低）<br />
                      • 变化幅度越大，影响越大；变化小则影响小
                    </span>
                  </p>
                </div>

                {/* Macro */}
                <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-amber-400 text-lg">⚖️</span>
                    <span className="font-semibold text-white">宏观对冲（ERP）</span>
                    <span className="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded">阶梯过滤</span>
                  </div>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    ERP = 股票收益率 - 债券收益率，作为<strong>极端风险过滤器</strong>，而非线性评分。
                    <br />
                    <span className="text-slate-500">
                      • ERP {'<'} 1.5%（股市泡沫）→ +5分（债券有吸引力）<br />
                      • ERP {'>'} 6%（股票极便宜）→ -10分（债券吸引力下降）<br />
                      • 1.5% ≤ ERP ≤ 6%（中性区间）→ 0分（不影响评分）<br />
                      • 股债并非严格跷跷板，ERP 仅作为极端情况的过滤器
                    </span>
                  </p>
                </div>
              </div>

              {/* Weather Guide */}
              <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <span className="text-lg">🌤️</span> 天气对照表
                </h3>
                <div className="grid grid-cols-5 gap-2 text-center text-xs">
                  <div className="bg-slate-900 rounded-lg p-3">
                    <div className="text-2xl mb-1">☀️</div>
                    <div className="font-semibold text-white">烈日</div>
                    <div className="text-slate-500">80-100分</div>
                    <div className="text-emerald-400 mt-1">值得买入</div>
                  </div>
                  <div className="bg-slate-900 rounded-lg p-3">
                    <div className="text-2xl mb-1">🌤️</div>
                    <div className="font-semibold text-white">晴朗</div>
                    <div className="text-slate-500">60-80分</div>
                    <div className="text-emerald-400 mt-1">可以买入</div>
                  </div>
                  <div className="bg-slate-900 rounded-lg p-3">
                    <div className="text-2xl mb-1">☁️</div>
                    <div className="font-semibold text-white">多云</div>
                    <div className="text-slate-500">40-60分</div>
                    <div className="text-slate-400 mt-1">持有观望</div>
                  </div>
                  <div className="bg-slate-900 rounded-lg p-3">
                    <div className="text-2xl mb-1">🌧️</div>
                    <div className="font-semibold text-white">小雨</div>
                    <div className="text-slate-500">20-40分</div>
                    <div className="text-rose-400 mt-1">暂缓买入</div>
                  </div>
                  <div className="bg-slate-900 rounded-lg p-3">
                    <div className="text-2xl mb-1">⛈️</div>
                    <div className="font-semibold text-white">暴雨</div>
                    <div className="text-slate-500">0-20分</div>
                    <div className="text-rose-400 mt-1">不建议买</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hero Score Section */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left: Weather & Score */}
        <div className="md:col-span-4 lg:col-span-3">
            {/* Removed overflow-hidden from parent to let tooltip overflow */}
            <div className="bg-slate-900 rounded-2xl p-6 shadow-xl border border-slate-800 text-center h-full flex flex-col justify-center relative">
                {/* Background glow effect - added rounded-2xl to clip itself */}
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-indigo-500/5 to-transparent pointer-events-none rounded-2xl"></div>
                
                <WeatherBadge weather={conclusion.weather} score={conclusion.score} />
                <div className="mt-6 relative z-10">
                    <div className="flex justify-center items-center mb-1">
                        <InfoTooltip 
                            term="综合评分" 
                            position="bottom"
                            content={`基于四大维度加权计算：\n1. 估值 (60%) - 核心因子\n2. 趋势 (15%)\n3. 情绪 (15%)\n4. 宏观对冲 (10%)\n\n☀️ 烈日 (80-100)：值得买入\n🌤️ 晴朗 (60-80)：可以买入\n☁️ 多云 (40-60)：持有观望\n🌧️ 小雨 (20-40)：暂缓买入\n⛈️ 暴雨 (0-20)：不建议买`}
                            showIcon={true} 
                        />
                    </div>
                    <div className="flex items-baseline justify-center">
                        <div className={`text-7xl font-black tracking-tighter ${conclusion.score >= 50 ? 'text-indigo-400 drop-shadow-[0_0_15px_rgba(129,140,248,0.3)]' : 'text-slate-500'}`}>
                            {conclusion.score.toFixed(2)}
                        </div>
                    </div>
                    
                    {/* Comparison Badge for Score */}
                    {prevData && (
                        <div className="flex justify-center mt-1">
                            {renderChangeBadge(conclusion.score, prevData.conclusion.score, 'score')}
                        </div>
                    )}

                    <div className="text-xs text-slate-600 mt-3 font-medium">满分 100 分</div>
                </div>
            </div>
        </div>

        {/* Right: Key Indicators Grid */}
        <div className="md:col-span-8 lg:col-span-9 grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard 
                title="10年国债收益率" 
                value={`${conclusion.last_yield.toFixed(2)}%`} 
                rightBadge={prevData ? renderChangeBadge(conclusion.last_yield, prevData.conclusion.last_yield, 'yield') : null}
                sub={`历史分位数: ${conclusion.percentile.toFixed(1)}%`}
                icon={Activity}
                color="text-blue-400"
                tooltip={`💡 核心法则：跷跷板效应\n\n📉 收益率下跌 = 债基上涨 (赚钱)\n📈 收益率上涨 = 债基下跌 (亏钱)\n\n收益率越高，代表东西越便宜（买点）。`}
            />
            <KpiCard 
                title="趋势信号 (MA60)" 
                value={conclusion.trend_val === '牛' ? '债牛 🐂' : '债熊 🐻'}
                sub={conclusion.trend_status}
                icon={TrendingUp}
                color={conclusion.trend_val === '牛' ? 'text-emerald-400' : 'text-rose-400'}
                tooltip={`🐮 牛熊分界线：60日均线\n\n🟢 Yield < MA60\n利率在均线下方，处于下行通道 → 债牛\n\n🔴 Yield > MA60\n利率在均线上方，债券相对便宜 → 可能是买点\n\n⚠️ 趋势仅作参考，核心看估值分位`}
            />
            <KpiCard 
              title="资金面 (Shibor)" 
              value={conclusion.shibor_val} 
              sub={`${conclusion.shibor_change || ''} • ${conclusion.liquidity_msg}`}
              icon={Droplets}
              color={getShiborColor(conclusion.liquidity_msg)}
              tooltip={`🏦 资金面变化趋势（20日）\n\n当前Shibor：${conclusion.shibor_val}\n20日变化：${conclusion.shibor_change || 'N/A'}\n\n📈 核心逻辑：看变化趋势，不看绝对值\n\n💧 Shibor下降 > 30bp：资金宽松 → 利好债市 (+8分)\n🔥 Shibor上升 > 30bp：资金收紧 → 利空债市 (-8分)\n⚖️ 变化在 ±30bp 之间：资金平稳\n\n💡 为什么不看绝对值？\n过去几年利率中枢持续下移，用固定阈值会失效。\n关键是资金面在"变松"还是"变紧"。`}
            />
            <KpiCard 
              title="中美利差" 
              value={conclusion.spread_val || 'N/A'} 
              sub={`${conclusion.spread_change || ''} • ${conclusion.spread_msg || '⚪️ 缺失'}`}
              icon={Globe}
              color={getSpreadColor(conclusion.spread_msg)}
              tooltip={`🌐 中美利差变化趋势（60日）\n\n中美利差 = 中国10年期 - 美国10年期\n当前利差：${conclusion.spread_val || 'N/A'}\n60日变化：${conclusion.spread_change || 'N/A'}\n美债收益率：${conclusion.us_yield || 'N/A'}\n\n📈 核心逻辑：看变化趋势，不看绝对值\n\n✅ 利差收窄（变好）：\n   美联储降息或中国加息 → 降息空间变大 → 利好债市\n\n⚠️ 利差走阔（变差）：\n   美联储加息或中国降息 → 降息空间变小 → 利空债市\n\n💡 为什么不看绝对值？\n过去2年利差一直倒挂（负值），但债券走了大牛市。\n关键是利差在"变好"还是"变差"。`}
            />
             <KpiCard 
                title="宏观对冲 (ERP)" 
                value={erpDisplayValue} 
                sub={erpSubText}
                icon={Anchor}
                color="text-purple-400"
                tooltip={erpTooltip}
            />
             {/* Second Row of KPIs for extra details */}
             <KpiCard 
                title="估值状态" 
                value={conclusion.val_status} 
                sub="基于收益率分位数"
                icon={BarChart3}
                color={getValuationColor(conclusion.val_status)}
                tooltip={`📊 均值回归逻辑\n\n如果分位数为 90%，说明现在的利率比过去 90% 的时间都高。\n👉 利率极高 = 价格极低 (绝佳买点)。`}
            />
            <KpiCard 
                title="动量 (MACD)" 
                value={conclusion.macd_val} 
                sub={conclusion.macd_status}
                icon={TrendingDown}
                color={getMacdColor(conclusion.macd_val, conclusion.macd_status)}
                tooltip={`⚡️ 判断趋势的强弱和转折\n\n🔴 红柱 (金叉)：收益率上涨动能增强 (债市利空)\n🟢 绿柱 (死叉)：收益率下跌动能增强 (债市利好)`}
            />
        </div>
      </div>

      {/* Strategies Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <StrategyCard 
            type="safe" 
            title="稳健型" 
            content={conclusion.suggestion_con} 
            tooltip={`🎯 适合：追求稳健收益，厌恶回撤。\n\n✅ 评分 ≥60 分时可以买入\n⏸️ 评分 40-60 分持有观望\n🛑 评分 <40 分暂缓买入`}
        />
        <StrategyCard 
            type="risk" 
            title="激进型" 
            content={conclusion.suggestion_agg} 
            tooltip={`⚔️ 适合：交易型选手，能承受波动。\n\n📈 高分时可加大仓位\n📉 低分时减仓或等待\n🔄 结合 ERP 进行股债轮动`}
        />
      </div>

      {/* Backtest Section */}
      {backtest && backtestBucket && backtestBucket.count > 0 && (
        <div className="mt-6 bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-200">📊 历史回测</span>
              <InfoTooltip 
                term="" 
                content={`回测逻辑：\n\n1. 根据历史数据计算每日的综合评分\n2. 统计每个评分区间在未来 ${Math.round(backtest.horizon_days / 21)} 个月的真实收益\n3. 收益 = 久期 × 利率变动 + 票息\n   （考虑了不同利率水平下的久期差异）\n\n📈 真实收益：考虑久期和票息的近似收益\n\n⚠️ 历史表现不代表未来收益`}
                showIcon={true} 
              />
            </div>
            <div className="flex items-center gap-2">
              {/* 单调性检验标签 */}
              <div className={`text-xs px-2 py-1 rounded ${backtest.is_monotonic ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-500/30' : 'bg-amber-950/50 text-amber-400 border border-amber-500/30'}`}>
                {backtest.is_monotonic ? '✅ 单调成立' : `⚠️ 单调性 ${Math.round((backtest.monotonic_score || 0) * 100)}%`}
              </div>
              {isTrendingMarket && (
                <div className={`text-xs px-2 py-1 rounded ${allPositive ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-500/30' : 'bg-rose-950/50 text-rose-400 border border-rose-500/30'}`}>
                  {allPositive ? '🐂 债牛周期' : '🐻 债熊周期'}
                </div>
              )}
              <div className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded">
                观察窗口：{Math.round(backtest.horizon_days / 21)} 个月
              </div>
            </div>
          </div>

          {/* Monotonicity Notice */}
          {!backtest.is_monotonic && (
            <div className="mb-4 p-3 rounded-lg text-xs bg-amber-950/20 border border-amber-500/20 text-amber-300">
              <span className="font-semibold">⚠️ 单调性检验：</span>
              {` ${backtest.monotonic_msg || '评分与收益未呈现严格单调关系，建议审视因子权重'}`}
            </div>
          )}

          {/* Market Cycle Notice */}
          {isTrendingMarket && (
            <div className={`mb-4 p-3 rounded-lg text-xs ${allPositive ? 'bg-emerald-950/20 border border-emerald-500/20 text-emerald-300' : 'bg-rose-950/20 border border-rose-500/20 text-rose-300'}`}>
              <span className="font-semibold">{allPositive ? '📈 注意：' : '📉 注意：'}</span>
              {allPositive 
                ? ' 回测期间处于债牛周期，所有区间绝对收益均为正。下方展示各区间的【相对表现】差异，帮助判断评分系统的有效性。'
                : ' 回测期间处于债熊周期，所有区间绝对收益均为负。下方展示各区间的【相对表现】差异，帮助判断评分系统的有效性。'}
            </div>
          )}
          
          {/* Current Score Bucket Highlight */}
          {(() => {
            const avgReturn = backtestBucket.avg_forward_return ?? 0;
            const avgAllReturn = backtest.buckets.reduce((sum: number, b: any) => sum + ((b.avg_forward_return || 0) * (b.count || 0)), 0) / totalSamples;
            const relativeReturn = avgReturn - avgAllReturn;
            const isPositive = avgReturn > 0;
            const isRelativePositive = relativeReturn > 0;
            return (
              <div className={`p-4 rounded-lg mb-4 ${isPositive ? 'bg-emerald-950/30 border border-emerald-500/30' : 'bg-rose-950/30 border border-rose-500/30'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-400 mb-1">当前评分区间</div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-slate-100">
                        {backtestBucket.min_score >= 80 ? '☀️' : backtestBucket.min_score >= 60 ? '🌤️' : backtestBucket.min_score >= 40 ? '☁️' : backtestBucket.min_score >= 20 ? '🌧️' : '⛈️'}
                        {' '}{backtestBucket.min_score}-{backtestBucket.max_score} 分
                      </span>
                      <span className="text-xs text-slate-500">（共 {backtestBucket.count} 次历史样本）</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-400 mb-1">历史平均收益</div>
                    <div className={`text-xl font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {avgReturn > 0 ? '+' : ''}{avgReturn.toFixed(2)}%
                    </div>
                    <div className={`text-[10px] mt-0.5 ${isRelativePositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                      相对：{relativeReturn > 0 ? '+' : ''}{relativeReturn.toFixed(2)}%
                    </div>
                  </div>
                </div>
                <div className={`mt-3 text-sm font-medium ${isPositive ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {isPositive 
                    ? `✅ 历史上该区间未来 ${Math.round(backtest.horizon_days / 21)} 个月平均盈利 ${avgReturn.toFixed(2)}%` 
                    : `⚠️ 历史上该区间未来 ${Math.round(backtest.horizon_days / 21)} 个月平均亏损 ${Math.abs(avgReturn).toFixed(2)}%`
                  }
                </div>
              </div>
            );
          })()}

          {/* All Buckets Overview */}
          <div className="text-xs text-slate-500 mb-2">各评分区间历史表现对比（真实收益 %）：</div>
          <div className="grid grid-cols-5 gap-2">
            {backtest.buckets.map((bucket: any) => {
              const isCurrentBucket = bucket.min_score === backtestBucket.min_score;
              const weatherIcon = bucket.min_score >= 80 ? '☀️' : bucket.min_score >= 60 ? '🌤️' : bucket.min_score >= 40 ? '☁️' : bucket.min_score >= 20 ? '🌧️' : '⛈️';
              const avgReturn = bucket.avg_forward_return ?? 0;
              const isPositive = avgReturn > 0;
              return (
                <div 
                  key={bucket.min_score} 
                  className={`p-2 rounded-lg text-center transition-all ${isCurrentBucket ? 'ring-2 ring-indigo-500 bg-slate-800' : 'bg-slate-800/50'}`}
                >
                  <div className="text-sm mb-1">{weatherIcon}</div>
                  <div className="text-[10px] text-slate-400">{bucket.min_score}-{bucket.max_score}分</div>
                  <div className={`text-xs font-bold mt-1 ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {avgReturn > 0 ? '+' : ''}{avgReturn.toFixed(1)}%
                  </div>
                  <div className="text-[10px] text-slate-500">{bucket.count}次</div>
                </div>
              );
            })}
          </div>

          {/* Expand/Collapse Button */}
          <button 
            onClick={() => setShowBacktestDetails(!showBacktestDetails)}
            className="mt-4 w-full flex items-center justify-center gap-2 py-2 px-4 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            {showBacktestDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {showBacktestDetails ? '收起详细数据' : '展开详细数据'}
          </button>

          {/* Detailed Data Table */}
          {showBacktestDetails && (
            <div className="mt-4 space-y-4">
              {/* Summary Stats */}
              <div className="bg-slate-800/50 rounded-lg p-4">
                <div className="text-xs font-semibold text-slate-300 mb-3">📈 回测统计摘要</div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-indigo-400">{totalSamples}</div>
                    <div className="text-[10px] text-slate-500">总样本数（交易日）</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-cyan-400">{Math.round(backtest.horizon_days / 21)}</div>
                    <div className="text-[10px] text-slate-500">前瞻窗口（月）</div>
                  </div>
                  <div>
                    <div className={`text-2xl font-bold ${backtest.is_monotonic ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {backtest.is_monotonic ? '✓' : `${Math.round((backtest.monotonic_score || 0) * 100)}%`}
                    </div>
                    <div className="text-[10px] text-slate-500">单调性检验</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-emerald-400">
                      {backtest.buckets.filter((b: any) => b.count > 0 && (b.avg_forward_return ?? 0) > 0).length}
                    </div>
                    <div className="text-[10px] text-slate-500">盈利区间</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-rose-400">
                      {backtest.buckets.filter((b: any) => b.count > 0 && (b.avg_forward_return ?? 0) <= 0).length}
                    </div>
                    <div className="text-[10px] text-slate-500">亏损区间</div>
                  </div>
                </div>
              </div>

              {/* Detailed Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-2 px-3 text-slate-400 font-medium">天气</th>
                      <th className="text-left py-2 px-3 text-slate-400 font-medium">评分区间</th>
                      <th className="text-right py-2 px-3 text-slate-400 font-medium">样本数</th>
                      <th className="text-right py-2 px-3 text-slate-400 font-medium">占比</th>
                      <th className="text-right py-2 px-3 text-slate-400 font-medium">真实收益</th>
                      <th className="text-right py-2 px-3 text-slate-400 font-medium">利率变动</th>
                      <th className="text-left py-2 px-3 text-slate-400 font-medium">评价</th>
                      <th className="text-left py-2 px-3 text-slate-400 font-medium">操作建议</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backtest.buckets.map((bucket: any) => {
                      const isCurrentBucket = bucket.min_score === backtestBucket.min_score;
                      const weatherIcon = bucket.min_score >= 80 ? '☀️' : bucket.min_score >= 60 ? '🌤️' : bucket.min_score >= 40 ? '☁️' : bucket.min_score >= 20 ? '🌧️' : '⛈️';
                      const weatherName = bucket.min_score >= 80 ? '烈日' : bucket.min_score >= 60 ? '晴朗' : bucket.min_score >= 40 ? '多云' : bucket.min_score >= 20 ? '小雨' : '暴雨';
                      const hasData = bucket.count > 0 && bucket.avg_forward_return !== null;
                      const avgReturn = bucket.avg_forward_return ?? 0;
                      const isReturnPositive = hasData && avgReturn > 0;
                      const yieldChangeBp = bucket.avg_forward_yield_change_bp ?? 0;
                      const isYieldPositive = yieldChangeBp > 0;
                      const percentage = totalSamples > 0 ? ((bucket.count / totalSamples) * 100).toFixed(1) : '0';
                      const suggestion = bucket.min_score >= 80 ? '✅ 值得买入' : bucket.min_score >= 60 ? '👍 可以买入' : bucket.min_score >= 40 ? '⏸️ 持有观望' : bucket.min_score >= 20 ? '⚠️ 暂缓买入' : '🚫 不建议买';
                      
                      return (
                        <tr 
                          key={bucket.min_score} 
                          className={`border-b border-slate-800 ${isCurrentBucket ? 'bg-indigo-950/30' : 'hover:bg-slate-800/50'}`}
                        >
                          <td className="py-3 px-3">
                            <span className="text-lg">{weatherIcon}</span>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <span className={`font-semibold ${isCurrentBucket ? 'text-indigo-400' : 'text-slate-200'}`}>
                                {bucket.min_score}-{bucket.max_score}分
                              </span>
                              <span className="text-slate-500">({weatherName})</span>
                              {isCurrentBucket && (
                                <span className="px-1.5 py-0.5 bg-indigo-500/20 text-indigo-400 text-[10px] rounded">当前</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <span className="text-slate-200 font-medium">{bucket.count}</span>
                            <span className="text-slate-500 ml-1">次</span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <div className="w-12 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-indigo-500 rounded-full" 
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                              <span className="text-slate-400 w-10 text-right">{percentage}%</span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right">
                            {hasData ? (
                              <span className={`font-bold ${isReturnPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {avgReturn > 0 ? '+' : ''}{avgReturn.toFixed(2)}%
                              </span>
                            ) : (
                              <span className="text-slate-500">无数据</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right">
                            {hasData ? (
                              <span className={`font-bold ${isYieldPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {isYieldPositive ? '↓' : '↑'} {Math.abs(yieldChangeBp).toFixed(1)} bp
                              </span>
                            ) : (
                              <span className="text-slate-500">无数据</span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            {hasData ? (
                              <span className={`px-2 py-1 rounded text-[10px] font-medium ${isReturnPositive ? 'bg-emerald-950/50 text-emerald-400' : 'bg-rose-950/50 text-rose-400'}`}>
                                {isReturnPositive ? '📈 盈利' : '📉 亏损'}
                              </span>
                            ) : (
                              <span className="px-2 py-1 rounded text-[10px] font-medium bg-slate-800/50 text-slate-500">
                                ⏳ 待验证
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <span className={`text-slate-300`}>
                              {suggestion}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Explanation */}
              <div className="bg-slate-800/30 rounded-lg p-4 text-xs text-slate-500 leading-relaxed">
                <div className="font-semibold text-slate-400 mb-2">📖 数据说明</div>
                <ul className="space-y-1 list-disc list-inside">
                  <li><strong>样本数：</strong>历史上该评分区间出现的交易日数量</li>
                  <li><strong>绝对变动：</strong>该区间出现后，未来 {Math.round(backtest.horizon_days / 21)} 个月国债收益率的平均变化（bp = 基点 = 0.01%）</li>
                  <li><strong>相对表现：</strong>该区间相对于整体平均（{avgYieldChange > 0 ? '↓' : '↑'}{Math.abs(avgYieldChange).toFixed(1)}bp）的超额收益</li>
                  <li><strong>↓ 表示收益率下行：</strong>债券价格上涨，对债基有利</li>
                  <li><strong>↑ 表示收益率上行：</strong>债券价格下跌，对债基不利</li>
                  {isTrendingMarket && (
                    <li><strong>{allPositive ? '🐂 债牛周期：' : '🐻 债熊周期：'}</strong>
                      {allPositive 
                        ? '回测期间收益率整体下行，所有区间绝对收益均为正。相对表现更能体现评分系统的有效性。'
                        : '回测期间收益率整体上行，所有区间绝对收益均为负。相对表现更能体现评分系统的有效性。'}
                    </li>
                  )}
                  <li><strong>数据范围：</strong>基于过去 10 年历史数据回测，历史表现不代表未来收益</li>
                </ul>
              </div>

              {/* Score History Chart */}
              {backtest.score_history && backtest.score_history.length > 0 && (
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <div className="text-xs font-semibold text-slate-300 mb-3">📈 评分历史走势（10年）</div>
                  <div className="h-64">
                    <ScoreHistoryChart 
                      data={backtest.score_history} 
                      currentScore={conclusion.score}
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-[10px]">
                    <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded">☀️ 烈日 80-100</span>
                    <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded">🌤️ 晴朗 60-80</span>
                    <span className="px-2 py-1 bg-slate-500/20 text-slate-400 rounded">☁️ 多云 40-60</span>
                    <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded">🌧️ 小雨 20-40</span>
                    <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded">⛈️ 暴雨 0-20</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
    </div>
  );
};
