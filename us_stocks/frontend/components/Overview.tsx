import React from 'react';
import { Card } from './Card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface OverviewProps {
  data: any;
  timeRange?: string;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  rangeChange?: number;
  rangeLabel?: string;
  color?: string;
  subtitle?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, change, changeLabel, rangeChange, rangeLabel, color = 'blue', subtitle }) => {
  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;
  const isRangePositive = rangeChange !== undefined && rangeChange > 0;
  const isRangeNegative = rangeChange !== undefined && rangeChange < 0;
  
  const colorMap: Record<string, string> = {
    blue: 'from-blue-500/20 to-blue-600/5 border-blue-500/30',
    green: 'from-green-500/20 to-green-600/5 border-green-500/30',
    red: 'from-red-500/20 to-red-600/5 border-red-500/30',
    yellow: 'from-yellow-500/20 to-yellow-600/5 border-yellow-500/30',
    purple: 'from-purple-500/20 to-purple-600/5 border-purple-500/30',
  };

  return (
    <div className={`bg-gradient-to-br ${colorMap[color]} border rounded-xl p-4`}>
      <div className="text-xs text-gray-400 mb-1">{title}</div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}
      <div className="flex items-center gap-3 mt-2">
        {change !== undefined && (
          <div className={`flex items-center gap-1 text-sm ${isPositive ? 'text-green-400' : isNegative ? 'text-red-400' : 'text-gray-400'}`}>
            {isPositive ? <TrendingUp className="w-3 h-3" /> : isNegative ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
            <span className="text-xs">{isPositive ? '+' : ''}{change.toFixed(2)}%</span>
            {changeLabel && <span className="text-gray-500 text-xs">{changeLabel}</span>}
          </div>
        )}
        {rangeChange !== undefined && (
          <div className={`flex items-center gap-1 text-xs ${isRangePositive ? 'text-green-400/70' : isRangeNegative ? 'text-red-400/70' : 'text-gray-500'}`}>
            <span>{isRangePositive ? '+' : ''}{rangeChange.toFixed(1)}%</span>
            {rangeLabel && <span className="text-gray-500">{rangeLabel}</span>}
          </div>
        )}
      </div>
    </div>
  );
};

export const Overview: React.FC<OverviewProps> = ({ data, timeRange = '1年' }) => {
  const { indices, vix, bond, dollar, stars } = data.data;
  
  // 获取最新数据
  const getLatest = (arr: any[]) => arr?.[arr.length - 1];
  const getPrev = (arr: any[]) => arr?.[arr.length - 2];
  const getFirst = (arr: any[]) => arr?.[0];
  
  const calcChange = (arr: any[], field = 'close') => {
    const latest = getLatest(arr)?.[field];
    const prev = getPrev(arr)?.[field];
    if (!latest || !prev) return 0;
    return ((latest - prev) / prev) * 100;
  };

  const calcRangeChange = (arr: any[], field = 'close') => {
    const latest = getLatest(arr)?.[field];
    const first = getFirst(arr)?.[field];
    if (!latest || !first) return 0;
    return ((latest - first) / first) * 100;
  };
  
  const latestDji = getLatest(indices?.dji);
  const latestSpx = getLatest(indices?.spx);
  const latestNdx = getLatest(indices?.ndx);
  const latestVix = getLatest(vix);
  const latestBond = getLatest(bond);
  const latestDollar = getLatest(dollar);
  
  // 明星股涨跌
  const starChanges = Object.entries(stars || {}).map(([key, arr]: [string, any]) => ({
    name: key.toUpperCase(),
    change: calcChange(arr),
    rangeChange: calcRangeChange(arr),
    close: getLatest(arr)?.close,
  })).sort((a, b) => b.change - a.change);

  return (
    <div className="space-y-4">
      {/* 三大指数 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          title="道琼斯工业"
          value={latestDji?.close?.toLocaleString() || '-'}
          change={calcChange(indices?.dji)}
          rangeChange={calcRangeChange(indices?.dji)}
          rangeLabel={timeRange}
          color="blue"
        />
        <MetricCard
          title="标普500"
          value={latestSpx?.close?.toLocaleString() || '-'}
          change={calcChange(indices?.spx)}
          rangeChange={calcRangeChange(indices?.spx)}
          rangeLabel={timeRange}
          color="green"
        />
        <MetricCard
          title="纳斯达克"
          value={latestNdx?.close?.toLocaleString() || '-'}
          change={calcChange(indices?.ndx)}
          rangeChange={calcRangeChange(indices?.ndx)}
          rangeLabel={timeRange}
          color="purple"
        />
        <MetricCard
          title="VIX 恐慌指数"
          value={latestVix?.close?.toFixed(2) || '-'}
          subtitle={latestVix?.close >= 30 ? '🔴 恐慌' : latestVix?.close >= 20 ? '🟡 警惕' : '🟢 平静'}
          color={latestVix?.close >= 30 ? 'red' : latestVix?.close >= 20 ? 'yellow' : 'green'}
        />
      </div>
      
      {/* 利率与美元 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          title="美债10年"
          value={latestBond?.us_10y?.toFixed(2) + '%' || '-'}
          color="yellow"
        />
        <MetricCard
          title="美债2年"
          value={latestBond?.us_2y?.toFixed(2) + '%' || '-'}
          color="yellow"
        />
        <MetricCard
          title="2-10年利差"
          value={latestBond?.spread_2_10?.toFixed(2) + '%' || '-'}
          subtitle={latestBond?.spread_2_10 < 0 ? '⚠️ 倒挂' : '正常'}
          color={latestBond?.spread_2_10 < 0 ? 'red' : 'green'}
        />
        <MetricCard
          title="美元指数"
          value={latestDollar?.close?.toFixed(2) || '-'}
          change={calcChange(dollar)}
          color="blue"
        />
      </div>
      
      {/* 明星股热力图 */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-300 mb-3">七巨头今日表现</h3>
        <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
          {starChanges.map((stock) => (
            <div 
              key={stock.name}
              className={`p-3 rounded-lg text-center ${
                stock.change > 0 ? 'bg-green-500/10 border border-green-500/30' : 
                stock.change < 0 ? 'bg-red-500/10 border border-red-500/30' : 
                'bg-gray-800 border border-gray-700'
              }`}
            >
              <div className="text-xs font-bold text-gray-300">{stock.name}</div>
              <div className={`text-sm font-semibold mt-1 ${stock.change > 0 ? 'text-green-400' : stock.change < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                {stock.change > 0 ? '+' : ''}{stock.change.toFixed(2)}%
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
