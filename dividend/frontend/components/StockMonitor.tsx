import React, { useState, useMemo } from 'react';
import { ChevronDown, TrendingDown, HelpCircle, Shield, AlertTriangle, CheckCircle, XCircle, Search } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TimeRange } from '../types';

// 类型定义
interface ScoreItem {
  score: number;
  level: 'gold' | 'good' | 'warn' | 'bad' | 'unknown';
  text: string;
}

interface StockScores {
  valuation: {
    spread: ScoreItem;
    pb: ScoreItem;
  };
  dividend_ability: {
    payout_ratio: ScoreItem;
    dividend_years: ScoreItem;
  };
  asset_quality: {
    roe: ScoreItem;
    industry: ScoreItem;
  };
}

interface StockMetrics {
  dividend_yield: number | null;  // TTM股息率
  spread: number | null;
  pb: number | null;
  payout_ratio: number | null;
  dividend_years: number;
  roe: number | null;
}

interface StockData {
  code: string;
  name: string;
  industry: string;
  type: string;
  price: number | null;
  metrics: StockMetrics;
  scores: StockScores;
  total_score: number;
  pb_history: { date: string; value: number }[];
  dividend_yield_history: { date: string; value: number }[];
  price_history: { date: string; value: number }[];
}

interface StocksDataType {
  generated_at: string;
  bond_yield: number;
  stocks: StockData[];
}

// 名词解释
const GLOSSARY: Record<string, string> = {
  '股债息差': '股息率 - 国债收益率。差值 > 3% 极佳，> 2% 良好，< 1% 没必要冒险买股票。',
  '市净率': '股价 / 每股净资产。PB < 0.8 极低（银行/能源），> 1.5 偏贵。',
  '支付率': '分红 / 净利润。30%-70% 健康，> 90% 不可持续，< 10% 铁公鸡。',
  '分红年数': '连续分红年数。> 10年优秀，> 5年良好，< 3年需警惕。',
  'ROE': '净资产收益率。> 15% 优秀，> 10% 良好，< 6% 资产质量差。',
  '行业': '稳定型（公用事业/金融）优于强周期（航运/化工/养猪）。',
};

// 评分等级颜色
const LEVEL_COLORS: Record<string, string> = {
  gold: 'text-green-400 bg-green-500/10 border-green-500/30',
  good: 'text-lime-400 bg-lime-500/10 border-lime-500/30',
  warn: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  bad: 'text-red-400 bg-red-500/10 border-red-500/30',
  unknown: 'text-slate-400 bg-slate-500/10 border-slate-500/30',
};

const LEVEL_ICONS: Record<string, React.ReactNode> = {
  gold: <CheckCircle size={14} className="text-green-400" />,
  good: <CheckCircle size={14} className="text-lime-400" />,
  warn: <AlertTriangle size={14} className="text-yellow-400" />,
  bad: <XCircle size={14} className="text-red-400" />,
  unknown: <HelpCircle size={14} className="text-slate-400" />,
};

// 指标卡片组件
const MetricBadge: React.FC<{ item: ScoreItem; label: string }> = ({ item, label }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltip = GLOSSARY[label];
  
  return (
    <div className="relative group">
      <div 
        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs ${LEVEL_COLORS[item.level]} cursor-help`}
        onClick={() => tooltip && setShowTooltip(!showTooltip)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {LEVEL_ICONS[item.level]}
        <span className="font-medium">{label}</span>
        <span className="opacity-70">{item.text}</span>
      </div>
      {tooltip && (
        <div className={`absolute z-50 bottom-full left-0 mb-2 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg shadow-xl transition-all duration-200 w-56 pointer-events-none ${
          showTooltip ? 'opacity-100 visible' : 'opacity-0 invisible group-hover:opacity-100 group-hover:visible'
        }`}>
          <div className="text-xs text-slate-300 leading-relaxed">{tooltip}</div>
          <div className="absolute top-full left-4 border-8 border-transparent border-t-slate-800"></div>
        </div>
      )}
    </div>
  );
};

// 根据时间范围过滤数据
const filterDataByTimeRange = (data: { date: string; value: number }[], timeRange: TimeRange): { date: string; value: number }[] => {
  if (!data || data.length === 0) return data;
  
  const now = new Date();
  let startDate: Date;
  
  switch (timeRange) {
    case '1年':
      startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      break;
    case '2年':
      startDate = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
      break;
    case '5年':
      startDate = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());
      break;
    case '全部':
    default:
      return data;
  }
  
  return data.filter(item => new Date(item.date) >= startDate);
};

// 历史折线图组件
const HistoryChart: React.FC<{ data: { date: string; value: number }[]; title: string; color: string; timeRange: TimeRange }> = ({ data, title, color, timeRange }) => {
  const filteredData = useMemo(() => filterDataByTimeRange(data, timeRange), [data, timeRange]);
  
  if (!filteredData || filteredData.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center text-slate-500 text-xs">
        暂无历史数据
      </div>
    );
  }

  // 格式化日期显示
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  // 计算统计值
  const values = filteredData.map(d => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const current = values[values.length - 1];

  return (
    <div className="bg-slate-800/30 rounded-lg p-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0 mb-2">
        <span className="text-xs text-slate-400">{title}</span>
        <div className="flex items-center gap-2 sm:gap-3 text-xs flex-wrap">
          <span className="text-slate-500">低: <span className="text-green-400">{min.toFixed(2)}</span></span>
          <span className="text-slate-500 hidden sm:inline">均: <span className="text-slate-300">{avg.toFixed(2)}</span></span>
          <span className="text-slate-500">高: <span className="text-red-400">{max.toFixed(2)}</span></span>
          <span className="text-slate-500">现: <span style={{ color }}>{current.toFixed(2)}</span></span>
        </div>
      </div>
      <div className="h-28">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={filteredData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis 
              dataKey="date" 
              tickFormatter={formatDate}
              tick={{ fill: '#64748b', fontSize: 10 }}
              axisLine={{ stroke: '#475569' }}
              tickLine={{ stroke: '#475569' }}
              interval="preserveStartEnd"
            />
            <YAxis 
              domain={['auto', 'auto']}
              tick={{ fill: '#64748b', fontSize: 10 }}
              axisLine={{ stroke: '#475569' }}
              tickLine={{ stroke: '#475569' }}
              width={35}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #475569',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              labelFormatter={(label) => `日期: ${label}`}
              formatter={(value: number) => [value.toFixed(2), title]}
            />
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke={color}
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 4, fill: color }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// 股票卡片组件
const StockCard: React.FC<{ stock: StockData; rank: number; timeRange: TimeRange }> = ({ stock, rank, timeRange }) => {
  const [expanded, setExpanded] = useState(false);
  const { metrics, scores } = stock;
  
  // 总分颜色
  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-green-400';
    if (score >= 70) return 'text-lime-400';
    if (score >= 55) return 'text-yellow-400';
    return 'text-red-400';
  };
  
  // 排名徽章
  const getRankBadge = (rank: number) => {
    if (rank === 1) return 'bg-amber-500 text-white';
    if (rank === 2) return 'bg-slate-400 text-white';
    if (rank === 3) return 'bg-amber-700 text-white';
    return 'bg-slate-700 text-slate-300';
  };
  
  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden hover:border-slate-700 transition-colors">
      {/* 头部 */}
      <div 
        className="p-4 cursor-pointer select-none active:bg-slate-800/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* 排名 */}
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${getRankBadge(rank)}`}>
              {rank}
            </div>
            {/* 名称 */}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-white font-semibold truncate">{stock.name}</span>
                <span className="text-xs text-slate-500 hidden sm:inline">{stock.code}</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs px-1.5 py-0.5 bg-slate-800 rounded text-slate-400">{stock.industry}</span>
                {stock.price && (
                  <span className="text-xs text-slate-500 hidden sm:inline">¥{stock.price.toFixed(2)}</span>
                )}
              </div>
            </div>
          </div>
          
          {/* 核心指标 */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* TTM股息率 */}
            <div className="text-right">
              <div className="text-xs text-slate-500 hidden sm:block">TTM股息率</div>
              <div className="text-amber-400 font-bold text-sm sm:text-base">
                {metrics.dividend_yield !== null ? `${metrics.dividend_yield.toFixed(2)}%` : 'N/A'}
              </div>
            </div>

            {/* 股债息差 - 小屏隐藏 */}
            <div className="text-right hidden lg:block">
              <div className="text-xs text-slate-500">息差</div>
              <div className={`font-bold ${
                metrics.spread !== null 
                  ? metrics.spread >= 2 ? 'text-green-400' : metrics.spread >= 1 ? 'text-lime-400' : 'text-yellow-400'
                  : 'text-slate-500'
              }`}>
                {metrics.spread !== null ? `${metrics.spread.toFixed(2)}%` : 'N/A'}
              </div>
            </div>
            {/* PB */}
            <div className="text-right">
              <div className="text-xs text-slate-500 hidden sm:block">PB</div>
              <div className={`font-bold text-sm sm:text-base ${
                metrics.pb !== null
                  ? metrics.pb <= 0.8 ? 'text-green-400' : metrics.pb <= 1.0 ? 'text-lime-400' : 'text-yellow-400'
                  : 'text-slate-500'
              }`}>
                {metrics.pb !== null ? metrics.pb.toFixed(2) : 'N/A'}
              </div>
            </div>
            {/* 总分 */}
            <div className="text-right min-w-[50px] sm:min-w-[60px]">
              <div className="text-xs text-slate-500 hidden sm:block">总分</div>
              <div className={`text-lg sm:text-xl font-bold ${getScoreColor(stock.total_score)}`}>
                {stock.total_score.toFixed(0)}
              </div>
            </div>
            {/* 展开按钮 */}
            <div className={`text-slate-500 shrink-0 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}>
              <ChevronDown size={20} />
            </div>
          </div>
        </div>
      </div>
      
      {/* 展开详情 - 带动画 */}
      <div 
        className={`grid transition-all duration-300 ease-in-out ${
          expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4 border-t border-slate-800/50 pt-4">
          {/* 三组指标 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 第一组：估值 */}
            <div className="bg-slate-800/30 rounded-lg p-3">
              <div className="flex items-center gap-2 text-slate-400 text-xs mb-3">
                <TrendingDown size={14} />
                能不能买（估值）
              </div>
              <div className="space-y-2">
                <MetricBadge item={scores.valuation.spread} label="股债息差" />
                <MetricBadge item={scores.valuation.pb} label="市净率" />
              </div>
            </div>
            
            {/* 第二组：分红能力 */}
            <div className="bg-slate-800/30 rounded-lg p-3">
              <div className="flex items-center gap-2 text-slate-400 text-xs mb-3">
                <Shield size={14} />
                安不安全（分红能力）
              </div>
              <div className="space-y-2">
                <MetricBadge item={scores.dividend_ability.payout_ratio} label="支付率" />
                <MetricBadge item={scores.dividend_ability.dividend_years} label="分红年数" />
              </div>
            </div>
            
            {/* 第三组：资产质量 */}
            <div className="bg-slate-800/30 rounded-lg p-3">
              <div className="flex items-center gap-2 text-slate-400 text-xs mb-3">
                <AlertTriangle size={14} />
                会不会坑（资产质量）
              </div>
              <div className="space-y-2">
                <MetricBadge item={scores.asset_quality.roe} label="ROE" />
                <MetricBadge item={scores.asset_quality.industry} label="行业" />
              </div>
            </div>
          </div>
          
          {/* 历史走势图 */}
          <div className="mt-4">
            <div className="text-xs text-slate-400 mb-3">📈 历史走势（{timeRange}）</div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <HistoryChart 
                data={stock.dividend_yield_history} 
                title="TTM股息率 (%)" 
                color="#f59e0b"
                timeRange={timeRange}
              />
              <HistoryChart 
                data={stock.pb_history} 
                title="市净率 (PB)" 
                color="#22d3ee"
                timeRange={timeRange}
              />
              <HistoryChart 
                data={stock.price_history} 
                title="股价 (元)" 
                color="#a78bfa"
                timeRange={timeRange}
              />
            </div>
          </div>
          
          {/* 买入建议 */}
          <div className="mt-4 p-3 bg-slate-800/20 rounded-lg">
            <div className="text-xs text-slate-400 mb-2">📊 综合评估</div>
            <div className="text-sm text-slate-300">
              {stock.total_score >= 85 ? (
                <span className="text-green-400">✅ 各项指标优秀，可重点关注</span>
              ) : stock.total_score >= 70 ? (
                <span className="text-lime-400">👍 整体表现良好，可适当配置</span>
              ) : stock.total_score >= 55 ? (
                <span className="text-yellow-400">⚠️ 部分指标一般，需谨慎评估</span>
              ) : (
                <span className="text-red-400">❌ 多项指标不佳，建议观望</span>
              )}
              {metrics.spread !== null && metrics.spread >= 3 && (
                <span className="ml-2 text-green-400">| 息差极佳</span>
              )}
              {metrics.pb !== null && metrics.pb <= 0.7 && (
                <span className="ml-2 text-green-400">| PB极低</span>
              )}
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// 主组件
interface Props {
  data: StocksDataType;
  timeRange: TimeRange;
}

export const StockMonitor: React.FC<Props> = ({ data, timeRange }) => {
  const [sortBy, setSortBy] = useState<'score' | 'spread' | 'pb' | 'yield'>('score');
  const [filterIndustry, setFilterIndustry] = useState<string>('all');
  
  // 获取行业列表（使用 useMemo 缓存）
  const industries = useMemo(() => 
    ['all', ...new Set(data.stocks.map(s => s.industry))],
    [data.stocks]
  );
  
  // 排序和筛选（使用 useMemo 优化）
  const sortedStocks = useMemo(() => {
    return [...data.stocks]
      .filter(s => filterIndustry === 'all' || s.industry === filterIndustry)
      .sort((a, b) => {
        switch (sortBy) {
          case 'spread':
            return (b.metrics.spread || -999) - (a.metrics.spread || -999);
          case 'pb':
            return (a.metrics.pb || 999) - (b.metrics.pb || 999);
          case 'yield':
            return (b.metrics.dividend_yield || 0) - (a.metrics.dividend_yield || 0);
          default:
            return b.total_score - a.total_score;
        }
      });
  }, [data.stocks, filterIndustry, sortBy]);
  
  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
      {/* 标题栏 */}
      <div className="px-4 py-3 border-b border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            📈 红利股监控面板
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            更新时间：{data.generated_at} | 国债收益率：{data.bond_yield}%
          </p>
        </div>
        
        {/* 筛选和排序 */}
        <div className="flex items-center gap-3">
          {/* 行业筛选 */}
          <select
            value={filterIndustry}
            onChange={(e) => setFilterIndustry(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-amber-500/50"
          >
            {industries.map(ind => (
              <option key={ind} value={ind}>
                {ind === 'all' ? '全部行业' : ind}
              </option>
            ))}
          </select>
          
          {/* 排序 */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-amber-500/50"
          >
            <option value="score">按总分</option>
            <option value="spread">按息差</option>
            <option value="pb">按PB</option>
            <option value="yield">按股息率</option>
          </select>
        </div>
      </div>
      
      {/* 指标说明 */}
      <div className="px-4 py-2 bg-slate-800/30 border-b border-slate-800/50">
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="text-slate-500">评分标准：</span>
          <span className="flex items-center gap-1">
            <CheckCircle size={12} className="text-green-400" />
            <span className="text-green-400">极佳</span>
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle size={12} className="text-lime-400" />
            <span className="text-lime-400">良好</span>
          </span>
          <span className="flex items-center gap-1">
            <AlertTriangle size={12} className="text-yellow-400" />
            <span className="text-yellow-400">一般</span>
          </span>
          <span className="flex items-center gap-1">
            <XCircle size={12} className="text-red-400" />
            <span className="text-red-400">警戒</span>
          </span>
        </div>
      </div>
      
      {/* 股票列表 */}
      <div className="p-4 space-y-3">
        {sortedStocks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <Search size={40} className="mb-3 opacity-50" />
            <p className="text-sm">没有找到符合条件的股票</p>
            <button 
              onClick={() => setFilterIndustry('all')}
              className="mt-2 text-xs text-amber-500 hover:text-amber-400 transition-colors"
            >
              清除筛选条件
            </button>
          </div>
        ) : (
          sortedStocks.map((stock, index) => (
            <StockCard 
              key={stock.code} 
              stock={stock} 
              rank={index + 1}
              timeRange={timeRange}
            />
          ))
        )}
      </div>
    </div>
  );
};
