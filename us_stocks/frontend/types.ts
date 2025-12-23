// 指数数据点
export interface IndexDataPoint {
  date: string;
  close: number;
  open: number;
  high: number;
  low: number;
  volume: number;
}

// 股票数据点 (含涨跌幅)
export interface StockDataPoint extends IndexDataPoint {
  change_pct: number;
}

// VIX数据点
export interface VixDataPoint {
  date: string;
  close: number;
  open: number;
  high: number;
  low: number;
}

// 美债收益率数据点
export interface BondDataPoint {
  date: string;
  us_2y: number;
  us_10y: number;
  spread_2_10: number;  // 2-10年利差
}

// 美元指数数据点
export interface DollarDataPoint {
  date: string;
  close: number;
}

// 联邦基金利率数据点
export interface FedRateDataPoint {
  date: string;
  rate: number;
}

// 完整市场数据
export interface USMarketData {
  meta: {
    updated_at: string;
    desc: string;
  };
  data: {
    indices: {
      dji: IndexDataPoint[];   // 道琼斯
      spx: IndexDataPoint[];   // 标普500
      ndx: IndexDataPoint[];   // 纳斯达克
    };
    vix: VixDataPoint[];
    bond: BondDataPoint[];
    dollar: DollarDataPoint[];
    fed_rate: FedRateDataPoint[];
    sectors: {
      xlk: StockDataPoint[];  // 科技
      xlf: StockDataPoint[];  // 金融
      xle: StockDataPoint[];  // 能源
      xlv: StockDataPoint[];  // 医疗
      xli: StockDataPoint[];  // 工业
      xly: StockDataPoint[];  // 可选消费
    };
    stars: {
      aapl: StockDataPoint[];
      msft: StockDataPoint[];
      nvda: StockDataPoint[];
      googl: StockDataPoint[];
      amzn: StockDataPoint[];
      meta: StockDataPoint[];
      tsla: StockDataPoint[];
    };
  };
}

// 图表通用数据点
export interface ChartDataPoint {
  date: string;
  [key: string]: number | string;
}
