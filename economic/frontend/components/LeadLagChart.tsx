import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine
} from 'recharts';
import { MacroDataPoint } from '../types';
import { METRIC_DEFINITIONS } from '../constants';
import { 
  GitBranch, 
  ChevronDown, 
  ChevronUp,
  ArrowRight,
  Clock,
  TrendingUp,
  Info
} from 'lucide-react';

interface LeadLagChartProps {
  data: { [key: string]: MacroDataPoint[] };
  theme: string;
}

// 领先-滞后关系定义
const LEAD_LAG_PAIRS = [
  {
    id: 'credit_to_growth',
    name: '信用脉冲 → 经济增长',
    description: '社融增速领先 GDP 约 2-3 个季度',
    leadKey: 'social_financing',
    lagKey: 'gdp',
    leadMonths: 6,
    color: '#8b5cf6'
  },
  {
    id: 'm1_to_stock',
    name: 'M1 → 股市估值',
    description: 'M1 增速领先上证 PE 约 3-6 个月',
    leadKey: 'm1',
    lagKey: 'sh_index_pe',
    leadMonths: 4,
    color: '#10b981'
  },
  {
    id: 'pmi_to_ppi',
    name: 'PMI → PPI',
    description: '制造业景气领先工业品价格约 1-2 个月',
    leadKey: 'pmi',
    lagKey: 'ppi',
    leadMonths: 2,
    color: '#f59e0b'
  },
  {
    id: 'rate_to_realestate',
    name: 'LPR → 房地产景气',
    description: '房贷利率变化领先地产景气约 3-6 个月',
    leadKey: 'lpr_5y',
    lagKey: 'real_estate_invest',
    leadMonths: 4,
    color: '#ec4899',
    invertLead: true // 利率下降利好地产
  },
  {
    id: 'scissors_to_stock',
    name: '剪刀差 → 股市',
    description: 'M1-M2 剪刀差领先上证指数约 3-6 个月',
    leadKey: 'scissors',
    lagKey: 'sh_index',
    leadMonths: 4,
    color: '#06b6d4'
  }
];

// 计算相关系数
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
  
  const denom = Math.sqrt(denomX * denomY);
  return denom === 0 ? 0 : numerator / denom;
};

// 标准化数据到 0-100 范围
const normalizeData = (values: number[]): number[] => {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 50);
  return values.map(v => ((v - min) / (max - min)) * 100);
};

const formatDate = (timestamp: number) => {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-gray-900 border border-gray-700 p-3 rounded-lg shadow-2xl text-xs min-w-[180px]">
        <div className="text-gray-400 mb-2 font-mono border-b border-gray-700 pb-1">
          {formatDate(label)}
        </div>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex justify-between items-center gap-4 mb-1">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></div>
              <span className="text-gray-300">{entry.name}</span>
            </div>
            <span className="font-mono font-medium" style={{ color: entry.color }}>
              {entry.value?.toFixed(1)}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export const LeadLagChart: React.FC<LeadLagChartProps> = ({ data, theme }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedPair, setSelectedPair] = useState(LEAD_LAG_PAIRS[0].id);

  const currentPair = LEAD_LAG_PAIRS.find(p => p.id === selectedPair) || LEAD_LAG_PAIRS[0];

  // 准备图表数据
  const chartData = useMemo(() => {
    const leadSeries = data[currentPair.leadKey];
    const lagSeries = data[currentPair.lagKey];
    
    if (!leadSeries || !lagSeries || leadSeries.length < 12 || lagSeries.length < 12) {
      return { data: [], correlation: 0, prediction: null };
    }

    // 创建日期映射
    const leadMap = new Map(leadSeries.map(d => [d.date, d.value]));
    const lagMap = new Map(lagSeries.map(d => [d.date, d.value]));
    
    // 获取所有日期
    const allDates = new Set([...leadSeries.map(d => d.date), ...lagSeries.map(d => d.date)]);
    const sortedDates = Array.from(allDates).sort();
    
    // 提取原始值用于标准化
    const leadValues = sortedDates.map(d => leadMap.get(d)).filter(v => v !== undefined) as number[];
    const lagValues = sortedDates.map(d => lagMap.get(d)).filter(v => v !== undefined) as number[];
    
    const normalizedLead = normalizeData(leadValues);
    const normalizedLag = normalizeData(lagValues);
    
    // 构建图表数据
    let leadIdx = 0;
    let lagIdx = 0;
    const result = sortedDates.map(date => {
      const leadVal = leadMap.get(date);
      const lagVal = lagMap.get(date);
      
      const point: any = {
        date,
        timestamp: new Date(date).getTime()
      };
      
      if (leadVal !== undefined) {
        point.lead = normalizedLead[leadIdx++];
        point.leadRaw = leadVal;
      }
      if (lagVal !== undefined) {
        point.lag = normalizedLag[lagIdx++];
        point.lagRaw = lagVal;
      }
      
      return point;
    });

    // 计算领先相关性（将领先指标前移后与滞后指标对比）
    const shiftedLead: number[] = [];
    const alignedLag: number[] = [];
    
    for (let i = currentPair.leadMonths; i < result.length; i++) {
      const leadPoint = result[i - currentPair.leadMonths];
      const lagPoint = result[i];
      if (leadPoint?.lead !== undefined && lagPoint?.lag !== undefined) {
        shiftedLead.push(currentPair.invertLead ? -leadPoint.lead : leadPoint.lead);
        alignedLag.push(lagPoint.lag);
      }
    }
    
    const correlation = calculateCorrelation(shiftedLead, alignedLag);

    // 预测：用最近的领先指标值预测未来
    const recentLead = result.filter(d => d.lead !== undefined).slice(-3);
    let prediction = null;
    if (recentLead.length > 0) {
      const avgRecentLead = recentLead.reduce((sum, d) => sum + d.lead, 0) / recentLead.length;
      const trend = avgRecentLead > 50 ? '上行' : avgRecentLead < 50 ? '下行' : '持平';
      prediction = {
        direction: currentPair.invertLead ? (trend === '上行' ? '下行' : '上行') : trend,
        confidence: Math.abs(avgRecentLead - 50) / 50,
        months: currentPair.leadMonths
      };
    }

    return { data: result, correlation, prediction };
  }, [data, currentPair]);

  const leadConfig = METRIC_DEFINITIONS[currentPair.leadKey];
  const lagConfig = METRIC_DEFINITIONS[currentPair.lagKey];

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-800/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-${theme}-500/20`}>
            <GitBranch className={`w-5 h-5 text-${theme}-400`} />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              领先-滞后指标关系
              <span className="text-xs text-gray-500 font-normal">Lead-Lag Relationships</span>
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              分析指标间的时序传导关系，辅助预判经济走势
            </p>
          </div>
        </div>
        <div className="p-1 rounded hover:bg-gray-700 text-gray-400">
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Content */}
      <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-[600px]' : 'max-h-0'}`}>
        <div className="px-4 pb-4">
          {/* Pair Selector */}
          <div className="flex flex-wrap gap-2 mb-4">
            {LEAD_LAG_PAIRS.map(pair => (
              <button
                key={pair.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPair(pair.id);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  selectedPair === pair.id
                    ? 'text-white shadow-lg'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
                style={{
                  backgroundColor: selectedPair === pair.id ? pair.color : undefined
                }}
              >
                {pair.name}
              </button>
            ))}
          </div>

          {/* Info Bar */}
          <div className="flex items-center justify-between mb-3 p-3 bg-gray-800/50 rounded-lg">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: currentPair.color }}></div>
                <span className="text-xs text-gray-300">{leadConfig?.label || currentPair.leadKey}</span>
                <ArrowRight className="w-3 h-3 text-gray-500" />
                <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                <span className="text-xs text-gray-300">{lagConfig?.label || currentPair.lagKey}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Clock className="w-3 h-3" />
                <span>领先约 {currentPair.leadMonths} 个月</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-xs">
                <span className="text-gray-500">相关性：</span>
                <span className={`font-mono font-bold ml-1 ${
                  Math.abs(chartData.correlation) > 0.5 ? 'text-emerald-400' : 'text-gray-400'
                }`}>
                  {(chartData.correlation * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData.data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                <XAxis 
                  dataKey="timestamp"
                  type="number"
                  scale="time"
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={formatDate}
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  stroke="#4b5563"
                  minTickGap={50}
                />
                <YAxis 
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  stroke="#4b5563"
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                  wrapperStyle={{ paddingTop: '10px' }}
                  formatter={(value) => <span className="text-xs text-gray-300">{value}</span>}
                />
                <ReferenceLine y={50} stroke="#6b7280" strokeDasharray="3 3" />
                
                <Line
                  type="monotone"
                  dataKey="lead"
                  name={`${leadConfig?.label || currentPair.leadKey} (领先)`}
                  stroke={currentPair.color}
                  strokeWidth={2}
                  dot={false}
                  connectNulls={true}
                />
                <Line
                  type="monotone"
                  dataKey="lag"
                  name={`${lagConfig?.label || currentPair.lagKey} (滞后)`}
                  stroke="#9ca3af"
                  strokeWidth={2}
                  dot={false}
                  connectNulls={true}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Prediction Box */}
          {chartData.prediction && (
            <div className={`mt-3 p-3 rounded-lg border ${
              chartData.prediction.direction === '上行' 
                ? 'bg-emerald-500/10 border-emerald-500/30' 
                : chartData.prediction.direction === '下行'
                  ? 'bg-red-500/10 border-red-500/30'
                  : 'bg-gray-800/50 border-gray-700'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className={`w-4 h-4 ${
                    chartData.prediction.direction === '上行' ? 'text-emerald-400' : 
                    chartData.prediction.direction === '下行' ? 'text-red-400 rotate-180' : 'text-gray-400'
                  }`} />
                  <span className="text-xs font-medium text-white">
                    预测：{lagConfig?.label} 未来 {chartData.prediction.months} 个月可能
                    <span className={`ml-1 font-bold ${
                      chartData.prediction.direction === '上行' ? 'text-emerald-400' : 
                      chartData.prediction.direction === '下行' ? 'text-red-400' : 'text-gray-400'
                    }`}>
                      {chartData.prediction.direction}
                    </span>
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  置信度：{(chartData.prediction.confidence * 100).toFixed(0)}%
                </div>
              </div>
            </div>
          )}

          {/* Description */}
          <div className="mt-3 pt-3 border-t border-gray-700/50 flex items-start gap-2 text-xs text-gray-500">
            <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <span>{currentPair.description}。数据已标准化到 0-100 区间便于对比。</span>
          </div>
        </div>
      </div>
    </div>
  );
};
