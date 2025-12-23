import React, { useMemo } from 'react';
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts';
import { IndexDataPoint, ScoreHistoryPoint, TimeRange } from '../types';

interface Props {
  indexData: IndexDataPoint[];
  scoreHistory?: ScoreHistoryPoint[];
  timeRange: TimeRange;
}

export const DividendChart: React.FC<Props> = ({ indexData, scoreHistory, timeRange }) => {
  // 根据时间范围过滤数据
  const filteredData = useMemo(() => {
    const getDays = (range: TimeRange) => {
      switch (range) {
        case '1年': return 252;
        case '2年': return 504;
        case '5年': return 1260;
        default: return Infinity;
      }
    };
    
    const days = getDays(timeRange);
    const slicedIndex = days === Infinity ? indexData : indexData.slice(-days);
    
    // 合并评分数据
    const scoreMap = new Map<string, number>();
    if (scoreHistory) {
      scoreHistory.forEach(s => scoreMap.set(s.date, s.score));
    }
    
    return slicedIndex.map(d => ({
      ...d,
      score: scoreMap.get(d.date) ?? null,
    }));
  }, [indexData, scoreHistory, timeRange]);

  // 计算Y轴范围
  const [minClose, maxClose] = useMemo(() => {
    const closes = filteredData.map(d => d.close).filter(Boolean);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const padding = (max - min) * 0.1;
    return [Math.floor(min - padding), Math.ceil(max + padding)];
  }, [filteredData]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl">
        <p className="text-slate-400 text-xs mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(2) : 'N/A'}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        📈 中证红利走势 & 评分
      </h3>
      
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={filteredData} syncId="dividend-sync">
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis 
              dataKey="date" 
              stroke="#64748b"
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => v.slice(5)}
            />
            <YAxis 
              yAxisId="left"
              domain={[minClose, maxClose]}
              stroke="#64748b"
              tick={{ fontSize: 10 }}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              domain={[0, 100]}
              stroke="#64748b"
              tick={{ fontSize: 10 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            
            {/* MA60 参考线 */}
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="MA60"
              name="MA60"
              stroke="#6366f1"
              strokeWidth={1}
              dot={false}
              strokeDasharray="5 5"
            />
            
            {/* MA20 参考线 */}
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="MA20"
              name="MA20"
              stroke="#8b5cf6"
              strokeWidth={1}
              dot={false}
              strokeDasharray="3 3"
            />
            
            {/* 指数价格 */}
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="close"
              name="中证红利"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
            />
            
            {/* 评分区域 */}
            <Area
              yAxisId="right"
              type="monotone"
              dataKey="score"
              name="评分"
              fill="#22c55e20"
              stroke="#22c55e"
              strokeWidth={1}
            />
            
            {/* 评分参考线 */}
            <ReferenceLine yAxisId="right" y={80} stroke="#22c55e" strokeDasharray="3 3" />
            <ReferenceLine yAxisId="right" y={50} stroke="#eab308" strokeDasharray="3 3" />
            <ReferenceLine yAxisId="right" y={20} stroke="#ef4444" strokeDasharray="3 3" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      
      <div className="mt-4 flex justify-center gap-6 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-green-500"></span> 80分以上：极佳买点
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-yellow-500"></span> 50分：中性
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-red-500"></span> 20分以下：卖出信号
        </span>
      </div>
    </div>
  );
};
