import React, { useMemo, useState, useRef } from 'react';
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  Legend,
  Brush,
  ReferenceDot,
} from 'recharts';
import { Card } from './Card';
import { ScanLine, TrendingUp, TrendingDown, Activity, Download } from 'lucide-react';
import { exportChartAsImage } from '../utils/exportChart';

interface VolumeIndexChartProps {
  title: string;
  description?: string;
  data: any[];
  syncId?: string;
  height?: number;
  showMA?: boolean; // 是否显示均线
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
const findKeyPoints = (data: any[], field: string, windowSize: number = 20) => {
  const highs: { idx: number; value: number; date: string }[] = [];
  const lows: { idx: number; value: number; date: string }[] = [];
  
  for (let i = windowSize; i < data.length - windowSize; i++) {
    const current = data[i][field];
    const leftWindow = data.slice(i - windowSize, i).map(d => d[field]);
    const rightWindow = data.slice(i + 1, i + windowSize + 1).map(d => d[field]);
    
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

export const VolumeIndexChart: React.FC<VolumeIndexChartProps> = ({
  title,
  description,
  data,
  syncId,
  height = 350,
  showMA = true,
}) => {
  const [showBrush, setShowBrush] = useState(false);
  const [maVisible, setMaVisible] = useState(showMA);
  const chartRef = useRef<HTMLDivElement>(null);

  const handleExport = () => {
    exportChartAsImage(chartRef.current, title.replace(/[/\\?%*:|"<>]/g, '_'));
  };

  // 格式化数据并计算量价关系
  const { formattedData, stats, keyPoints } = useMemo(() => {
    // 计算均线
    const indexValues = data.map(d => d.sh_close);
    const ma5 = calcMA(indexValues, 5);
    const ma10 = calcMA(indexValues, 10);
    const ma20 = calcMA(indexValues, 20);
    
    const formatted = data.map((d, idx) => {
      const prevD = data[idx - 1];
      const priceChange = prevD ? ((d.sh_close - prevD.sh_close) / prevD.sh_close * 100) : 0;
      const volumeChange = prevD ? ((d.total_amount_yi - prevD.total_amount_yi) / prevD.total_amount_yi * 100) : 0;
      
      // 量价关系分类
      let volumePriceType = 'normal';
      if (priceChange > 0.5 && volumeChange > 10) volumePriceType = 'bullish'; // 放量上涨
      else if (priceChange < -0.5 && volumeChange > 10) volumePriceType = 'bearish'; // 放量下跌
      else if (priceChange > 0.5 && volumeChange < -10) volumePriceType = 'divergence_up'; // 缩量上涨
      else if (priceChange < -0.5 && volumeChange < -10) volumePriceType = 'divergence_down'; // 缩量下跌
      
      return {
        ...d,
        idx,
        displayDate: d.date?.slice(5) || d.date,
        priceChange,
        volumeChange,
        volumePriceType,
        // 均线数据
        ma5: ma5[idx],
        ma10: ma10[idx],
        ma20: ma20[idx],
        // 成交额柱状图颜色
        amountColor: priceChange >= 0 ? '#ef4444' : '#22c55e',
      };
    });

    // 统计量价关系
    const recent20 = formatted.slice(-20);
    const bullishDays = recent20.filter(d => d.volumePriceType === 'bullish').length;
    const bearishDays = recent20.filter(d => d.volumePriceType === 'bearish').length;
    const avgAmount = recent20.reduce((sum, d) => sum + d.total_amount_yi, 0) / 20;

    // 识别关键点位
    const keyPoints = findKeyPoints(formatted, 'sh_close', 15);

    return {
      formattedData: formatted,
      stats: { bullishDays, bearishDays, avgAmount },
      keyPoints,
    };
  }, [data]);

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

  // Y轴域计算
  const { amountDomain, indexDomain } = useMemo(() => {
    const amounts = data.map(d => d.total_amount_yi).filter(v => v > 0);
    const indices = data.map(d => d.sh_close).filter(v => v > 0);
    
    const amountMin = Math.min(...amounts);
    const amountMax = Math.max(...amounts);
    const indexMin = Math.min(...indices);
    const indexMax = Math.max(...indices);
    
    const amountPadding = (amountMax - amountMin) * 0.1;
    const indexPadding = (indexMax - indexMin) * 0.1;
    
    return {
      amountDomain: [Math.floor(amountMin - amountPadding), Math.ceil(amountMax + amountPadding)],
      indexDomain: [Math.floor(indexMin - indexPadding), Math.ceil(indexMax + indexPadding)],
    };
  }, [data]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    
    return (
      <div className="bg-gray-900/95 border border-gray-700 rounded-lg p-3 shadow-xl z-50 min-w-[220px]">
        <p className="text-gray-400 text-xs mb-2 border-b border-gray-800 pb-1">{d?.date}</p>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="text-gray-300">上证指数:</span>
            <span className="text-white font-medium">{d?.sh_close?.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="text-gray-300">成交额:</span>
            <span className="text-white font-medium">{(d?.total_amount_yi / 10000).toFixed(2)}万亿</span>
          </div>
          {maVisible && (
            <div className="border-t border-gray-800 pt-1.5 mt-1.5">
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="text-center">
                  <span className="text-purple-400">MA5</span>
                  <div className="text-gray-300">{d?.ma5?.toFixed(0) || '-'}</div>
                </div>
                <div className="text-center">
                  <span className="text-cyan-400">MA10</span>
                  <div className="text-gray-300">{d?.ma10?.toFixed(0) || '-'}</div>
                </div>
                <div className="text-center">
                  <span className="text-yellow-400">MA20</span>
                  <div className="text-gray-300">{d?.ma20?.toFixed(0) || '-'}</div>
                </div>
              </div>
            </div>
          )}
          <div className="border-t border-gray-800 pt-1.5 mt-1.5">
            <div className="flex items-center justify-between gap-4 text-xs">
              <span className="text-gray-500">涨跌:</span>
              <span className={d?.priceChange >= 0 ? 'text-red-400' : 'text-green-400'}>
                {d?.priceChange >= 0 ? '+' : ''}{d?.priceChange?.toFixed(2)}%
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 text-xs">
              <span className="text-gray-500">量变:</span>
              <span className={d?.volumeChange >= 0 ? 'text-red-400' : 'text-green-400'}>
                {d?.volumeChange >= 0 ? '+' : ''}{d?.volumeChange?.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
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
        {/* 量价统计 */}
        <div className="flex items-center gap-3 mr-4">
          <div className="flex items-center gap-1 text-xs">
            <TrendingUp className="w-3 h-3 text-red-400" />
            <span className="text-gray-500">放量涨</span>
            <span className="text-red-400 font-medium">{stats.bullishDays}天</span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <TrendingDown className="w-3 h-3 text-green-400" />
            <span className="text-gray-500">放量跌</span>
            <span className="text-green-400 font-medium">{stats.bearishDays}天</span>
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
            <linearGradient id="gradient-amount-up" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0.3}/>
            </linearGradient>
            <linearGradient id="gradient-amount-down" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#22c55e" stopOpacity={0.3}/>
            </linearGradient>
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
          
          {/* 左Y轴 - 成交额 */}
          <YAxis 
            yAxisId="amount"
            orientation="left"
            domain={amountDomain as [number, number]}
            tick={{ fill: '#3b82f6', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={55}
            tickFormatter={(value) => {
              if (value >= 10000) return (value / 10000).toFixed(1) + '万亿';
              return (value / 1000).toFixed(0) + '00亿';
            }}
          />
          
          {/* 右Y轴 - 指数 */}
          <YAxis 
            yAxisId="index"
            orientation="right"
            domain={indexDomain as [number, number]}
            tick={{ fill: '#f59e0b', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={50}
            tickFormatter={(value) => value.toFixed(0)}
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
              yAxisId="index"
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
          
          {/* 成交额阈值线 */}
          <ReferenceLine 
            yAxisId="amount"
            y={10000} 
            stroke="#f59e0b" 
            strokeDasharray="4 4"
            label={{ 
              value: '万亿', 
              fill: '#f59e0b', 
              fontSize: 10,
              position: 'left'
            }}
          />
          <ReferenceLine 
            yAxisId="amount"
            y={15000} 
            stroke="#ef4444" 
            strokeDasharray="4 4"
            label={{ 
              value: '1.5万亿', 
              fill: '#ef4444', 
              fontSize: 10,
              position: 'left'
            }}
          />
          
          {/* 成交额柱状图 - 红涨绿跌 */}
          <Bar 
            yAxisId="amount"
            dataKey="total_amount_yi"
            name="成交额(亿)"
            fill="#3b82f6"
            opacity={0.7}
            // 根据涨跌设置颜色
            shape={(props: any) => {
              const { x, y, width, height, payload } = props;
              const fill = payload.priceChange >= 0 ? '#ef4444' : '#22c55e';
              return <rect x={x} y={y} width={width} height={height} fill={fill} opacity={0.6} />;
            }}
          />
          
          {/* 上证指数线 */}
          <Line
            yAxisId="index"
            type="monotone"
            dataKey="sh_close"
            name="上证指数"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#f59e0b' }}
          />
          
          {/* 均线系统 */}
          {maVisible && (
            <>
              <Line
                yAxisId="index"
                type="monotone"
                dataKey="ma5"
                name="MA5"
                stroke="#a855f7"
                strokeWidth={1}
                dot={false}
                strokeDasharray="2 2"
              />
              <Line
                yAxisId="index"
                type="monotone"
                dataKey="ma10"
                name="MA10"
                stroke="#06b6d4"
                strokeWidth={1}
                dot={false}
                strokeDasharray="3 3"
              />
              <Line
                yAxisId="index"
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
              yAxisId="index"
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
              yAxisId="index"
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
      
      {/* 量价关系说明 */}
      <div className="mt-3 pt-3 border-t border-gray-800 flex flex-wrap items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-red-500/60 rounded-sm"></span>
          红柱=上涨日
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-green-500/60 rounded-sm"></span>
          绿柱=下跌日
        </span>
        {maVisible && (
          <>
            <span className="text-gray-600">|</span>
            <span className="flex items-center gap-1">
              <span className="w-4 h-0.5 bg-purple-500"></span>
              MA5
            </span>
            <span className="flex items-center gap-1">
              <span className="w-4 h-0.5 bg-cyan-500"></span>
              MA10
            </span>
            <span className="flex items-center gap-1">
              <span className="w-4 h-0.5 bg-yellow-500"></span>
              MA20
            </span>
          </>
        )}
        <span className="text-gray-600">|</span>
        <span>
          <span className="text-red-400">●</span>高点 
          <span className="text-green-400 ml-2">●</span>低点
        </span>
      </div>
    </Card>
  );
};
