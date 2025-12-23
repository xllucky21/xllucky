import { MetricConfig } from './types';

export const METRIC_DEFINITIONS: { [key: string]: MetricConfig } = {
  // --- Investment Signals (New) ---
  equity_risk_premium: {
    key: 'equity_risk_premium',
    label: '股权风险溢价 (ERP)',
    description: '【概念】股债跷跷板。衡量买股票比买债券多出来的"风险补偿"。公式：(1/PE) - 10年国债收益率。',
    analysis: (value: number) => {
      if (value > 4) return `ERP 飙升至 ${value.toFixed(2)}%。这根跷跷板已经极度倾斜：股票太便宜，债券太贵。这通常是数年一遇的"黄金坑"，虽然市场此时最恐慌，但这正是赔率最高的时刻。`;
      if (value > 3) return `ERP 为 ${value.toFixed(2)}%，越过 3% 高性价比红线。此时股票的安全边际很高，向下空间有限，向上弹性充足，建议超配。`;
      if (value < 1) return `ERP 仅为 ${value.toFixed(2)}%，跌破 1% 警戒线。意味着股票不仅没有风险补偿，甚至可能比债券还贵。此时应注重防御，不论市场多狂热，都要舍得卖出。`;
      return `ERP 为 ${value.toFixed(2)}%，处于历史中枢。股债性价比平衡，建议保持标配。`;
    },
    format: 'percentage',
    color: '#10b981', // Emerald green for opportunity
    colorScale: 'normal' // High is Good
  },

  // --- Inflation ---
  cpi: {
    key: 'cpi',
    label: 'CPI 同比',
    description: '【概念】生活成本温度计。3%是高烧警戒线，0%是冰点警戒线。',
    analysis: (value: number) => {
      if (value < 0) return `CPI (${value}%) 跌破 0 线，进入通缩区间。这是危险信号：物价下跌 -> 企业利润降 -> 裁员降薪 -> 消费更少。必须有强力的货币宽松来打破这个螺旋。`;
      if (value < 1.5) return `CPI (${value}%) 处于低位。说明总需求不足，经济体温偏冷。这给央行留出了巨大的降息空间。`;
      if (value > 3) return `CPI (${value}%) 突破 3% 警戒线。通胀过热，央行可能会被迫加息"泼冷水"，这对股市估值和债券价格都是利空。`;
      return `CPI (${value}%) 处于温和区间（金发姑娘状态），利好资产价格。`;
    },
    format: 'percentage',
    color: '#38bdf8'
  },
  ppi: {
    key: 'ppi',
    label: 'PPI 同比',
    description: '【概念】企业利润晴雨表。PPI 上涨意味着企业出厂价提高，通常利好利润；PPI 通缩则意味着企业在打价格战。',
    analysis: (value: number) => {
      if (value < 0) return `PPI (${value}%) 处于负值区间。工业通缩意味着企业没有定价权，利润被压缩。为了生存，企业会削减开支和裁员，这是典型的"资产负债表衰退"特征。`;
      if (value > 5) return `PPI (${value}%) 过高，需警惕原材料成本激增对中下游企业的挤压。`;
      return `PPI (${value}%) 回正，表明工业需求回暖，企业盈利预期改善。`;
    },
    format: 'percentage',
    color: '#818cf8'
  },

  // --- Liquidity ---
  m2: {
    key: 'm2',
    label: 'M2 广义货币',
    description: '【概念】货币蓄水池。代表央行印了多少钱。但在去杠杆周期，水位高（M2高）不代表流速快。',
    analysis: (value: number) => {
      return `M2 增速 ${value}%。关注它与名义 GDP 的裂口。如果 M2 很高但 GDP 很低，说明货币流通速度下降，钱停在银行里"空转"，没有变成实体经济的投资。`;
    },
    format: 'percentage',
    color: '#34d399'
  },
  m1: {
    key: 'm1',
    label: 'M1 狭义货币',
    description: '【概念】企业活钱。M1 是企业放在账上随时准备花的钱，代表了企业的扩张意愿。',
    analysis: (value: number) => {
      return `M1 增速 ${value}%。${value < 3 ? '增速极低，说明企业在"囤积现金过冬"，不敢投资扩产。' : '增速回升，这是经济复苏最硬核的先行指标，说明企业开始花钱了。'}`;
    },
    format: 'percentage',
    color: '#22c55e'
  },
  scissors: {
    key: 'scissors',
    label: 'M1-M2 剪刀差',
    description: '【概念】资金活化跷跷板。正值=资金进入实体；负值=资金沉淀在银行。',
    analysis: (value: number) => {
      if (value < -5) return `剪刀差深度倒挂 (${value.toFixed(2)}%)。典型的"流动性陷阱"。央行发了很多钱（M2高），但企业不贷不投（M1低），资金在金融体系内空转。这是经济底部的显著特征。`;
      if (value < 0) return `剪刀差为负 (${value.toFixed(2)}%)。资金活性不足，市场处于防御状态。`;
      return `剪刀差转正 (${value.toFixed(2)}%)！这是资金活化的大信号，意味着信用扩张周期开启，利好股市和实体经济。`;
    },
    format: 'percentage',
    color: '#fbbf24'
  },
  social_financing: {
    key: 'social_financing',
    label: '社融增量',
    description: '【概念】经济燃料。代表实体经济真正借到了多少钱。',
    analysis: (value: number) => {
      return `本月社融增量 ${value} 亿元。这是"信贷脉冲"的核心。若脉冲向上，通常 6 个月后经济数据会见底回升；若脉冲向下，则经济仍有下行惯性。`;
    },
    format: 'number',
    color: '#a78bfa'
  },
  lpr_1y: {
    key: 'lpr_1y',
    label: 'LPR (1年期)',
    description: '【概念】短期资金成本。央行降息的直接体现。',
    analysis: (value: number) => {
      return `1年期 LPR 报 ${value}%。降息是为了给企业减负。但在信心不足时，"推绳子"效应会导致降息边际效用递减。`;
    },
    format: 'percentage',
    color: '#f472b6'
  },
  lpr_5y: {
    key: 'lpr_5y',
    label: 'LPR (5年期)',
    description: '【概念】房贷利率锚。直接决定了居民的购房成本和月供压力。',
    analysis: (value: number) => {
      return `5年期 LPR 报 ${value}%。央行大幅调降此利率，意图非常明显：托底房地产。这是刺激居民加杠杆买房的最强信号。`;
    },
    format: 'percentage',
    color: '#ec4899'
  },

  // --- Market ---
  sh_index: {
    key: 'sh_index',
    label: '上证指数',
    description: '【概念】国运曲线。反映市场对未来名义GDP增长的预期。',
    analysis: (value: number) => {
      return `上证收于 ${value} 点。关注 3000 点心理关口。指数是分母（无风险利率）和分子（企业盈利）博弈的结果。`;
    },
    format: 'index',
    color: '#f472b6'
  },
  sh_index_pe: {
    key: 'sh_index_pe',
    label: '上证PE (市盈率)',
    description: '【概念】回本年限。PE=10 意味着按当前盈利 10 年回本。越低越好。',
    analysis: (value: number) => {
      let status = value < 13 ? "处于历史底部区域" : value > 20 ? "处于泡沫区域" : "处于合理中枢";
      return `当前 PE 为 ${value} 倍，${status}。在宏观不确定性大时，市场会杀估值。对于长线资金，低估值提供了天然的安全垫。`;
    },
    format: 'number',
    color: '#e879f9',
    colorScale: 'inverse' // Low is Good
  },
  sh_index_pb: {
    key: 'sh_index_pb',
    label: '上证PB (市净率)',
    description: '【概念】破净率。PB<1 意味着股价跌破了变卖资产的价值。',
    analysis: (value: number) => {
      return `当前 PB 为 ${value} 倍。${value < 1.3 ? 'PB 极低，逼近"破净"边缘。这通常是熊市末期的特征，意味着市场认为资产不仅不赚钱，甚至在毁灭价值。这也往往是反转的前夜。' : '估值合理。'}`;
    },
    format: 'number',
    color: '#d946ef',
    colorScale: 'inverse' // Low is Good
  },
  bond_spread: {
    key: 'bond_spread',
    label: '中美利差',
    description: '【概念】货币政策不可能三角。利差倒挂会限制国内降息空间。',
    analysis: (value: number) => {
      if (value < 0) return `利差倒挂 (${value.toFixed(2)}%)。这是一根紧绷的弦。为了防止资金外流和汇率贬值，央行不敢随意大幅降息，这制约了国内货币政策的宽松上限。`;
      return `利差为正 (${value.toFixed(2)}%)。舒适区。央行可以根据国内经济情况自由调整利率，无需看美联储脸色。`;
    },
    format: 'percentage',
    color: '#f87171'
  },
  cn_bond_10y: {
    key: 'cn_bond_10y',
    label: '中债10年期',
    description: '【概念】无风险收益率锚。反映市场对长期经济增长的信心。',
    analysis: (value: number) => {
      return `收益率报 ${value}%。${value < 2.6 ? '长债收益率极低，说明资金在疯狂避险，市场在交易"长期停滞"逻辑。' : '收益率回升，说明市场开始交易"经济复苏"。'} 它是各类资产定价的基石。`;
    },
    format: 'percentage',
    color: '#ef4444',
    colorScale: 'normal'
  },
  us_bond_10y: {
    key: 'us_bond_10y',
    label: '美债10年期',
    description: '【概念】全球资产定价之锚。美债利率高，全球风险资产（包括A股）都要杀估值。',
    analysis: (value: number) => {
      return `美债收益率 ${value}%。如果它快速上行，会像吸尘器一样抽走全球流动性。`;
    },
    format: 'percentage',
    color: '#dc2626'
  },

  // --- Growth ---
  gdp: {
    key: 'gdp',
    label: 'GDP 增速',
    description: '【概念】经济总产出。5% 通常是当前的潜在增长率目标。',
    analysis: (value: number) => {
      return `GDP 增速 ${value}%。若低于 5%，说明存在"产出缺口"，产能闲置，失业增加，需要政策刺激。若高于 5%，则需警惕过热。`;
    },
    format: 'percentage',
    color: '#fb923c'
  },
  pmi: {
    key: 'pmi',
    label: '制造业 PMI',
    description: '【概念】50 荣枯线。经济的转速表。高于50扩张，低于50收缩。',
    analysis: (value: number) => {
      return `PMI 录得 ${value}。${value >= 50 ? '站在荣枯线上方，工厂在加班加点，经济处于扩张期。' : '跌破荣枯线，工厂在减少订单，经济处于收缩期。'} PMI 反应最快，是 GDP 的先行指标。`;
    },
    format: 'number',
    color: '#60a5fa'
  },
  exports_yoy: {
    key: 'exports_yoy',
    label: '出口增速',
    description: '【概念】外循环引擎。0% 是衰退警戒线。',
    analysis: (value: number) => {
      return `出口增速 ${value}%。${value > 5 ? '外需给力，掩盖了内需不足的问题，为转型争取了时间。' : '外需熄火，经济必须"单腿走路"靠内需，稳增长压力陡增。'}`;
    },
    format: 'percentage',
    color: '#8b5cf6'
  },

  // --- Real Estate & Consumption ---
  retail_sales: {
    key: 'retail_sales',
    label: '社消零售',
    description: '【概念】消费马车。受制于居民收入预期和房价（财富效应）。',
    analysis: (value: number) => {
      return `零售增速 ${value}%。${value < 8 ? '消费疲软。因为房价跌了（财富缩水）且收入预期不稳，老百姓不敢花钱，这是"疤痕效应"。' : '消费回暖，这是经济进入良性循环的标志。'}`;
    },
    format: 'percentage',
    color: '#c084fc'
  },
  real_estate_invest: {
    key: 'real_estate_invest',
    label: '国房景气',
    description: '【概念】地产体温计。100 是适度景气分界线。',
    analysis: (value: number) => {
      return `国房景气指数 ${value}。${value < 100 ? '处于不景气区间。地产是"周期之母"，它的调整会拖累上下游几十个行业，是当前经济最大的通缩压力源。' : '景气度回升，表明地产企稳。'}`;
    },
    format: 'number',
    color: '#c084fc'
  },
  resident_leverage: {
    key: 'resident_leverage',
    label: '居民杠杆率',
    description: '【概念】债务天花板。65% 左右通常是发展中国家的瓶颈。',
    analysis: (value: number) => {
      return `居民杠杆率 ${value}%。${value > 60 ? '杠杆率已处高位，居民借不动了，甚至开始"提前还贷"（修复资产负债表）。这意味着很难再靠居民加杠杆来接盘楼市。' : '杠杆率健康，还有空间。'}`;
    },
    format: 'percentage',
    color: '#f97316'
  },

  // --- External ---
  usd_cny: {
    key: 'usd_cny',
    label: '美元/人民币',
    description: '【概念】汇率防线。7.0 和 7.3 是关键心理关口。',
    analysis: (value: number) => {
      return `汇率报 ${value}。${value > 7.2 ? '贬值压力较大，主要受中美利差倒挂影响。虽利好出口，但容易引发资本外流，央行会限制降息幅度来保汇率。' : '汇率稳住了，市场信心回升。'}`;
    },
    format: 'number',
    color: '#94a3b8'
  },
  fx_reserves: {
    key: 'fx_reserves',
    label: '外汇储备',
    description: '【概念】国家账本。3万亿美元是安全红线。',
    analysis: (value: number) => {
      return `外汇储备 ${value} 亿美元。只要维持在 3 万亿上方，我们就拥有应对任何外部冲击的"核武器"，国家信用无虞。`;
    },
    format: 'number',
    color: '#64748b'
  },
  gold: {
    key: 'gold',
    label: '上海金',
    description: '【概念】信用对冲。当法币（纸币）信用动摇时的避难所。',
    analysis: (value: number) => {
      return `金价报 ${value} 元/克。金价上涨是在交易"实际利率下行"和"去美元化"。在乱世，它是投资组合中必须配置的"保险"。`;
    },
    format: 'number',
    color: '#fbbf24'
  },
  unemployment: {
    key: 'unemployment',
    label: '调查失业率',
    description: '【概念】社会底线。5.5% 是警戒线。',
    analysis: (value: number) => {
      return `失业率 ${value}%。${value >= 5.5 ? '触及警戒线。就业不稳->收入不稳->消费不稳。稳就业是政策的头号任务。' : '就业市场总体平稳。'} 需特别关注青年失业率这一结构性痛点。`;
    },
    format: 'percentage',
    color: '#ef4444'
  }
};