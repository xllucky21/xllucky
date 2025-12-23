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

export interface UsBondDataPoint {
  date: string;
  us_yield: number;
}

// 原始数据集合
export interface RawData {
  bond_10y: BondDataPoint[];
  stock_pe: StockDataPoint[];
  shibor_on: ShiborDataPoint[];
  us_bond_10y?: UsBondDataPoint[];
}

// 市场状态
export interface MarketRegime {
  regime: 'trending' | 'ranging' | 'unknown';
  regime_msg: string;
  consecutive_days: number;
  trend_weight: number;
  direction: 'bull' | 'bear' | null;
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
  rsi?: number;       // RSI 指标值
  pe_val: string;
  macro_msg: string;
  shibor_val: string;
  shibor_change?: string;  // Shibor 20日变化
  liquidity_msg: string;
  spread_val?: string;     // 中美利差
  spread_change?: string;  // 利差60日变化
  spread_msg?: string;     // 利差状态（收窄/走阔/平稳）
  us_yield?: string;       // 美国10年期国债收益率
  market_regime?: MarketRegime;  // 市场状态
  suggestion_con: string; // 稳健型建议
  suggestion_agg: string; // 激进型建议
}

export interface BacktestBucket {
  min_score: number;
  max_score: number;
  count: number;
  avg_forward_return: number | null;  // 新增：真实收益（%）
  avg_forward_yield_change_bp: number | null;  // 保留：利率变动（bp）
}

// 评分历史数据点
export interface ScoreHistoryPoint {
  date: string;
  yield: number;
  score: number;
}

export interface BacktestResult {
  horizon_days: number;
  buckets: BacktestBucket[];
  is_monotonic: boolean;  // 新增：单调性是否成立
  monotonic_score: number;  // 新增：单调性得分（0-1）
  monotonic_msg: string;  // 新增：单调性提示信息
  score_history?: ScoreHistoryPoint[];  // 新增：评分历史时间序列
}

// 顶层数据结构
export interface BondReportData {
  generated_at: string;
  conclusion: Conclusion;
  raw?: RawData;  // 只有最新一条有原始数据，历史记录无
  backtest?: BacktestResult;
}
