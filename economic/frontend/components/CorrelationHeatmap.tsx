import React, { useMemo, useState } from 'react';
import { MacroDataPoint } from '../types';
import { METRIC_DEFINITIONS } from '../constants';
import { X, TrendingUp, TrendingDown, Minus, Grid3X3, Info, ChevronDown, ChevronUp, Filter } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine
} from 'recharts';

interface CorrelationHeatmapProps {
  data: { [key: string]: MacroDataPoint[] };
  metricKeys: string[];
  theme: string;
  minCorrelation?: number; // 最小相关性阈值，默认0.6（中等偏强相关）
}

// 计算皮尔逊相关系数
const calculateCorrelation = (x: number[], y: number[]): number => {
  const n = Math.min(x.length, y.length);
  if (n < 3) return 0;

  const xSlice = x.slice(-n);
  const ySlice = y.slice(-n);

  const meanX = xSlice.reduce((a, b) => a + b, 0) / n;
  const meanY = ySlice.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let denomX = 0;
  let denomY = 0;

  for (let i = 0; i < n; i++) {
    const dx = xSlice[i] - meanX;
    const dy = ySlice[i] - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }

  const denominator = Math.sqrt(denomX * denomY);
  if (denominator === 0) return 0;

  return numerator / denominator;
};

// 对齐两个时间序列数据
const alignTimeSeries = (
  data1: MacroDataPoint[],
  data2: MacroDataPoint[]
): { values1: number[]; values2: number[]; dates: string[] } => {
  const dateMap1 = new Map(data1.map(d => [d.date, d.value]));
  const dateMap2 = new Map(data2.map(d => [d.date, d.value]));

  const commonDates = [...dateMap1.keys()].filter(date => dateMap2.has(date)).sort();

  return {
    values1: commonDates.map(d => dateMap1.get(d)!),
    values2: commonDates.map(d => dateMap2.get(d)!),
    dates: commonDates
  };
};

// 根据相关系数获取颜色
const getCorrelationColor = (corr: number): string => {
  const absCorr = Math.abs(corr);
  if (corr > 0) {
    // 正相关：绿色系
    if (absCorr > 0.7) return 'bg-emerald-600';
    if (absCorr > 0.5) return 'bg-emerald-500/80';
    if (absCorr > 0.3) return 'bg-emerald-400/60';
    return 'bg-emerald-300/40';
  } else {
    // 负相关：红色系
    if (absCorr > 0.7) return 'bg-rose-600';
    if (absCorr > 0.5) return 'bg-rose-500/80';
    if (absCorr > 0.3) return 'bg-rose-400/60';
    return 'bg-rose-300/40';
  }
};

// 根据相关系数获取文字颜色
const getTextColor = (corr: number): string => {
  const absCorr = Math.abs(corr);
  if (absCorr > 0.5) return 'text-white';
  return 'text-gray-200';
};

// 时序对比弹窗组件
const ComparisonModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  metric1: string;
  metric2: string;
  data: { [key: string]: MacroDataPoint[] };
  correlation: number;
}> = ({ isOpen, onClose, metric1, metric2, data, correlation }) => {
  if (!isOpen) return null;

  const label1 = METRIC_DEFINITIONS[metric1]?.label || metric1;
  const label2 = METRIC_DEFINITIONS[metric2]?.label || metric2;
  const color1 = METRIC_DEFINITIONS[metric1]?.color || '#60a5fa';
  const color2 = METRIC_DEFINITIONS[metric2]?.color || '#f472b6';

  // 合并数据用于图表
  const chartData = useMemo(() => {
    const dateMap: { [date: string]: { date: string; [key: string]: number | string } } = {};

    data[metric1]?.forEach(d => {
      if (!dateMap[d.date]) dateMap[d.date] = { date: d.date };
      dateMap[d.date][metric1] = d.value;
    });

    data[metric2]?.forEach(d => {
      if (!dateMap[d.date]) dateMap[d.date] = { date: d.date };
      dateMap[d.date][metric2] = d.value;
    });

    return Object.values(dateMap)
      .filter(d => d[metric1] !== undefined && d[metric2] !== undefined)
      .sort((a, b) => (a.date as string).localeCompare(b.date as string));
  }, [data, metric1, metric2]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-[90vw] max-w-4xl max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <Grid3X3 className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-bold text-white">
              {label1} vs {label2}
            </h3>
            <span
              className={`px-2 py-0.5 rounded text-xs font-bold ${
                correlation > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
              }`}
            >
              相关系数: {correlation.toFixed(3)}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-800 transition-colors text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Chart */}
        <div className="p-4">
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <XAxis
                  dataKey="date"
                  stroke="#4b5563"
                  tick={{ fill: '#9ca3af', fontSize: 11 }}
                  tickFormatter={(value) => value.slice(0, 7)}
                />
                <YAxis
                  yAxisId="left"
                  stroke={color1}
                  tick={{ fill: color1, fontSize: 11 }}
                  tickFormatter={(v) => v.toFixed(1)}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke={color2}
                  tick={{ fill: color2, fontSize: 11 }}
                  tickFormatter={(v) => v.toFixed(1)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                  labelStyle={{ color: '#9ca3af' }}
                  formatter={(value: number, name: string) => [
                    value.toFixed(2),
                    METRIC_DEFINITIONS[name]?.label || name
                  ]}
                />
                <Legend
                  formatter={(value) => METRIC_DEFINITIONS[value]?.label || value}
                  wrapperStyle={{ fontSize: '12px' }}
                />
                <ReferenceLine yAxisId="left" y={0} stroke="#4b5563" strokeDasharray="3 3" />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey={metric1}
                  stroke={color1}
                  strokeWidth={2}
                  dot={false}
                  name={metric1}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey={metric2}
                  stroke={color2}
                  strokeWidth={2}
                  dot={false}
                  name={metric2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Interpretation */}
          <div className="mt-4 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-gray-300">
                {Math.abs(correlation) > 0.7 ? (
                  <span>
                    <strong className={correlation > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      强{correlation > 0 ? '正' : '负'}相关
                    </strong>
                    ：这两个指标高度{correlation > 0 ? '同步' : '反向'}运动。
                    {correlation > 0
                      ? '当一个上升时，另一个也倾向于上升。'
                      : '当一个上升时，另一个倾向于下降。'}
                  </span>
                ) : Math.abs(correlation) > 0.4 ? (
                  <span>
                    <strong className={correlation > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      中等{correlation > 0 ? '正' : '负'}相关
                    </strong>
                    ：这两个指标存在一定的{correlation > 0 ? '同向' : '反向'}关联，但并非完全同步。
                  </span>
                ) : (
                  <span>
                    <strong className="text-gray-400">弱相关</strong>
                    ：这两个指标之间的线性关系较弱，可能受到其他因素的独立影响。
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const CorrelationHeatmap: React.FC<CorrelationHeatmapProps> = ({
  data,
  metricKeys,
  theme,
  minCorrelation = 0.6
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAllCorrelations, setShowAllCorrelations] = useState(false);
  const [selectedPair, setSelectedPair] = useState<{
    metric1: string;
    metric2: string;
    correlation: number;
  } | null>(null);

  // 获取指标标签（完整名称）
  const getFullLabel = (key: string): string => {
    const def = METRIC_DEFINITIONS[key];
    return def?.label || key;
  };

  // 计算所有指标对的相关性
  const allCorrelationPairs = useMemo(() => {
    const pairs: { key1: string; key2: string; corr: number }[] = [];

    for (let i = 0; i < metricKeys.length; i++) {
      for (let j = i + 1; j < metricKeys.length; j++) {
        const data1 = data[metricKeys[i]] || [];
        const data2 = data[metricKeys[j]] || [];
        const { values1, values2 } = alignTimeSeries(data1, data2);
        const corr = calculateCorrelation(values1, values2);
        pairs.push({ key1: metricKeys[i], key2: metricKeys[j], corr });
      }
    }

    // 按相关性绝对值排序
    pairs.sort((a, b) => Math.abs(b.corr) - Math.abs(a.corr));
    return pairs;
  }, [data, metricKeys]);

  // 根据阈值过滤
  const filteredPairs = useMemo(() => {
    if (showAllCorrelations) return allCorrelationPairs;
    return allCorrelationPairs.filter(p => Math.abs(p.corr) >= minCorrelation);
  }, [allCorrelationPairs, minCorrelation, showAllCorrelations]);

  // 找出最强的正相关和负相关
  const topCorrelations = useMemo(() => {
    const positive = allCorrelationPairs.filter(p => p.corr > 0).slice(0, 2);
    const negative = allCorrelationPairs.filter(p => p.corr < 0).slice(0, 2);
    return { positive, negative };
  }, [allCorrelationPairs]);

  const handlePairClick = (pair: { key1: string; key2: string; corr: number }) => {
    setSelectedPair({
      metric1: pair.key1,
      metric2: pair.key2,
      correlation: pair.corr
    });
  };

  return (
    <>
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between group mt-6 p-3 bg-gray-800/30 rounded-lg border border-gray-700/50 hover:border-gray-600 transition-all"
      >
        <div className="flex items-center gap-2">
          <Grid3X3 className={`w-4 h-4 text-${theme}-400`} />
          <span className="text-sm font-medium text-white">指标相关性分析</span>
          <span className="text-xs text-gray-500">Correlation Analysis</span>
          {!isExpanded && (
            <span className="text-xs text-gray-500 ml-2">
              ({filteredPairs.length} 组高相关指标)
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Summary when collapsed */}
          {!isExpanded && topCorrelations.positive[0] && (
            <div className="hidden lg:flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5 text-emerald-400">
                <TrendingUp className="w-3 h-3" />
                <span className="text-gray-500">最强正相关:</span>
                <span className="font-medium">
                  {getFullLabel(topCorrelations.positive[0].key1)} & {getFullLabel(topCorrelations.positive[0].key2)}
                </span>
                <span className="font-mono text-emerald-500">({topCorrelations.positive[0].corr.toFixed(2)})</span>
              </div>
              {topCorrelations.negative[0] && (
                <div className="flex items-center gap-1.5 text-rose-400">
                  <TrendingDown className="w-3 h-3" />
                  <span className="text-gray-500">最强负相关:</span>
                  <span className="font-medium">
                    {getFullLabel(topCorrelations.negative[0].key1)} & {getFullLabel(topCorrelations.negative[0].key2)}
                  </span>
                  <span className="font-mono text-rose-500">({topCorrelations.negative[0].corr.toFixed(2)})</span>
                </div>
              )}
            </div>
          )}
          <div className={`p-1 rounded transition-colors group-hover:bg-gray-700 text-gray-400 group-hover:text-white`}>
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </button>

      {/* Expandable Content */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded ? 'max-h-[600px] opacity-100 mt-3' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="bg-gray-800/20 rounded-lg border border-gray-700/50 p-4">
          {/* Header with filter toggle */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-gray-400">正相关</span>
                <div className="flex gap-0.5">
                  <div className="w-2.5 h-2.5 rounded bg-emerald-400/60"></div>
                  <div className="w-2.5 h-2.5 rounded bg-emerald-600"></div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                <span className="text-gray-400">负相关</span>
                <div className="flex gap-0.5">
                  <div className="w-2.5 h-2.5 rounded bg-rose-400/60"></div>
                  <div className="w-2.5 h-2.5 rounded bg-rose-600"></div>
                </div>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowAllCorrelations(!showAllCorrelations);
              }}
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${
                showAllCorrelations 
                  ? 'bg-gray-700 text-white' 
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
            >
              <Filter className="w-3 h-3" />
              {showAllCorrelations ? '显示全部' : `仅显示 |r| ≥ ${minCorrelation}`}
            </button>
          </div>

          {/* Correlation List */}
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
            {filteredPairs.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                没有相关性 ≥ {minCorrelation} 的指标对
              </div>
            ) : (
              filteredPairs.map((pair, idx) => {
                const absCorr = Math.abs(pair.corr);
                const isPositive = pair.corr > 0;
                
                return (
                  <div
                    key={`${pair.key1}-${pair.key2}`}
                    onClick={() => handlePairClick(pair)}
                    className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-800/40 hover:bg-gray-700/50 cursor-pointer transition-all group border border-transparent hover:border-gray-600"
                  >
                    {/* Rank */}
                    <div className="w-6 text-center text-xs text-gray-500 font-mono">
                      {idx + 1}
                    </div>

                    {/* Correlation Bar */}
                    <div className="flex-1 flex items-center gap-3">
                      <div className="flex-1 flex items-center gap-2">
                        <span className="text-sm text-gray-200 font-medium min-w-[120px] truncate" title={getFullLabel(pair.key1)}>
                          {getFullLabel(pair.key1)}
                        </span>
                        <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              isPositive 
                                ? absCorr > 0.7 ? 'bg-emerald-500' : 'bg-emerald-400/70'
                                : absCorr > 0.7 ? 'bg-rose-500' : 'bg-rose-400/70'
                            }`}
                            style={{ width: `${absCorr * 100}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-200 font-medium min-w-[120px] truncate text-right" title={getFullLabel(pair.key2)}>
                          {getFullLabel(pair.key2)}
                        </span>
                      </div>
                    </div>

                    {/* Correlation Value */}
                    <div className={`w-16 text-right font-mono text-sm font-bold ${
                      isPositive ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {pair.corr > 0 ? '+' : ''}{pair.corr.toFixed(2)}
                    </div>

                    {/* Arrow indicator */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400">
                      <ChevronDown className="w-4 h-4 -rotate-90" />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Hint */}
          <div className="mt-3 pt-3 border-t border-gray-700/50 text-xs text-gray-500 flex items-center gap-1">
            <Info className="w-3 h-3" />
            点击任意行可查看两个指标的时序对比图
          </div>
        </div>
      </div>

      {/* Comparison Modal */}
      <ComparisonModal
        isOpen={selectedPair !== null}
        onClose={() => setSelectedPair(null)}
        metric1={selectedPair?.metric1 || ''}
        metric2={selectedPair?.metric2 || ''}
        data={data}
        correlation={selectedPair?.correlation || 0}
      />
    </>
  );
};
