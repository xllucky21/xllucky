import React, { useState, useMemo } from 'react';
import { HotLofFund } from '../types';
import { LineChart as LineChartIcon } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts';

interface DiscountChartProps {
  funds: HotLofFund[];
}

const COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
];

export const DiscountChart: React.FC<DiscountChartProps> = ({ funds }) => {
  const fundsWithHistory = funds.filter(f => f.discount_history.length > 0);
  const [selectedFunds, setSelectedFunds] = useState<string[]>(
    fundsWithHistory.slice(0, 5).map(f => f.code)
  );

  const toggleFund = (code: string) => {
    if (selectedFunds.includes(code)) {
      setSelectedFunds(selectedFunds.filter(c => c !== code));
    } else if (selectedFunds.length < 10) {
      setSelectedFunds([...selectedFunds, code]);
    }
  };

  const chartData = useMemo(() => {
    if (selectedFunds.length === 0) return [];

    // 获取所有日期
    const allDates = new Set<string>();
    fundsWithHistory.forEach(fund => {
      if (selectedFunds.includes(fund.code)) {
        fund.discount_history.forEach(h => allDates.add(h.date));
      }
    });

    const sortedDates = Array.from(allDates).sort();

    // 构建数据
    return sortedDates.map(date => {
      const point: Record<string, any> = { date };
      fundsWithHistory.forEach(fund => {
        if (selectedFunds.includes(fund.code)) {
          const history = fund.discount_history.find(h => h.date === date);
          point[fund.code] = history?.discount_rate ?? null;
        }
      });
      return point;
    });
  }, [fundsWithHistory, selectedFunds]);

  const selectedFundDetails = useMemo(() => {
    return fundsWithHistory.filter(f => selectedFunds.includes(f.code));
  }, [fundsWithHistory, selectedFunds]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <LineChartIcon className="text-blue-400" size={20} />
        <h2 className="text-lg font-semibold">折溢价率走势对比</h2>
      </div>

      {/* Fund Selector */}
      <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800">
        <div className="text-sm text-slate-400 mb-3">选择基金（最多10只）:</div>
        <div className="flex flex-wrap gap-2">
          {fundsWithHistory.map((fund, index) => {
            const isSelected = selectedFunds.includes(fund.code);
            const colorIndex = selectedFunds.indexOf(fund.code);
            const color = colorIndex >= 0 ? COLORS[colorIndex % COLORS.length] : undefined;

            return (
              <button
                key={fund.code}
                onClick={() => toggleFund(fund.code)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  isSelected
                    ? 'text-white'
                    : 'bg-gray-800 text-slate-400 hover:text-white hover:bg-gray-700'
                }`}
                style={isSelected ? { backgroundColor: color } : undefined}
              >
                {fund.code} {fund.name.slice(0, 6)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chart */}
      {selectedFunds.length > 0 ? (
        <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800">
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  tickFormatter={(value) => value.slice(5)}
                />
                <YAxis
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  tickFormatter={(value) => `${value}%`}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number, name: string) => {
                    const fund = fundsWithHistory.find(f => f.code === name);
                    return [`${value?.toFixed(2)}%`, fund?.name ?? name];
                  }}
                  labelFormatter={(label) => `日期: ${label}`}
                />
                <Legend
                  formatter={(value) => {
                    const fund = fundsWithHistory.find(f => f.code === value);
                    return fund?.name ?? value;
                  }}
                />
                <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="3 3" />
                {selectedFundDetails.map((fund, index) => (
                  <Line
                    key={fund.code}
                    type="monotone"
                    dataKey={fund.code}
                    stroke={COLORS[index % COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="bg-gray-900/50 rounded-xl p-8 border border-gray-800 text-center">
          <p className="text-slate-400">请选择至少一只基金查看走势</p>
        </div>
      )}

      {/* Current Status Table */}
      {selectedFundDetails.length > 0 && (
        <div className="bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-800/50">
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">基金</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-slate-400">当前折溢价</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-slate-400">30日最低</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-slate-400">30日最高</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-slate-400">30日均值</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {selectedFundDetails.map((fund, index) => {
                  const rates = fund.discount_history.map(h => h.discount_rate);
                  const min = Math.min(...rates);
                  const max = Math.max(...rates);
                  const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
                  const current = fund.discount_rate ?? 0;

                  return (
                    <tr key={fund.code} className="hover:bg-gray-800/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <span className="font-mono text-blue-400">{fund.code}</span>
                          <span className="text-white">{fund.name}</span>
                        </div>
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold ${
                        current < 0 ? 'text-green-400' : current > 0 ? 'text-red-400' : 'text-slate-400'
                      }`}>
                        {current >= 0 ? '+' : ''}{current.toFixed(2)}%
                      </td>
                      <td className="px-4 py-3 text-right text-green-400">
                        {min.toFixed(2)}%
                      </td>
                      <td className="px-4 py-3 text-right text-red-400">
                        +{max.toFixed(2)}%
                      </td>
                      <td className="px-4 py-3 text-right text-slate-400">
                        {avg >= 0 ? '+' : ''}{avg.toFixed(2)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
