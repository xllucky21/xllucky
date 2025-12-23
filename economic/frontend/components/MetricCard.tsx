import React, { useMemo, useState } from 'react';
import { ArrowUp, ArrowDown, Minus, Info } from 'lucide-react';
import { LineChart, Line, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { METRIC_DEFINITIONS } from '../constants';
import { MacroDataPoint } from '../types';

interface MetricCardProps {
  dataKey: string;
  data: MacroDataPoint[]; // Now receives filtered history based on global time range
}

const SparklineTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-gray-900 border border-gray-700 p-1.5 rounded shadow-xl text-[10px] z-50">
        <div className="text-gray-400 font-mono mb-0.5">{data.date}</div>
        <div className="text-white font-bold">{Number(data.value).toLocaleString()}</div>
      </div>
    );
  }
  return null;
};

export const MetricCard: React.FC<MetricCardProps> = ({ dataKey, data }) => {
  const config = METRIC_DEFINITIONS[dataKey];
  const [showTooltip, setShowTooltip] = useState(false);
  
  // Memoize calculations to prevent heavy re-renders
  const stats = useMemo(() => {
    if (!data || data.length === 0) return null;

    // 1. Current & Previous
    const currentPoint = data[data.length - 1];
    const prevPoint = data.length > 1 ? data[data.length - 2] : currentPoint;
    const currentValue = currentPoint.value;
    const prevValue = prevPoint.value;
    const date = currentPoint.date;

    const diff = currentValue - prevValue;
    // const percentChange = prevValue !== 0 ? (diff / Math.abs(prevValue)) * 100 : 0;

    // 2. Sparkline Data 
    // Now uses the entire filtered dataset passed from App.tsx
    // This allows the sparkline to reflect the 5Y, 10Y, or 20Y selection.
    const sparklineData = data;

    // 3. Cycle Position
    // Calculates Min/Max based on the currently selected time range
    const values = data.map(d => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    // Calculate position percentage (0 to 100)
    let position = 0;
    if (max !== min) {
      position = ((currentValue - min) / (max - min)) * 100;
    }
    // Clamp position
    position = Math.max(0, Math.min(100, position));

    return {
      currentValue,
      diff,
      date,
      sparklineData,
      min,
      max,
      position
    };
  }, [data]);

  if (!config || !stats) return null;

  const { currentValue, diff, date, sparklineData, min, max, position } = stats;
  
  const isUp = diff > 0;
  const isNeutral = diff === 0;
  
  // Market Color Logic: China Red = Up
  const trendColor = isNeutral ? '#9ca3af' : isUp ? '#ff3b30' : '#00b578';
  const trendClass = isNeutral ? 'text-gray-400' : isUp ? 'text-market-red' : 'text-market-green';
  const Icon = isNeutral ? Minus : isUp ? ArrowUp : ArrowDown;

  // Valuation Heatmap Logic
  let positionColor = trendColor; // Default fallback to trend color
  
  if (config.colorScale) {
    if (config.colorScale === 'normal') {
      // Normal: Low is Bad/Red, High is Good/Green (e.g., ERP, Yield for buying)
      if (position < 20) positionColor = '#ef4444'; // Red
      else if (position < 80) positionColor = '#fbbf24'; // Yellow/Neutral
      else positionColor = '#10b981'; // Green
    } else {
      // Inverse: Low is Good/Green, High is Bad/Red (e.g., PE, PB)
      if (position < 20) positionColor = '#10b981'; // Green
      else if (position < 80) positionColor = '#fbbf24'; // Yellow/Neutral
      else positionColor = '#ef4444'; // Red
    }
  }

  const formattedValue = config.format === 'percentage' 
    ? `${currentValue.toFixed(2)}%`
    : currentValue.toLocaleString();

  return (
    <div className="bg-gray-900/80 border border-gray-800 rounded-lg p-4 hover:border-gray-600 transition-all duration-300 group flex flex-col justify-between h-[140px] backdrop-blur-sm relative">
      
      {/* Background Gradient for subtle grouping feel (optional) */}
      <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-gray-800 to-transparent opacity-50 group-hover:bg-blue-600 transition-colors"></div>

      {/* Header */}
      <div className="flex justify-between items-start z-10">
        <div className="flex items-center gap-1.5 overflow-hidden">
          <span className="text-gray-400 text-xs font-medium uppercase tracking-wider truncate" title={config.label}>
            {config.label}
          </span>
          <div 
            className="relative"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            <Info className="w-3 h-3 text-gray-600 hover:text-gray-300 cursor-help" />
            {showTooltip && (
              <div 
                className="fixed z-[9999] w-56 p-3 bg-gray-950 border border-gray-600 text-[11px] text-gray-300 rounded-lg shadow-2xl leading-relaxed"
                style={{
                  transform: 'translateY(-100%) translateY(-8px)',
                  marginTop: '-4px'
                }}
              >
                <div className="text-gray-500 text-[9px] uppercase tracking-wider mb-1.5 font-semibold">指标说明</div>
                {config.description}
              </div>
            )}
          </div>
        </div>
        <span className="text-[10px] font-mono text-gray-600">{date.substring(0, 7)}</span>
      </div>

      {/* Main Content Area: Value + Sparkline */}
      <div className="flex items-end justify-between mt-2 mb-3 z-10">
        <div>
          <div className="text-2xl font-bold text-gray-100 tracking-tight leading-none">
            {formattedValue}
          </div>
          <div className={`flex items-center text-xs font-medium mt-1.5 ${trendClass}`}>
            <Icon size={12} className="mr-0.5" strokeWidth={3} />
            <span>{Math.abs(diff).toFixed(2)}</span>
          </div>
        </div>

        {/* Sparkline Chart */}
        <div className="w-[80px] h-[35px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparklineData}>
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke={trendColor} 
                strokeWidth={sparklineData.length > 60 ? 1.5 : 2} // Thinner line for long history
                dot={false} 
                isAnimationActive={false} // Disable animation for performance in grid
              />
              <YAxis domain={['dataMin', 'dataMax']} hide={true} />
              <Tooltip content={<SparklineTooltip />} cursor={{ stroke: '#666', strokeWidth: 1 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Cycle Position Bar */}
      <div className="mt-auto z-10">
        <div className="flex justify-between text-[9px] text-gray-500 mb-1 font-mono">
          <span>L: {config.format === 'percentage' ? min.toFixed(1) : min.toLocaleString()}</span>
          <span>H: {config.format === 'percentage' ? max.toFixed(1) : max.toLocaleString()}</span>
        </div>
        <div className="h-1.5 w-full bg-gray-800 rounded-full relative overflow-hidden">
          {/* Track */}
          <div className="absolute top-0 left-0 h-full bg-gray-800 w-full"></div>
          {/* Position Marker */}
          <div 
            className="absolute top-0 h-full w-1 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.8)] z-20"
            style={{ left: `${position}%` }}
          />
          {/* Filled part */}
          <div 
            className="absolute top-0 left-0 h-full opacity-60 rounded-full transition-all duration-500"
            style={{ 
              width: `${position}%`,
              backgroundColor: positionColor 
            }}
          />
        </div>
      </div>
    </div>
  );
};