import React, { useState, useMemo } from 'react';
import { LofFund } from '../types';
import { TrendingUp, TrendingDown, AlertCircle, Info, CheckCircle, XCircle, Droplets, ChevronUp, ChevronDown, Copy, Check, ExternalLink } from 'lucide-react';

interface OpportunityListProps {
  title: string;
  subtitle: string;
  funds: LofFund[];
}

// 基金类型颜色映射
const TYPE_COLORS: Record<string, string> = {
  'A股宽基': 'bg-blue-500/20 text-blue-400',
  'A股行业': 'bg-purple-500/20 text-purple-400',
  'QDII港股': 'bg-orange-500/20 text-orange-400',
  'QDII全球': 'bg-amber-500/20 text-amber-400',
  '商品原油': 'bg-red-500/20 text-red-400',
  '其他': 'bg-slate-500/20 text-slate-400',
};

// 外部链接
const EXTERNAL_LINKS = {
  tiantian: (code: string) => `https://fund.eastmoney.com/${code}.html`,
  jisilu: (code: string) => `https://www.jisilu.cn/data/lof/detail/${code}`,
};

// 最低成交额阈值（万元）
const MIN_AMOUNT = 500;

// 排序字段
type SortField = 'premium' | 'annualized' | 'maxProfit';
type SortOrder = 'asc' | 'desc';

// 可排序表头组件
const SortableHeader: React.FC<{
  field: SortField;
  currentField: SortField;
  currentOrder: SortOrder;
  onSort: (field: SortField) => void;
  children: React.ReactNode;
  className?: string;
  title?: string;
}> = ({ field, currentField, currentOrder, onSort, children, className = '', title }) => {
  const isActive = currentField === field;
  return (
    <th
      className={`px-3 py-3 text-sm font-medium cursor-pointer hover:bg-gray-700/50 transition-colors select-none ${className}`}
      onClick={() => onSort(field)}
      title={title}
    >
      <div className="flex items-center justify-end gap-1">
        <span className={isActive ? 'text-white' : ''}>{children}</span>
        <div className="flex flex-col -space-y-1">
          <ChevronUp 
            size={12} 
            className={isActive && currentOrder === 'asc' ? 'text-white' : 'text-slate-600'} 
          />
          <ChevronDown 
            size={12} 
            className={isActive && currentOrder === 'desc' ? 'text-white' : 'text-slate-600'} 
          />
        </div>
      </div>
    </th>
  );
};

export const OpportunityList: React.FC<OpportunityListProps> = ({
  title,
  subtitle,
  funds,
}) => {
  const [showOnlySubscribable, setShowOnlySubscribable] = useState(true);
  const [showOnlyLiquid, setShowOnlyLiquid] = useState(true);
  const [expandedFund, setExpandedFund] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('premium');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  
  // 切换排序
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // 同一字段切换升降序
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      // 新字段默认降序
      setSortField(field);
      setSortOrder('desc');
    }
  };
  
  // 复制代码到剪贴板
  const copyCode = (code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1500);
  };

  // 过滤并排序基金
  const filteredFunds = useMemo(() => {
    let result = funds;
    if (showOnlySubscribable) {
      result = result.filter(f => f.can_subscribe);
    }
    if (showOnlyLiquid) {
      result = result.filter(f => !f.low_liquidity);
    }
    
    // 排序
    const sorted = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'premium') {
        cmp = b.realtime_discount - a.realtime_discount;
      } else if (sortField === 'annualized') {
        cmp = b.annualized_return - a.annualized_return;
      } else if (sortField === 'maxProfit') {
        const profitA = a.can_subscribe && a.daily_limit && a.realtime_discount > 0
          ? a.daily_limit * a.realtime_discount / 100 : -1;
        const profitB = b.can_subscribe && b.daily_limit && b.realtime_discount > 0
          ? b.daily_limit * b.realtime_discount / 100 : -1;
        if (profitA === -1 && profitB === -1) cmp = b.realtime_discount - a.realtime_discount;
        else if (profitA === -1) cmp = 1;
        else if (profitB === -1) cmp = -1;
        else cmp = profitB - profitA;
      }
      return sortOrder === 'desc' ? cmp : -cmp;
    });
    return sorted;
  }, [funds, showOnlySubscribable, showOnlyLiquid, sortField, sortOrder]);
  
  // 统计
  const subscribableCount = funds.filter(f => f.can_subscribe).length;
  const unsubscribableCount = funds.length - subscribableCount;
  const liquidCount = funds.filter(f => !f.low_liquidity).length;
  const illiquidCount = funds.length - liquidCount;
  // 真正可套利：可申购 + 流动性足够
  const realArbitrageCount = funds.filter(f => 
    f.can_subscribe && !f.low_liquidity && f.arb_path.startsWith('in_to_out')
  ).length;

  if (funds.length === 0) {
    return (
      <div className="bg-gray-900/50 rounded-xl p-8 border border-gray-800 text-center">
        <AlertCircle className="mx-auto mb-4 text-slate-500" size={48} />
        <h3 className="text-lg font-medium text-slate-400">暂无{title}</h3>
        <p className="text-sm text-slate-500 mt-2">
          当前市场没有符合条件的溢价套利机会（各类型阈值不同）
        </p>
      </div>
    );
  }

  // 按基金类型分组统计
  const typeStats = filteredFunds.reduce((acc, fund) => {
    const type = fund.fund_type || '其他';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-4">
      <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/20">
        <div className="flex items-center gap-2">
          <TrendingUp className="text-red-400" size={20} />
          <h2 className="text-lg font-semibold text-red-400">{title}</h2>
          <span className="ml-auto px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-sm font-bold">
            经典套利: {realArbitrageCount} 只
          </span>
        </div>
        <p className="text-sm text-slate-400 mt-1">{subtitle}</p>
      </div>

      {/* 筛选条件统计 */}
      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
        <div className="text-sm text-slate-300 font-medium mb-3">📌 套利条件筛选</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* 可申购 */}
          <button
            onClick={() => setShowOnlySubscribable(!showOnlySubscribable)}
            className={`flex items-center gap-2 p-3 rounded-lg transition-colors ${
              showOnlySubscribable 
                ? 'bg-green-500/20 border border-green-500/30' 
                : 'bg-slate-700/50 border border-slate-600'
            }`}
          >
            <CheckCircle className={showOnlySubscribable ? 'text-green-400' : 'text-slate-500'} size={20} />
            <div className="text-left">
              <div className={`text-lg font-bold ${showOnlySubscribable ? 'text-green-400' : 'text-slate-400'}`}>
                {subscribableCount}
              </div>
              <div className="text-xs text-slate-500">可申购</div>
            </div>
          </button>
          
          {/* 暂停申购 */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <XCircle className="text-red-400" size={20} />
            <div className="text-left">
              <div className="text-lg font-bold text-red-400">{unsubscribableCount}</div>
              <div className="text-xs text-red-400/70">暂停申购</div>
            </div>
          </div>
          
          {/* 流动性足够 */}
          <button
            onClick={() => setShowOnlyLiquid(!showOnlyLiquid)}
            className={`flex items-center gap-2 p-3 rounded-lg transition-colors ${
              showOnlyLiquid 
                ? 'bg-blue-500/20 border border-blue-500/30' 
                : 'bg-slate-700/50 border border-slate-600'
            }`}
          >
            <Droplets className={showOnlyLiquid ? 'text-blue-400' : 'text-slate-500'} size={20} />
            <div className="text-left">
              <div className={`text-lg font-bold ${showOnlyLiquid ? 'text-blue-400' : 'text-slate-400'}`}>
                {liquidCount}
              </div>
              <div className="text-xs text-slate-500">流动性足</div>
            </div>
          </button>
          
          {/* 流动性不足 */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <AlertCircle className="text-amber-400" size={20} />
            <div className="text-left">
              <div className="text-lg font-bold text-amber-400">{illiquidCount}</div>
              <div className="text-xs text-amber-400/70">&lt;{MIN_AMOUNT}万</div>
            </div>
          </div>
        </div>
        
        <div className="mt-3 text-xs text-slate-500">
          点击按钮切换筛选
        </div>
      </div>

      {/* 阈值说明 */}
      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
        <div className="text-sm text-slate-300 font-medium mb-2">📊 分类阈值 & 结算周期</div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">A股宽基</span>
            <span className="text-slate-400">≥1% T+2</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-400">A股行业</span>
            <span className="text-slate-400">≥1.5% T+2</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-orange-500/20 text-orange-400">QDII港股</span>
            <span className="text-slate-400">≥3% T+3</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400">QDII全球</span>
            <span className="text-slate-400">≥4% T+4</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400">商品原油</span>
            <span className="text-slate-400">≥5% T+3</span>
          </div>
        </div>
      </div>

      {/* 类型分布 */}
      {Object.keys(typeStats).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(typeStats).map(([type, count]) => (
            <span key={type} className={`px-3 py-1 rounded-full text-sm ${TYPE_COLORS[type] || TYPE_COLORS['其他']}`}>
              {type}: {count}只
            </span>
          ))}
        </div>
      )}

      {/* 数据说明 */}
      <div className="flex items-center gap-2 text-xs text-slate-500 px-2">
        <Info size={14} />
        <span>折溢价率基于【盘中实时估值】| 点击行展开详情</span>
      </div>

      {filteredFunds.length === 0 ? (
        <div className="bg-gray-900/50 rounded-xl p-8 border border-gray-800 text-center">
          <AlertCircle className="mx-auto mb-4 text-amber-500" size={48} />
          <h3 className="text-lg font-medium text-amber-400">暂无符合条件的套利机会</h3>
          <p className="text-sm text-slate-500 mt-2">
            当前筛选条件下没有可套利的基金
          </p>
          <div className="mt-4 flex gap-2 justify-center flex-wrap">
            {showOnlySubscribable && (
              <button
                onClick={() => setShowOnlySubscribable(false)}
                className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg text-sm hover:bg-slate-600 transition-colors"
              >
                显示暂停申购
              </button>
            )}
            {showOnlyLiquid && (
              <button
                onClick={() => setShowOnlyLiquid(false)}
                className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg text-sm hover:bg-slate-600 transition-colors"
              >
                显示低流动性
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-800/50">
                  <th className="px-3 py-3 text-left text-sm font-medium text-slate-400">代码</th>
                  <th className="px-3 py-3 text-left text-sm font-medium text-slate-400">名称</th>
                  <SortableHeader
                    field="premium"
                    currentField={sortField}
                    currentOrder={sortOrder}
                    onSort={handleSort}
                    className="text-red-400"
                    title="点击排序"
                  >
                    溢价率
                  </SortableHeader>
                  <th className="px-3 py-3 text-right text-sm font-medium text-slate-400">场内价</th>
                  <th className="px-3 py-3 text-right text-sm font-medium text-slate-400">估值</th>
                  <th className="px-3 py-3 text-right text-sm font-medium text-slate-400">成交额</th>
                  <th className="px-3 py-3 text-center text-sm font-medium text-slate-400">申购</th>
                  <th className="px-3 py-3 text-right text-sm font-medium text-slate-400">
                    <span title="单日申购限额">限额</span>
                  </th>
                  <SortableHeader
                    field="maxProfit"
                    currentField={sortField}
                    currentOrder={sortOrder}
                    onSort={handleSort}
                    className="text-yellow-400"
                    title="限额 × 溢价率，点击排序"
                  >
                    预期最大收入
                  </SortableHeader>
                  <th className="px-3 py-3 text-center text-sm font-medium text-slate-400">T+N</th>
                  <SortableHeader
                    field="annualized"
                    currentField={sortField}
                    currentOrder={sortOrder}
                    onSort={handleSort}
                    className="text-green-400"
                    title="溢价率 ÷ 结算天数 × 365，点击排序"
                  >
                    年化
                  </SortableHeader>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredFunds.map((fund) => {
                  const hasIssue = !fund.can_subscribe || fund.low_liquidity;
                  const isExpanded = expandedFund === fund.code;
                  // 限额信息（单位：元）
                  const hasLimit = fund.subscribe_status === '限大额';
                  const dailyLimit = fund.daily_limit;  // 单位：元
                  // 计算最大收入：限额（元）× 溢价率 / 100
                  // 如果没有限额或不可申购，显示"-"
                  const maxProfit = (fund.can_subscribe && dailyLimit && fund.realtime_discount > 0)
                    ? dailyLimit * fund.realtime_discount / 100
                    : null;
                  
                  // 溢价变化趋势（实时溢价 vs T-1溢价）
                  const discountChange = fund.t1_discount !== null 
                    ? fund.realtime_discount - fund.t1_discount 
                    : null;
                  
                  // 格式化限额显示
                  const formatLimit = (limit: number) => {
                    if (limit >= 100000000) return `${(limit / 100000000).toFixed(0)}亿`;
                    if (limit >= 10000) return `${(limit / 10000).toFixed(0)}万`;
                    return `${limit}元`;
                  };
                  
                  // 格式化收入显示
                  const formatProfit = (profit: number) => {
                    if (profit >= 10000) return `${(profit / 10000).toFixed(2)}万`;
                    if (profit >= 1) return `${profit.toFixed(0)}元`;
                    return `${(profit * 100).toFixed(1)}分`;
                  };
                  
                  return (
                    <React.Fragment key={fund.code}>
                      <tr
                        className={`hover:bg-gray-800/30 transition-colors cursor-pointer ${hasIssue ? 'opacity-70' : ''}`}
                        onClick={() => setExpandedFund(isExpanded ? null : fund.code)}
                      >
                        <td className="px-3 py-3 text-sm font-mono text-blue-400">
                          <div className="flex items-center gap-1">
                            <span>{fund.code}</span>
                            <button
                              onClick={(e) => copyCode(fund.code, e)}
                              className="p-1 rounded hover:bg-slate-700 transition-colors"
                              title="复制代码"
                            >
                              {copiedCode === fund.code ? (
                                <Check size={12} className="text-green-400" />
                              ) : (
                                <Copy size={12} className="text-slate-500 hover:text-slate-300" />
                              )}
                            </button>
                            <div className="relative group">
                              <button
                                onClick={(e) => e.stopPropagation()}
                                className="p-1 rounded hover:bg-slate-700 transition-colors"
                                title="查看详情"
                              >
                                <ExternalLink size={12} className="text-slate-500 hover:text-slate-300" />
                              </button>
                              <div className="absolute left-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[100px]">
                                <a
                                  href={EXTERNAL_LINKS.tiantian(fund.code)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="block px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 rounded-t-lg"
                                >
                                  天天基金
                                </a>
                                <a
                                  href={EXTERNAL_LINKS.jisilu(fund.code)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="block px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 rounded-b-lg"
                                >
                                  集思录
                                </a>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-sm text-white">
                          <div className="flex items-center gap-2">
                            <span className="truncate max-w-[120px]" title={fund.name}>{fund.name}</span>
                            <span className={`px-1.5 py-0.5 rounded text-xs whitespace-nowrap ${TYPE_COLORS[fund.fund_type] || TYPE_COLORS['其他']}`}>
                              {fund.fund_type}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-sm text-right">
                          <div className="flex flex-col items-end">
                            <span className="font-bold text-red-400">+{fund.realtime_discount}%</span>
                            {discountChange !== null && (
                              <span 
                                className={`flex items-center text-xs ${
                                  discountChange > 0 ? 'text-red-400' : 
                                  discountChange < 0 ? 'text-green-400' : 'text-slate-500'
                                }`}
                                title={`相比昨日${discountChange > 0 ? '扩大' : discountChange < 0 ? '收窄' : '持平'}${Math.abs(discountChange).toFixed(2)}%`}
                              >
                                {discountChange > 0 ? (
                                  <><TrendingUp size={10} className="mr-0.5" />+{discountChange.toFixed(2)}</>
                                ) : discountChange < 0 ? (
                                  <><TrendingDown size={10} className="mr-0.5" />{discountChange.toFixed(2)}</>
                                ) : (
                                  <span className="text-slate-500">±0</span>
                                )}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-sm text-right text-white font-mono">
                          {fund.price?.toFixed(3)}
                        </td>
                        <td className="px-3 py-3 text-sm text-right text-blue-400 font-mono">
                          {fund.est_nav?.toFixed(3)}
                        </td>
                        <td className="px-3 py-3 text-sm text-right">
                          <span className={fund.low_liquidity ? 'text-amber-400' : 'text-slate-400'}>
                            {fund.amount >= 10000 
                              ? `${(fund.amount / 10000).toFixed(1)}亿` 
                              : `${fund.amount.toFixed(0)}万`}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-sm text-center">
                          {fund.can_subscribe ? (
                            <span className="text-green-400">✓</span>
                          ) : (
                            <span className="text-red-400">✗</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-sm text-right">
                          {dailyLimit ? (
                            <span className={hasLimit ? 'text-amber-400' : 'text-slate-400'} title={`限额${dailyLimit}元`}>
                              {formatLimit(dailyLimit)}
                            </span>
                          ) : fund.can_subscribe ? (
                            <span className="text-green-400/70" title="无限额">无限</span>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-sm text-right">
                          {maxProfit !== null ? (
                            <span className="text-yellow-400 font-semibold cursor-help" title={`${formatLimit(dailyLimit!)} × ${fund.realtime_discount}% = ${formatProfit(maxProfit)}`}>
                              {formatProfit(maxProfit)}
                            </span>
                          ) : fund.can_subscribe && !dailyLimit ? (
                            <span className="text-green-400/70" title="无限额，收入取决于投入本金">∞</span>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-sm text-center text-slate-400">
                          T+{fund.settlement_days}
                        </td>
                        <td className="px-3 py-3 text-sm text-right font-semibold text-green-400 cursor-help" 
                            title={fund.annualized_return > 0 ? `${fund.realtime_discount}% ÷ ${fund.settlement_days}天 × 365 = ${fund.annualized_return}%` : ''}>
                          {fund.annualized_return > 0 ? `${fund.annualized_return}%` : '-'}
                        </td>
                      </tr>
                      {/* 展开详情 */}
                      {isExpanded && (
                        <tr className="bg-slate-800/30">
                          <td colSpan={11} className="px-4 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* 左侧：基本信息 */}
                              <div className="space-y-3">
                                <div className="text-sm font-medium text-slate-300">📊 详细信息</div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div className="flex justify-between">
                                    <span className="text-slate-500">场内价格:</span>
                                    <span className="text-white">{fund.price?.toFixed(4)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-500">实时估值:</span>
                                    <span className="text-blue-400">{fund.est_nav?.toFixed(4)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-500">T-1净值:</span>
                                    <span className="text-slate-400">{fund.prev_nav?.toFixed(4) || '-'}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-500">今日涨跌:</span>
                                    <span className={fund.change_pct && fund.change_pct > 0 ? 'text-red-400' : 'text-green-400'}>
                                      {fund.change_pct ? `${fund.change_pct > 0 ? '+' : ''}${fund.change_pct}%` : '-'}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-500">申购状态:</span>
                                    <span className={fund.can_subscribe ? 'text-green-400' : 'text-red-400'}>
                                      {fund.subscribe_status}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-500">赎回状态:</span>
                                    <span className="text-slate-400">{fund.redeem_status || '-'}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-500">套利阈值:</span>
                                    <span className="text-slate-400">≥{fund.threshold}%</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-500">换手率:</span>
                                    <span className="text-slate-400">{fund.turnover_rate ? `${fund.turnover_rate}%` : '-'}</span>
                                  </div>
                                </div>
                              </div>
                              
                              {/* 右侧：操作提示 */}
                              <div className="space-y-3">
                                <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                                  <div className="text-xs text-slate-500 mb-2">💡 套利操作步骤</div>
                                  <div className="text-xs text-slate-400 space-y-1">
                                    {fund.can_subscribe ? (
                                      <>
                                        <div>1. 场外申购 {fund.code}（按当日收盘净值确认份额）</div>
                                        <div>2. 等待份额确认（T+1）</div>
                                        <div>3. 办理跨系统转托管（场外→场内）</div>
                                        <div>4. T+{fund.settlement_days} 后场内按市价卖出</div>
                                        <div className="pt-2 border-t border-slate-700 mt-2 space-y-2">
                                          <div>
                                            <span className="text-slate-500">预期年化: </span>
                                            <span className="text-green-400 font-semibold">{fund.annualized_return}%</span>
                                            <span className="text-slate-600 text-[10px] ml-2">
                                              （{fund.realtime_discount}% ÷ {fund.settlement_days}天 × 365）
                                            </span>
                                          </div>
                                          {dailyLimit ? (
                                            <div>
                                              <span className="text-slate-500">预期最大收入: </span>
                                              <span className="text-yellow-400 font-bold">
                                                {maxProfit !== null && formatProfit(maxProfit)}
                                              </span>
                                              <span className="text-slate-600 text-[10px] ml-2">
                                                （{formatLimit(dailyLimit)} × {fund.realtime_discount}%）
                                              </span>
                                            </div>
                                          ) : (
                                            <div>
                                              <span className="text-slate-500">申购限额: </span>
                                              <span className="text-green-400">无限制</span>
                                              <span className="text-slate-600 text-[10px] ml-2">
                                                （收入 = 本金 × {fund.realtime_discount}%）
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      </>
                                    ) : (
                                      <div className="text-amber-400">
                                        ⚠️ 该基金暂停申购，无法进行套利操作
                                      </div>
                                    )}
                                  </div>
                                </div>
                                
                                {fund.risk_notes && fund.risk_notes.length > 0 && (
                                  <div className="text-xs text-slate-500">
                                    {fund.risk_notes.map((note, idx) => (
                                      <div key={idx}>{note}</div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="text-sm text-slate-500 px-2">
        显示 {filteredFunds.length} 只基金（共 {funds.length} 只溢价）| 按溢价率排序
      </div>
    </div>
  );
};
