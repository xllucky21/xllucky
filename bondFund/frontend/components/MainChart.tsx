
import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { BondDataPoint } from '../types';

interface MainChartProps {
  rawData: BondDataPoint[];
}

export const MainChart: React.FC<MainChartProps> = ({ rawData }) => {
  if (!rawData || rawData.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-900 rounded text-slate-600 border border-slate-800 border-dashed">
        暂无走势数据
      </div>
    );
  }

  // Process data to add MA60
  const chartData = useMemo(() => {
    return rawData.map((point, index, array) => {
      let ma60 = null;
      if (index >= 59) {
        const slice = array.slice(index - 59, index + 1);
        const sum = slice.reduce((acc, curr) => acc + curr.yield, 0);
        ma60 = sum / 60;
      }
      return {
        ...point,
        ma60
      };
    });
  }, [rawData]);

  // Calculate min/max for domain to make the chart look dynamic
  const yields = rawData.map(d => d.yield);
  const minYield = Math.min(...yields);
  const maxYield = Math.max(...yields);
  const padding = (maxYield - minYield) * 0.2; // Add 20% padding

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorYield" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3}/> {/* Indigo-400 */}
            <stop offset="95%" stopColor="#818cf8" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" /> {/* slate-700 */}
        <XAxis 
          dataKey="date" 
          tick={{ fontSize: 10, fill: '#64748b' }} // slate-500
          tickLine={false}
          axisLine={false}
          minTickGap={30}
        />
        <YAxis 
          domain={[minYield - padding, maxYield + padding]} 
          tick={{ fontSize: 10, fill: '#64748b' }} // slate-500
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `${value.toFixed(2)}%`}
          width={40}
        />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: '#0f172a', // slate-900
            borderRadius: '8px', 
            border: '1px solid #334155', // slate-700
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.5)' 
          }}
          labelStyle={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }} // slate-400
          itemStyle={{ fontSize: '14px', fontWeight: 600 }}
          formatter={(value: any, name: string) => {
             if (typeof value !== 'number') return ['--', name];
             return [`${value.toFixed(2)}%`, name === 'ma60' ? 'MA60均线' : '收益率'];
          }}
          cursor={{ stroke: '#475569', strokeWidth: 1 }} // slate-600
        />
        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
        
        {/* Moving Average Line (MA60) */}
        <Line 
          type="monotone" 
          dataKey="ma60" 
          stroke="#f97316" // Orange-500
          strokeWidth={2} 
          strokeDasharray="5 5"
          dot={false}
          name="MA60 (牛熊线)"
          activeDot={false}
        />

        {/* Real-time Yield Area */}
        <Area 
          type="monotone" 
          dataKey="yield" 
          name="10年国债收益率"
          stroke="#818cf8" // Indigo-400
          strokeWidth={2}
          fillOpacity={1} 
          fill="url(#colorYield)" 
          activeDot={{ r: 6, strokeWidth: 0, fill: '#c7d2fe' }} // Indigo-200
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
};
