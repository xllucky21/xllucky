import React, { useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity,
  Flame,
  Snowflake,
  AlertTriangle,
  CheckCircle,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Zap,
} from 'lucide-react';
import { Card } from './Card';
import { AMOUNT_THRESHOLDS } from '../constants';

interface OverviewProps {
  data: any;
}

// 计算百分位
const calcPercentile = (arr: number[], value: number): number => {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const count = sorted.filter(v => v <= value).length;
  return Math.round((count / sorted.length) * 100);
};

// 获取百分位颜色
const getPercentileColor = (p: number): string => {
  if (p <= 10) return 'text-blue-400';      // 极低
  if (p <= 25) return 'text-cyan-400';      // 低
  if (p <= 50) return 'text-gray-400';      // 中等偏低
  if (p <= 75) return 'text-yellow-400';    // 中等偏高
  if (p <= 90) return 'text-orange-400';    // 高
  return 'text-red-400';                     // 极高
};

// 获取百分位背景色
const getPercentileBgColor = (p: number): string => {
  if (p <= 10) return 'bg-blue-500/20';
  if (p <= 25) return 'bg-cyan-500/20';
  if (p <= 50) return 'bg-gray-500/20';
  if (p <= 75) return 'bg-yellow-500/20';
  if (p <= 90) return 'bg-orange-500/20';
  return 'bg-red-500/20';
};

// 获取百分位标签
const getPercentileLabel = (p: number): string => {
  if (p <= 10) return '地量';
  if (p <= 25) return '偏低';
  if (p <= 50) return '中等';
  if (p <= 75) return '偏高';
  if (p <= 90) return '放量';
  return '天量';
};

export const Overview: React.FC<OverviewProps> = ({ data }) => {
  const analysis = useMemo(() => {
    const aShare = data.data.a_share || [];
    const south = data.data.south || [];
    const margin = data.data.margin || [];
    const bond = data.data.bond || [];
    const fundFlow = data.data.fund_flow || [];

    // 最新数据
    const latestAShare = aShare[aShare.length - 1];
    const prevAShare = aShare[aShare.length - 2];
    const latestSouth = south[south.length - 1];
    const latestMargin = margin[margin.length - 1];
    const latestBond = bond[bond.length - 1];
    const latestFundFlow = fundFlow[fundFlow.length - 1];

    // 计算变化
    const shChange = prevAShare ? ((latestAShare?.sh_close - prevAShare.sh_close) / prevAShare.sh_close * 100) : 0;
    const szChange = prevAShare ? ((latestAShare?.sz_close - prevAShare.sz_close) / prevAShare.sz_close * 100) : 0;
    const amountChange = prevAShare ? ((latestAShare?.total_amount_yi - prevAShare.total_amount_yi) / prevAShare.total_amount_yi * 100) : 0;

    // 近5日主力资金累计 (2024年8月起北向资金停止每日披露，改用主力资金)
    const main5d = fundFlow.slice(-5).reduce((sum: number, d: any) => sum + (d.main_net_yi || 0), 0);
    const south5d = south.slice(-5).reduce((sum: number, d: any) => sum + (d.net_inflow_yi || 0), 0);

    // ===== 成交额百分位计算 =====
    const allAmounts = aShare.map((d: any) => d.total_amount_yi).filter((v: number) => v > 0);
    const currentAmount = latestAShare?.total_amount_yi || 0;
    
    // 全历史百分位
    const amountPercentileAll = calcPercentile(allAmounts, currentAmount);
    
    // 近1年百分位 (约252个交易日)
    const amounts1Y = allAmounts.slice(-252);
    const amountPercentile1Y = calcPercentile(amounts1Y, currentAmount);
    
    // 近3年百分位 (约756个交易日)
    const amounts3Y = allAmounts.slice(-756);
    const amountPercentile3Y = calcPercentile(amounts3Y, currentAmount);
    
    // 近5日成交额均值
    const amount5d = aShare.slice(-5).reduce((sum: number, d: any) => sum + (d.total_amount_yi || 0), 0) / 5;
    const amount5dPercentile = calcPercentile(amounts1Y, amount5d);
    
    // 近20日成交额均值
    const amount20d = aShare.slice(-20).reduce((sum: number, d: any) => sum + (d.total_amount_yi || 0), 0) / 20;
    const amount20dPercentile = calcPercentile(amounts1Y, amount20d);

    // 成交额统计
    const amountStats = {
      current: currentAmount,
      percentileAll: amountPercentileAll,
      percentile1Y: amountPercentile1Y,
      percentile3Y: amountPercentile3Y,
      avg5d: amount5d,
      avg5dPercentile: amount5dPercentile,
      avg20d: amount20d,
      avg20dPercentile: amount20dPercentile,
      min1Y: Math.min(...amounts1Y),
      max1Y: Math.max(...amounts1Y),
    };

    // 市场温度评估
    let temperature = 'normal';
    let temperatureLabel = '正常';
    let temperatureColor = 'text-gray-400';
    let TemperatureIcon = Activity;

    const amount = latestAShare?.total_amount_yi || 0;
    if (amount >= AMOUNT_THRESHOLDS.hot) {
      temperature = 'hot';
      temperatureLabel = '火爆';
      temperatureColor = 'text-red-500';
      TemperatureIcon = Flame;
    } else if (amount >= AMOUNT_THRESHOLDS.active) {
      temperature = 'active';
      temperatureLabel = '活跃';
      temperatureColor = 'text-orange-500';
      TemperatureIcon = TrendingUp;
    } else if (amount < AMOUNT_THRESHOLDS.cold) {
      temperature = 'cold';
      temperatureLabel = '冷清';
      temperatureColor = 'text-blue-400';
      TemperatureIcon = Snowflake;
    }

    // 综合信号 - 成交额信号放在最前面
    const signals: { type: 'bullish' | 'bearish' | 'neutral'; text: string; priority: number }[] = [];
    
    // 成交额信号 (最重要，优先级最高)
    if (amountPercentile1Y <= 10) {
      signals.push({ type: 'neutral', text: `成交额处于近1年 ${amountPercentile1Y}% 分位（地量区间）`, priority: 1 });
    } else if (amountPercentile1Y >= 90) {
      signals.push({ type: 'neutral', text: `成交额处于近1年 ${amountPercentile1Y}% 分位（天量区间）`, priority: 1 });
    }
    
    // 连续缩量/放量信号
    if (amount5dPercentile <= 15) {
      signals.push({ type: 'neutral', text: `近5日均量处于 ${amount5dPercentile}% 分位，持续缩量`, priority: 2 });
    } else if (amount5dPercentile >= 85) {
      signals.push({ type: 'neutral', text: `近5日均量处于 ${amount5dPercentile}% 分位，持续放量`, priority: 2 });
    }
    
    // 主力资金信号 (替代北向资金，因2024年8月起北向资金停止每日披露)
    if (latestFundFlow?.main_net_yi > 100) {
      signals.push({ type: 'bullish', text: `主力大幅流入 ${latestFundFlow.main_net_yi.toFixed(1)}亿`, priority: 3 });
    } else if (latestFundFlow?.main_net_yi < -100) {
      signals.push({ type: 'bearish', text: `主力大幅流出 ${Math.abs(latestFundFlow.main_net_yi).toFixed(1)}亿`, priority: 3 });
    }

    if (main5d > 200) {
      signals.push({ type: 'bullish', text: `近5日主力累计流入 ${main5d.toFixed(1)}亿`, priority: 4 });
    } else if (main5d < -200) {
      signals.push({ type: 'bearish', text: `近5日主力累计流出 ${Math.abs(main5d).toFixed(1)}亿`, priority: 4 });
    }

    // 南向资金信号
    if (latestSouth?.net_inflow_yi > 50) {
      signals.push({ type: 'bullish', text: `南向大幅流入 ${latestSouth.net_inflow_yi.toFixed(1)}亿`, priority: 5 });
    } else if (latestSouth?.net_inflow_yi < -50) {
      signals.push({ type: 'bearish', text: `南向大幅流出 ${Math.abs(latestSouth.net_inflow_yi).toFixed(1)}亿`, priority: 5 });
    }

    if (latestBond?.spread < -1) {
      signals.push({ type: 'bearish', text: `中美利差倒挂 ${latestBond.spread.toFixed(2)}%`, priority: 6 });
    }
    
    // 按优先级排序
    signals.sort((a, b) => a.priority - b.priority);

    return {
      latestAShare,
      prevAShare,
      shChange,
      szChange,
      amountChange,
      latestSouth,
      main5d,
      south5d,
      latestMargin,
      latestBond,
      latestFundFlow,
      temperature,
      temperatureLabel,
      temperatureColor,
      TemperatureIcon,
      signals,
      amountStats,
      date: latestAShare?.date || data.meta.updated_at,
    };
  }, [data]);

  const SignalIcon = ({ type }: { type: 'bullish' | 'bearish' | 'neutral' }) => {
    if (type === 'bullish') return <ArrowUpRight className="w-4 h-4 text-red-500" />;
    if (type === 'bearish') return <ArrowDownRight className="w-4 h-4 text-green-500" />;
    return <Activity className="w-4 h-4 text-gray-400" />;
  };

  return (
    <Card className="bg-gradient-to-br from-gray-900 to-gray-950">
      <div className="flex flex-col gap-6">
        {/* 顶部：成交额核心指标（最重要） */}
        <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-xl p-4 border border-blue-500/20">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-bold text-white">两市成交额</h3>
            <span className="text-gray-500 text-sm ml-auto">{analysis.date}</span>
          </div>
          
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {/* 当前成交额 */}
            <div className="col-span-2 lg:col-span-1">
              <div className="text-3xl font-bold text-white">
                {(analysis.amountStats.current / 10000).toFixed(2)}
                <span className="text-lg text-gray-400 ml-1">万亿</span>
              </div>
              <div className={`text-sm ${analysis.amountChange >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                较昨日 {analysis.amountChange >= 0 ? '+' : ''}{analysis.amountChange.toFixed(2)}%
              </div>
            </div>
            
            {/* 近1年百分位 */}
            <div className="text-center">
              <div className="text-gray-400 text-xs mb-1">近1年分位</div>
              <div className={`text-2xl font-bold ${getPercentileColor(analysis.amountStats.percentile1Y)}`}>
                {analysis.amountStats.percentile1Y}%
              </div>
              <div className={`text-xs px-2 py-0.5 rounded-full inline-block ${getPercentileBgColor(analysis.amountStats.percentile1Y)} ${getPercentileColor(analysis.amountStats.percentile1Y)}`}>
                {getPercentileLabel(analysis.amountStats.percentile1Y)}
              </div>
            </div>
            
            {/* 近3年百分位 */}
            <div className="text-center">
              <div className="text-gray-400 text-xs mb-1">近3年分位</div>
              <div className={`text-2xl font-bold ${getPercentileColor(analysis.amountStats.percentile3Y)}`}>
                {analysis.amountStats.percentile3Y}%
              </div>
              <div className={`text-xs px-2 py-0.5 rounded-full inline-block ${getPercentileBgColor(analysis.amountStats.percentile3Y)} ${getPercentileColor(analysis.amountStats.percentile3Y)}`}>
                {getPercentileLabel(analysis.amountStats.percentile3Y)}
              </div>
            </div>
            
            {/* 5日均量 */}
            <div className="text-center">
              <div className="text-gray-400 text-xs mb-1">5日均量</div>
              <div className="text-lg font-bold text-white">
                {(analysis.amountStats.avg5d / 10000).toFixed(2)}
                <span className="text-xs text-gray-400">万亿</span>
              </div>
              <div className={`text-xs ${getPercentileColor(analysis.amountStats.avg5dPercentile)}`}>
                {analysis.amountStats.avg5dPercentile}% 分位
              </div>
            </div>
            
            {/* 20日均量 */}
            <div className="text-center">
              <div className="text-gray-400 text-xs mb-1">20日均量</div>
              <div className="text-lg font-bold text-white">
                {(analysis.amountStats.avg20d / 10000).toFixed(2)}
                <span className="text-xs text-gray-400">万亿</span>
              </div>
              <div className={`text-xs ${getPercentileColor(analysis.amountStats.avg20dPercentile)}`}>
                {analysis.amountStats.avg20dPercentile}% 分位
              </div>
            </div>
          </div>
          
          {/* 成交额区间参考 */}
          <div className="mt-3 pt-3 border-t border-gray-700/50 flex items-center gap-4 text-xs text-gray-500">
            <span>近1年区间:</span>
            <span className="text-blue-400">{(analysis.amountStats.min1Y / 10000).toFixed(2)}万亿</span>
            <span>~</span>
            <span className="text-red-400">{(analysis.amountStats.max1Y / 10000).toFixed(2)}万亿</span>
            <span className="ml-auto">全历史分位: <span className={getPercentileColor(analysis.amountStats.percentileAll)}>{analysis.amountStats.percentileAll}%</span></span>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          {/* 左侧：市场概览 */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-2 rounded-lg bg-gray-800 ${analysis.temperatureColor}`}>
                <analysis.TemperatureIcon className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">指数与资金</h2>
              </div>
              <div className={`ml-auto px-3 py-1 rounded-full text-sm font-bold ${
                analysis.temperature === 'hot' ? 'bg-red-500/20 text-red-400' :
                analysis.temperature === 'active' ? 'bg-orange-500/20 text-orange-400' :
                analysis.temperature === 'cold' ? 'bg-blue-500/20 text-blue-400' :
                'bg-gray-500/20 text-gray-400'
              }`}>
                {analysis.temperatureLabel}
              </div>
            </div>

            {/* 核心指标 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-gray-800/50 rounded-lg p-3">
                <div className="text-gray-400 text-xs mb-1">上证指数</div>
                <div className="text-xl font-bold text-white">
                  {analysis.latestAShare?.sh_close?.toFixed(2) || '-'}
                </div>
                <div className={`text-sm ${analysis.shChange >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                  {analysis.shChange >= 0 ? '+' : ''}{analysis.shChange.toFixed(2)}%
                </div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3">
                <div className="text-gray-400 text-xs mb-1">深证成指</div>
                <div className="text-xl font-bold text-white">
                  {analysis.latestAShare?.sz_close?.toFixed(2) || '-'}
                </div>
                <div className={`text-sm ${analysis.szChange >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                  {analysis.szChange >= 0 ? '+' : ''}{analysis.szChange.toFixed(2)}%
                </div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3">
                <div className="text-gray-400 text-xs mb-1">主力资金</div>
                <div className={`text-xl font-bold ${(analysis.latestFundFlow?.main_net_yi || 0) >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                  {(analysis.latestFundFlow?.main_net_yi || 0) >= 0 ? '+' : ''}
                  {analysis.latestFundFlow?.main_net_yi?.toFixed(1) || '-'}
                  <span className="text-sm text-gray-400 ml-1">亿</span>
                </div>
                <div className="text-gray-500 text-xs">
                  近5日: {analysis.main5d >= 0 ? '+' : ''}{analysis.main5d.toFixed(1)}亿
                </div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3">
                <div className="text-gray-400 text-xs mb-1">融资余额</div>
                <div className="text-xl font-bold text-white">
                  {(analysis.latestMargin?.margin_balance_yi / 10000).toFixed(2) || '-'}
                  <span className="text-sm text-gray-400 ml-1">万亿</span>
                </div>
                <div className="text-gray-500 text-xs">杠杆资金</div>
              </div>
            </div>

            {/* 更多指标 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-gray-500 text-xs">中美利差</div>
                <div className={`font-medium ${(analysis.latestBond?.spread || 0) >= 0 ? 'text-gray-300' : 'text-yellow-400'}`}>
                  {analysis.latestBond?.spread?.toFixed(2) || '-'}%
                </div>
              </div>
              <div className="text-center">
                <div className="text-gray-500 text-xs">南向资金</div>
                <div className={`font-medium ${(analysis.latestSouth?.net_inflow_yi || 0) >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {(analysis.latestSouth?.net_inflow_yi || 0) >= 0 ? '+' : ''}
                  {analysis.latestSouth?.net_inflow_yi?.toFixed(1) || '-'}亿
                </div>
              </div>
              <div className="text-center">
                <div className="text-gray-500 text-xs">近5日南向</div>
                <div className={`font-medium ${analysis.south5d >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {analysis.south5d >= 0 ? '+' : ''}{analysis.south5d.toFixed(1)}亿
                </div>
              </div>
              <div className="text-center">
                <div className="text-gray-500 text-xs">市场温度</div>
                <div className={`font-medium ${analysis.temperatureColor}`}>
                  {analysis.temperatureLabel}
                </div>
              </div>
            </div>
          </div>

          {/* 右侧：信号面板 */}
          <div className="lg:w-80 bg-gray-800/30 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-500" />
              市场信号
            </h3>
            {analysis.signals.length > 0 ? (
              <div className="space-y-2">
                {analysis.signals.map((signal, i) => (
                  <div 
                    key={i}
                    className={`flex items-center gap-2 p-2 rounded-lg ${
                      signal.type === 'bullish' ? 'bg-red-500/10' :
                      signal.type === 'bearish' ? 'bg-green-500/10' :
                      'bg-yellow-500/10'
                    }`}
                  >
                    <SignalIcon type={signal.type} />
                    <span className="text-sm text-gray-300">{signal.text}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 p-2 text-gray-500">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm">暂无明显信号</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};
