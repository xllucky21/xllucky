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
  Legend,
  ReferenceLine,
  ReferenceArea
} from 'recharts';
import { ScoreHistoryPoint } from '../types';

interface ScoreHistoryChartProps {
  data: ScoreHistoryPoint[];
  currentScore?: number;
}

export const ScoreHistoryChart: React.FC<ScoreHistoryChartProps> = ({ data, currentScore }) => {
  if (!data || data.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-900 rounded text-slate-600 border border-slate-800 border-dashed">
        暂无评分历史数据
      </div>
    );
  }

  // 计算收益率的范围
  const yieldRange = useMemo(() => {
    const yields = data.map(d => d.yield);
    const min = Math.min(...yields);
    const max = Math.max(...yields);
    const padding = (max - min) * 0.1;
    return { min: min - padding, max: max + padding };
  }, [data]);

  // 获取天气颜色
  const getWeatherColor = (score: number) => {
    if (score >= 80) return '#fbbf24'; // 烈日 - amber
    if (score >= 60) return '#34d399'; // 晴朗 - emerald
    if (score >= 40) return '#94a3b8'; // 多云 - slate
    if (score >= 20) return '#60a5fa'; // 小雨 - blue
    return '#f87171'; // 暴雨 - red
  };

  // 格式化日期显示
  const formatDate = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length >= 2) {
      return `${parts[0].slice(2)}.${parts[1]}`;
    }
    return dateStr;
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 10, right: 50, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorScoreHistory" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="#818cf8" stopOpacity={0.05}/>
          </linearGradient>
        </defs>
        
        {/* 天气区间背景 - 需要指定yAxisId */}
        <ReferenceArea yAxisId="score" y1={80} y2={100} fill="#fbbf24" fillOpacity={0.08} />
        <ReferenceArea yAxisId="score" y1={60} y2={80} fill="#34d399" fillOpacity={0.08} />
        <ReferenceArea yAxisId="score" y1={40} y2={60} fill="#94a3b8" fillOpacity={0.03} />
        <ReferenceArea yAxisId="score" y1={20} y2={40} fill="#60a5fa" fillOpacity={0.08} />
        <ReferenceArea yAxisId="score" y1={0} y2={20} fill="#f87171" fillOpacity={0.08} />
        
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" strokeOpacity={0.5} />
        
        <XAxis 
          dataKey="date" 
          tick={{ fontSize: 9, fill: '#64748b' }}
          tickLine={false}
          axisLine={false}
          minTickGap={60}
          tickFormatter={formatDate}
        />
        
        {/* 评分Y轴（左侧） */}
        <YAxis 
          yAxisId="score"
          domain={[0, 100]} 
          tick={{ fontSize: 9, fill: '#818cf8' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `${value}`}
          width={25}
          ticks={[0, 20, 40, 60, 80, 100]}
        />
        
        {/* 收益率Y轴（右侧） */}
        <YAxis 
          yAxisId="yield"
          orientation="right"
          domain={[yieldRange.min, yieldRange.max]}
          tick={{ fontSize: 9, fill: '#f97316' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `${value.toFixed(1)}%`}
          width={40}
        />
        
        <Tooltip 
          contentStyle={{ 
            backgroundColor: '#0f172a',
            borderRadius: '8px', 
            border: '1px solid #334155',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.5)',
            padding: '8px 12px'
          }}
          labelStyle={{ color: '#94a3b8', fontSize: '11px', marginBottom: '6px' }}
          itemStyle={{ fontSize: '12px', fontWeight: 500, padding: '2px 0' }}
          formatter={(value: any, name: string) => {
            if (typeof value !== 'number') return ['--', name];
            if (name === '评分') {
              const weather = value >= 80 ? '☀️ 烈日' : value >= 60 ? '🌤️ 晴朗' : value >= 40 ? '☁️ 多云' : value >= 20 ? '🌧️ 小雨' : '⛈️ 暴雨';
              return [`${value.toFixed(1)}分 (${weather})`, '评分'];
            }
            return [`${value.toFixed(3)}%`, '收益率'];
          }}
          cursor={{ stroke: '#475569', strokeWidth: 1 }}
        />
        
        <Legend 
          wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
          iconType="line"
          iconSize={12}
        />
        
        {/* 天气分界参考线 */}
        <ReferenceLine yAxisId="score" y={80} stroke="#fbbf24" strokeDasharray="4 4" strokeOpacity={0.4} strokeWidth={1} />
        <ReferenceLine yAxisId="score" y={60} stroke="#34d399" strokeDasharray="4 4" strokeOpacity={0.4} strokeWidth={1} />
        <ReferenceLine yAxisId="score" y={40} stroke="#94a3b8" strokeDasharray="4 4" strokeOpacity={0.3} strokeWidth={1} />
        <ReferenceLine yAxisId="score" y={20} stroke="#60a5fa" strokeDasharray="4 4" strokeOpacity={0.4} strokeWidth={1} />
        
        {/* 收益率线（先画，在底层） */}
        <Line 
          yAxisId="yield"
          type="monotone" 
          dataKey="yield" 
          stroke="#f97316"
          strokeWidth={1.5} 
          strokeOpacity={0.8}
          dot={false}
          name="收益率"
          activeDot={{ r: 4, fill: '#f97316', strokeWidth: 0 }}
        />
        
        {/* 评分面积图（后画，在上层） */}
        <Area 
          yAxisId="score"
          type="monotone" 
          dataKey="score" 
          name="评分"
          stroke="#818cf8"
          strokeWidth={2}
          fillOpacity={1} 
          fill="url(#colorScoreHistory)" 
          activeDot={{ r: 5, strokeWidth: 0, fill: '#a5b4fc' }}
        />
        
        {/* 当前评分水平线 */}
        {currentScore !== undefined && (
          <ReferenceLine 
            yAxisId="score"
            y={currentScore} 
            stroke={getWeatherColor(currentScore)} 
            strokeWidth={2}
            strokeDasharray="6 3"
            label={{ 
              value: `当前 ${currentScore.toFixed(0)}分`, 
              position: 'insideTopRight',
              fill: getWeatherColor(currentScore),
              fontSize: 10,
              fontWeight: 600
            }}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
};
