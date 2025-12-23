import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card } from './Card';

interface MetricCardProps {
  title: string;
  value: number | string;
  unit?: string;
  change?: number;
  changeLabel?: string;
  color?: string;
  icon?: React.ReactNode;
  description?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit = '',
  change,
  changeLabel = '较前日',
  color = '#3b82f6',
  icon,
  description,
}) => {
  const getTrendIcon = () => {
    if (change === undefined || change === 0) return <Minus className="w-4 h-4 text-gray-400" />;
    if (change > 0) return <TrendingUp className="w-4 h-4 text-red-500" />;
    return <TrendingDown className="w-4 h-4 text-green-500" />;
  };

  const getChangeColor = () => {
    if (change === undefined || change === 0) return 'text-gray-400';
    // 中国股市：红涨绿跌
    return change > 0 ? 'text-red-500' : 'text-green-500';
  };

  const formatValue = (val: number | string) => {
    if (typeof val === 'string') return val;
    if (Math.abs(val) >= 10000) return (val / 10000).toFixed(2) + '万';
    if (Math.abs(val) >= 1000) return val.toLocaleString();
    return val.toFixed(2);
  };

  return (
    <Card className="hover:border-gray-700 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          {icon && <span style={{ color }}>{icon}</span>}
          <span className="text-gray-400 text-sm font-medium">{title}</span>
        </div>
        {getTrendIcon()}
      </div>
      
      <div className="flex items-baseline gap-1 mb-1">
        <span className="text-2xl font-bold text-white" style={{ color }}>
          {formatValue(value)}
        </span>
        {unit && <span className="text-gray-500 text-sm">{unit}</span>}
      </div>
      
      {change !== undefined && (
        <div className={`text-xs ${getChangeColor()} flex items-center gap-1`}>
          <span>{changeLabel}</span>
          <span className="font-medium">
            {change > 0 ? '+' : ''}{change.toFixed(2)}%
          </span>
        </div>
      )}
      
      {description && (
        <div className="text-xs text-gray-500 mt-2 border-t border-gray-800 pt-2">
          {description}
        </div>
      )}
    </Card>
  );
};
