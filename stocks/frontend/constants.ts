import { MetricConfig } from './types';

// 指标配置
export const METRIC_CONFIGS: Record<string, MetricConfig> = {
  // A股
  total_amount: {
    key: 'total_amount',
    name: '两市成交额',
    unit: '亿',
    color: '#3b82f6',
    description: '沪深两市总成交额，反映市场活跃度',
    higherIsBetter: true,
  },
  sh_index: {
    key: 'sh_index',
    name: '上证指数',
    unit: '点',
    color: '#ef4444',
    description: '上证综合指数收盘价',
    higherIsBetter: true,
  },
  sz_index: {
    key: 'sz_index',
    name: '深证成指',
    unit: '点',
    color: '#f97316',
    description: '深证成分指数收盘价',
    higherIsBetter: true,
  },
  
  // 港股
  hk_main: {
    key: 'hk_main',
    name: '恒生指数',
    unit: '点',
    color: '#10b981',
    description: '香港恒生指数',
    higherIsBetter: true,
  },
  hk_tech: {
    key: 'hk_tech',
    name: '恒生科技',
    unit: '点',
    color: '#06b6d4',
    description: '恒生科技指数',
    higherIsBetter: true,
  },
  
  // 资金流向
  north: {
    key: 'north',
    name: '北向资金',
    unit: '亿',
    color: '#ef4444',
    description: '北向资金净买入，外资流入A股',
    higherIsBetter: true,
  },
  south: {
    key: 'south',
    name: '南向资金',
    unit: '亿',
    color: '#10b981',
    description: '南向资金净买入，内资流入港股',
    higherIsBetter: true,
  },
  
  // 汇率
  usd_cny: {
    key: 'usd_cny',
    name: '美元/离岸人民币',
    unit: '',
    color: '#8b5cf6',
    description: '美元兑离岸人民币汇率',
    higherIsBetter: false,
  },
  
  // 美股
  nasdaq: {
    key: 'nasdaq',
    name: '纳指ETF(QQQ)',
    unit: '$',
    color: '#f59e0b',
    description: '纳斯达克100 ETF',
    higherIsBetter: true,
  },
  
  // 融资融券
  margin: {
    key: 'margin',
    name: '融资余额',
    unit: '亿',
    color: '#ec4899',
    description: '上交所融资余额，反映杠杆资金情绪',
    higherIsBetter: true,
  },
  
  // Shibor
  shibor_overnight: {
    key: 'shibor_overnight',
    name: 'Shibor隔夜',
    unit: '%',
    color: '#14b8a6',
    description: '银行间隔夜拆借利率',
    higherIsBetter: false,
  },
  
  // 国债
  cn_bond_10y: {
    key: 'cn_bond_10y',
    name: '中国10年国债',
    unit: '%',
    color: '#ef4444',
    description: '中国10年期国债收益率',
  },
  us_bond_10y: {
    key: 'us_bond_10y',
    name: '美国10年国债',
    unit: '%',
    color: '#3b82f6',
    description: '美国10年期国债收益率',
  },
  bond_spread: {
    key: 'bond_spread',
    name: '中美利差',
    unit: '%',
    color: '#f59e0b',
    description: '中国10年国债 - 美国10年国债',
  },
  
  // 资金流向
  main_net: {
    key: 'main_net',
    name: '主力净流入',
    unit: '亿',
    color: '#ef4444',
    description: '主力资金净流入',
    higherIsBetter: true,
  },
};

// 成交额阈值
export const AMOUNT_THRESHOLDS = {
  hot: 15000,      // 火爆
  active: 10000,   // 活跃
  normal: 8000,    // 正常
  cold: 6000,      // 冷清
};

// 北向资金阈值
export const NORTH_THRESHOLDS = {
  bigBuy: 100,     // 大幅买入
  buy: 50,         // 买入
  sell: -50,       // 卖出
  bigSell: -100,   // 大幅卖出
};
