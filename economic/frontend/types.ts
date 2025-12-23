export interface MacroDataPoint {
  date: string;
  value: number;
}

export interface MacroDataResponse {
  labels: { [key: string]: string };
  data: {
    cpi: MacroDataPoint[];
    ppi: MacroDataPoint[];
    m1: MacroDataPoint[];
    m2: MacroDataPoint[];
    scissors: MacroDataPoint[];
    social_financing: MacroDataPoint[];
    lpr_1y: MacroDataPoint[];
    lpr_5y: MacroDataPoint[];
    gdp: MacroDataPoint[];
    pmi: MacroDataPoint[];
    exports_yoy: MacroDataPoint[];
    retail_sales: MacroDataPoint[];
    sh_index: MacroDataPoint[];
    sh_index_pe: MacroDataPoint[];
    sh_index_pb: MacroDataPoint[];
    us_bond_10y: MacroDataPoint[];
    cn_bond_10y: MacroDataPoint[];
    bond_spread: MacroDataPoint[];
    usd_cny: MacroDataPoint[];
    fx_reserves: MacroDataPoint[];
    gold: MacroDataPoint[];
    resident_leverage: MacroDataPoint[];
    real_estate_invest: MacroDataPoint[];
    unemployment: MacroDataPoint[];
    [key: string]: MacroDataPoint[]; // Index signature for dynamic access
  };
  meta: { source: string; updated_at: string };
}

// Configuration for charts and cards
export interface MetricConfig {
  key: string;
  label: string;
  description: string; // The "What is this?" hover text
  // Analysis can be a static template with {value} or a function returning a specific insight based on the value
  analysis: string | ((value: number) => string); 
  format: 'percentage' | 'number' | 'currency' | 'index';
  color?: string;
  // 'normal': High is Green/Good (e.g., ERP, Yields). 'inverse': Low is Green/Good (e.g., PE, PB).
  colorScale?: 'normal' | 'inverse'; 
}

export type Category = 'inflation' | 'liquidity' | 'market' | 'rates' | 'external' | 'real_estate';