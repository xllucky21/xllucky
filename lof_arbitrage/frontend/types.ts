// LOF基金套利监测类型定义

// IOPV可信度
export type IopvReliability = 'high' | 'medium' | 'low';

// 套利路径
export type ArbPath = 
  | 'in_to_out'           // 场内→场外套利（经典LOF套利）
  | 'in_to_out_caution'   // 场内→场外套利（需谨慎）
  | 'in_to_out_risky'     // 场内→场外套利（IOPV不可靠）
  | 'price_reversion'     // 价格回归博弈（非无风险套利）
  | 'none';               // 不可套利

export interface LofFund {
  code: string;
  name: string;
  price: number;                    // 场内实时价格
  est_nav: number;                  // 实时估算净值（盘中IOPV）
  prev_nav: number | null;          // T-1公布净值
  realtime_discount: number;        // 实时折溢价率（核心指标）
  t1_discount: number | null;       // T-1折溢价率（参考）
  est_change_pct: number | null;    // 估算涨跌幅
  change_pct: number | null;        // 场内涨跌幅
  volume: number;
  amount: number;
  turnover_rate: number | null;
  signal_type: '溢价套利' | null;
  signal_strength: number;
  fund_type: string;                // 基金类型（A股宽基/A股行业/QDII港股/QDII全球/商品原油）
  threshold: number;                // 该类型的溢价阈值
  can_subscribe: boolean;           // 是否可申购（套利生死线！）
  subscribe_status: string;         // 申购状态文本（开放申购/暂停申购/限大额等）
  redeem_status: string;            // 赎回状态文本
  low_liquidity: boolean;           // 流动性不足（成交额<500万）
  daily_limit: number | null;       // 申购限额（万元）
  
  // 其他字段
  iopv_reliability: IopvReliability;  // IOPV可信度
  iopv_reason: string;                // IOPV可信度原因
  arb_path: ArbPath;                  // 套利路径
  arb_path_desc: string;              // 套利路径描述
  settlement_days: number;            // 结算天数（T+N）
  annualized_return: number;          // 年化收益率
  capital_efficiency: number;         // 资金效率评分（0-100）
  risk_notes: string[];               // 风险提示列表
}

export interface PriceHistory {
  date: string;
  close: number;
  volume: number;
}

export interface DiscountHistory {
  date: string;
  price: number;
  nav: number;
  discount_rate: number;
}

export interface HotLofFund extends LofFund {
  track_index: string;
  price_history: PriceHistory[];
  discount_history: DiscountHistory[];
}

export interface Distribution {
  deep_discount: number;
  slight_discount: number;
  fair_value: number;
  slight_premium: number;
  deep_premium: number;
}

export interface MarketOverview {
  total_count: number;
  avg_discount_rate: number;
  max_discount: number;
  max_premium: number;
  distribution: Distribution;
}

export interface Opportunities {
  premium: LofFund[];
}

export interface LofData {
  meta: {
    updated_at: string;
    desc: string;
    note: string;
  };
  overview: MarketOverview;
  opportunities: Opportunities;
  all_funds: LofFund[];
  hot_funds: HotLofFund[];
}
