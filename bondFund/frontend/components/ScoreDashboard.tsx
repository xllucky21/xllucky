
import React from 'react';
import { BondReportData } from '../types';
import { WeatherBadge } from './WeatherBadge';
import { TrendingUp, TrendingDown, Anchor, BarChart3, Activity, Droplets, MoveRight } from 'lucide-react';
import { InfoTooltip } from './InfoTooltip';

interface ScoreDashboardProps {
  data: BondReportData;
  prevData?: BondReportData;
}

export const ScoreDashboard: React.FC<ScoreDashboardProps> = ({ data, prevData }) => {
  const { conclusion } = data;

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
          erpTooltip = `⚖️ 股债性价比 (股权风险溢价)\n🧮 公式：(1 / PE) - 国债收益率\n\n👉 (1 / ${pe}) - ${conclusion.last_yield.toFixed(2)}% ≈ ${erpDisplayValue}\n\n⚠️ 警戒线：> 5.5%\n当 ERP 高于 5.5% 时，说明股票比债券便宜太多，资金可能流出债市。`;
      }
  }

  // Helpers for Dynamic Colors
  const getValuationColor = (status: string) => {
    if (status.includes('便宜') || status.includes('低估')) return 'text-emerald-400';
    if (status.includes('贵') || status.includes('高估')) return 'text-rose-400';
    return 'text-slate-400';
  };

  const getShiborColor = (shiborStr: string) => {
    const val = parseFloat(shiborStr.replace('%', ''));
    if (!isNaN(val) && val > 1.8) return 'text-rose-400';
    return 'text-cyan-400'; // Safe/Normal color
  };

  const getMacdColor = (val: string, status: string) => {
    // 动量向好 (Green) OR 死叉 (Green for bonds as yield drops)
    if (val === '向好' || status.includes('绿') || status.includes('死叉')) return 'text-emerald-400';
    // 动量恶化 (Red) OR 金叉 (Red for bonds as yield rises)
    if (val === '恶化' || status.includes('红') || status.includes('金叉')) return 'text-rose-400';
    return 'text-slate-400';
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
        <p className="text-slate-500 text-sm font-mono">
          数据生成时间: <span className="text-slate-400">{data.generated_at}</span>
        </p>
      </div>

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
                            content={`基于四大维度加权计算：\n1. 估值 (40%)\n2. 趋势 (30%)\n3. 情绪 (30%)\n4. 宏观对冲 (扣分项)\n\n☀️ 烈日 (80-100)：极度低估 (重仓)\n🌤️ 晴朗 (60-80)：舒适区间 (加仓)\n☁️ 多云 (40-60)：震荡区间 (观望)\n🌧️ 小雨 (20-40)：风险区间 (减仓)\n⛈️ 暴雨 (0-20)：极度高估 (清仓)`}
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
                tooltip={`🐮 牛熊分界线：60日均线\n\n🟢 Yield < MA60\n利率在均线下方，处于下行通道 → 债牛 (持有)\n\n🔴 Yield > MA60\n利率在均线上方，处于上行通道 → 债熊 (减仓)`}
            />
             <KpiCard 
                title="资金面 (Shibor)" 
                value={conclusion.shibor_val} 
                sub={conclusion.liquidity_msg}
                icon={Droplets}
                color={getShiborColor(conclusion.shibor_val)}
                tooltip={`🏦 债市的"水源" (银行间拆借利率)\n🔥 警戒线：1.8%\n\n如果隔夜 Shibor 持续高于 1.8%，说明央行在收紧银根，银行没钱买债了，风险增加。`}
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
            tooltip={`🎯 适合：追求绝对收益，厌恶回撤。\n\n✅ 只在"晴天"和"烈日"入场\n🛑 评分跌破 40 分坚决止盈离场\n🚫 不参与左侧抄底，不碰垃圾时间`}
        />
        <StrategyCard 
            type="risk" 
            title="激进型" 
            content={conclusion.suggestion_agg} 
            tooltip={`⚔️ 适合：交易型选手，懂波段。\n\n🌊 利用 RSI 超买 (>70) 抢反弹\n🔄 利用 ERP 指标进行股债轮动切换`}
        />
      </div>
      
    </div>
  );
};
