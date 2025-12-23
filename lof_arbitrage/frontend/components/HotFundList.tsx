import React, { useState } from 'react';
import { HotLofFund } from '../types';
import { Star, TrendingDown, TrendingUp, ChevronDown, ChevronUp, Info } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

interface HotFundListProps {
  funds: HotLofFund[];
}

export const HotFundList: React.FC<HotFundListProps> = ({ funds }) => {
  const [expandedFund, setExpandedFund] = useState<string | null>(null);

  const toggleExpand = (code: string) => {
    setExpandedFund(expandedFund === code ? null : code);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Star className="text-yellow-400" size={20} />
        <h2 className="text-lg font-semibold">热门LOF基金</h2>
        <span className="text-sm text-slate-400">({funds.length}只)</span>
      </div>

      {/* 数据说明 */}
      <div className="flex items-center gap-2 text-xs text-slate-500 px-2">
        <Info size={14} />
        <span>实时折溢价基于盘中估值计算；历史走势图基于T-1净值（收盘后数据）</span>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {funds.map(fund => {
          const isExpanded = expandedFund === fund.code;
          const realtimeDiscount = fund.realtime_discount ?? 0;
          const isDiscount = realtimeDiscount < 0;

          return (
            <div
              key={fund.code}
              className="bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden"
            >
              {/* Header */}
              <div
                className="p-4 cursor-pointer hover:bg-gray-800/30 transition-colors"
                onClick={() => toggleExpand(fund.code)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-blue-400">{fund.code}</span>
                        <span className="text-white font-medium">{fund.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-700 text-slate-400">
                          {fund.track_index}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-sm text-slate-400">场内价格</div>
                      <div className="text-lg font-semibold text-white">
                        {fund.price?.toFixed(4) ?? '-'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-blue-400">实时估值</div>
                      <div className="text-lg font-semibold text-blue-400">
                        {fund.est_nav?.toFixed(4) ?? '-'}
                      </div>
                    </div>
                    <div className="text-right min-w-[100px]">
                      <div className="text-sm text-blue-400">实时折溢价</div>
                      <div className={`text-lg font-semibold flex items-center justify-end gap-1 ${
                        isDiscount ? 'text-green-400' : realtimeDiscount > 0 ? 'text-red-400' : 'text-slate-400'
                      }`}>
                        {isDiscount ? <TrendingDown size={16} /> : realtimeDiscount > 0 ? <TrendingUp size={16} /> : null}
                        {realtimeDiscount >= 0 ? '+' : ''}{realtimeDiscount.toFixed(2)}%
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-slate-400">涨跌幅</div>
                      <div className={`text-lg font-semibold ${
                        (fund.change_pct ?? 0) >= 0 ? 'text-red-400' : 'text-green-400'
                      }`}>
                        {fund.change_pct !== null ? `${fund.change_pct >= 0 ? '+' : ''}${fund.change_pct}%` : '-'}
                      </div>
                    </div>
                    <div className="text-slate-400">
                      {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                  </div>
                </div>
              </div>

              {/* Expanded Content */}
              {isExpanded && fund.discount_history.length > 0 && (
                <div className="border-t border-gray-800 p-4">
                  <h4 className="text-sm font-medium text-slate-400 mb-3">
                    历史折溢价率走势（近30天，基于T-1净值）
                  </h4>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={fund.discount_history}>
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
                          formatter={(value: number) => [`${value.toFixed(2)}%`, '折溢价率']}
                          labelFormatter={(label) => `日期: ${label}`}
                        />
                        <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="3 3" />
                        <Line
                          type="monotone"
                          dataKey="discount_rate"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="mt-4 grid grid-cols-4 gap-4 text-sm">
                    <div className="bg-gray-800/50 rounded-lg p-3">
                      <div className="text-slate-400">成交额</div>
                      <div className="text-white font-medium">{fund.amount.toLocaleString()}万</div>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-3">
                      <div className="text-slate-400">成交量</div>
                      <div className="text-white font-medium">{fund.volume.toLocaleString()}手</div>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-3">
                      <div className="text-slate-400">换手率</div>
                      <div className="text-white font-medium">
                        {fund.turnover_rate !== null ? `${fund.turnover_rate}%` : '-'}
                      </div>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-3">
                      <div className="text-slate-400">T-1折溢价</div>
                      <div className={`font-medium ${
                        (fund.t1_discount ?? 0) < 0 ? 'text-green-400' : 
                        (fund.t1_discount ?? 0) > 0 ? 'text-red-400' : 'text-slate-400'
                      }`}>
                        {fund.t1_discount !== null ? `${fund.t1_discount >= 0 ? '+' : ''}${fund.t1_discount}%` : '-'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
