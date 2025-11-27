
import React from 'react';
import { Activity } from 'lucide-react';
import { MainChart } from './MainChart';
import { BondDataPoint } from '../types';

interface YieldChartSectionProps {
  data: BondDataPoint[];
}

export const YieldChartSection: React.FC<YieldChartSectionProps> = ({ data }) => {
  return (
    <div className="bg-slate-900 rounded-2xl shadow-lg border border-slate-800 p-6">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
        <h3 className="text-lg font-bold text-slate-100 flex items-center">
          <Activity className="w-5 h-5 mr-2 text-indigo-400"/>
          10年期国债收益率走势 <span className="ml-2 text-xs font-normal text-slate-500">(近30个交易日)</span>
        </h3>
        <div className="flex space-x-3">
            <span className="text-xs text-orange-400 bg-orange-950/20 border border-orange-500/20 px-2 py-1 rounded flex items-center">
                🔸 虚线 = MA60牛熊线
            </span>
            <span className="text-xs text-slate-400 bg-slate-800 border border-slate-700 px-2 py-1 rounded">
            📉 收益率下行 = 债牛
            </span>
        </div>
      </div>
      <div className="h-[300px] w-full">
        <MainChart rawData={data} />
      </div>
    </div>
  );
};
