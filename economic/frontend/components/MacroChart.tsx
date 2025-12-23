import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  ReferenceLine,
  ReferenceArea,
  Brush
} from 'recharts';
import { Card } from './Card';
import { InfoTooltip } from './InfoTooltip';
import { METRIC_DEFINITIONS } from '../constants';
import { MacroDataPoint } from '../types';
import { 
  Lightbulb, 
  Maximize2, 
  History, 
  X,
  ScanLine,
  Activity
} from 'lucide-react';

interface Threshold {
  value: number;
  label?: string;
  color?: string;
  strokeDasharray?: string;
  dataKey?: string;
}

interface MacroChartProps {
  title: string;
  dataKeys: string[];
  data: { [key: string]: MacroDataPoint[] };
  type?: 'line' | 'area';
  thresholds?: Threshold[];
  syncId?: string;
  analysisKey?: string;
  showMA?: boolean; // 是否显示移动平均线
}

// Key Historical Events for Context
const ECONOMIC_EVENTS = [
  { label: '全球金融危机', start: '2008-06-01', end: '2009-03-01', color: '#ef4444' },
  { label: '四万亿刺激', start: '2009-03-01', end: '2010-12-01', color: '#22c55e' },
  { label: '股灾/汇改', start: '2015-06-01', end: '2016-02-01', color: '#f59e0b' },
  { label: '疫情冲击', start: '2020-01-01', end: '2022-12-01', color: '#6366f1' },
];

const formatDate = (timestamp: number) => {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const dateStr = typeof label === 'number' ? formatDate(label) : label;

    return (
      <div className="bg-gray-900 border border-gray-700 p-3 rounded shadow-2xl text-xs z-50 min-w-[150px]">
        <p className="text-gray-400 mb-2 font-mono border-b border-gray-800 pb-1">{dateStr}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="mb-1 flex justify-between gap-4 font-medium items-center">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></span>
              <span style={{ color: '#e5e7eb' }}>{entry.name}:</span>
            </div>
            <span style={{ color: entry.color, fontWeight: 'bold' }}>
              {entry.value !== undefined && entry.value !== null ? Number(entry.value).toLocaleString() : '--'}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// 计算移动平均线
const calculateMA = (data: any[], key: string, period: number): any[] => {
  return data.map((point, index) => {
    if (index < period - 1) {
      return { ...point, [`${key}_ma${period}`]: null };
    }
    
    let sum = 0;
    let count = 0;
    for (let i = index - period + 1; i <= index; i++) {
      if (data[i][key] !== null && data[i][key] !== undefined) {
        sum += data[i][key];
        count++;
      }
    }
    
    return {
      ...point,
      [`${key}_ma${period}`]: count > 0 ? sum / count : null
    };
  });
};

export const MacroChart: React.FC<MacroChartProps> = ({ 
  title, 
  dataKeys, 
  data, 
  type = 'line',
  thresholds = [],
  syncId = "macro-dashboard",
  analysisKey,
  showMA = false
}) => {
  const [isBrushEnabled, setIsBrushEnabled] = useState(false);
  const [showEvents, setShowEvents] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [maEnabled, setMaEnabled] = useState(showMA);
  const [maPeriod, setMaPeriod] = useState<3 | 6 | 12>(6); // 默认6个月MA
  const chartRef = useRef<HTMLDivElement>(null);

  const openFullscreen = () => {
    setIsFullscreen(true);
    // Auto-enable analysis tools in fullscreen mode
    setIsBrushEnabled(true);
    setShowEvents(true);
  };

  const closeFullscreen = () => {
    setIsFullscreen(false);
    // Reset tools to keep card view clean
    setIsBrushEnabled(false);
    setShowEvents(false);
  };

  // Close fullscreen on ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFullscreen(false);
        setIsBrushEnabled(false);
        setShowEvents(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  const chartData = useMemo(() => {
    const allDates = new Set<string>();
    dataKeys.forEach(key => {
      data[key]?.forEach(point => allDates.add(point.date));
    });
    
    const sortedDates = Array.from(allDates).sort();

    let result = sortedDates.map(date => {
      const point: any = { 
        date,
        timestamp: new Date(date).getTime() 
      };
      
      dataKeys.forEach(key => {
        const found = data[key]?.find(d => d.date === date);
        point[key] = found ? found.value : null;
      });
      return point;
    });

    // 如果启用了移动平均线，为主指标计算MA
    if (maEnabled && dataKeys.length > 0) {
      const primaryKey = dataKeys[0];
      result = calculateMA(result, primaryKey, maPeriod);
    }

    return result;
  }, [data, dataKeys, maEnabled, maPeriod]);

  const primaryKey = dataKeys[0];
  const secondaryKey = dataKeys.length > 1 ? dataKeys[1] : null;
  
  const useDualAxis = useMemo(() => {
    if (!secondaryKey) return false;
    
    const primarySeries = chartData.map(d => d[primaryKey]).filter(v => v !== null) as number[];
    const secondarySeries = chartData.map(d => d[secondaryKey]).filter(v => v !== null) as number[];
    
    if (primarySeries.length === 0 || secondarySeries.length === 0) return false;

    const max1 = Math.max(...primarySeries.map(Math.abs));
    const max2 = Math.max(...secondarySeries.map(Math.abs));

    if (max1 === 0 || max2 === 0) return false;

    const ratio = max1 / max2;
    return ratio > 5 || ratio < 0.2;
  }, [chartData, primaryKey, secondaryKey]);

  const insightKey = analysisKey || primaryKey;
  const insightConfig = METRIC_DEFINITIONS[insightKey];
  const lastInsightValue = data[insightKey]?.slice(-1)[0]?.value || 0;
  
  let analysisText = "暂无深度解读";
  if (insightConfig?.analysis) {
    if (typeof insightConfig.analysis === 'function') {
      analysisText = insightConfig.analysis(lastInsightValue);
    } else {
      analysisText = insightConfig.analysis.replace('{value}', lastInsightValue.toLocaleString());
    }
  }

  const mainConfig = METRIC_DEFINITIONS[primaryKey]; 
  const secondaryColor = secondaryKey ? (METRIC_DEFINITIONS[secondaryKey]?.color || '#82ca9d') : undefined;

  const renderChartContent = (heightClass: string) => {
    const ChartComponent = type === 'area' ? AreaChart : LineChart;
    // Disable sync in fullscreen to avoid lag or confusion, or when brushing
    const activeSyncId = (isFullscreen || isBrushEnabled) ? undefined : syncId;

    return (
      <div ref={chartRef} className={`w-full ${heightClass} transition-all duration-300`}>
        <ResponsiveContainer width="100%" height="100%">
          <ChartComponent data={chartData} syncId={activeSyncId} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              {dataKeys.map((key) => (
                <linearGradient key={key} id={`color-${key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={METRIC_DEFINITIONS[key]?.color || '#8884d8'} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={METRIC_DEFINITIONS[key]?.color || '#8884d8'} stopOpacity={0}/>
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
            
            <XAxis 
              dataKey="timestamp" 
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              tickFormatter={formatDate}
              tick={{fontSize: 10, fill: '#9ca3af'}} 
              stroke="#4b5563" 
              tickLine={false} 
              axisLine={false} 
              dy={10} 
              minTickGap={50} 
            />
            
            <YAxis 
              yAxisId="left"
              tick={{fontSize: 10, fill: '#9ca3af'}} 
              stroke="#4b5563" 
              domain={['auto', 'auto']} 
              tickLine={false} 
              axisLine={false} 
              dx={-10}
            />

            {useDualAxis && (
              <YAxis 
                yAxisId="right"
                orientation="right"
                tick={{fontSize: 10, fill: secondaryColor}} 
                stroke={secondaryColor} 
                domain={['auto', 'auto']} 
                tickLine={false} 
                axisLine={false} 
                dx={10}
              />
            )}

            <Tooltip 
              content={<CustomTooltip />} 
              cursor={{ stroke: '#6b7280', strokeWidth: 1, strokeDasharray: '4 4' }} 
              labelFormatter={(label) => formatDate(label as number)}
            />
            <Legend wrapperStyle={{ paddingTop: '10px' }} />

            {/* Historical Events Context Layer */}
            {showEvents && ECONOMIC_EVENTS.map((event, i) => {
              const startTs = new Date(event.start).getTime();
              const endTs = new Date(event.end).getTime();

              return (
                <ReferenceArea
                  key={event.label}
                  x1={startTs}
                  x2={endTs}
                  yAxisId="left"
                  strokeOpacity={0}
                  fill={event.color}
                  fillOpacity={0.15}
                  label={{ 
                    value: event.label, 
                    position: 'insideTop', 
                    fill: event.color, 
                    fontSize: 10,
                    fontWeight: 600,
                    opacity: 0.9 
                  }} 
                />
              );
            })}

            {/* Threshold Lines */}
            {thresholds.map((t, i) => {
              const isTargetSecondary = t.dataKey === secondaryKey;
              const axisId = (isTargetSecondary && useDualAxis) ? "right" : "left";
              const metricColor = t.dataKey ? METRIC_DEFINITIONS[t.dataKey]?.color : undefined;
              const lineColor = t.color || metricColor || '#ef4444';
              
              return (
                <ReferenceLine 
                  key={i} 
                  y={t.value} 
                  yAxisId={axisId}
                  label={{ 
                    value: t.label, 
                    position: 'insideTopRight', 
                    fill: lineColor, 
                    fontSize: 10,
                    fontWeight: 600,
                    dy: -10
                  }} 
                  stroke={lineColor} 
                  strokeDasharray={t.strokeDasharray || "3 3"} 
                  strokeOpacity={0.9}
                />
              );
            })}

            {dataKeys.map((key, index) => {
              const isSecondary = index === 1 && useDualAxis;
              const axisId = isSecondary ? "right" : "left";
              const color = METRIC_DEFINITIONS[key]?.color || '#8884d8';
              const label = METRIC_DEFINITIONS[key]?.label || key;

              if (type === 'area' && !isSecondary) { 
                return (
                  <Area 
                    key={key}
                    yAxisId={axisId}
                    type="monotone" 
                    dataKey={key} 
                    name={label}
                    stroke={color} 
                    fillOpacity={1} 
                    fill={`url(#color-${key})`} 
                    strokeWidth={2}
                    connectNulls={true}
                    animationDuration={1000}
                  />
                );
              }
              
              return (
                <Line 
                  key={key} 
                  yAxisId={axisId}
                  type="monotone" 
                  dataKey={key} 
                  name={label}
                  stroke={color} 
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 0, fill: '#fff' }}
                  connectNulls={true} 
                  animationDuration={1000}
                />
              );
            })}

            {/* Moving Average Line */}
            {maEnabled && dataKeys.length > 0 && (
              <Line
                yAxisId="left"
                type="monotone"
                dataKey={`${dataKeys[0]}_ma${maPeriod}`}
                name={`MA${maPeriod}`}
                stroke="#fbbf24"
                strokeWidth={2}
                strokeDasharray="5 3"
                dot={false}
                connectNulls={true}
                animationDuration={500}
              />
            )}

            {/* Interactive Brush for Zooming */}
            {isBrushEnabled && (
              <Brush 
                dataKey="timestamp" 
                height={30} 
                stroke="#4b5563"
                fill="#1f2937"
                tickFormatter={(val) => new Date(val).getFullYear().toString()}
              />
            )}
          </ChartComponent>
        </ResponsiveContainer>
      </div>
    );
  };

  const HeaderControls = () => (
    <div className="flex items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
      {/* MA Toggle */}
      <div className="flex items-center gap-1 bg-gray-800 rounded-md p-0.5">
        <button
          onClick={() => setMaEnabled(!maEnabled)}
          className={`p-1.5 rounded transition-all ${maEnabled ? 'bg-yellow-600 text-white shadow-lg shadow-yellow-900/20' : 'text-gray-400 hover:text-white'}`}
          title="移动平均线"
        >
          <Activity size={14} />
        </button>
        {maEnabled && (
          <select
            value={maPeriod}
            onChange={(e) => setMaPeriod(Number(e.target.value) as 3 | 6 | 12)}
            className="bg-transparent text-xs text-gray-300 border-none outline-none cursor-pointer pr-1"
            onClick={(e) => e.stopPropagation()}
          >
            <option value={3} className="bg-gray-900">3月</option>
            <option value={6} className="bg-gray-900">6月</option>
            <option value={12} className="bg-gray-900">12月</option>
          </select>
        )}
      </div>
      <button
        onClick={() => setShowEvents(!showEvents)}
        className={`p-1.5 rounded-md transition-all ${showEvents ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
        title="Toggle Historical Context"
      >
        <History size={14} />
      </button>
      <button
        onClick={openFullscreen}
        className="p-1.5 rounded-md bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-all"
        title="Maximize Chart (Fullscreen Mode)"
      >
        <Maximize2 size={14} />
      </button>
    </div>
  );

  return (
    <>
      {/* Standard Card View */}
      <Card className="flex flex-col h-full bg-gray-900/80 backdrop-blur-sm group relative">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <h3 className="text-lg font-bold text-gray-100">{title}</h3>
            {mainConfig && <InfoTooltip content={mainConfig.description} />}
          </div>
          <HeaderControls />
        </div>

        {renderChartContent(isBrushEnabled ? 'h-96' : 'h-64')}

        <div className="mt-auto pt-4 border-t border-gray-800 text-sm text-gray-300 bg-gray-950/30 rounded-lg p-4 leading-relaxed flex items-start gap-3">
          <Lightbulb className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div>
            <span className="text-yellow-500 font-bold block mb-1 text-xs uppercase tracking-wider">Dalio Insight · 解读</span>
            <p className="text-gray-400 font-light text-xs md:text-sm">{analysisText}</p>
          </div>
        </div>
      </Card>

      {/* Fullscreen Modal View */}
      {isFullscreen && (
        <div className="fixed inset-0 z-[100] bg-gray-950/95 backdrop-blur-md flex flex-col p-6 animate-in fade-in zoom-in duration-200">
          <div className="flex justify-between items-center mb-6 px-4">
            <div className="flex items-center gap-4">
              <h2 className="text-2xl font-bold text-white">{title}</h2>
              <div className="flex gap-2">
                 <button
                  onClick={() => setMaEnabled(!maEnabled)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-2 ${maEnabled ? 'bg-yellow-600 text-white' : 'bg-gray-800 text-gray-400'}`}
                >
                  <Activity size={14} /> MA{maPeriod}
                </button>
                {maEnabled && (
                  <select
                    value={maPeriod}
                    onChange={(e) => setMaPeriod(Number(e.target.value) as 3 | 6 | 12)}
                    className="px-2 py-1.5 rounded-full text-xs bg-gray-800 text-gray-300 border-none outline-none cursor-pointer"
                  >
                    <option value={3}>3个月</option>
                    <option value={6}>6个月</option>
                    <option value={12}>12个月</option>
                  </select>
                )}
                 <button
                  onClick={() => setShowEvents(!showEvents)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-2 ${showEvents ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}
                >
                  <History size={14} /> {showEvents ? 'Hide Events' : 'Show Events'}
                </button>
                <button
                  onClick={() => setIsBrushEnabled(!isBrushEnabled)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-2 ${isBrushEnabled ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}
                >
                  <ScanLine size={14} /> {isBrushEnabled ? 'Hide Slider' : 'Show Slider'}
                </button>
              </div>
            </div>
            <button 
              onClick={closeFullscreen}
              className="p-2 rounded-full bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          <div className="flex-1 w-full bg-gray-900/50 rounded-xl border border-gray-800 p-6 shadow-2xl overflow-hidden flex flex-col">
             {renderChartContent('h-full flex-1')}
          </div>

          <div className="mt-6 px-4 max-w-4xl mx-auto w-full">
             <div className="bg-blue-900/20 border border-blue-900/50 rounded-lg p-6 flex gap-4 items-start">
                <Lightbulb className="w-6 h-6 text-blue-400 flex-shrink-0 mt-1" />
                <div>
                  <h4 className="text-blue-400 font-bold mb-2 uppercase tracking-wider text-sm">Deep Dive Analysis</h4>
                  <p className="text-gray-300 text-lg leading-relaxed font-light">
                    {analysisText}
                  </p>
                </div>
             </div>
          </div>
        </div>
      )}
    </>
  );
};