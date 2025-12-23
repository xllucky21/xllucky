import React, { useMemo, useState } from 'react';
import { MacroDataPoint } from '../types';
import { METRIC_DEFINITIONS } from '../constants';
import { 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  Zap, 
  ChevronDown, 
  ChevronUp,
  ArrowUpRight,
  ArrowDownRight,
  Flame,
  Snowflake,
  Activity
} from 'lucide-react';

interface AlertPanelProps {
  data: { [key: string]: MacroDataPoint[] };
  theme: string;
}

interface Alert {
  key: string;
  label: string;
  type: 'extreme_high' | 'extreme_low' | 'big_change' | 'trend';
  severity: 'high' | 'medium' | 'low';
  message: string;
  value: number;
  change?: number;
  percentile?: number;
  consecutiveMonths?: number;
}

// 计算历史分位数
const calculatePercentile = (value: number, history: number[]): number => {
  const sorted = [...history].sort((a, b) => a - b);
  const rank = sorted.filter(v => v < value).length;
  return (rank / sorted.length) * 100;
};

// 计算连续同向变化月数
const getConsecutiveMonths = (data: MacroDataPoint[]): { count: number; direction: 'up' | 'down' | 'flat' } => {
  if (data.length < 2) return { count: 0, direction: 'flat' };
  
  let count = 1;
  const lastDiff = data[data.length - 1].value - data[data.length - 2].value;
  const direction = lastDiff > 0 ? 'up' : lastDiff < 0 ? 'down' : 'flat';
  
  for (let i = data.length - 2; i > 0; i--) {
    const diff = data[i].value - data[i - 1].value;
    const currentDir = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat';
    if (currentDir === direction && direction !== 'flat') {
      count++;
    } else {
      break;
    }
  }
  
  return { count, direction };
};

export const AlertPanel: React.FC<AlertPanelProps> = ({ data, theme }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  // 生成预警列表
  const alerts = useMemo(() => {
    const alertList: Alert[] = [];
    
    Object.keys(data).forEach(key => {
      const series = data[key];
      if (!series || series.length < 12) return;
      
      const config = METRIC_DEFINITIONS[key];
      if (!config) return;
      
      const currentValue = series[series.length - 1].value;
      const prevValue = series[series.length - 2]?.value || currentValue;
      const change = currentValue - prevValue;
      const changePercent = prevValue !== 0 ? Math.abs(change / prevValue) * 100 : 0;
      
      // 获取历史数据（近5年）
      const recentData = series.slice(-60);
      const values = recentData.map(d => d.value);
      const percentile = calculatePercentile(currentValue, values);
      
      // 计算连续变化
      const consecutive = getConsecutiveMonths(series);
      
      // 1. 极端高位预警 (> 90分位)
      if (percentile > 90) {
        alertList.push({
          key,
          label: config.label,
          type: 'extreme_high',
          severity: percentile > 95 ? 'high' : 'medium',
          message: `处于近5年 ${percentile.toFixed(0)}% 分位，历史极高水平`,
          value: currentValue,
          percentile
        });
      }
      
      // 2. 极端低位预警 (< 10分位)
      if (percentile < 10) {
        alertList.push({
          key,
          label: config.label,
          type: 'extreme_low',
          severity: percentile < 5 ? 'high' : 'medium',
          message: `处于近5年 ${percentile.toFixed(0)}% 分位，历史极低水平`,
          value: currentValue,
          percentile
        });
      }
      
      // 3. 单月大幅变化预警 (变化超过历史标准差的2倍)
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const std = Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length);
      
      if (std > 0 && Math.abs(change) > std * 1.5) {
        alertList.push({
          key,
          label: config.label,
          type: 'big_change',
          severity: Math.abs(change) > std * 2.5 ? 'high' : 'medium',
          message: change > 0 
            ? `本月大幅上升 ${change > 0 ? '+' : ''}${change.toFixed(2)}，超出正常波动范围`
            : `本月大幅下降 ${change.toFixed(2)}，超出正常波动范围`,
          value: currentValue,
          change
        });
      }
      
      // 4. 趋势预警 (连续4个月以上同向变化)
      if (consecutive.count >= 4) {
        alertList.push({
          key,
          label: config.label,
          type: 'trend',
          severity: consecutive.count >= 6 ? 'high' : 'medium',
          message: consecutive.direction === 'up' 
            ? `连续 ${consecutive.count} 个月上升，形成明确上行趋势`
            : `连续 ${consecutive.count} 个月下降，形成明确下行趋势`,
          value: currentValue,
          consecutiveMonths: consecutive.count
        });
      }
    });
    
    // 按严重程度和类型排序
    return alertList.sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }, [data]);

  // 获取预警图标
  const getAlertIcon = (alert: Alert) => {
    switch (alert.type) {
      case 'extreme_high':
        return <Flame className="w-4 h-4" />;
      case 'extreme_low':
        return <Snowflake className="w-4 h-4" />;
      case 'big_change':
        return alert.change && alert.change > 0 
          ? <ArrowUpRight className="w-4 h-4" />
          : <ArrowDownRight className="w-4 h-4" />;
      case 'trend':
        return <Activity className="w-4 h-4" />;
      default:
        return <AlertTriangle className="w-4 h-4" />;
    }
  };

  // 获取预警颜色
  const getAlertColor = (alert: Alert) => {
    if (alert.severity === 'high') {
      return {
        bg: 'bg-rose-500/10',
        border: 'border-rose-500/30',
        text: 'text-rose-400',
        icon: 'text-rose-500'
      };
    }
    if (alert.severity === 'medium') {
      return {
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/30',
        text: 'text-amber-400',
        icon: 'text-amber-500'
      };
    }
    return {
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/30',
      text: 'text-blue-400',
      icon: 'text-blue-500'
    };
  };

  // 获取类型标签
  const getTypeLabel = (type: Alert['type']) => {
    switch (type) {
      case 'extreme_high': return '极高';
      case 'extreme_low': return '极低';
      case 'big_change': return '异动';
      case 'trend': return '趋势';
    }
  };

  const highAlerts = alerts.filter(a => a.severity === 'high');
  const mediumAlerts = alerts.filter(a => a.severity === 'medium');

  if (alerts.length === 0) {
    return null;
  }

  return (
    <div className={`bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden`}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-800/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-${theme}-500/20`}>
            <Zap className={`w-5 h-5 text-${theme}-400`} />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              指标异动预警
              <span className="text-xs text-gray-500 font-normal">Alert Monitor</span>
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {highAlerts.length > 0 && (
                <span className="text-rose-400 mr-2">{highAlerts.length} 个高危预警</span>
              )}
              {mediumAlerts.length > 0 && (
                <span className="text-amber-400">{mediumAlerts.length} 个中等预警</span>
              )}
              {alerts.length === 0 && '暂无异常'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isExpanded && highAlerts.length > 0 && (
            <div className="flex -space-x-1">
              {highAlerts.slice(0, 3).map((alert, i) => (
                <div 
                  key={i}
                  className="w-6 h-6 rounded-full bg-rose-500/20 border border-rose-500/50 flex items-center justify-center"
                  title={alert.label}
                >
                  <AlertTriangle className="w-3 h-3 text-rose-400" />
                </div>
              ))}
              {highAlerts.length > 3 && (
                <div className="w-6 h-6 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-[10px] text-gray-400">
                  +{highAlerts.length - 3}
                </div>
              )}
            </div>
          )}
          <div className="p-1 rounded hover:bg-gray-700 text-gray-400">
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </button>

      {/* Content */}
      <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-[500px]' : 'max-h-0'}`}>
        <div className="px-4 pb-4 space-y-2 max-h-[400px] overflow-y-auto">
          {alerts.map((alert, idx) => {
            const colors = getAlertColor(alert);
            return (
              <div
                key={`${alert.key}-${alert.type}-${idx}`}
                className={`flex items-start gap-3 p-3 rounded-lg border ${colors.bg} ${colors.border} transition-all hover:scale-[1.01]`}
              >
                <div className={`p-1.5 rounded ${colors.bg} ${colors.icon}`}>
                  {getAlertIcon(alert)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-white truncate">{alert.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${colors.bg} ${colors.text} font-medium`}>
                      {getTypeLabel(alert.type)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">{alert.message}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-mono font-bold text-white">
                    {alert.value.toFixed(2)}
                  </div>
                  {alert.change !== undefined && (
                    <div className={`text-xs font-mono ${alert.change > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {alert.change > 0 ? '+' : ''}{alert.change.toFixed(2)}
                    </div>
                  )}
                  {alert.percentile !== undefined && (
                    <div className="text-xs text-gray-500">
                      P{alert.percentile.toFixed(0)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
