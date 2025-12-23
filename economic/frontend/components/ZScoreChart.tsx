import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell
} from 'recharts';
import { MacroDataPoint } from '../types';
import { METRIC_DEFINITIONS } from '../constants';
import { 
  BarChart3, 
  ChevronDown, 
  ChevronUp,
  Info,
  AlertTriangle
} from 'lucide-react';

interface ZScoreChartProps {
  data: { [key: string]: MacroDataPoint[] };
  metricKeys: string[];
  theme: string;
}

interface ZScoreItem {
  key: string;
  label: string;
  value: number;
  zScore: number;
  mean: number;
  std: number;
  interpretation: string;
  isExtreme: boolean;
}

// 计算 Z-Score
const calculateZScore = (value: number, values: number[]): { zScore: number; mean: number; std: number } => {
  const n = values.length;
  if (n < 2) return { zScore: 0, mean: value, std: 0 };
  
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n;
  const std = Math.sqrt(variance);
  
  if (std === 0) return { zScore: 0, mean, std: 0 };
  
  const zScore = (value - mean) / std;
  return { zScore, mean, std };
};

// 获取 Z-Score 颜色
const getZScoreColor = (zScore: number, colorScale?: 'normal' | 'inverse'): string => {
  const isInverse = colorScale === 'inverse';
  const absZ = Math.abs(zScore);
  
  if (absZ < 1) return '#6b7280'; // 灰色 - 正常范围
  
  if (zScore > 0) {
    // 高于均值
    if (absZ >= 2) return isInverse ? '#ef4444' : '#10b981'; // 极端高
    return isInverse ? '#f97316' : '#22c55e'; // 偏高
  } else {
    // 低于均值
    if (absZ >= 2) return isInverse ? '#10b981' : '#ef4444'; // 极端低
    return isInverse ? '#22c55e' : '#f97316'; // 偏低
  }
};

// 生成解读
const getZScoreInterpretation = (zScore: number, label: string): string => {
  const absZ = Math.abs(zScore);
  const direction = zScore > 0 ? '高于' : '低于';
  
  if (absZ < 1) {
    return `${label}处于历史正常波动范围内（±1σ）`;
  } else if (absZ < 2) {
    return `${label}${direction}历史均值 ${absZ.toFixed(1)} 个标准差，属于偏离状态`;
  } else {
    return `${label}${direction}历史均值 ${absZ.toFixed(1)} 个标准差，处于极端位置！`;
  }
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as ZScoreItem;
    return (
      <div className="bg-gray-900 border border-gray-700 p-3 rounded-lg shadow-2xl text-xs min-w-[200px]">
        <div className="font-bold text-white mb-2 pb-2 border-b border-gray-700">
          {data.label}
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between">
            <span className="text-gray-400">当前值</span>
            <span className="text-white font-mono">{data.value.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">历史均值</span>
            <span className="text-gray-300 font-mono">{data.mean.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">标准差</span>
            <span className="text-gray-300 font-mono">{data.std.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Z-Score</span>
            <span className={`font-mono font-bold ${Math.abs(data.zScore) >= 2 ? 'text-amber-400' : 'text-white'}`}>
              {data.zScore > 0 ? '+' : ''}{data.zScore.toFixed(2)}σ
            </span>
          </div>
        </div>
        <div className="mt-2 pt-2 border-t border-gray-700 text-[10px] text-gray-400 leading-relaxed">
          {data.interpretation}
        </div>
      </div>
    );
  }
  return null;
};

export const ZScoreChart: React.FC<ZScoreChartProps> = ({ data, metricKeys, theme }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [sortBy, setSortBy] = useState<'name' | 'zscore'>('zscore');

  // 计算所有指标的 Z-Score
  const zScoreData = useMemo(() => {
    const results: ZScoreItem[] = [];
    
    metricKeys.forEach(key => {
      const series = data[key];
      if (!series || series.length < 12) return;
      
      const config = METRIC_DEFINITIONS[key];
      if (!config) return;
      
      const values = series.map(d => d.value);
      const currentValue = values[values.length - 1];
      
      const { zScore, mean, std } = calculateZScore(currentValue, values);
      
      results.push({
        key,
        label: config.label,
        value: currentValue,
        zScore,
        mean,
        std,
        interpretation: getZScoreInterpretation(zScore, config.label),
        isExtreme: Math.abs(zScore) >= 2
      });
    });
    
    // 排序
    if (sortBy === 'zscore') {
      results.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));
    } else {
      results.sort((a, b) => a.label.localeCompare(b.label));
    }
    
    return results;
  }, [data, metricKeys, sortBy]);

  // 统计
  const extremeCount = zScoreData.filter(d => d.isExtreme).length;
  const highCount = zScoreData.filter(d => d.zScore >= 1).length;
  const lowCount = zScoreData.filter(d => d.zScore <= -1).length;

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-800/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-${theme}-500/20`}>
            <BarChart3 className={`w-5 h-5 text-${theme}-400`} />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              Z-Score 标准化视图
              <span className="text-xs text-gray-500 font-normal">Standardized Comparison</span>
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              将不同量纲指标标准化为统一尺度，便于横向对比
              {extremeCount > 0 && (
                <span className="text-amber-400 ml-2">
                  <AlertTriangle className="w-3 h-3 inline mr-1" />
                  {extremeCount} 个指标处于极端位置
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isExpanded && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-emerald-400">{highCount} 偏高</span>
              <span className="text-gray-500">|</span>
              <span className="text-red-400">{lowCount} 偏低</span>
            </div>
          )}
          <div className="p-1 rounded hover:bg-gray-700 text-gray-400">
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </button>

      {/* Content */}
      <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-[500px]' : 'max-h-0'}`}>
        <div className="px-4 pb-4">
          {/* Legend & Controls */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-gray-500"></div>
                <span className="text-gray-400">正常 (±1σ)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-orange-500"></div>
                <span className="text-gray-400">偏离 (1-2σ)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-red-500"></div>
                <span className="text-gray-400">极端 (&gt;2σ)</span>
              </div>
              <div className="flex items-center gap-1.5 ml-2">
                <Info className="w-3 h-3 text-gray-500" />
                <span className="text-gray-500">Z = (当前值 - 均值) / 标准差</span>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSortBy(sortBy === 'zscore' ? 'name' : 'zscore');
              }}
              className="text-xs text-gray-400 hover:text-white transition-colors"
            >
              {sortBy === 'zscore' ? '按偏离程度排序' : '按名称排序'}
            </button>
          </div>

          {/* Chart */}
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={zScoreData}
                layout="vertical"
                margin={{ top: 10, right: 30, left: 100, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
                <XAxis 
                  type="number" 
                  domain={[-4, 4]}
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  tickFormatter={(v) => `${v}σ`}
                  stroke="#4b5563"
                />
                <YAxis 
                  type="category" 
                  dataKey="label" 
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  width={95}
                  stroke="#4b5563"
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                
                {/* Reference Lines */}
                <ReferenceLine x={0} stroke="#6b7280" strokeWidth={2} />
                <ReferenceLine x={-1} stroke="#4b5563" strokeDasharray="3 3" />
                <ReferenceLine x={1} stroke="#4b5563" strokeDasharray="3 3" />
                <ReferenceLine x={-2} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.5} />
                <ReferenceLine x={2} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.5} />
                
                <Bar dataKey="zScore" radius={[0, 4, 4, 0]} maxBarSize={20}>
                  {zScoreData.map((entry, index) => {
                    const config = METRIC_DEFINITIONS[entry.key];
                    return (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={getZScoreColor(entry.zScore, config?.colorScale)}
                      />
                    );
                  })}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Summary */}
          <div className="mt-3 pt-3 border-t border-gray-700/50 flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <Info className="w-3 h-3" />
              <span>Z-Score 衡量当前值偏离历史均值的程度，|Z| &gt; 2 表示极端</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-emerald-400">{zScoreData.filter(d => d.zScore > 1).length} 个偏高</span>
              <span className="text-red-400">{zScoreData.filter(d => d.zScore < -1).length} 个偏低</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
