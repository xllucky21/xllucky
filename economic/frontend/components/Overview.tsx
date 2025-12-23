import React, { useMemo } from 'react';
import { Card } from './Card';
import { InfoTooltip } from './InfoTooltip';
import { 
  Activity, 
  TrendingUp, 
  Gauge,
  Target,
  CircleDollarSign,
  Landmark,
  Coins,
  Zap,
  Thermometer,
  Droplets,
  Scale,
  Wallet,
  ArrowRightLeft,
  Percent,
  Building2,
  Home,
  BrickWall,
  Briefcase,
  Globe,
  Ship,
  Anchor,
  ArrowDownToLine
} from 'lucide-react';
import { MacroDataResponse } from '../types';

interface OverviewProps {
  data: MacroDataResponse;
  mode: 'observation' | 'investment' | 'credit' | 'real_estate' | 'external';
}

// Helper to get the last valid value
const getLast = (arr: any[]) => arr && arr.length > 0 ? arr[arr.length - 1].value : 0;
const getDiff = (arr: any[]) => {
    if (!arr || arr.length < 2) return 0;
    return arr[arr.length - 1].value - arr[arr.length - 2].value;
};

export const Overview: React.FC<OverviewProps> = ({ data, mode }) => {
  // 1. Extract Core Data
  const gdp = getLast(data.data.gdp);
  const pmi = getLast(data.data.pmi);
  const cpi = getLast(data.data.cpi);
  const ppi = getLast(data.data.ppi);
  const erp = getLast(data.data.equity_risk_premium);
  const scissors = getLast(data.data.scissors); 
  const bond_spread = getLast(data.data.bond_spread);
  const m1 = getLast(data.data.m1);
  const social_financing = getLast(data.data.social_financing);
  const social_financing_diff = getDiff(data.data.social_financing);
  const resident_leverage = getLast(data.data.resident_leverage);
  const lpr_5y = getLast(data.data.lpr_5y);
  const real_estate_invest = getLast(data.data.real_estate_invest);
  const real_estate_diff = getDiff(data.data.real_estate_invest);
  const exports_yoy = getLast(data.data.exports_yoy);
  const usd_cny = getLast(data.data.usd_cny);
  const fx_reserves = getLast(data.data.fx_reserves);

  // 2. Logic Engines

  // A. Macro Regime (For Observation Mode)
  const regime = useMemo(() => {
    const isGrowthPositive = pmi >= 50 || gdp > 5.0;
    const isInflationHigh = cpi > 2.5 || ppi > 2.0;
    const isDeflation = cpi < 0.5 || ppi < -1.0;

    if (isGrowthPositive && !isInflationHigh && !isDeflation) 
        return { name: "温和复苏 (Recovery)", color: "text-green-400", bg: "bg-green-400/10", border: "border-green-400/20", desc: "【金发姑娘区间】PMI > 50 且通胀适中。这是经济机器最顺滑的运行状态：增长不至过热，通胀不至紧缩，政策处于舒适区，最利好权益资产。" };
    if (isGrowthPositive && isInflationHigh) 
        return { name: "经济过热 (Overheat)", color: "text-orange-400", bg: "bg-orange-400/10", border: "border-orange-400/20", desc: "【紧缩警戒线】需求过旺导致物价飞涨。央行面临'控通胀'压力，通常会通过加息或收紧信贷来降温，这对债券构成重大利空。" };
    if (!isGrowthPositive && isInflationHigh) 
        return { name: "滞胀风险 (Stagflation)", color: "text-red-400", bg: "bg-red-400/10", border: "border-red-400/20", desc: "【政策两难】增长停滞但通胀高企。央行陷入'保增长'与'控通胀'的跷跷板困境。这是最痛苦的宏观环境，现金和商品通常跑赢股债。" };
    if (!isGrowthPositive && isDeflation) 
        return { name: "通缩去杠杆 (Deflation)", color: "text-blue-400", bg: "bg-blue-400/10", border: "border-blue-400/20", desc: "【债务螺旋风险】需求不足导致物价下跌，实际利率被动抬升。这加剧了债务人的偿债负担，引发'债务-通缩'循环。此时必须进行激进的宽松，现金为王。" };
    
    return { name: "震荡筑底 (Bottoming)", color: "text-gray-400", bg: "bg-gray-400/10", border: "border-gray-400/20", desc: "【多空博弈】各项指标多空交织，缺乏明确的方向性信号。通常出现在周期切换的过渡期，市场处于观望状态。" };
  }, [pmi, gdp, cpi, ppi]);

  // B. Investment Sentiment (For Investment Mode)
  const sentiment = useMemo(() => {
    if (erp > 3) return { name: "积极进攻 (Aggressive)", color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/20", desc: `【黄金坑】ERP > 3% 是极高性价比信号。意味着股票隐含回报率远超债券，市场极度悲观定价，提供了极佳的安全边际。` };
    if (erp < 1) return { name: "防守避险 (Defensive)", color: "text-rose-400", bg: "bg-rose-400/10", border: "border-rose-400/20", desc: `【风险溢价不足】ERP < 1% 意味着股票相对于债券太贵了。此时承担股市波动风险无法获得足够的额外补偿，应战术性撤退。` };
    if (scissors > 0) return { name: "结构性行情 (Structural)", color: "text-blue-400", bg: "bg-blue-400/10", border: "border-blue-400/20", desc: "【资金活化】虽然整体估值合理，但 M1 增速反超 M2，意味着趴在账上的死钱开始变成活钱，市场存在结构性机会。" };
    return { name: "中性观望 (Neutral)", color: "text-gray-400", bg: "bg-gray-400/10", border: "border-gray-400/20", desc: "【均衡配置】市场估值和流动性均处于历史中枢，建议保持股债均衡配置，不宜过度偏激。" };
  }, [erp, scissors]);

  // C. Credit Cycle Status (For Credit Mode)
  const creditStatus = useMemo(() => {
    if (scissors > 0) return { name: "信用扩张 (Expansion)", color: "text-purple-400", bg: "bg-purple-400/10", border: "border-purple-400/20", desc: "【良性循环】M1 > M2，剪刀差转正。说明企业不仅拿到了钱（M2），还敢于花钱（M1），资金正在高效注入实体经济血管。" };
    if (scissors < -5 && social_financing_diff < 0) return { name: "信用收缩 (Contraction)", color: "text-orange-400", bg: "bg-orange-400/10", border: "border-orange-400/20", desc: "【主动去杠杆】剪刀差深度倒挂且社融回落，说明融资需求萎缩，信用创造机制受阻，经济面临失速风险。" };
    if (scissors < -2 && social_financing_diff > 0) return { name: "宽货币紧信用 (Trapped)", color: "text-blue-400", bg: "bg-blue-400/10", border: "border-blue-400/20", desc: "【推绳子效应】央行放水（社融增），但资金并未流向实体（M1低），而是形成了流动性陷阱（Liquidity Trap）。" };
    return { name: "结构性分化 (Divergence)", color: "text-gray-400", bg: "bg-gray-400/10", border: "border-gray-400/20", desc: "信贷数据冷热不均，部分部门在修复资产负债表，部分部门仍在观望。" };
  }, [scissors, social_financing_diff]);

  // D. Real Estate Cycle (For Real Estate Mode)
  const reStatus = useMemo(() => {
    if (real_estate_invest < 95) return { name: "深度调整 (Correction)", color: "text-orange-400", bg: "bg-orange-400/10", border: "border-orange-400/20", desc: "【去库存痛点】景气指数跌破 95 枯荣线下方，表明开发投资和销售双冷。这是长周期债务出清的必经阵痛。" };
    if (real_estate_invest < 100 && real_estate_diff > 0) return { name: "筑底回暖 (Bottoming)", color: "text-yellow-400", bg: "bg-yellow-400/10", border: "border-yellow-400/20", desc: "【边际改善】虽然仍处水下 (<100)，但指数开始抬头。政策托底（降利率、放宽限购）开始生效，最坏时刻可能已过。" };
    if (real_estate_invest > 101) return { name: "景气扩张 (Boom)", color: "text-red-400", bg: "bg-red-400/10", border: "border-red-400/20", desc: "【正向反馈】景气指数重回 100 上方，地产销售带动投资，通过财富效应（房价涨）刺激消费，进入扩张正循环。" };
    return { name: "弱势震荡 (Weak)", color: "text-gray-400", bg: "bg-gray-400/10", border: "border-gray-400/20", desc: "市场情绪低迷，供需双方都在观望，尚未形成一致性预期。" };
  }, [real_estate_invest, real_estate_diff]);

  // E. External Trade Status (For External Mode)
  const tradeStatus = useMemo(() => {
    if (exports_yoy > 10) return { name: "强劲拉动 (Strong)", color: "text-cyan-400", bg: "bg-cyan-400/10", border: "border-cyan-400/20", desc: "【外循环引擎】出口双位数增长，有效对冲了内需的疲软。这为国内去杠杆提供了宝贵的缓冲期。" };
    if (exports_yoy < 0) return { name: "外需疲软 (Weak)", color: "text-slate-400", bg: "bg-slate-400/10", border: "border-slate-400/20", desc: "【双重压力】出口负增长意味着外部需求熄火，经济必须完全依赖内需（投资+消费）拉动，转型压力剧增。" };
    if (bond_spread < -1.5) return { name: "资本外流压力 (Outflow)", color: "text-orange-400", bg: "bg-orange-400/10", border: "border-orange-400/20", desc: "【不可能三角】中美利差深度倒挂，资金倾向流出。央行为了保汇率，可能被迫放弃一部分货币政策的独立性（如不敢大幅降息）。" };
    return { name: "韧性维持 (Resilient)", color: "text-blue-400", bg: "bg-blue-400/10", border: "border-blue-400/20", desc: "尽管面临全球衰退预期，但中国出口份额保持稳定，展现出供应链的强大韧性。" };
  }, [exports_yoy, bond_spread]);

  // 3. Grid Items Generation (With Dynamic Descriptions)
  const gridItems = useMemo(() => {
    if (mode === 'investment') {
      // --- Investment Mode ---
      let stock = { signal: "标配", color: "text-gray-400", bg: "bg-gray-800", desc: "" };
      if (erp > 3.5) stock = { signal: "超配 (Overweight)", color: "text-emerald-400", bg: "bg-emerald-900/30", desc: `【股债跷跷板】当前 ERP (${erp.toFixed(2)}%) 处于极高位。这说明相对于债券，股票便宜得"不可思议"。历史规律表明，这是赢面极大的买点。` };
      else if (erp < 0.5) stock = { signal: "低配 (Underweight)", color: "text-rose-400", bg: "bg-rose-900/30", desc: `【风险溢价消失】ERP (${erp.toFixed(2)}%) 接近于零。你承担了股票的波动风险，却只能拿到和债券一样的回报，这很不划算。` };
      else stock = { signal: "标配 (Neutral)", color: "text-gray-400", bg: "bg-gray-800", desc: `【合理定价】ERP (${erp.toFixed(2)}%) 处于中枢。市场并未给出明显的低估或高估信号，建议赚取业绩增长的钱。` };

      let bond = { signal: "标配", color: "text-gray-400", bg: "bg-gray-800", desc: "" };
      if (pmi < 48 || cpi < 0) bond = { signal: "超配 (Bull)", color: "text-emerald-400", bg: "bg-emerald-900/30", desc: "【避险属性】经济收缩叠加通缩预期，央行大概率降息，债券资本利得空间大开。" };
      else if (pmi > 52 && cpi > 3) bond = { signal: "低配 (Bear)", color: "text-rose-400", bg: "bg-rose-900/30", desc: "【通胀杀手】经济过热且通胀高企，利率上行是大概率事件，这对债券价格是致命打击。" };
      else bond = { signal: "标配 (Neutral)", color: "text-gray-400", bg: "bg-gray-800", desc: "宏观环境对债市影响中性，建议缩短久期，以票息策略为主。" };

      let cash = { signal: "标配", color: "text-gray-400", bg: "bg-gray-800", desc: "保持适度流动性，等待机会。" };
      if (regime.name.includes("滞胀") || (erp < 1 && bond_spread < -1)) 
          cash = { signal: "超配 (Defense)", color: "text-emerald-400", bg: "bg-emerald-900/30", desc: "【现金为王】在滞胀（股债双杀）或外部风险剧增时，现金是唯一不亏钱的资产，且保留了抄底的期权价值。" };

      let gold = { signal: "标配", color: "text-gray-400", bg: "bg-gray-800", desc: "作为组合稳定器长期配置。" };
      if (bond_spread < -1.5 || regime.name.includes("滞胀")) 
          gold = { signal: "超配 (Hedge)", color: "text-emerald-400", bg: "bg-emerald-900/30", desc: "【信用对冲】当实际利率下行或主权信用货币（美元/人民币）购买力下降时，黄金是终极的价值锚。" };

      return [
          { label: "权益 (Stocks)", icon: TrendingUp, ...stock },
          { label: "债券 (Bonds)", icon: Landmark, ...bond },
          { label: "现金 (Cash)", icon: CircleDollarSign, ...cash },
          { label: "黄金 (Gold)", icon: Coins, ...gold },
      ];
    } else if (mode === 'credit') {
      // --- Credit Mode ---
      const impulse = social_financing_diff > 0 
        ? { signal: "回升 (Rising)", color: "text-purple-400", bg: "bg-purple-900/20", desc: "【先行指标】社融是经济的'燃料'。增量回升意味着信用脉冲转正，通常领先实体经济复苏 6 个月。" }
        : { signal: "回落 (Falling)", color: "text-gray-400", bg: "bg-gray-800", desc: "【动力衰减】社融增量回落，意味着投入经济引擎的燃料减少，未来两个季度增长可能承压。" };
      
      const transmission = scissors > -1 
        ? { signal: "通畅 (Smooth)", color: "text-purple-400", bg: "bg-purple-900/20", desc: `【活化效应】剪刀差 (${scissors.toFixed(2)}%) 收敛，说明央行放的水真正流进了企业的口袋（M1），而不是停留在银行空转。` }
        : { signal: "淤堵 (Trapped)", color: "text-orange-400", bg: "bg-orange-900/20", desc: `【流动性陷阱】剪刀差 (${scissors.toFixed(2)}%) 倒挂，说明企业宁愿把钱存定期（M2）也不愿投资（M1）。信心比黄金更重要。` };
      
      const cost = lpr_5y < 4.0 
        ? { signal: "宽松 (Loose)", color: "text-purple-400", bg: "bg-purple-900/20", desc: `【降息周期】5年期 LPR 处于 ${lpr_5y}% 低位。央行正在压低全社会的资金成本，以减轻债务人的利息负担。` }
        : { signal: "中性 (Neutral)", color: "text-gray-400", bg: "bg-gray-800", desc: `当前利率水平 (${lpr_5y}%) 相对稳定，政策进入观察期。` };
      
      const leverage = resident_leverage > 60 
        ? { signal: "高位 (High)", color: "text-orange-400", bg: "bg-orange-900/20", desc: `【债务天花板】居民杠杆率达到 ${resident_leverage.toFixed(1)}%。当债务过高时，收入将优先用于还债而非消费，这是消费疲软的根源。` }
        : { signal: "适中 (Moderate)", color: "text-green-400", bg: "bg-green-900/20", desc: `居民杠杆率 (${resident_leverage.toFixed(1)}%) 尚有空间，居民部门仍具备加杠杆消费的潜力。` };

      return [
        { label: "信用脉冲", icon: Activity, ...impulse },
        { label: "传导效率", icon: ArrowRightLeft, ...transmission },
        { label: "资金成本", icon: Percent, ...cost },
        { label: "居民杠杆", icon: Wallet, ...leverage },
      ];

    } else if (mode === 'real_estate') {
      // --- Real Estate Mode ---
      const policy = lpr_5y < 3.8 
        ? { signal: "极度宽松 (Max)", color: "text-orange-400", bg: "bg-orange-900/20", desc: `【托底红线】5年期 LPR 降至 ${lpr_5y}%，这是历史极值。政策已打出底牌，只为降低居民购房门槛。` } 
        : { signal: "宽松 (Loose)", color: "text-yellow-400", bg: "bg-yellow-900/20", desc: `【降成本】房贷利率锚 (${lpr_5y}%) 下行，有助于释放刚需。` };
      
      const demand = real_estate_invest < 95 
        ? { signal: "冰点 (Freezing)", color: "text-blue-400", bg: "bg-blue-900/20", desc: `【枯荣线下方】景气指数 (${real_estate_invest.toFixed(1)}) 远低于 100。市场信心极度脆弱，去库存是当务之急。` }
        : { signal: "修复 (Repairing)", color: "text-orange-400", bg: "bg-orange-900/20", desc: `景气指数 (${real_estate_invest.toFixed(1)}) 企稳，市场正在尝试筑底。` };
                                             
      const liquidity = m1 > 5 
        ? { signal: "充裕 (Rich)", color: "text-green-400", bg: "bg-green-900/20", desc: "M1 增速回升，意味着房企销售回款加快，现金流断裂风险降低。" }
        : { signal: "紧张 (Tight)", color: "text-gray-400", bg: "bg-gray-800", desc: "M1 低迷，表明房企依然缺钱，如果不解决融资端问题，竣工和交付仍有隐患。" };
      
      const debt = resident_leverage > 62 
        ? { signal: "见顶 (Peaking)", color: "text-red-400", bg: "bg-red-900/20", desc: "【资产负债表衰退】居民不再追求利润最大化，而是追求债务最小化（提前还贷）。这意味着很难再靠居民加杠杆来救楼市。" }
        : { signal: "可控 (Stable)", color: "text-green-400", bg: "bg-green-900/20", desc: "居民债务水平总体可控，系统性风险较小。" };

      return [
        { label: "政策力度", icon: Scale, ...policy },
        { label: "市场需求", icon: BrickWall, ...demand },
        { label: "房企流动性", icon: Droplets, ...liquidity },
        { label: "居民负债", icon: ArrowDownToLine, ...debt },
      ];
    } else if (mode === 'external') {
      // --- External Mode ---
      const trade = exports_yoy > 5 
        ? { signal: "强劲 (Strong)", color: "text-cyan-400", bg: "bg-cyan-900/20", desc: `【外需顺风】出口增长 ${exports_yoy.toFixed(1)}%。外需强劲是当前经济的压舱石，弥补了内需的不足。` }
        : { signal: "疲软 (Weak)", color: "text-gray-400", bg: "bg-gray-800", desc: `【外需逆风】出口增长乏力 (${exports_yoy.toFixed(1)}%)。当外需熄火时，必须启动内需（消费+基建）来填补缺口。` };
                                    
      const currency = usd_cny > 7.25 
        ? { signal: "贬值压力 (Depr)", color: "text-orange-400", bg: "bg-orange-900/20", desc: `【汇率红线】人民币 (${usd_cny}) 逼近心理关口。过快贬值会引发资本外流，央行可能会出手干预（如发行离岸央票）。` }
        : { signal: "平稳 (Stable)", color: "text-green-400", bg: "bg-green-900/20", desc: `人民币汇率 (${usd_cny}) 保持在合理区间，为货币政策留出了空间。` };
                                      
      const spread = bond_spread < -1 
        ? { signal: "深度倒挂 (Inv)", color: "text-red-400", bg: "bg-red-900/20", desc: `【政策跷跷板】中美利差倒挂 ${Math.abs(bond_spread).toFixed(2)}%。这是'不可能三角'的体现：为了保持汇率稳定，国内降息空间被美联储的高利率锁死。` }
        : { signal: "正常 (Normal)", color: "text-green-400", bg: "bg-green-900/20", desc: "中美利差处于舒适区，央行货币政策可以'以我为主'。" };
                                      
      const buffer = fx_reserves > 30000 
        ? { signal: "充足 (Ample)", color: "text-cyan-400", bg: "bg-cyan-900/20", desc: "【安全垫】3万亿外汇储备是金融安全的护城河，足以应对美联储加息带来的冲击。" }
        : { signal: "下降 (Dropping)", color: "text-yellow-400", bg: "bg-yellow-900/20", desc: "外汇储备下降，需警惕资本流出的速度。" };

      return [
        { label: "出口动能", icon: Ship, ...trade },
        { label: "汇率压力", icon: Globe, ...currency },
        { label: "中美利差", icon: Activity, ...spread },
        { label: "外储防线", icon: Anchor, ...buffer },
      ];
    } else {
      // --- Observation Mode: Macro Factor Status ---
      // Growth
      const growthStatus = pmi >= 50 
        ? { signal: "扩张 (Expanding)", color: "text-orange-400", bg: "bg-orange-900/20", desc: `【50 荣枯线】PMI (${pmi}) 站上 50 分界线。这意味着制造业蛋糕在变大，企业在补库存，经济处于扩张一侧。` } 
        : { signal: "收缩 (Contracting)", color: "text-blue-400", bg: "bg-blue-900/20", desc: `【50 荣枯线】PMI (${pmi}) 跌破 50。意味着制造业蛋糕在缩小，企业在去库存，经济处于收缩一侧。` };
      // Inflation
      const inflationStatus = cpi > 3 
        ? { signal: "高通胀 (Hot)", color: "text-red-400", bg: "bg-red-900/20", desc: `【3% 警戒线】CPI (${cpi}%) 突破舒适区。通胀过高会侵蚀居民购买力，迫使央行收紧银根。` }
        : cpi < 0 
          ? { signal: "通缩 (Deflation)", color: "text-blue-400", bg: "bg-blue-900/20", desc: `【0% 冰点线】CPI (${cpi}%) 跌入负值。这是危险信号，可能引发'物价跌-债务升-消费降'的恶性循环。` }
          : { signal: "温和 (Mild)", color: "text-green-400", bg: "bg-green-900/20", desc: `【黄金区间】CPI (${cpi}%) 温和。这是央行最喜欢的状态，既无通胀之忧，也无通缩之痛，政策空间最大。` };
      // Liquidity
      const liquidityStatus = scissors > 0 
        ? { signal: "活化 (Active)", color: "text-emerald-400", bg: "bg-emerald-900/20", desc: `【活化跷跷板】M1-M2 > 0。资金从定期存款（M2）搬家到活期账户（M1），说明微观主体（企业/居民）准备投资或消费，是复苏的先行指标。` }
        : { signal: "沉淀 (Trapped)", color: "text-gray-400", bg: "bg-gray-800", desc: `【储蓄跷跷板】M1-M2 < 0。资金大量沉淀在定期存款中，说明微观主体信心不足，倾向于持币观望（囤粮过冬）。` };
      // Policy
      const policyStatus = bond_spread > 0 
        ? { signal: "自主 (Independent)", color: "text-green-400", bg: "bg-green-900/20", desc: "【政策自由度】中美利差为正，资本没有单向流出压力，国内货币政策可以完全'以我为主'，自由降息或降准。" }
        : { signal: "受限 (Constrained)", color: "text-yellow-400", bg: "bg-yellow-900/20", desc: `【外部约束】中美利差倒挂 (${bond_spread.toFixed(2)}%)。为了防止汇率崩盘，央行在降息时必须小心翼翼，受到美联储政策的强力掣肘。` };

      return [
        { label: "增长动能", icon: Zap, ...growthStatus },
        { label: "通胀压力", icon: Thermometer, ...inflationStatus },
        { label: "货币活性", icon: Droplets, ...liquidityStatus },
        { label: "政策空间", icon: Scale, ...policyStatus },
      ];
    }
  }, [mode, erp, pmi, cpi, regime, bond_spread, scissors, social_financing_diff, lpr_5y, resident_leverage, real_estate_invest, exports_yoy, usd_cny, fx_reserves, m1]);

  // 4. Synthesis Text Generation
  const synthesis = useMemo(() => {
    if (mode === 'investment') {
      let text = `当前市场处于【${sentiment.name}】交易环境。`;
      if (erp > 3) text += ` 股权风险溢价(ERP)高达 ${erp.toFixed(2)}%，这根"股债跷跷板"已经极度向股票倾斜，权益资产进入了难得的"黄金坑"赔率区间。`;
      else if (erp < 1) text += ` 权益资产估值偏高 (ERP=${erp.toFixed(2)}%)，风险补偿不足，建议防守。`;
      else text += ` 估值处于合理中枢，建议寻找结构性机会。`;
      
      if (bond_spread < -1) text += ` 同时需警惕中美利差倒挂带来的汇率波动对资产价格的扰动。`;
      return text;
    } else if (mode === 'credit') {
      let text = `信贷体系处于【${creditStatus.name}】阶段。`;
      if (scissors < -5) text += ` M1-M2 剪刀差 (${scissors.toFixed(2)}%) 深度倒挂，形成了典型的"流动性陷阱"——央行发出的钱（M2）趴在账上，没流进实体（M1）。`;
      else if (scissors > 0) text += ` M1 回升，表明企业资金开始"解冻"活化。`;
      
      text += ` 5年期 LPR 为 ${lpr_5y}%，长端资金成本${lpr_5y < 4.0 ? '已降至历史低位，旨在通过降息减轻全社会的债务包袱。' : '仍有下降空间。'}`;
      return text;
    } else if (mode === 'real_estate') {
      let text = `房地产行业处于【${reStatus.name}】阶段。`;
      text += ` 景气指数 ${real_estate_invest.toFixed(1)}，${real_estate_invest < 100 ? '位于 100 枯荣线下方，去库存压力依然较大，行业仍在寻找底部。' : '保持在景气区间。'}`;
      text += ` 5年期LPR已降至 ${lpr_5y}%，政策端已极尽所能降低购房成本。`;
      text += resident_leverage > 60 ? ` 但居民杠杆率 (${resident_leverage.toFixed(1)}%) 触及天花板，"资产负债表衰退"效应限制了加杠杆意愿。` : ` 居民具备一定加杠杆空间。`;
      return text;
    } else if (mode === 'external') {
      let text = `外部环境处于【${tradeStatus.name}】状态。`;
      if (exports_yoy > 0) text += ` 出口同比增长 ${exports_yoy.toFixed(1)}%，这台"外循环引擎"依然强劲，为国内经济转型争取了时间。`;
      else text += ` 出口承压 (${exports_yoy.toFixed(1)}%)，外需熄火意味着经济增长必须回归内需。`;
      
      text += ` 中美利差倒挂 ${bond_spread.toFixed(2)}%，人民币汇率 (${usd_cny}) ${usd_cny > 7.2 ? '承压，央行面临"保汇率"还是"保利率"的艰难抉择（不可能三角）。' : '保持相对稳定。'}`;
      return text;
    } else {
      let text = `宏观经济处于【${regime.name}】阶段。`;
      if (pmi < 50) text += ` 制造业PMI (${pmi}) 位于 50 荣枯线下方，说明总需求依然疲软，经济机器运转不畅。`;
      else text += ` 生产端景气度回升。`;
      
      if (scissors < -5) text += ` M1-M2 剪刀差深度倒挂，反映出明显的"流动性陷阱"特征，信心比黄金更重要。`;
      else if (scissors > 0) text += ` M1 回升标志着微观主体活力正在修复。`;
      return text;
    }
  }, [mode, sentiment, regime, creditStatus, reStatus, tradeStatus, erp, pmi, scissors, bond_spread, lpr_5y, real_estate_invest, resident_leverage, exports_yoy, usd_cny]);

  // 5. Layout Config
  let header;
  if (mode === 'investment') {
    header = { title: "投资策略仪表盘", icon: Target, subtitle: "Investment Strategy", status: sentiment, theme: 'emerald' };
  } else if (mode === 'credit') {
    header = { title: "信用周期仪表盘", icon: Zap, subtitle: "Credit Cycle Monitor", status: creditStatus, theme: 'purple' };
  } else if (mode === 'real_estate') {
    header = { title: "地产周期仪表盘", icon: Home, subtitle: "Real Estate Cycle", status: reStatus, theme: 'orange' };
  } else if (mode === 'external') {
    header = { title: "全球外贸仪表盘", icon: Globe, subtitle: "Global Trade Monitor", status: tradeStatus, theme: 'cyan' };
  } else {
    header = { title: "宏观周期仪表盘", icon: Gauge, subtitle: "Macro Cycle Monitor", status: regime, theme: 'blue' };
  }

  return (
    <Card className={`mb-6 border-l-4 bg-gray-900/50 border-l-${header.theme}-500`}>
      <div className="flex flex-col lg:flex-row gap-6">
        
        {/* Left: Dashboard Status & Synthesis */}
        <div className="flex-1 space-y-4">
          <div className="flex items-center gap-3">
            <h2 className={`text-xl font-bold text-white flex items-center gap-2`}>
              <header.icon className={`w-6 h-6 text-${header.theme}-500`} />
              {header.title}
            </h2>
            <div className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 cursor-help ${header.status.color} ${header.status.bg} ${header.status.border}`}>
              {header.status.name}
              <InfoTooltip content={header.status.desc} />
            </div>
          </div>
          
          <div className="bg-gray-950/50 rounded-lg p-4 border border-gray-800">
            <p className="text-gray-300 text-sm leading-7 font-light">
              <span className={`font-bold mr-2 text-${header.theme}-400`}>
                {mode === 'investment' ? 'CIO View:' : 
                 mode === 'credit' ? 'Credit Analyst View:' : 
                 mode === 'real_estate' ? 'Industry Analyst View:' :
                 mode === 'external' ? 'FX Strategist View:' :
                 'Economist View:'}
              </span>
              {synthesis}
            </p>
          </div>
          
          <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
            <Activity size={12} />
            <span>
                {mode === 'investment' ? 'Based on FED Model & Risk Parity' : 
                 mode === 'credit' ? 'Based on Credit Impulse & Liquidity Trap' : 
                 mode === 'real_estate' ? 'Based on Housing Inventory & LPR' :
                 mode === 'external' ? 'Based on BOP & Interest Rate Parity' :
                 'Based on Ray Dalio Economic Machine'}
            </span>
          </div>
        </div>

        {/* Right: Grid (Allocation or Factors) */}
        <div className="lg:w-[480px]">
            <div className="flex items-center gap-2 mb-3 text-gray-400 text-xs uppercase tracking-wider font-semibold">
                {mode === 'investment' ? <Target size={14} /> : 
                 mode === 'credit' ? <Building2 size={14} /> : 
                 mode === 'real_estate' ? <Home size={14} /> :
                 mode === 'external' ? <Globe size={14} /> :
                 <Gauge size={14} />} 
                
                {mode === 'investment' ? ' 资产配置建议 (Tactical Allocation)' : 
                 mode === 'credit' ? ' 信贷健康度 (Credit Health)' : 
                 mode === 'real_estate' ? ' 行业关键因子 (Industry Factors)' :
                 mode === 'external' ? ' 贸易关键因子 (Trade Factors)' :
                 ' 核心宏观因子 (Key Macro Factors)'}
            </div>
            <div className="grid grid-cols-2 gap-3">
                {gridItems.map((item, idx) => (
                    <div key={idx} className={`p-3 rounded border border-gray-700/50 flex flex-col justify-between ${item.bg} transition-colors duration-300`}>
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-xs text-gray-300 font-medium flex items-center gap-1.5">
                                <item.icon size={14} className={`text-${header.theme}-400/70`} /> 
                                {item.label}
                                <InfoTooltip content={item.desc} />
                            </span>
                        </div>
                        <div className={`text-sm font-bold ${item.color} mt-1`}>
                            {item.signal}
                        </div>
                    </div>
                ))}
            </div>
        </div>

      </div>
    </Card>
  );
};