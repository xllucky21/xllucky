import React, { useMemo, useState, useRef } from 'react';
import {
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  ReferenceDot,
  Legend,
  ComposedChart,
  Bar,
  Brush,
} from 'recharts';
import { Card } from './Card';
import { ScanLine, Activity, Download } from 'lucide-react';
import { exportChartAsImage } from '../utils/exportChart';

interface DataSeries {
  key: string;
  name: string;
  color: string;
  type?: 'line' | 'area' | 'bar';
}

interface Threshold {
  value: number;
  label: string;
  color?: string;
}

interface MarketChartProps {
  title: string;
  description?: string;
  data: any[];
  series: DataSeries[];
  syncId?: string;
  thresholds?: Threshold[];
  height?: number;
  showLegend?: boolean;
}

// 计算移动平均线
const calcMA = (data: number[], period: number): (number | null)[] => {
  const result: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
  }
  return result;
};

// 识别关键高低点
const findKeyPoints = (data: any[], field: string, windowSize: number = 15) => {
  const highs: { idx: number; value: number; date: string }[] = [];
  const lows: { idx: number; value: number; date: string }[] = [];
  
  for (let i = windowSize; i < data.length - windowSize; i++) {
    const current = data[i][field];
    if (typeof current !== 'number' || isNaN(current)) continue;
    
    const leftWindow = data.slice(i - windowSize, i).map(d => d[field]).filter(v => typeof v === 'number');
    const rightWindow = data.slice(i + 1, i + windowSize + 1).map(d => d[field]).filter(v => typeof v === 'number');
    
    if (leftWindow.length === 0 || rightWindow.length === 0) continue;
    
    const isLocalHigh = leftWindow.every(v => v < current) && rightWindow.every(v => v < current);
    const isLocalLow = leftWindow.every(v => v > current) && rightWindow.every(v => v > current);
    
    if (isLocalHigh) {
      highs.push({ idx: i, value: current, date: data[i].date });
    }
    if (isLocalLow) {
      lows.push({ idx: i, value: current, date: data[i].date });
    }
  }
  
  // 只保留最显著的几个点 (按值排序)
  const topHighs = highs.sort((a, b) => b.value - a.value).slice(0, 3);
  const topLows = lows.sort((a, b) => a.value - b.value).slice(0, 3);
  
  return { highs: topHighs, lows: topLows };
};

// 股市重大事件
const MARKET_EVENTS = [
  { label: '2015股灾', start: '2015-06-12', end: '2015-08-26', color: '#ef4444', position: 'top' },
  { label: '熔断', start: '2016-01-04', end: '2016-01-15', color: '#f59e0b', position: 'bottom' },
  { label: '301调查', start: '2018-03-22', end: '2018-04-06', color: '#8b5cf6', position: 'top' },
  { label: '2000亿关税', start: '2018-09-17', end: '2018-10-30', color: '#a855f7', position: 'bottom' },
  { label: '疫情', start: '2020-01-20', end: '2020-03-23', color: '#6366f1', position: 'top' },
  { label: '924行情', start: '2024-09-24', end: '2024-10-08', color: '#22c55e', position: 'bottom' },
  { label: '对等关税', start: '2025-04-02', end: '2025-04-09', color: '#ec4899', position: 'top' },
];

export const MarketChart: React.FC<MarketChartProps> = ({
  title,
  description,
  data,
  series,
  syncId,
  thresholds = [],
  height = 300,
  showLegend = true,
}) => {
  const [showBrush, setShowBrush] = useState(false);
  const [maVisible, setMaVisible] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  const handleExport = () => {
    exportChartAsImage(chartRef.current, title.replace(/[/\\?%*:|"<>]/g, '_'));
  };

  // 添加索引和均线数据
  const { formattedData, keyPoints } = useMemo(() => {
    // 为第一个数据系列计算均线
    const primaryKey = series[0]?.key;
    const values = data.map(d => d[primaryKey]).filter(v => typeof v === 'number');
    const ma5 = calcMA(values, 5);
    const ma10 = calcMA(values, 10);
    const ma20 = calcMA(values, 20);
    
    let maIdx = 0;
    const formatted = data.map((d, idx) => {
      const val = d[primaryKey];
      const hasMa = typeof val === 'number';
      const result = {
        ...d,
        idx,
        displayDate: d.date?.slice(5) || d.date,
        ma5: hasMa ? ma5[maIdx] : null,
        ma10: hasMa ? ma10[maIdx] : null,
        ma20: hasMa ? ma20[maIdx] : null,
      };
      if (hasMa) maIdx++;
      return result;
    });
    
    // 识别关键点位
    const keyPoints = findKeyPoints(formatted, primaryKey, 15);
    
    return { formattedData: formatted, keyPoints };
  }, [data, series]);

  // 找出当前数据范围内的事件
  const visibleEvents = useMemo(() => {
    if (!formattedData.length) return [];
    const dataStart = formattedData[0]?.date;
    const dataEnd = formattedData[formattedData.length - 1]?.date;
    
    return MARKET_EVENTS.map(event => {
      if (event.end < dataStart || event.start > dataEnd) return null;
      
      let startIdx = formattedData.findIndex(d => d.date >= event.start);
      let endIdx = formattedData.findIndex(d => d.date > event.end);
      
      if (startIdx === -1) startIdx = 0;
      if (endIdx === -1) endIdx = formattedData.length - 1;
      else endIdx = Math.max(0, endIdx - 1);
      
      if (endIdx - startIdx < 1) return null;
      
      return { ...event, startIdx, endIdx };
    }).filter(Boolean);
  }, [formattedData]);

  const yDomain = useMemo(() => {
    const allValues: number[] = [];
    data.forEach(d => {
      series.forEach(s => {
        const val = d[s.key];
        if (typeof val === 'number' && !isNaN(val)) {
          allValues.push(val);
        }
      });
    });
    if (allValues.length === 0) return ['auto', 'auto'];
    
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const range = max - min;
    const padding = range * 0.1;
    
    return [Math.floor(min - padding), Math.ceil(max + padding)];
  }, [data, series]);

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
        {maVisible && payload[0]?.payload?.ma5 !== undefined && (
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
    <Card className="group" ref={chartRef}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-gray-300">{title}</h3>
          {description && (
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">{description}</p>
          )}
        </div>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 flex items-center gap-1">
          <button
            onClick={() => setMaVisible(!maVisible)}
            className={`p-1.5 rounded-md transition-all ${
              maVisible ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
            title="均线系统"
          >
            <Activity size={14} />
          </button>
          <button
            onClick={() => setShowBrush(!showBrush)}
            className={`p-1.5 rounded-md transition-all ${
              showBrush ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
            title="时间范围选择"
          >
            <ScanLine size={14} />
          </button>
          <button
            onClick={handleExport}
            className="p-1.5 rounded-md transition-all bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700"
            title="导出图表"
          >
            <Download size={14} />
          </button>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={showBrush ? height + 40 : height}>
        <ComposedChart data={formattedData} syncId={showBrush ? undefined : syncId}>
          <defs>
            {series.map(s => (
              <linearGradient key={s.key} id={`gradient-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={s.color} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={s.color} stopOpacity={0}/>
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.5} vertical={false} />
          <XAxis 
            dataKey="idx" 
            tick={{ fill: '#9ca3af', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            tickFormatter={(idx) => formattedData[idx]?.displayDate || ''}
          />
          <YAxis 
            domain={yDomain as [number, number]}
            tick={{ fill: '#9ca3af', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={55}
            tickFormatter={(value) => {
              if (Math.abs(value) >= 10000) return (value / 10000).toFixed(1) + 'w';
              if (Math.abs(value) >= 1000) return (value / 1000).toFixed(1) + 'k';
              return value;
            }}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#6b7280', strokeWidth: 1, strokeDasharray: '4 4' }} />
          {showLegend && (
            <Legend 
              wrapperStyle={{ paddingTop: 10 }}
              formatter={(value) => <span className="text-gray-400 text-xs">{value}</span>}
            />
          )}

          {/* 历史事件标注 - 默认显示 */}
          {visibleEvents.map((event: any) => (
            <ReferenceArea
              key={event.label}
              x1={event.startIdx}
              x2={event.endIdx}
              strokeOpacity={0}
              fill={event.color}
              fillOpacity={0.2}
              label={{
                value: event.label,
                position: event.position === 'bottom' ? 'insideBottom' : 'insideTop',
                fill: event.color,
                fontSize: 11,
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
              stroke={t.color || '#fbbf24'} 
              strokeDasharray="4 4"
              label={{ 
                value: t.label, 
                fill: t.color || '#fbbf24', 
                fontSize: 10,
                position: 'right'
              }}
            />
          ))}
          
          {/* 数据系列 */}
          {series.map((s) => {
            if (s.type === 'bar') {
              return (
                <Bar 
                  key={s.key}
                  dataKey={s.key}
                  name={s.name}
                  fill={s.color}
                  opacity={0.8}
                />
              );
            }
            if (s.type === 'area') {
              return (
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
                  activeDot={{ r: 4, fill: s.color }}
                />
              );
            }
            return (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stroke={s.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#fff' }}
              />
            );
          })}

          {/* 均线系统 */}
          {maVisible && (
            <>
              <Line
                type="monotone"
                dataKey="ma5"
                name="MA5"
                stroke="#a855f7"
                strokeWidth={1}
                dot={false}
                strokeDasharray="2 2"
                legendType="none"
              />
              <Line
                type="monotone"
                dataKey="ma10"
                name="MA10"
                stroke="#06b6d4"
                strokeWidth={1}
                dot={false}
                strokeDasharray="3 3"
                legendType="none"
              />
              <Line
                type="monotone"
                dataKey="ma20"
                name="MA20"
                stroke="#eab308"
                strokeWidth={1.5}
                dot={false}
                legendType="none"
              />
            </>
          )}

          {/* 关键高点标注 */}
          {keyPoints.highs.map((point, i) => (
            <ReferenceDot
              key={`high-${i}`}
              x={point.idx}
              y={point.value}
              r={4}
              fill="#ef4444"
              stroke="#fff"
              strokeWidth={1}
              label={{
                value: point.value.toFixed(0),
                position: 'top',
                fill: '#ef4444',
                fontSize: 9,
                fontWeight: 600,
              }}
            />
          ))}
          
          {/* 关键低点标注 */}
          {keyPoints.lows.map((point, i) => (
            <ReferenceDot
              key={`low-${i}`}
              x={point.idx}
              y={point.value}
              r={4}
              fill="#22c55e"
              stroke="#fff"
              strokeWidth={1}
              label={{
                value: point.value.toFixed(0),
                position: 'bottom',
                fill: '#22c55e',
                fontSize: 9,
                fontWeight: 600,
              }}
            />
          ))}

          {/* 时间范围选择器 */}
          {showBrush && (
            <Brush
              dataKey="idx"
              height={30}
              stroke="#4b5563"
              fill="#1f2937"
              tickFormatter={(idx) => formattedData[idx]?.displayDate || ''}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </Card>
  );
};
