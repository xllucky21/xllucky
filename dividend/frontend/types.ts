/**
 * 红利股票工具箱 - 类型定义（合并版）
 */

// ==========================================
// 指数相关类型
// ==========================================

export interface IndexDataPoint {
  date: string;
  close: number;
  MA20?: number;
  MA60?: number;
  RSI?: number;
  pct_change?: number;
}

export interface BondDataPoint {
  date: string;
  bond_yield: number;
}

export interface ScoreHistoryPoint {
  date: string;
  score: number;
  close: number;
}

export interface DividendConclusion {
  last_date: string;
  last_close: number;
  score: number;
  weather: string;
  signal: 'strong_buy' | 'buy' | 'hold' | 'reduce' | 'sell';
  dividend_yield: number | null;
  bond_yield: number | null;
  spread: number | null;
  spread_status: string;
  trend_status: string;
  ma_deviation: number | null;
  rsi: number | null;
  pct_change_5d: number | null;
  pct_change_20d: number | null;
  suggestion_con: string;
  suggestion_agg: string;
}

export interface DividendRawData {
  index: IndexDataPoint[];
  bond: BondDataPoint[];
}

export interface IndexAnalysis {
  conclusion: DividendConclusion;
  score_history?: ScoreHistoryPoint[];
  raw?: DividendRawData;
}

// ==========================================
// 个股相关类型
// ==========================================

export interface StockMetrics {
  dividend_yield: number | null;
  spread: number | null;
  pb: number | null;
  payout_ratio: number | null;
  dividend_years: number;
  roe: number | null;
}

export interface ScoreItem {
  score: number;
  level: 'gold' | 'good' | 'warn' | 'bad' | 'unknown';
  text: string;
}

export interface StockScores {
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

export interface HistoryPoint {
  date: string;
  value: number;
}

export interface StockData {
  code: string;
  name: string;
  industry: string;
  type: string;
  price: number | null;
  metrics: StockMetrics;
  scores: StockScores;
  total_score: number;
  pb_history: HistoryPoint[];
  dividend_yield_history: HistoryPoint[];
  price_history: HistoryPoint[];
}

// 简化版个股数据（历史记录用）
export interface StockDataSimple {
  code: string;
  name: string;
  total_score: number;
  metrics: {
    dividend_yield: number | null;
    spread: number | null;
    pb: number | null;
  };
}

// ==========================================
// 合并后的数据类型
// ==========================================

export interface DividendDataItem {
  generated_at: string;
  bond_yield: number;
  index: IndexAnalysis | null;
  stocks: StockData[] | StockDataSimple[];
}

// ==========================================
// 兼容旧接口的类型
// ==========================================

export interface DividendReportData {
  generated_at: string;
  conclusion?: DividendConclusion;
  score_history?: ScoreHistoryPoint[];
  raw?: DividendRawData;
}

export interface StocksDataWrapper {
  generated_at: string;
  bond_yield: number;
  stocks: StockData[];
}

// ==========================================
// 通用类型
// ==========================================

export type TimeRange = '1年' | '2年' | '5年' | '全部';

export const SIGNAL_COLORS: Record<string, string> = {
  strong_buy: '#22c55e',
  buy: '#84cc16',
  hold: '#eab308',
  reduce: '#f97316',
  sell: '#ef4444',
};

export const SIGNAL_TEXT: Record<string, string> = {
  strong_buy: '强烈买入',
  buy: '建议买入',
  hold: '持有观望',
  reduce: '减仓观望',
  sell: '建议卖出',
};
