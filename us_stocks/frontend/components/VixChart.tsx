import React, { useState, useMemo, useRef } from 'react';
import {
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  Brush,
  ReferenceDot,
} from 'recharts';
import { Card } from './Card';
import { ZoomIn, Download } from 'lucide-react';
import { exportChartAsImage } from '../utils/exportChart';

interface VixChartProps {
  title: string;
  description?: string;
  data: any[];
  syncId?: string;
}

// VIX 恐慌事件 (VIX飙升的重大事件)
const VIX_EVENTS = [
  { label: '次贷危机', start: '2008-09-15', end: '2008-11-20', color: '#ef4444', position: 'top' },
  { label: '闪电崩盘', start: '2010-05-06', end: '2010-05-25', color: '#f59e0b', position: 'bottom' },
  { label: '欧债危机', start: '2011-08-04', end: '2011-10-04', color: '#8b5cf6', position: 'top' },
  { label: '中国股灾', start: '2015-08-20', end: '2015-09-01', color: '#a855f7', position: 'bottom' },
  { label: 'Volmageddon', start: '2018-02-05', end: '2018-02-09', color: '#ec4899', position: 'top' },
  { label: '贸易战', start: '2018-12-17', end: '2018-12-26', color: '#f97316', position: 'bottom' },
  { label: '新冠疫情', start: '2020-02-24', end: '2020-03-18', color: '#6366f1', position: 'top' },
  { label: '俄乌战争', start: '2022-02-24', end: '2022-03-14', color: '#ef4444', position: 'bottom' },
  { label: '硅谷银行', start: '2023-03-10', end: '2023-03-15', color: '#ef4444', position: 'top' },
  { label: '以色列袭伊朗', start: '2024-04-15', end: '2024-04-22', color: '#f97316', position: 'bottom' },
  { label: '日元套利崩盘', start: '2024-08-02', end: '2024-08-05', color: '#ef4444', position: 'top' },
  { label: '对等关税', start: '2025-04-02', end: '2025-04-09', color: '#ec4899', position: 'bottom' },
];

// 找出关键高低点
const findKeyPoints = (data: any[], field: string, windowSize: number = 10) => {
  const highs: { idx: number; value: number; date: string }[] = [];
  const lows: { idx: number; value: number; date: string }[] = [];
  
  for (let i = windowSize; i < data.length - windowSize; i++) {
    const current = data[i][field];
    if (current === undefined || current === null) continue;
    
    let isHigh = true;
    let isLow = true;
    
    for (let j = i - windowSize; j <= i + windowSize; j++) {
      if (j === i) continue;
      const val = data[j][field];
      if (val === undefined || val === null) continue;
      if (val >= current) isHigh = false;
      if (val <= current) isLow = false;
    }
    
    if (isHigh) highs.push({ idx: i, value: current, date: data[i].date });
    if (isLow) lows.push({ idx: i, value: current, date: data[i].date });
  }
  
  const sortedHighs = highs.sort((a, b) => b.value - a.value).slice(0, 5);
  const sortedLows = lows.sort((a, b) => a.value - b.value).slice(0, 3);
  
  return { highs: sortedHighs, lows: sortedLows };
};

export const VixChart: React.FC<VixChartProps> = ({
  title,
  description,
  data,
  syncId,
}) => {
  const [showBrush, setShowBrush] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);
  
  // 添加索引并计算高低点
  const { chartData, keyPoints } = useMemo(() => {
    if (data.length < 20) return { chartData: data.map((d, idx) => ({ ...d, idx })), keyPoints: { highs: [], lows: [] } };
    const formatted = data.map((item, idx) => ({ ...item, idx }));
    const keyPoints = findKeyPoints(formatted, 'close');
    return { chartData: formatted, keyPoints };
  }, [data]);

  // 找出当前数据范围内的事件
  const visibleEvents = useMemo(() => {
    if (!chartData.length) return [];
    const dataStart = chartData[0]?.date;
    const dataEnd = chartData[chartData.length - 1]?.date;
    
    return VIX_EVENTS.map(event => {
      if (event.end < dataStart || event.start > dataEnd) return null;
      
      let startIdx = chartData.findIndex(d => d.date >= event.start);
      let endIdx = chartData.findIndex(d => d.date > event.end);
      
      if (startIdx === -1) startIdx = 0;
      if (endIdx === -1) endIdx = chartData.length - 1;
      else endIdx = Math.max(0, endIdx - 1);
      
      if (endIdx - startIdx < 1) return null;
      
      return { ...event, startIdx, endIdx };
    }).filter(Boolean);
  }, [chartData]);

  const handleExport = () => {
    const date = new Date().toISOString().slice(0, 10);
    exportChartAsImage(chartRef.current, `${title}_${date}`);
  };

  return (
    <Card ref={chartRef}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-200">{title}</h3>
          {description && <p className="text-xs text-gray-500 mt-1">{description}</p>}
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setShowBrush(!showBrush)}
            className={`p-1.5 rounded transition-colors ${showBrush ? 'bg-blue-500/20 text-blue-400' : 'text-gray-500 hover:text-gray-300'}`}
            title="时间范围选择"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={handleExport}
            className="p-1.5 rounded text-gray-500 hover:text-gray-300 transition-colors"
            title="导出图片"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} syncId={syncId} margin={{ top: 20, right: 5, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis 
              dataKey="date" 
              tick={{ fill: '#6b7280', fontSize: 10 }}
              tickFormatter={(v) => v?.slice(5) || ''}
              axisLine={{ stroke: '#374151' }}
            />
            <YAxis 
              tick={{ fill: '#6b7280', fontSize: 10 }}
              domain={[0, 'auto']}
              axisLine={{ stroke: '#374151' }}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              labelStyle={{ color: '#9ca3af' }}
              formatter={(value: number) => [value?.toFixed(2), 'VIX']}
            />
            
            {/* 事件区域标注 */}
            {visibleEvents.map((event: any, i) => (
              <ReferenceArea
                key={`event-${i}`}
                x1={chartData[event.startIdx]?.date}
                x2={chartData[event.endIdx]?.date}
                fill={event.color}
                fillOpacity={0.15}
                stroke={event.color}
                strokeOpacity={0.5}
                label={{
                  value: event.label,
                  position: event.position === 'top' ? 'insideTop' : 'insideBottom',
                  fill: event.color,
                  fontSize: 10,
                  fontWeight: 'bold',
                }}
              />
            ))}
            
            {/* 阈值区域 */}
            <ReferenceLine y={20} stroke="#f59e0b" strokeDasharray="5 5" label={{ value: '警惕线 20', fill: '#f59e0b', fontSize: 10 }} />
            <ReferenceLine y={30} stroke="#ef4444" strokeDasharray="5 5" label={{ value: '恐慌线 30', fill: '#ef4444', fontSize: 10 }} />
            
            <Area 
              type="monotone" 
              dataKey="close" 
              name="VIX" 
              stroke="#f59e0b" 
              fill="url(#vixGradient)" 
              strokeWidth={2} 
              dot={false} 
            />
            
            {/* 渐变定义 */}
            <defs>
              <linearGradient id="vixGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
              </linearGradient>
            </defs>
            
            {/* 高点标注 (恐慌时刻) - 带数值标签 */}
            {keyPoints.highs.map((p, i) => (
              <ReferenceDot 
                key={`high-${i}`} 
                x={p.date} 
                y={p.value} 
                r={4} 
                fill="#ef4444" 
                stroke="#fff" 
                strokeWidth={1}
                label={{
                  value: p.value.toFixed(1),
                  position: 'top',
                  fill: '#ef4444',
                  fontSize: 9,
                  fontWeight: 'bold',
                }}
              />
            ))}
            
            {showBrush && <Brush dataKey="date" height={20} stroke="#3b82f6" fill="#1e3a5f" />}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      
      {/* VIX 说明 */}
      <div className="flex gap-4 mt-2 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-gray-400">&lt;20 平静</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-yellow-500" />
          <span className="text-gray-400">20-30 警惕</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-gray-400">&gt;30 恐慌</span>
        </div>
      </div>
    </Card>
  );
};
