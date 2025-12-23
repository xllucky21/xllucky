import React, { useMemo, useState } from 'react';
import { MacroDataPoint } from '../types';
import { METRIC_DEFINITIONS } from '../constants';
import { 
  Gauge, 
  ChevronDown, 
  ChevronUp,
  TrendingUp,
  TrendingDown,
  Minus,
  Info
} from 'lucide-react';

interface PercentileGaugeProps {
  data: { [key: string]: MacroDataPoint[] };
  metricKeys: string[];
  theme: string;
  timeRange: '5Y' | '10Y' | '20Y' | 'ALL';
}

interface MetricPercentile {
  key: string;
  label: string;
  currentValue: number;
  percentile: number;
  min: number;
  max: number;
  median: number;
  trend: 'up' | 'down' | 'flat';
  change: number;
  interpretation: string;
  colorScale?: 'normal' | 'inverse';
}

// 计算分位数
const calculatePercentile = (value: number, sortedValues: number[]): number => {
  if (sortedValues.length === 0) return 50;
  const rank = sortedValues.filter(v => v < value).length;
  return (rank / sortedValues.length) * 100;
};

// 获取分位数颜色
const getPercentileColor = (percentile: number, colorScale?: 'normal' | 'inverse'): string => {
  // inverse: 低分位好（如PE、PB）
  // normal: 高分位好（如ERP）
  const isInverse = colorScale === 'inverse';
  
  if (percentile < 10) {
    return isInverse ? 'text-emerald-400' : 'text-rose-400';
  } else if (percentile < 25) {
    return isInverse ? 'text-green-400' : 'text-orange-400';
  } else if (percentile < 75) {
    return 'text-gray-300';
  } else if (percentile < 90) {
    return isInverse ? 'text-orange-400' : 'text-green-400';
  } else {
    return isInverse ? 'text-rose-400' : 'text-emerald-400';
  }
};

// 获取分位数背景色
const getPercentileBgColor = (percentile: number, colorScale?: 'normal' | 'inverse'): string => {
  const isInverse = colorScale === 'inverse';
  
  if (percentile < 10) {
    return isInverse ? 'bg-emerald-500' : 'bg-rose-500';
  } else if (percentile < 25) {
    return isInverse ? 'bg-green-500' : 'bg-orange-500';
  } else if (percentile < 75) {
    return 'bg-gray-500';
  } else if (percentile < 90) {
    return isInverse ? 'bg-orange-500' : 'bg-green-500';
  } else {
    return isInverse ? 'bg-rose-500' : 'bg-emerald-500';
  }
};

// 生成解读文案
const getInterpretation = (percentile: number, label: string, colorScale?: 'normal' | 'inverse'): string => {
  const isInverse = colorScale === 'inverse';
  
  if (percentile < 10) {
    return isInverse 
      ? `${label}处于历史极低位，估值极具吸引力`
      : `${label}处于历史极低位，需关注下行风险`;
  } else if (percentile < 25) {
    return isInverse 
      ? `${label}处于历史低位，具有较好的安全边际`
      : `${label}处于历史低位，可能存在底部机会`;
  } else if (percentile < 75) {
    return `${label}处于历史中枢区间，属于正常波动范围`;
  } else if (percentile < 90) {
    return isInverse 
      ? `${label}处于历史高位，估值偏贵需谨慎`
      : `${label}处于历史高位，市场情绪较为乐观`;
  } else {
    return isInverse 
      ? `${label}处于历史极高位，估值泡沫风险较大`
      : `${label}处于历史极高位，可能接近周期顶部`;
  }
};

export const PercentileGauge: React.FC<PercentileGaugeProps> = ({ 
  data, 
  metricKeys, 
  theme,
  timeRange 
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [sortBy, setSortBy] = useState<'name' | 'percentile'>('percentile');

  // 计算所有指标的分位数
  const percentiles = useMemo(() => {
    const results: MetricPercentile[] = [];
    
    metricKeys.forEach(key => {
      const series = data[key];
      if (!series || series.length < 12) return;
      
      const config = METRIC_DEFINITIONS[key];
      if (!config) return;
      
      const values = series.map(d => d.value);
      const sortedValues = [...values].sort((a, b) => a - b);
      
      const currentValue = series[series.length - 1].value;
      const prevValue = series[series.length - 2]?.value || currentValue;
      const change = currentValue - prevValue;
      
      const percentile = calculatePercentile(currentValue, sortedValues);
      const min = sortedValues[0];
      const max = sortedValues[sortedValues.length - 1];
      const median = sortedValues[Math.floor(sortedValues.length / 2)];
      
      const trend = change > 0.01 ? 'up' : change < -0.01 ? 'down' : 'flat';
      
      results.push({
        key,
        label: config.label,
        currentValue,
        percentile,
        min,
        max,
        median,
        trend,
        change,
        interpretation: getInterpretation(percentile, config.label, config.colorScale),
        colorScale: config.colorScale
      });
    });
    
    // 排序
    if (sortBy === 'percentile') {
      // 按极端程度排序（距离50%越远越靠前）
      results.sort((a, b) => Math.abs(b.percentile - 50) - Math.abs(a.percentile - 50));
    } else {
      results.sort((a, b) => a.label.localeCompare(b.label));
    }
    
    return results;
  }, [data, metricKeys, sortBy]);

  // 统计极端值数量
  const extremeCount = percentiles.filter(p => p.percentile < 10 || p.percentile > 90).length;
  const lowCount = percentiles.filter(p => p.percentile < 25).length;
  const highCount = percentiles.filter(p => p.percentile > 75).length;

  return (
    <div className={`bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden`}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-800/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-${theme}-500/20`}>
            <Gauge className={`w-5 h-5 text-${theme}-400`} />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              历史分位数仪表盘
              <span className="text-xs text-gray-500 font-normal">Percentile Dashboard</span>
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              基于{timeRange === 'ALL' ? '全部' : `近${timeRange.replace('Y', '年')}`}历史数据
              {extremeCount > 0 && (
                <span className="text-amber-400 ml-2">{extremeCount} 个指标处于极端位置</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isExpanded && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-rose-400">{lowCount} 低位</span>
              <span className="text-gray-500">|</span>
              <span className="text-emerald-400">{highCount} 高位</span>
            </div>
          )}
          <div className="p-1 rounded hover:bg-gray-700 text-gray-400">
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </button>

      {/* Content */}
      <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-[600px]' : 'max-h-0'}`}>
        <div className="px-4 pb-4">
          {/* Sort Toggle */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500"></div>
                <span className="text-gray-400">极低 (&lt;10%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-orange-500"></div>
                <span className="text-gray-400">偏低 (10-25%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-gray-500"></div>
                <span className="text-gray-400">中性 (25-75%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                <span className="text-gray-400">偏高 (75-90%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                <span className="text-gray-400">极高 (&gt;90%)</span>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSortBy(sortBy === 'percentile' ? 'name' : 'percentile');
              }}
              className="text-xs text-gray-400 hover:text-white transition-colors"
            >
              {sortBy === 'percentile' ? '按极端程度排序' : '按名称排序'}
            </button>
          </div>

          {/* Percentile List */}
          <div className="space-y-2 max-h-[450px] overflow-y-auto pr-1">
            {percentiles.map((item) => {
              const TrendIcon = item.trend === 'up' ? TrendingUp : item.trend === 'down' ? TrendingDown : Minus;
              const trendColor = item.trend === 'up' ? 'text-rose-400' : item.trend === 'down' ? 'text-emerald-400' : 'text-gray-500';
              
              return (
                <div
                  key={item.key}
                  className="bg-gray-800/40 rounded-lg p-3 hover:bg-gray-800/60 transition-all group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-sm font-medium text-white truncate" title={item.label}>
                        {item.label}
                      </span>
                      <div className="group/tip relative">
                        <Info className="w-3 h-3 text-gray-600 hover:text-gray-400 cursor-help" />
                        <div className="absolute left-0 bottom-full mb-2 w-56 p-2 bg-gray-950 border border-gray-700 text-[10px] text-gray-300 rounded shadow-xl opacity-0 group-hover/tip:opacity-100 transition-opacity pointer-events-none z-50 leading-relaxed">
                          {item.interpretation}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={`flex items-center gap-1 text-xs ${trendColor}`}>
                        <TrendIcon className="w-3 h-3" />
                        <span className="font-mono">
                          {item.change > 0 ? '+' : ''}{item.change.toFixed(2)}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-mono font-bold text-white">
                          {item.currentValue.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Percentile Bar */}
                  <div className="relative">
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      {/* Gradient Background */}
                      <div 
                        className="absolute inset-0 opacity-30"
                        style={{
                          background: item.colorScale === 'inverse'
                            ? 'linear-gradient(to right, #10b981, #22c55e, #6b7280, #f97316, #ef4444)'
                            : 'linear-gradient(to right, #ef4444, #f97316, #6b7280, #22c55e, #10b981)'
                        }}
                      />
                      {/* Position Marker */}
                      <div 
                        className={`absolute top-0 h-full w-1 ${getPercentileBgColor(item.percentile, item.colorScale)} rounded-full shadow-[0_0_8px_rgba(255,255,255,0.5)] z-10 transition-all duration-500`}
                        style={{ left: `${Math.max(0, Math.min(99, item.percentile))}%` }}
                      />
                    </div>
                    
                    {/* Labels */}
                    <div className="flex justify-between mt-1 text-[9px] text-gray-500 font-mono">
                      <span>{item.min.toFixed(1)}</span>
                      <span className={`font-bold ${getPercentileColor(item.percentile, item.colorScale)}`}>
                        P{item.percentile.toFixed(0)}
                      </span>
                      <span>{item.max.toFixed(1)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary */}
          <div className="mt-3 pt-3 border-t border-gray-700/50 flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <Info className="w-3 h-3" />
              <span>分位数反映当前值在历史数据中的相对位置</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-rose-400">{percentiles.filter(p => p.percentile < 25).length} 个低位</span>
              <span className="text-emerald-400">{percentiles.filter(p => p.percentile > 75).length} 个高位</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
