import React, { useState, useMemo, useEffect, useRef } from 'react';
import { MACRO_DATA } from '../macro_data';
import { Overview } from './components/Overview';
import { MetricCard } from './components/MetricCard';
import { MacroChart } from './components/MacroChart';
import { AIStrategist } from './components/AIStrategist';
import { CorrelationHeatmap } from './components/CorrelationHeatmap';
import { AlertPanel } from './components/AlertPanel';
import { PercentileGauge } from './components/PercentileGauge';
import { GroupedMetrics } from './components/GroupedMetrics';
import { CycleQuadrant } from './components/CycleQuadrant';
import { ZScoreChart } from './components/ZScoreChart';
import { LeadLagChart } from './components/LeadLagChart';
import html2canvas from 'html2canvas';
import { 
  BarChart3, 
  TrendingUp, 
  Calendar,
  Activity,     
  Banknote,     
  Scale,
  AlertOctagon,
  ArrowUp,
  Percent,
  Glasses,
  Briefcase,
  Zap,
  Home,
  Globe,
  Download,
  Loader2,
  PieChart,
  Layers
} from 'lucide-react';
import { MacroDataPoint } from './types';

type TimeRange = '5Y' | '10Y' | '20Y' | 'ALL';
type DashboardMode = 'data_analysis' | 'observation' | 'investment' | 'credit' | 'real_estate' | 'external';

const App: React.FC = () => {
  const [timeRange, setTimeRange] = useState<TimeRange>('5Y');
  const [mode, setMode] = useState<DashboardMode>('observation');
  const [isExporting, setIsExporting] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);

  // --- Data Pre-processing: Calculate Equity Risk Premium (ERP) ---
  const processedData = useMemo(() => {
    const rawData = MACRO_DATA.data;
    const peData = rawData.sh_index_pe || [];
    const bondData = rawData.cn_bond_10y || [];
    
    const bondMap = new Map(bondData.map(d => [d.date, d.value]));
    
    const erpData: MacroDataPoint[] = [];
    
    peData.forEach(pe => {
      if (pe.value > 0 && bondMap.has(pe.date)) {
        const bondYield = bondMap.get(pe.date)!;
        const earningsYield = (1 / pe.value) * 100;
        const erp = earningsYield - bondYield;
        erpData.push({ date: pe.date, value: Number(erp.toFixed(2)) });
      }
    });

    return {
      ...rawData,
      equity_risk_premium: erpData
    };
  }, []);

  const filterData = (range: TimeRange, fullData: { [key: string]: MacroDataPoint[] }) => {
    if (range === 'ALL') return fullData;

    const now = new Date();
    let yearsToSubtract = 0;
    if (range === '5Y') yearsToSubtract = 5;
    if (range === '10Y') yearsToSubtract = 10;
    if (range === '20Y') yearsToSubtract = 20;

    const cutoffDate = new Date(now.setFullYear(now.getFullYear() - yearsToSubtract)).toISOString().split('T')[0];

    const filtered: { [key: string]: MacroDataPoint[] } = {};
    Object.keys(fullData).forEach(key => {
      filtered[key] = fullData[key].filter(d => d.date >= cutoffDate);
    });
    return filtered;
  };

  const filteredData = useMemo(() => filterData(timeRange, processedData), [timeRange, processedData]);

  // --- Metric Selection per Mode ---
  const investmentMetricKeys = [
    'equity_risk_premium', 'sh_index_pe', 'cn_bond_10y', 'bond_spread',
    'sh_index', 'usd_cny', 'gold', 'm1'
  ];

  const observationMetricKeys = [
    'gdp', 'cpi', 'ppi', 'pmi', 
    'm1', 'social_financing', 'resident_leverage', 'unemployment'
  ];

  const creditMetricKeys = [
    'social_financing', 'm2', 'scissors', 'lpr_5y',
    'resident_leverage', 'real_estate_invest', 'cn_bond_10y', 'ppi'
  ];

  const realEstateMetricKeys = [
    'real_estate_invest', 'resident_leverage', 'lpr_5y', 'm1',
    'retail_sales', 'social_financing', 'unemployment', 'cpi'
  ];

  const externalMetricKeys = [
    'exports_yoy', 'usd_cny', 'fx_reserves', 'bond_spread',
    'us_bond_10y', 'gold', 'ppi', 'cn_bond_10y'
  ];

  const allMetricKeys = Object.keys(processedData);

  const coreMetricKeys = mode === 'investment' ? investmentMetricKeys 
                       : mode === 'credit' ? creditMetricKeys 
                       : mode === 'real_estate' ? realEstateMetricKeys
                       : mode === 'external' ? externalMetricKeys
                       : mode === 'data_analysis' ? allMetricKeys
                       : observationMetricKeys;

  // Shared syncId
  const SYNC_ID = "macro-sync-group";

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleExportImage = async () => {
    if (!dashboardRef.current || isExporting) return;
    
    setIsExporting(true);
    try {
      // Small delay to ensure UI is stable
      await new Promise(resolve => setTimeout(resolve, 100));

      const canvas = await html2canvas(dashboardRef.current, {
        useCORS: true, // Allow cross-origin images
        scale: 2, // Retina resolution
        backgroundColor: '#0b0f19', // Match body bg
        logging: false,
        ignoreElements: (element) => {
          // Ignore the floating control dock when capturing
          return element.classList.contains('no-export');
        }
      });

      const link = document.createElement('a');
      const timestamp = new Date().toISOString().split('T')[0];
      link.download = `China_Macro_Dashboard_${mode}_${timestamp}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Export failed:', error);
      alert('导出图片失败，请重试');
    } finally {
      setIsExporting(false);
    }
  };

  const getThemeColor = (m: DashboardMode) => {
    if (m === 'data_analysis') return 'sky';
    if (m === 'investment') return 'emerald';
    if (m === 'credit') return 'purple';
    if (m === 'real_estate') return 'orange';
    if (m === 'external') return 'cyan';
    return 'blue';
  };

  const theme = getThemeColor(mode);

  return (
    <div 
      ref={dashboardRef}
      className={`min-h-screen text-slate-200 p-8 font-sans selection:bg-blue-500 selection:text-white pb-32 transition-colors duration-700 ease-in-out bg-gray-950 shadow-[inset_0_0_150px_rgba(var(--theme-rgb),0.05)]`}
      style={{ '--theme-rgb': mode === 'data_analysis' ? '14,165,233' : mode === 'investment' ? '16,185,129' : mode === 'credit' ? '168,85,247' : mode === 'real_estate' ? '249,115,22' : mode === 'external' ? '6,182,212' : '59,130,246' } as React.CSSProperties}
    >
      <header className="mb-8 flex flex-col xl:flex-row xl:items-center justify-between border-b border-gray-800 pb-4 gap-4">
        <div>
           <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
             <BarChart3 className={`w-8 h-8 text-${theme}-500`} />
             China Macro Vision
             <span className={`text-xs font-bold text-gray-950 self-end mb-1 px-2 py-0.5 rounded tracking-wider bg-${theme}-500`}>
               DALIO FRAMEWORK
             </span>
           </h1>
           <p className="text-gray-500 mt-1 text-sm">基于经济机器模型的宏观与金融市场深度看板</p>
        </div>
        
        <div className="flex flex-col items-end gap-3">
           {/* Mode Switcher */}
           <div className="bg-gray-900/80 p-1 rounded-lg border border-gray-800 flex flex-wrap justify-end gap-1" data-html2canvas-ignore>
              <button
                onClick={() => setMode('data_analysis')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                  mode === 'data_analysis' 
                    ? 'bg-sky-600 text-white shadow-md' 
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <PieChart size={14} /> 数据分析
              </button>
              <div className="w-px h-6 bg-gray-700 self-center mx-1"></div>
              <button
                onClick={() => setMode('observation')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                  mode === 'observation' 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <Glasses size={14} /> 宏观观测
              </button>
              <button
                onClick={() => setMode('credit')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                  mode === 'credit' 
                    ? 'bg-purple-600 text-white shadow-md' 
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <Zap size={14} /> 信用周期
              </button>
              <button
                onClick={() => setMode('real_estate')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                  mode === 'real_estate' 
                    ? 'bg-orange-600 text-white shadow-md' 
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <Home size={14} /> 房地产
              </button>
              <button
                onClick={() => setMode('external')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                  mode === 'external' 
                    ? 'bg-cyan-600 text-white shadow-md' 
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <Globe size={14} /> 全球外贸
              </button>
              <button
                onClick={() => setMode('investment')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                  mode === 'investment' 
                    ? 'bg-emerald-600 text-white shadow-md' 
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <Briefcase size={14} /> 资产配置
              </button>
           </div>
        </div>
      </header>

      {/* 1. Overview Section - 非数据分析模式显示 */}
      {mode !== 'data_analysis' && (
        <section className="mb-8">
          <Overview data={{ ...MACRO_DATA, data: processedData }} mode={mode} />
        </section>
      )}

      {/* 2. Data Analysis Mode - 数据分析专属视图 */}
      {mode === 'data_analysis' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          {/* 第一行：经济周期象限 + 数据预警 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <div className={`flex items-center gap-2 font-semibold uppercase text-xs tracking-wider text-${theme}-400 mb-2`}>
                <Glasses size={14} />
                经济周期定位
              </div>
              <CycleQuadrant 
                data={filteredData}
                theme={theme}
              />
            </div>
            <div>
              <div className={`flex items-center gap-2 font-semibold uppercase text-xs tracking-wider text-${theme}-400 mb-2`}>
                <AlertOctagon size={14} />
                数据预警
              </div>
              <AlertPanel 
                data={filteredData}
                theme={theme}
              />
            </div>
          </div>

          {/* 第二行：Z-Score + 领先滞后关系 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ZScoreChart 
              data={filteredData}
              metricKeys={allMetricKeys}
              theme={theme}
            />
            <LeadLagChart 
              data={filteredData}
              theme={theme}
            />
          </div>

          {/* 第三行：历史百分位 */}
          <div>
            <div className={`flex items-center gap-2 font-semibold uppercase text-xs tracking-wider text-${theme}-400 mb-2`}>
              <Percent size={14} />
              历史百分位
            </div>
            <PercentileGauge 
              data={filteredData}
              metricKeys={allMetricKeys}
              theme={theme}
              timeRange={timeRange}
            />
          </div>

          {/* 第四行：相关性分析 */}
          <div>
            <div className={`flex items-center gap-2 font-semibold uppercase text-xs tracking-wider text-${theme}-400 mb-2`}>
              <Activity size={14} />
              指标相关性
            </div>
            <CorrelationHeatmap 
              data={filteredData}
              metricKeys={allMetricKeys}
              theme={theme}
              minCorrelation={0.6}
            />
          </div>

          {/* 第五行：分组指标视图 */}
          <div>
            <div className={`flex items-center gap-2 font-semibold uppercase text-xs tracking-wider text-${theme}-400 mb-2`}>
              <Layers size={14} />
              分类指标概览
            </div>
            <GroupedMetrics 
              data={filteredData}
              theme={theme}
            />
          </div>

          {/* 第六行：全部指标卡片 */}
          <div>
            <div className={`flex items-center gap-2 font-semibold uppercase text-xs tracking-wider text-${theme}-400 mb-2`}>
              <TrendingUp size={14} />
              全部指标详情
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {allMetricKeys.map(key => (
                <MetricCard 
                  key={key} 
                  dataKey={key} 
                  data={filteredData[key]} 
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. Key Metrics Grid - 非数据分析模式显示 */}
      {mode !== 'data_analysis' && (
        <section className="mb-8">
        <div className="flex items-center mb-4">
          <div className={`flex items-center gap-2 font-semibold uppercase text-xs tracking-wider text-${theme}-400`}>
            <TrendingUp size={14} /> 
            {mode === 'investment' ? '核心交易指标 (Trading Metrics)' : 
             mode === 'credit' ? '核心信贷指标 (Credit Metrics)' : 
             mode === 'real_estate' ? '核心地产指标 (Real Estate Metrics)' :
             mode === 'external' ? '核心外贸指标 (Trade Metrics)' :
             '核心宏观指标 (Macro Metrics)'}
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {coreMetricKeys.map(key => (
            <MetricCard 
              key={key} 
              dataKey={key} 
              data={filteredData[key]} 
            />
          ))}
        </div>
      </section>
      )}

      {/* 4. AI Strategist Section - 非数据分析模式显示 */}
      {mode !== 'data_analysis' && (
        <section className="mb-12">
          <AIStrategist 
            data={{ ...MACRO_DATA, data: processedData }} 
            mode={mode} 
            timeRange={timeRange}
          />
        </section>
      )}

      {/* 5. Charts Section - Conditional Rendering */}
      <div className="space-y-12 animate-in fade-in duration-500">
        
        {/* === INVESTMENT MODE CHARTS === */}
        {mode === 'investment' && (
          <>
            <section>
              <div className="flex items-center justify-between mb-4 border-b border-gray-800 pb-2">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold uppercase text-xs tracking-wider">
                  <Percent size={14} /> 第一层级：资产性价比与估值 (Valuation & Allocation)
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="lg:col-span-2">
                    <MacroChart 
                        title="股权风险溢价 (ERP) - 股债性价比" 
                        dataKeys={['equity_risk_premium']} 
                        data={filteredData} 
                        type="area"
                        syncId={SYNC_ID}
                        thresholds={[
                          { value: 3, label: '极具性价比 (>3%)', color: '#10b981', strokeDasharray: '4 4', dataKey: 'equity_risk_premium' },
                          { value: 0, label: '风险高估 (<0%)', color: '#ef4444', strokeDasharray: '4 4', dataKey: 'equity_risk_premium' }
                        ]}
                        analysisKey="equity_risk_premium"
                    />
                </div>
                <MacroChart 
                    title="上证指数 (价格)" 
                    dataKeys={['sh_index']} 
                    data={filteredData} 
                    type="area"
                    syncId={SYNC_ID}
                    thresholds={[
                      { value: 3000, label: '3000点', dataKey: 'sh_index' }
                    ]}
                />
                <MacroChart 
                    title="市场估值 (PE/PB)" 
                    dataKeys={['sh_index_pe', 'sh_index_pb']} 
                    data={filteredData} 
                    type="line"
                    syncId={SYNC_ID}
                    analysisKey="sh_index_pe"
                />
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between mb-4 border-b border-gray-800 pb-2">
                <div className="flex items-center gap-2 text-pink-400 font-semibold uppercase text-xs tracking-wider">
                  <Scale size={14} /> 第二层级：宏观流动性与外部约束 (Liquidity & External)
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="lg:col-span-2">
                    <MacroChart 
                        title="中美利差与汇率 (跨境资本锚)" 
                        dataKeys={['bond_spread', 'usd_cny']} 
                        data={filteredData} 
                        type="line"
                        syncId={SYNC_ID}
                        thresholds={[
                          { value: 0, label: '倒挂', dataKey: 'bond_spread' }
                        ]}
                        analysisKey="bond_spread"
                    />
                </div>
                <MacroChart 
                    title="M1-M2 剪刀差 (剩余流动性)" 
                    dataKeys={['m1', 'm2', 'scissors']} 
                    data={filteredData} 
                    syncId={SYNC_ID}
                    analysisKey="scissors"
                />
                <MacroChart 
                    title="黄金与外储 (避险资产)" 
                    dataKeys={['gold', 'fx_reserves']} 
                    data={filteredData} 
                    type="area"
                    syncId={SYNC_ID}
                    analysisKey="gold"
                />
              </div>
            </section>
          </>
        )}

        {/* === CREDIT CYCLE MODE CHARTS === */}
        {mode === 'credit' && (
          <>
            <section>
              <div className="flex items-center justify-between mb-4 border-b border-gray-800 pb-2">
                <div className="flex items-center gap-2 text-purple-400 font-semibold uppercase text-xs tracking-wider">
                  <Zap size={14} /> 第一层级：信用扩张与传导 (Expansion & Transmission)
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="lg:col-span-2">
                    <MacroChart 
                        title="广义流动性与活化程度 (M2 vs 剪刀差)" 
                        dataKeys={['m2', 'scissors']} 
                        data={filteredData} 
                        syncId={SYNC_ID}
                        thresholds={[
                          { value: 0, label: '剪刀差转正', strokeDasharray: '4 4', dataKey: 'scissors', color: '#fbbf24' }
                        ]}
                        analysisKey="scissors"
                    />
                </div>
                <MacroChart 
                    title="社会融资规模 (信用脉冲)" 
                    dataKeys={['social_financing']} 
                    data={filteredData}
                    type="area"
                    syncId={SYNC_ID}
                    analysisKey="social_financing"
                />
                <MacroChart 
                    title="PPI (企业盈利/偿债能力)" 
                    dataKeys={['ppi']} 
                    data={filteredData} 
                    syncId={SYNC_ID}
                    thresholds={[
                      { value: 0, label: '通缩线', color: '#9ca3af', dataKey: 'ppi' }
                    ]}
                    analysisKey="ppi"
                />
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between mb-4 border-b border-gray-800 pb-2">
                <div className="flex items-center gap-2 text-pink-400 font-semibold uppercase text-xs tracking-wider">
                  <Banknote size={14} /> 第二层级：资金成本与债务负担 (Cost & Burden)
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <MacroChart 
                    title="关键利率锚 (LPR vs 国债)" 
                    dataKeys={['lpr_1y', 'lpr_5y', 'cn_bond_10y']} 
                    data={filteredData} 
                    syncId={SYNC_ID}
                    analysisKey="lpr_5y"
                />
                <MacroChart 
                    title="居民部门杠杆率" 
                    dataKeys={['resident_leverage']} 
                    data={filteredData} 
                    type="area"
                    syncId={SYNC_ID}
                    analysisKey="resident_leverage"
                />
              </div>
            </section>
          </>
        )}

        {/* === REAL ESTATE MODE CHARTS === */}
        {mode === 'real_estate' && (
          <>
            <section>
              <div className="flex items-center justify-between mb-4 border-b border-gray-800 pb-2">
                <div className="flex items-center gap-2 text-orange-400 font-semibold uppercase text-xs tracking-wider">
                  <Home size={14} /> 第一层级：行业景气与杠杆 (Prosperity & Leverage)
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="lg:col-span-2">
                  <MacroChart 
                      title="房地产景气指数 (行业体温)" 
                      dataKeys={['real_estate_invest']} 
                      data={filteredData}
                      type="area"
                      syncId={SYNC_ID}
                      thresholds={[
                        { value: 100, label: '景气分界线', dataKey: 'real_estate_invest', color: '#fbbf24' }
                      ]}
                      analysisKey="real_estate_invest"
                  />
                </div>
                <MacroChart 
                    title="居民部门杠杆率 (购房购买力)" 
                    dataKeys={['resident_leverage']} 
                    data={filteredData} 
                    type="area"
                    syncId={SYNC_ID}
                    analysisKey="resident_leverage"
                />
                <MacroChart 
                    title="M1 增速 (房企流动性代理指标)" 
                    dataKeys={['m1']} 
                    data={filteredData} 
                    syncId={SYNC_ID}
                    thresholds={[
                        { value: 5, label: '枯荣线', color: '#9ca3af', strokeDasharray: '4 4', dataKey: 'm1' }
                    ]}
                    analysisKey="m1"
                />
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between mb-4 border-b border-gray-800 pb-2">
                <div className="flex items-center gap-2 text-yellow-400 font-semibold uppercase text-xs tracking-wider">
                  <Banknote size={14} /> 第二层级：购房成本与财富效应 (Cost & Wealth Effect)
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="lg:col-span-2">
                    <MacroChart 
                        title="房贷利率锚 (LPR 5年期)" 
                        dataKeys={['lpr_5y']} 
                        data={filteredData} 
                        type="line"
                        syncId={SYNC_ID}
                        analysisKey="lpr_5y"
                    />
                </div>
                <MacroChart 
                    title="社会消费品零售 (受房价影响)" 
                    dataKeys={['retail_sales']} 
                    data={filteredData} 
                    type="area"
                    syncId={SYNC_ID}
                    analysisKey="retail_sales"
                />
                <MacroChart 
                    title="CPI 居民通胀 (租金影响)" 
                    dataKeys={['cpi']} 
                    data={filteredData} 
                    syncId={SYNC_ID}
                    analysisKey="cpi"
                />
              </div>
            </section>
          </>
        )}

        {/* === EXTERNAL MODE CHARTS === */}
        {mode === 'external' && (
          <>
            <section>
              <div className="flex items-center justify-between mb-4 border-b border-gray-800 pb-2">
                <div className="flex items-center gap-2 text-cyan-400 font-semibold uppercase text-xs tracking-wider">
                  <Globe size={14} /> 第一层级：贸易与汇率 (Trade & FX)
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="lg:col-span-2">
                  <MacroChart 
                      title="出口同比增速 (外需拉动)" 
                      dataKeys={['exports_yoy']} 
                      data={filteredData}
                      type="area"
                      syncId={SYNC_ID}
                      thresholds={[
                        { value: 0, label: '衰退线', dataKey: 'exports_yoy', color: '#ef4444' }
                      ]}
                      analysisKey="exports_yoy"
                  />
                </div>
                <MacroChart 
                    title="美元兑人民币汇率" 
                    dataKeys={['usd_cny']} 
                    data={filteredData} 
                    type="line"
                    syncId={SYNC_ID}
                    thresholds={[
                        { value: 7.0, label: '心理关口', strokeDasharray: '4 4', dataKey: 'usd_cny', color: '#9ca3af' }
                    ]}
                    analysisKey="usd_cny"
                />
                <MacroChart 
                    title="外汇储备 (安全垫)" 
                    dataKeys={['fx_reserves']} 
                    data={filteredData} 
                    type="area"
                    syncId={SYNC_ID}
                    analysisKey="fx_reserves"
                />
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between mb-4 border-b border-gray-800 pb-2">
                <div className="flex items-center gap-2 text-blue-400 font-semibold uppercase text-xs tracking-wider">
                  <Scale size={14} /> 第二层级：全球资产与价差 (Global Spread & Assets)
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="lg:col-span-2">
                    <MacroChart 
                        title="中美利差 (货币政策约束)" 
                        dataKeys={['bond_spread', 'us_bond_10y', 'cn_bond_10y']} 
                        data={filteredData} 
                        type="line"
                        syncId={SYNC_ID}
                        thresholds={[
                          { value: 0, label: '倒挂线', dataKey: 'bond_spread', color: '#ef4444' }
                        ]}
                        analysisKey="bond_spread"
                    />
                </div>
                <MacroChart 
                    title="10年期美债收益率 (全球资产锚)" 
                    dataKeys={['us_bond_10y']} 
                    data={filteredData} 
                    type="line"
                    syncId={SYNC_ID}
                    analysisKey="us_bond_10y"
                />
                <MacroChart 
                    title="黄金 (对冲美元资产)" 
                    dataKeys={['gold']} 
                    data={filteredData} 
                    type="area"
                    syncId={SYNC_ID}
                    analysisKey="gold"
                />
              </div>
            </section>
          </>
        )}

        {/* === OBSERVATION MODE CHARTS === */}
        {mode === 'observation' && (
          <>
            <section>
              <div className="flex items-center justify-between mb-4 border-b border-gray-800 pb-2">
                <div className="flex items-center gap-2 text-orange-400 font-semibold uppercase text-xs tracking-wider">
                  <Activity size={14} /> 第一层级：周期定位 (Regime Positioning)
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <MacroChart 
                    title="GDP 同比增速" 
                    dataKeys={['gdp']} 
                    data={filteredData}
                    type="line" 
                    syncId={SYNC_ID}
                    thresholds={[
                      { value: 5, label: '目标线', color: '#fb923c', strokeDasharray: '2 2', dataKey: 'gdp' }
                    ]}
                />
                <MacroChart 
                    title="制造业 PMI (景气度)" 
                    dataKeys={['pmi']} 
                    data={filteredData}
                    type="line" 
                    syncId={SYNC_ID}
                    thresholds={[
                      { value: 50, label: '荣枯线', color: '#fbbf24', strokeDasharray: '5 5', dataKey: 'pmi' }
                    ]}
                />
                <MacroChart 
                    title="CPI vs PPI (通胀剪刀差)" 
                    dataKeys={['cpi', 'ppi']} 
                    data={filteredData} 
                    syncId={SYNC_ID}
                    thresholds={[
                      { value: 0, label: '通缩警戒', color: '#9ca3af', dataKey: 'cpi' }
                    ]}
                    analysisKey="cpi"
                />
                <MacroChart 
                    title="出口 vs 零售 (三驾马车)" 
                    dataKeys={['exports_yoy', 'retail_sales']} 
                    data={filteredData} 
                    syncId={SYNC_ID}
                    analysisKey="retail_sales"
                />
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between mb-4 border-b border-gray-800 pb-2">
                <div className="flex items-center gap-2 text-green-400 font-semibold uppercase text-xs tracking-wider">
                  <Banknote size={14} /> 第二层级：机器燃料 (Liquidity & Credit)
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="lg:col-span-2">
                    <MacroChart 
                        title="M1-M2 剪刀差 (流动性陷阱监测)" 
                        dataKeys={['m1', 'm2', 'scissors']} 
                        data={filteredData} 
                        syncId={SYNC_ID}
                        thresholds={[
                          { value: 0, label: '剪刀差转正', strokeDasharray: '4 4', dataKey: 'scissors' }
                        ]}
                        analysisKey="scissors"
                    />
                </div>
                <MacroChart 
                    title="社会融资规模 (信用脉冲)" 
                    dataKeys={['social_financing']} 
                    data={filteredData}
                    type="area"
                    syncId={SYNC_ID}
                />
                <MacroChart 
                    title="LPR 利率 (资金成本)" 
                    dataKeys={['lpr_1y', 'lpr_5y']} 
                    data={filteredData} 
                    syncId={SYNC_ID}
                    analysisKey="lpr_5y"
                />
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between mb-4 border-b border-gray-800 pb-2">
                <div className="flex items-center gap-2 text-purple-400 font-semibold uppercase text-xs tracking-wider">
                  <AlertOctagon size={14} /> 第三层级：结构性阻力 (Structural Drag)
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <MacroChart 
                    title="房地产景气度" 
                    dataKeys={['real_estate_invest']} 
                    data={filteredData}
                    type="area"
                    syncId={SYNC_ID}
                    thresholds={[
                      { value: 100, label: '景气分界', dataKey: 'real_estate_invest' }
                    ]}
                />
                <MacroChart 
                    title="失业率 (社会压力)" 
                    dataKeys={['unemployment']} 
                    data={filteredData} 
                    syncId={SYNC_ID}
                    thresholds={[
                      { value: 5.5, label: '警戒线', dataKey: 'unemployment' }
                    ]}
                />
                <div className="lg:col-span-2">
                    <MacroChart 
                        title="居民部门杠杆率 (长期债务周期)" 
                        dataKeys={['resident_leverage']} 
                        data={filteredData} 
                        syncId={SYNC_ID}
                    />
                </div>
              </div>
            </section>
          </>
        )}
      </div>

      {/* Floating Control Dock */}
      <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-40 animate-in slide-in-from-bottom-4 duration-500 no-export">
        <div className="flex items-center p-1.5 bg-gray-900/90 backdrop-blur-md border border-gray-700/60 rounded-full shadow-2xl shadow-black/50">
           {/* Time Range Selectors */}
           <div className="flex items-center bg-gray-800/50 rounded-full p-1 mr-2">
              <Calendar className="w-4 h-4 text-gray-400 ml-2 mr-3" />
              {(['5Y', '10Y', '20Y', 'ALL'] as TimeRange[]).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all duration-300 ${
                    timeRange === range 
                      ? `bg-${theme}-600 text-white shadow-lg shadow-${theme}-900/30` 
                      : 'text-gray-400 hover:text-gray-100 hover:bg-gray-700/50'
                  }`}
                >
                  {range === 'ALL' ? '全部' : `近${range.replace('Y', '年')}`}
                </button>
              ))}
           </div>

           {/* Divider */}
           <div className="h-6 w-px bg-gray-700 mx-1"></div>

           {/* Export Button */}
           <button 
             onClick={handleExportImage}
             disabled={isExporting}
             className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition-all duration-200 flex items-center justify-center w-9 h-9"
             title="导出为图片"
           >
             {isExporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
           </button>

           {/* Scroll Top Button */}
           <button 
             onClick={scrollToTop}
             className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition-all duration-200 flex items-center justify-center w-9 h-9"
             title="回到顶部"
           >
             <ArrowUp className="w-5 h-5" />
           </button>
        </div>
      </div>

    </div>
  );
};

export default App;