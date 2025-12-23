import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { MacroDataPoint } from '../types';

interface GroupedMetricsProps {
  data: { [key: string]: MacroDataPoint[] };
  theme: string;
}

// 指标分组定义
const METRIC_GROUPS: { [groupName: string]: { icon: string; color: string; keys: string[] } } = {
  '经济增长': {
    icon: '📈',
    color: 'emerald',
    keys: ['gdp', 'pmi', 'retail_sales', 'real_estate_invest']
  },
  '通胀物价': {
    icon: '🔥',
    color: 'orange',
    keys: ['cpi', 'ppi']
  },
  '就业民生': {
    icon: '👥',
    color: 'blue',
    keys: ['unemployment', 'resident_leverage']
  },
  '货币流动性': {
    icon: '💧',
    color: 'cyan',
    keys: ['m1', 'm2', 'scissors', 'social_financing']
  },
  '利率成本': {
    icon: '🏦',
    color: 'purple',
    keys: ['lpr_1y', 'lpr_5y', 'cn_bond_10y', 'us_bond_10y', 'bond_spread']
  },
  '外部环境': {
    icon: '🌐',
    color: 'pink',
    keys: ['exports_yoy', 'usd_cny', 'fx_reserves', 'gold']
  },
  '市场估值': {
    icon: '📊',
    color: 'yellow',
    keys: ['sh_index', 'sh_index_pe', 'sh_index_pb', 'equity_risk_premium']
  }
};

// 指标名称映射
const METRIC_LABELS: { [key: string]: string } = {
  gdp: 'GDP增速',
  cpi: 'CPI',
  ppi: 'PPI',
  pmi: '制造业PMI',
  m1: 'M1增速',
  m2: 'M2增速',
  scissors: 'M1-M2剪刀差',
  social_financing: '社融规模',
  lpr_1y: 'LPR 1年',
  lpr_5y: 'LPR 5年',
  cn_bond_10y: '中国10年国债',
  us_bond_10y: '美国10年国债',
  bond_spread: '中美利差',
  usd_cny: '美元/人民币',
  exports_yoy: '出口同比',
  fx_reserves: '外汇储备',
  gold: '黄金价格',
  sh_index: '上证指数',
  sh_index_pe: '上证PE',
  sh_index_pb: '上证PB',
  retail_sales: '社零增速',
  real_estate_invest: '房地产景气',
  unemployment: '失业率',
  resident_leverage: '居民杠杆率',
  equity_risk_premium: '股权风险溢价'
};

// 指标单位映射
const METRIC_UNITS: { [key: string]: string } = {
  gdp: '%', cpi: '%', ppi: '%', pmi: '', m1: '%', m2: '%', scissors: '%',
  social_financing: '万亿', lpr_1y: '%', lpr_5y: '%', cn_bond_10y: '%',
  us_bond_10y: '%', bond_spread: 'bp', usd_cny: '', exports_yoy: '%',
  fx_reserves: '亿美元', gold: '美元/盎司', sh_index: '', sh_index_pe: '',
  sh_index_pb: '', retail_sales: '%', real_estate_invest: '', unemployment: '%',
  resident_leverage: '%', equity_risk_premium: '%'
};

export const GroupedMetrics: React.FC<GroupedMetricsProps> = ({ data, theme }) => {
  
  const getMetricInfo = (key: string) => {
    const series = data[key];
    if (!series || series.length < 2) return null;
    
    const latest = series[series.length - 1];
    const prev = series[series.length - 2];
    const change = latest.value - prev.value;
    const changePercent = prev.value !== 0 ? (change / Math.abs(prev.value)) * 100 : 0;
    
    return {
      value: latest.value,
      date: latest.date,
      change,
      changePercent
    };
  };

  const formatValue = (value: number, key: string) => {
    if (key === 'fx_reserves') return (value / 10000).toFixed(2);
    if (key === 'social_financing') return value.toFixed(2);
    if (key === 'bond_spread') return value.toFixed(0);
    if (['sh_index', 'gold'].includes(key)) return value.toFixed(0);
    return value.toFixed(2);
  };

  const getTrendIcon = (change: number, key: string) => {
    // 某些指标下降是好事
    const inverseMetrics = ['unemployment', 'resident_leverage', 'sh_index_pe', 'sh_index_pb', 'usd_cny'];
    const isInverse = inverseMetrics.includes(key);
    
    if (Math.abs(change) < 0.01) {
      return <Minus size={12} className="text-gray-500" />;
    }
    
    const isUp = change > 0;
    const isGood = isInverse ? !isUp : isUp;
    
    if (isUp) {
      return <TrendingUp size={12} className={isGood ? 'text-emerald-400' : 'text-red-400'} />;
    } else {
      return <TrendingDown size={12} className={isGood ? 'text-emerald-400' : 'text-red-400'} />;
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {Object.entries(METRIC_GROUPS).map(([groupName, group]) => {
        const validKeys = group.keys.filter(k => data[k] && data[k].length > 0);
        if (validKeys.length === 0) return null;

        return (
          <div 
            key={groupName}
            className={`bg-gray-900/60 border border-gray-800 rounded-lg p-3 hover:border-${group.color}-500/30 transition-colors`}
          >
            {/* Group Header */}
            <div className={`flex items-center gap-2 mb-3 pb-2 border-b border-gray-800`}>
              <span className="text-base">{group.icon}</span>
              <span className={`text-xs font-semibold text-${group.color}-400 uppercase tracking-wider`}>
                {groupName}
              </span>
            </div>

            {/* Metrics List */}
            <div className="space-y-2">
              {validKeys.map(key => {
                const info = getMetricInfo(key);
                if (!info) return null;

                return (
                  <div key={key} className="flex items-center justify-between text-xs">
                    <span className="text-gray-400 truncate flex-1 mr-2">
                      {METRIC_LABELS[key] || key}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-white font-mono font-medium">
                        {formatValue(info.value, key)}
                        <span className="text-gray-500 text-[10px] ml-0.5">
                          {METRIC_UNITS[key]}
                        </span>
                      </span>
                      {getTrendIcon(info.change, key)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
