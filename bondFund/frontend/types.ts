// 基础数据点定义
export interface BondDataPoint {
  date: string;
  yield: number;
}

export interface StockDataPoint {
  date: string;
  pe: number;
}

export interface ShiborDataPoint {
  date: string;
  shibor: number;
}

// 原始数据集合
export interface RawData {
  bond_10y: BondDataPoint[];
  stock_pe: StockDataPoint[];
  shibor_on: ShiborDataPoint[];
}

// 结论部分
export interface Conclusion {
  last_date: string;
  last_yield: number;
  score: number;
  weather: string; // ☀️ 烈日, 🌤️ 晴朗, etc.
  percentile: number;
  val_status: string; // 🟢 便宜
  trend_val: string; // 牛 / 熊
  trend_status: string;
  macd_val: string;
  macd_status: string;
  pe_val: string;
  macro_msg: string;
  shibor_val: string;
  liquidity_msg: string;
  suggestion_con: string; // 稳健型建议
  suggestion_agg: string; // 激进型建议
}

// 顶层数据结构
export interface BondReportData {
  generated_at: string;
  report_folder: string;
  files: {
    markdown: string;
    chart: string;
    ts: string;
  };
  conclusion: Conclusion;
  raw: RawData;
}
