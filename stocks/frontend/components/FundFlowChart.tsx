import React, { useMemo, useState, useRef } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
  ReferenceArea,
  ReferenceDot,
  Brush,
} from 'recharts';
import { Card } from './Card';
import { ScanLine, Activity, Download } from 'lucide-react';
import { exportChartAsImage } from '../utils/exportChart';

interface FundFlowChartProps {
  title: string;
  description?: string;
  data: any[];
  dataKey: string;
  height?: number;
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

export const FundFlowChart: React.FC<FundFlowChartProps> = ({
  title,
  description,
  data,
  dataKey,
  height = 250,
}) => {
  const [showBrush, setShowBrush] = useState(false);
  const [maVisible, setMaVisible] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  const handleExport = () => {
    exportChartAsImage(chartRef.current, title.replace(/[/\\?%*:|"<>]/g, '_'));
  };

  const { formattedData, keyPoints } = useMemo(() => {
    // 计算均线
    const values = data.map(d => d[dataKey] || 0);
    const ma5 = calcMA(values, 5);
    const ma10 = calcMA(values, 10);
    const ma20 = calcMA(values, 20);
    
    const formatted = data.map((d, idx) => ({
      ...d,
      idx,
      displayDate: d.date?.slice(5) || d.date,
      ma5: ma5[idx],
      ma10: ma10[idx],
      ma20: ma20[idx],
    }));
    
    // 识别关键点位
    const keyPoints = findKeyPoints(formatted, dataKey, 15);
    
    return { formattedData: formatted, keyPoints };
  }, [data, dataKey]);

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

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    
    const value = payload[0]?.value || 0;
    const d = payload[0]?.payload;
    return (
      <div className="bg-gray-900/95 border border-gray-700 rounded-lg p-3 shadow-xl z-50">
        <p className="text-gray-400 text-xs mb-1 border-b border-gray-800 pb-1">{d?.date}</p>
        <div className={`text-lg font-bold ${value >= 0 ? 'text-red-500' : 'text-green-500'}`}>
          {value >= 0 ? '+' : ''}{value.toFixed(2)} 亿
        </div>
        {maVisible && d?.ma5 !== undefined && (
          <div className="border-t border-gray-800 pt-1.5 mt-1.5">
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="text-center">
                <span className="text-purple-400">MA5</span>
                <div className="text-gray-300">{d?.ma5?.toFixed(1) || '-'}</div>
              </div>
              <div className="text-center">
                <span className="text-cyan-400">MA10</span>
                <div className="text-gray-300">{d?.ma10?.toFixed(1) || '-'}</div>
              </div>
              <div className="text-center">
                <span className="text-yellow-400">MA20</span>
                <div className="text-gray-300">{d?.ma20?.toFixed(1) || '-'}</div>
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
        <ComposedChart data={formattedData}>
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
            tick={{ fill: '#9ca3af', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={50}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#374151', opacity: 0.3 }} />

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

          <ReferenceLine y={0} stroke="#6b7280" />
          <Bar dataKey={dataKey} radius={[2, 2, 0, 0]}>
            {formattedData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`}
                fill={entry[dataKey] >= 0 ? '#ef4444' : '#10b981'}
                opacity={0.8}
              />
            ))}
          </Bar>

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
              />
              <Line
                type="monotone"
                dataKey="ma10"
                name="MA10"
                stroke="#06b6d4"
                strokeWidth={1}
                dot={false}
                strokeDasharray="3 3"
              />
              <Line
                type="monotone"
                dataKey="ma20"
                name="MA20"
                stroke="#eab308"
                strokeWidth={1.5}
                dot={false}
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
