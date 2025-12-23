
import React, { useState, useMemo } from 'react';
import { Activity } from 'lucide-react';
import { MainChart } from './MainChart';
import { BondDataPoint } from '../types';

interface YieldChartSectionProps {
  data: BondDataPoint[];
}

type TimeRange = '30d' | '90d' | '1y' | 'all';

const timeRangeConfig: { key: TimeRange; label: string; days: number | null }[] = [
  { key: '30d', label: '30天', days: 30 },
  { key: '90d', label: '90天', days: 90 },
  { key: '1y', label: '1年', days: 252 },
  { key: 'all', label: '全部', days: null },
];

export const YieldChartSection: React.FC<YieldChartSectionProps> = ({ data }) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('90d');

  const filteredData = useMemo(() => {
    const config = timeRangeConfig.find(c => c.key === timeRange);
    if (!config || config.days === null) {
      return data;
    }
    return data.slice(-config.days);
  }, [data, timeRange]);

  const currentLabel = timeRangeConfig.find(c => c.key === timeRange)?.label || '90天';

  return (
    <div className="bg-slate-900 rounded-2xl shadow-lg border border-slate-800 p-6">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
        <h3 className="text-lg font-bold text-slate-100 flex items-center">
          <Activity className="w-5 h-5 mr-2 text-indigo-400"/>
          10年期国债收益率走势 <span className="ml-2 text-xs font-normal text-slate-500">(近{currentLabel})</span>
        </h3>
        <div className="flex items-center space-x-3">
            {/* Time Range Selector */}
            <div className="flex bg-slate-800 rounded-lg p-0.5 border border-slate-700">
              {timeRangeConfig.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setTimeRange(key)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                    timeRange === key
                      ? 'bg-indigo-500 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="text-xs text-orange-400 bg-orange-950/20 border border-orange-500/20 px-2 py-1 rounded flex items-center">
                🔸 虚线 = MA60牛熊线
            </span>
            <span className="text-xs text-slate-400 bg-slate-800 border border-slate-700 px-2 py-1 rounded hidden sm:block">
            📉 收益率下行 = 债牛
            </span>
        </div>
      </div>
      <div className="h-[300px] w-full">
        <MainChart rawData={filteredData} />
      </div>
    </div>
  );
};
