import React, { useState, useMemo } from 'react';
import { LofFund } from '../types';
import { Search, ArrowUpDown, ArrowUp, ArrowDown, Info } from 'lucide-react';

interface AllFundTableProps {
  funds: LofFund[];
  searchTerm: string;
  onSearchChange: (term: string) => void;
}

type SortField = 'code' | 'name' | 'realtime_discount' | 't1_discount' | 'change_pct' | 'amount' | 'signal_strength';
type SortDirection = 'asc' | 'desc';

export const AllFundTable: React.FC<AllFundTableProps> = ({
  funds,
  searchTerm,
  onSearchChange,
}) => {
  const [sortField, setSortField] = useState<SortField>('realtime_discount');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'realtime_discount' ? 'asc' : 'desc');
    }
  };

  const sortedFunds = useMemo(() => {
    return [...funds].sort((a, b) => {
      let aVal: number | string = 0;
      let bVal: number | string = 0;

      switch (sortField) {
        case 'code':
          aVal = a.code;
          bVal = b.code;
          break;
        case 'name':
          aVal = a.name;
          bVal = b.name;
          break;
        case 'realtime_discount':
          aVal = a.realtime_discount ?? 0;
          bVal = b.realtime_discount ?? 0;
          break;
        case 't1_discount':
          aVal = a.t1_discount ?? 0;
          bVal = b.t1_discount ?? 0;
          break;
        case 'change_pct':
          aVal = a.change_pct ?? 0;
          bVal = b.change_pct ?? 0;
          break;
        case 'amount':
          aVal = a.amount ?? 0;
          bVal = b.amount ?? 0;
          break;
        case 'signal_strength':
          aVal = a.signal_strength ?? 0;
          bVal = b.signal_strength ?? 0;
          break;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      return sortDirection === 'asc' 
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
  }, [funds, sortField, sortDirection]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown size={14} className="text-slate-500" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp size={14} className="text-blue-400" />
      : <ArrowDown size={14} className="text-blue-400" />;
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          type="text"
          placeholder="搜索基金代码或名称..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* 数据说明 */}
      <div className="flex items-center gap-2 text-xs text-slate-500 px-2">
        <Info size={14} />
        <span>实时折溢价 = (场内价格 - 实时估值) / 实时估值 × 100%，更准确反映套利机会</span>
      </div>

      {/* Table */}
      <div className="bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-800/50">
                <th 
                  className="px-4 py-3 text-left text-sm font-medium text-slate-400 cursor-pointer hover:text-white"
                  onClick={() => handleSort('code')}
                >
                  <div className="flex items-center gap-1">
                    基金代码 <SortIcon field="code" />
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-sm font-medium text-slate-400 cursor-pointer hover:text-white"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-1">
                    基金名称 <SortIcon field="name" />
                  </div>
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-slate-400">场内价格</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-blue-400">实时估值</th>
                <th 
                  className="px-4 py-3 text-right text-sm font-medium text-blue-400 cursor-pointer hover:text-white"
                  onClick={() => handleSort('realtime_discount')}
                >
                  <div className="flex items-center justify-end gap-1">
                    实时折溢价 <SortIcon field="realtime_discount" />
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-right text-sm font-medium text-slate-500 cursor-pointer hover:text-white"
                  onClick={() => handleSort('t1_discount')}
                >
                  <div className="flex items-center justify-end gap-1">
                    T-1折溢价 <SortIcon field="t1_discount" />
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-right text-sm font-medium text-slate-400 cursor-pointer hover:text-white"
                  onClick={() => handleSort('change_pct')}
                >
                  <div className="flex items-center justify-end gap-1">
                    涨跌幅 <SortIcon field="change_pct" />
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-right text-sm font-medium text-slate-400 cursor-pointer hover:text-white"
                  onClick={() => handleSort('amount')}
                >
                  <div className="flex items-center justify-end gap-1">
                    成交额(万) <SortIcon field="amount" />
                  </div>
                </th>
                <th className="px-4 py-3 text-center text-sm font-medium text-slate-400">套利信号</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {sortedFunds.map((fund) => {
                const realtimeDiscount = fund.realtime_discount ?? 0;
                const isDiscount = realtimeDiscount < 0;
                const isPremium = realtimeDiscount > 0;

                return (
                  <tr
                    key={fund.code}
                    className="hover:bg-gray-800/30 transition-colors"
                  >
                    <td className="px-4 py-3 text-sm font-mono text-blue-400">{fund.code}</td>
                    <td className="px-4 py-3 text-sm text-white">{fund.name}</td>
                    <td className="px-4 py-3 text-sm text-right text-white">
                      {fund.price?.toFixed(4) ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-blue-400">
                      {fund.est_nav?.toFixed(4) ?? '-'}
                    </td>
                    <td className={`px-4 py-3 text-sm text-right font-semibold ${
                      isDiscount ? 'text-green-400' : isPremium ? 'text-red-400' : 'text-slate-400'
                    }`}>
                      {realtimeDiscount >= 0 ? '+' : ''}{realtimeDiscount.toFixed(2)}%
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-slate-500">
                      {fund.t1_discount !== null 
                        ? `${fund.t1_discount >= 0 ? '+' : ''}${fund.t1_discount.toFixed(2)}%` 
                        : '-'}
                    </td>
                    <td className={`px-4 py-3 text-sm text-right ${
                      (fund.change_pct ?? 0) >= 0 ? 'text-red-400' : 'text-green-400'
                    }`}>
                      {fund.change_pct !== null ? `${fund.change_pct >= 0 ? '+' : ''}${fund.change_pct}%` : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-slate-400">
                      {fund.amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-center">
                      {fund.signal_type ? (
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          fund.signal_type === '折价套利'
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {fund.signal_type}
                        </span>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-sm text-slate-500 px-2">
        共 {sortedFunds.length} 只基金 | 套利阈值: ±1.5%
      </div>
    </div>
  );
};
