// A股数据点
export interface AShareDataPoint {
  date: string;
  total_amount_yi: number;  // 两市成交额(亿)
  sh_close: number;         // 上证收盘
  sz_close: number;         // 深证收盘
}

// 港股指数数据点
export interface HKIndexDataPoint {
  date: string;
  amount_yi: number;  // 成交额(亿)
  close: number;      // 收盘价
}

// 资金流向数据点
export interface FundFlowDataPoint {
  date: string;
  net_inflow_yi: number;  // 净流入(亿)
}

// 汇率数据点
export interface RateDataPoint {
  date: string;
  rate: number;
}

// 纳斯达克数据点
export interface NasdaqDataPoint {
  date: string;
  close: number;
}

// 融资融券数据点
export interface MarginDataPoint {
  date: string;
  margin_balance_yi: number;  // 融资余额(亿)
  total_balance_yi: number;   // 融资融券余额(亿)
}

// Shibor数据点
export interface ShiborDataPoint {
  date: string;
  overnight: number;  // 隔夜
  week_1: number;     // 1周
  month_1: number;    // 1月
}

// 国债收益率数据点
export interface BondDataPoint {
  date: string;
  cn_10y: number;   // 中国10年期
  us_10y: number;   // 美国10年期
  spread: number;   // 利差
}

// 市场资金流向数据点
export interface MarketFundFlowDataPoint {
  date: string;
  main_net_yi: number;   // 主力净流入(亿)
  main_pct: number;      // 主力净占比(%)
  super_net_yi: number;  // 超大单净流入(亿)
}

// 完整市场数据
export interface MarketData {
  meta: {
    updated_at: string;
    desc: string;
  };
  data: {
    a_share: AShareDataPoint[];
    hk_main: HKIndexDataPoint[];
    hk_tech: HKIndexDataPoint[];
    north: FundFlowDataPoint[];
    south: FundFlowDataPoint[];
    rate: RateDataPoint[];
    nasdaq: NasdaqDataPoint[];
    margin: MarginDataPoint[];
    shibor: ShiborDataPoint[];
    bond: BondDataPoint[];
    fund_flow: MarketFundFlowDataPoint[];
  };
}

// 图表通用数据点
export interface ChartDataPoint {
  date: string;
  [key: string]: number | string;
}

// 指标配置
export interface MetricConfig {
  key: string;
  name: string;
  unit: string;
  color: string;
  description: string;
  higherIsBetter?: boolean;
}
