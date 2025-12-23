import React, { useState, useMemo, useRef } from 'react';
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
  ReferenceArea,
  Brush,
  ReferenceDot,
  Legend,
} from 'recharts';
import { Card } from './Card';
import { Activity, ZoomIn, Download } from 'lucide-react';
import { exportChartAsImage } from '../utils/exportChart';

interface SeriesConfig {
  key: string;
  name: string;
  color: string;
  type?: 'line' | 'area';
}

interface ThresholdConfig {
  value: number;
  label: string;
  color: string;
}

interface MarketChartProps {
  title: string;
  description?: string;
  data: any[];
  series: SeriesConfig[];
  syncId?: string;
  thresholds?: ThresholdConfig[];
}

// 计算移动平均线
const calcMA = (data: any[], field: string, period: number) => {
  return data.map((item, index) => {
    if (index < period - 1) return null;
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += data[index - i][field] || 0;
    }
    return sum / period;
  });
};

// 找出关键高低点
const findKeyPoints = (data: any[], field: string, windowSize: number = 15) => {
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
  
  // 返回最显著的高低点
  const sortedHighs = highs.sort((a, b) => b.value - a.value).slice(0, 3);
  const sortedLows = lows.sort((a, b) => a.value - b.value).slice(0, 3);
  
  return { highs: sortedHighs, lows: sortedLows };
};

// 美股重大事件
const US_MARKET_EVENTS = [
  { label: '次贷危机', start: '2008-09-15', end: '2009-03-09', color: '#ef4444', position: 'top' },
  { label: '闪电崩盘', start: '2010-05-06', end: '2010-05-07', color: '#f59e0b', position: 'bottom' },
  { label: '欧债危机', start: '2011-08-01', end: '2011-10-04', color: '#8b5cf6', position: 'top' },
  { label: '中国股灾', start: '2015-08-18', end: '2015-08-26', color: '#a855f7', position: 'bottom' },
  { label: 'Volmageddon', start: '2018-02-05', end: '2018-02-09', color: '#ec4899', position: 'top' },
  { label: '贸易战', start: '2018-10-01', end: '2018-12-24', color: '#f97316', position: 'bottom' },
  { label: '新冠疫情', start: '2020-02-19', end: '2020-03-23', color: '#6366f1', position: 'top' },
  { label: '俄乌战争', start: '2022-02-24', end: '2022-03-14', color: '#ef4444', position: 'bottom' },
  { label: '通胀加息', start: '2022-01-03', end: '2022-10-12', color: '#f59e0b', position: 'top' },
  { label: '硅谷银行', start: '2023-03-08', end: '2023-03-15', color: '#ef4444', position: 'bottom' },
  { label: 'AI牛市', start: '2023-05-25', end: '2023-07-19', color: '#22c55e', position: 'top' },
  { label: '以色列袭伊朗', start: '2024-04-15', end: '2024-04-22', color: '#f97316', position: 'bottom' },
  { label: '科技股轮动', start: '2024-07-11', end: '2024-07-25', color: '#a855f7', position: 'top' },
  { label: '日元套利崩盘', start: '2024-08-02', end: '2024-08-05', color: '#ef4444', position: 'bottom' },
  { label: '特朗普胜选', start: '2024-11-05', end: '2024-11-11', color: '#22c55e', position: 'top' },
  { label: '对等关税', start: '2025-04-02', end: '2025-04-09', color: '#ec4899', position: 'bottom' },
];

export const MarketChart: React.FC<MarketChartProps> = ({
  title,
  description,
  data,
  series,
  syncId,
  thresholds = [],
}) => {
  const [showBrush, setShowBrush] = useState(false);
  const [showMA, setShowMA] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);
  
  // 主要数据字段
  const mainField = series[0]?.key || '';
  
  // 计算均线数据并添加索引
  const { chartData, keyPoints } = useMemo(() => {
    const ma5 = calcMA(data, mainField, 5);
    const ma10 = calcMA(data, mainField, 10);
    const ma20 = calcMA(data, mainField, 20);
    
    const formatted = data.map((item, idx) => ({
      ...item,
      idx,
      displayDate: item.date?.slice(5) || item.date,
      ma5: ma5[idx],
      ma10: ma10[idx],
      ma20: ma20[idx],
    }));
    
    const keyPoints = mainField && data.length >= 30 
      ? findKeyPoints(formatted, mainField) 
      : { highs: [], lows: [] };
    
    return { chartData: formatted, keyPoints };
  }, [data, mainField]);

  // 找出当前数据范围内的事件
  const visibleEvents = useMemo(() => {
    if (!chartData.length) return [];
    const dataStart = chartData[0]?.date;
    const dataEnd = chartData[chartData.length - 1]?.date;
    
    return US_MARKET_EVENTS.map(event => {
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

  // 计算Y轴范围
  const yDomain = useMemo(() => {
    const values = data.map(d => series.map(s => d[s.key])).flat().filter(v => v !== undefined && v !== null);
    if (values.length === 0) return ['auto', 'auto'];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = (max - min) * 0.1;
    return [min - padding, max + padding];
  }, [data, series]);

  const handleExport = () => {
    const date = new Date().toISOString().slice(0, 10);
    exportChartAsImage(chartRef.current, `${title}_${date}`);
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    
    return (
      <div className="bg-gray-900/95 border border-gray-700 rounded-lg p-3 shadow-xl z-50">
        <p className="text-gray-400 text-xs mb-2 border-b border-gray-800 pb-1">{payload[0]?.payload?.date}</p>
        {payload.filter((entry: any) => !['ma5', 'ma10', 'ma20'].includes(entry.dataKey)).map((entry: any, index: number) => (
          <div key={index} className="flex items-center justify-between gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-gray-300">{entry.name}:</span>
            </div>
            <span className="text-white font-medium">
              {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
            </span>
          </div>
        ))}
        {showMA && payload[0]?.payload?.ma5 !== undefined && (
          <div className="border-t border-gray-800 pt-1.5 mt-1.5">
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="text-center">
                <span className="text-purple-400">MA5</span>
                <div className="text-gray-300">{payload[0]?.payload?.ma5?.toFixed(2) || '-'}</div>
              </div>
              <div className="text-center">
                <span className="text-cyan-400">MA10</span>
                <div className="text-gray-300">{payload[0]?.payload?.ma10?.toFixed(2) || '-'}</div>
              </div>
              <div className="text-center">
                <span className="text-yellow-400">MA20</span>
                <div className="text-gray-300">{payload[0]?.payload?.ma20?.toFixed(2) || '-'}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card ref={chartRef} className="group">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-200">{title}</h3>
          {description && <p className="text-xs text-gray-500 mt-1">{description}</p>}
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setShowMA(!showMA)}
            className={`p-1.5 rounded transition-colors ${showMA ? 'bg-purple-500/20 text-purple-400' : 'text-gray-500 hover:text-gray-300'}`}
            title="均线系统"
          >
            <Activity className="w-4 h-4" />
          </button>
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
      
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} syncId={showBrush ? undefined : syncId} margin={{ top: 10, right: 10, left: -5, bottom: 5 }}>
            <defs>
              {series.map(s => (
                <linearGradient key={s.key} id={`gradient-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={s.color} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={s.color} stopOpacity={0}/>
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis 
              dataKey="idx" 
              tick={{ fill: '#6b7280', fontSize: 10 }}
              tickFormatter={(idx) => chartData[idx]?.displayDate || ''}
              axisLine={{ stroke: '#374151' }}
              interval="preserveStartEnd"
            />
            <YAxis 
              tick={{ fill: '#6b7280', fontSize: 10 }}
              domain={yDomain}
              axisLine={{ stroke: '#374151' }}
              width={50}
              tickFormatter={(v) => {
                if (v >= 10000) return (v / 10000).toFixed(1) + 'w';
                if (v >= 1000) return (v / 1000).toFixed(1) + 'k';
                return v.toFixed(v < 10 ? 2 : 0);
              }}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#6b7280', strokeWidth: 1, strokeDasharray: '4 4' }} />
            <Legend 
              wrapperStyle={{ paddingTop: 10 }}
              formatter={(value) => <span className="text-gray-400 text-xs">{value}</span>}
            />
            
            {/* 历史事件标注 */}
            {visibleEvents.map((event: any) => (
              <ReferenceArea
                key={event.label}
                x1={event.startIdx}
                x2={event.endIdx}
                strokeOpacity={0}
                fill={event.color}
                fillOpacity={0.15}
                label={{
                  value: event.label,
                  position: event.position === 'bottom' ? 'insideBottom' : 'insideTop',
                  fill: event.color,
                  fontSize: 10,
                  fontWeight: 700,
                  offset: 5,
                }}
              />
            ))}
            
            {/* 阈值线 */}
            {thresholds.map((t, i) => (
              <ReferenceLine 
                key={i} 
                y={t.value} 
                stroke={t.color} 
                strokeDasharray="5 5" 
                label={{ value: t.label, fill: t.color, fontSize: 10, position: 'right' }} 
              />
            ))}
            
            {/* 数据系列 */}
            {series.map((s) => 
              s.type === 'area' ? (
                <Area 
                  key={s.key} 
                  type="monotone" 
                  dataKey={s.key} 
                  name={s.name} 
                  stroke={s.color} 
                  fill={`url(#gradient-${s.key})`}
                  fillOpacity={1}
                  strokeWidth={2} 
                  dot={false} 
                />
              ) : (
                <Line 
                  key={s.key} 
                  type="monotone" 
                  dataKey={s.key} 
                  name={s.name} 
                  stroke={s.color} 
                  strokeWidth={2} 
                  dot={false} 
                />
              )
            )}
            
            {/* 均线 */}
            {showMA && (
              <>
                <Line type="monotone" dataKey="ma5" name="MA5" stroke="#a855f7" strokeWidth={1} strokeDasharray="3 3" dot={false} legendType="none" />
                <Line type="monotone" dataKey="ma10" name="MA10" stroke="#06b6d4" strokeWidth={1} strokeDasharray="3 3" dot={false} legendType="none" />
                <Line type="monotone" dataKey="ma20" name="MA20" stroke="#eab308" strokeWidth={1.5} dot={false} legendType="none" />
              </>
            )}
            
            {/* 高点标注 (带数值) */}
            {keyPoints.highs.map((p, i) => (
              <ReferenceDot 
                key={`high-${i}`} 
                x={p.idx} 
                y={p.value} 
                r={4} 
                fill="#ef4444" 
                stroke="#fff" 
                strokeWidth={1}
                label={{
                  value: p.value >= 1000 ? (p.value / 1000).toFixed(1) + 'k' : p.value.toFixed(0),
                  position: 'top',
                  fill: '#ef4444',
                  fontSize: 9,
                  fontWeight: 600,
                }}
              />
            ))}
            {/* 低点标注 (带数值) */}
            {keyPoints.lows.map((p, i) => (
              <ReferenceDot 
                key={`low-${i}`} 
                x={p.idx} 
                y={p.value} 
                r={4} 
                fill="#22c55e" 
                stroke="#fff" 
                strokeWidth={1}
                label={{
                  value: p.value >= 1000 ? (p.value / 1000).toFixed(1) + 'k' : p.value.toFixed(0),
                  position: 'bottom',
                  fill: '#22c55e',
                  fontSize: 9,
                  fontWeight: 600,
                }}
              />
            ))}
            
            {showBrush && <Brush dataKey="idx" height={20} stroke="#3b82f6" fill="#1e3a5f" tickFormatter={(idx) => chartData[idx]?.displayDate || ''} />}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};
