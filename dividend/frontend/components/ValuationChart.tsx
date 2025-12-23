import React, { useMemo } from 'react';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { BondDataPoint, TimeRange } from '../types';

interface Props {
  bondData: BondDataPoint[];
  timeRange: TimeRange;
}

export const ValuationChart: React.FC<Props> = ({ bondData, timeRange }) => {
  // 根据时间范围过滤数据
  const chartData = useMemo(() => {
    const getDays = (range: TimeRange) => {
      switch (range) {
        case '1年': return 252;
        case '2年': return 504;
        case '5年': return 1260;
        default: return Infinity;
      }
    };
    
    const days = getDays(timeRange);
    return days === Infinity ? bondData : bondData.slice(-days);
  }, [bondData, timeRange]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl">
        <p className="text-slate-400 text-xs mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(2) : 'N/A'}%
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        📈 10年期国债收益率走势
      </h3>
      <p className="text-slate-500 text-xs mb-4">
        国债收益率是无风险利率的代表。当股息率高于国债收益率时，红利股更具吸引力。
      </p>
      
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} syncId="dividend-sync">
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis 
              dataKey="date" 
              stroke="#64748b"
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => v.slice(5)}
            />
            <YAxis 
              stroke="#64748b"
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => `${v}%`}
              domain={['auto', 'auto']}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            
            {/* 国债收益率 */}
            <Line
              type="monotone"
              dataKey="bond_yield"
              name="10年国债收益率"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
