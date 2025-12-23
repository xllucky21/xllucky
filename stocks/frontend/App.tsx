import React, { useState, useMemo, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { MARKET_FULL } from './data';
import { Overview } from './components/Overview';
import { MarketChart } from './components/MarketChart';
import { FundFlowChart } from './components/FundFlowChart';
import { TrendAnalysis } from './components/TrendAnalysis';
import { Glossary } from './components/Glossary';
import { VolumeIndexChart } from './components/VolumeIndexChart';
import { 
  BarChart3, 
  Calendar,
  TrendingUp,
  Banknote,
  Globe,
  ArrowUp,
  HelpCircle,
  Eye,
  EyeOff,
  Settings,
  X,
  Download,
  Loader2,
} from 'lucide-react';

type TimeRange = '1年' | '2年' | '5年' | '全部';

// 图表配置
type ChartKey = 'volumePrice' | 'amount' | 'aIndex' | 'hkIndex' | 'nasdaq' | 'fundFlow' | 'margin' | 'rate';

const CHART_LABELS: Record<ChartKey, string> = {
  volumePrice: '量价关系',
  amount: '成交额',
  aIndex: 'A股指数',
  hkIndex: '港股指数',
  nasdaq: '纳指',
  fundFlow: '资金流向',
  margin: '融资融券',
  rate: '利率汇率',
};

const App: React.FC = () => {
  const [timeRange, setTimeRange] = useState<TimeRange>('1年');
  const [showGlossary, setShowGlossary] = useState(false);
  const [showChartSettings, setShowChartSettings] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  
  // 图表可见性状态 (从 localStorage 读取)
  const [chartVisibility, setChartVisibility] = useState<Record<ChartKey, boolean>>(() => {
    const saved = localStorage.getItem('chartVisibility');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // ignore
      }
    }
    return {
      volumePrice: true,
      amount: true,
      aIndex: true,
      hkIndex: true,
      nasdaq: true,
      fundFlow: true,
      margin: true,
      rate: true,
    };
  });

  // 保存图表可见性到 localStorage
  useEffect(() => {
    localStorage.setItem('chartVisibility', JSON.stringify(chartVisibility));
  }, [chartVisibility]);

  const toggleChart = (key: ChartKey) => {
    setChartVisibility(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // 数据过滤
  const filteredData = useMemo(() => {
    const data = MARKET_FULL.data;
    
    const getDaysFromRange = (range: TimeRange) => {
      switch (range) {
        case '1年': return 252;
        case '2年': return 504;
        case '5年': return 1260;
        default: return Infinity;
      }
    };

    const days = getDaysFromRange(timeRange);
    
    const filterArray = (arr: any[]) => {
      if (!arr || days === Infinity) return arr || [];
      return arr.slice(-days);
    };

    return {
      meta: MARKET_FULL.meta,
      data: {
        a_share: filterArray(data.a_share),
        hk_main: filterArray(data.hk_main),
        hk_tech: filterArray(data.hk_tech),
        south: filterArray(data.south),
        rate: filterArray(data.rate),
        nasdaq: filterArray(data.nasdaq),
        margin: filterArray(data.margin),
        shibor: filterArray(data.shibor),
        bond: filterArray(data.bond),
        fund_flow: filterArray(data.fund_flow),
      },
    };
  }, [timeRange]);

  // 准备图表数据
  const chartData = useMemo(() => {
    const { a_share, hk_main, hk_tech, south, rate, nasdaq, margin, shibor, bond, fund_flow } = filteredData.data;

    // 合并A股和港股数据
    const indexData = a_share.map((d: any) => {
      const hkMain = hk_main.find((h: any) => h.date === d.date);
      const hkTech = hk_tech.find((h: any) => h.date === d.date);
      const nasdaqItem = nasdaq.find((n: any) => n.date === d.date);
      return {
        date: d.date,
        sh_close: d.sh_close,
        sz_close: d.sz_close,
        hk_main: hkMain?.close,
        hk_tech: hkTech?.close,
        nasdaq: nasdaqItem?.close,
      };
    });

    // 成交额数据
    const amountData = a_share.map((d: any) => ({
      date: d.date,
      amount: d.total_amount_yi,
    }));

    // 融资融券数据
    const marginData = margin.map((d: any) => ({
      date: d.date,
      margin_balance: d.margin_balance_yi,
      total_balance: d.total_balance_yi,
    }));

    // 利率数据
    const rateData = shibor.map((d: any) => {
      const b = bond.find((x: any) => x.date === d.date);
      const r = rate.find((x: any) => x.date === d.date);
      return {
        date: d.date,
        shibor_overnight: d.overnight,
        shibor_1w: d.week_1,
        cn_10y: b?.cn_10y,
        us_10y: b?.us_10y,
        spread: b?.spread,
        usd_cny: r?.rate,
      };
    });

    return { indexData, amountData, marginData, rateData };
  }, [filteredData]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 导出功能
  const handleExport = async () => {
    if (!contentRef.current || isExporting) return;
    
    setIsExporting(true);
    try {
      // 滚动到顶部确保完整截图
      window.scrollTo(0, 0);
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const canvas = await html2canvas(contentRef.current, {
        backgroundColor: '#030712', // gray-950
        scale: 2, // 高清
        useCORS: true,
        logging: false,
        windowHeight: contentRef.current.scrollHeight,
        height: contentRef.current.scrollHeight,
      });
      
      // 创建下载链接
      const link = document.createElement('a');
      const date = new Date().toISOString().slice(0, 10);
      link.download = `股市分析看板_${date}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('导出失败:', error);
      alert('导出失败，请重试');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen text-slate-200 p-4 md:p-8 font-sans bg-gray-950 pb-32">
      <div ref={contentRef}>
      {/* Header */}
      <header className="mb-6 flex flex-col md:flex-row md:items-center justify-between border-b border-gray-800 pb-4 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <BarChart3 className="w-7 h-7 text-blue-500" />
            股市全维分析看板
            <span className="text-xs font-bold text-gray-950 self-end mb-1 px-2 py-0.5 rounded tracking-wider bg-blue-500">
              MULTI-DIMENSION
            </span>
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            A股/港股/资金/利率/汇率 综合分析 · 更新于 {MARKET_FULL.meta.updated_at}
          </p>
        </div>
        <button
          onClick={() => setShowGlossary(!showGlossary)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
            showGlossary 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
        >
          <HelpCircle className="w-4 h-4" />
          <span className="text-sm font-medium">名词解释</span>
        </button>
      </header>

      {/* Glossary Panel */}
      {showGlossary && (
        <section className="mb-6">
          <Glossary />
        </section>
      )}



      {/* 图表设置面板 */}
      {showChartSettings && (
        <section className="mb-6">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                <Settings className="w-4 h-4" />
                图表显示设置
              </h3>
              <button 
                onClick={() => setShowChartSettings(false)}
                className="p-1 hover:bg-gray-700 rounded"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(Object.keys(CHART_LABELS) as ChartKey[]).map(key => (
                <button
                  key={key}
                  onClick={() => toggleChart(key)}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                    chartVisibility[key] 
                      ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' 
                      : 'bg-gray-800/50 border-gray-700 text-gray-500'
                  }`}
                >
                  <span className="text-sm font-medium">{CHART_LABELS[key]}</span>
                  {chartVisibility[key] ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Overview Section */}
      <section className="mb-6">
        <Overview data={filteredData} />
      </section>

      {/* Trend Analysis */}
      <section className="mb-6">
        <TrendAnalysis data={filteredData} />
      </section>

      {/* Charts Grid */}
      <div className="space-y-4">
        {/* 量价关系（最重要） */}
        {chartVisibility.volumePrice && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-blue-400 font-semibold uppercase text-xs tracking-wider">
                <BarChart3 size={14} /> 量价关系
              </div>
              <p className="text-gray-500 text-xs">量底见价底，天量见天价。红柱上涨日，绿柱下跌日，柱高为成交额</p>
            </div>
            <VolumeIndexChart
              title="成交额 vs 上证指数"
              description="成交额(柱状图)与上证指数(折线)叠加显示。放量上涨=强势突破，缩量下跌=惜售企稳，放量下跌=恐慌出逃。"
              data={filteredData.data.a_share}
              syncId="market-sync"
            />
          </section>
        )}

        {/* 成交额单独图表 */}
        {chartVisibility.amount && (
          <section>
            <MarketChart
              title="两市成交额 (亿元)"
              description="成交额是市场活跃度的温度计。万亿以上为活跃，1.5万亿以上为火爆，低于8000亿则偏冷清。"
              data={chartData.amountData}
              series={[
                { key: 'amount', name: '成交额', color: '#3b82f6', type: 'area' },
              ]}
              syncId="market-sync"
              thresholds={[
                { value: 10000, label: '万亿', color: '#f59e0b' },
                { value: 15000, label: '1.5万亿', color: '#ef4444' },
              ]}
            />
          </section>
        )}

        {/* A股指数走势 */}
        {chartVisibility.aIndex && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-red-400 font-semibold uppercase text-xs tracking-wider">
                <TrendingUp size={14} /> A股指数
              </div>
              <p className="text-gray-500 text-xs">反映A股市场整体涨跌趋势，是判断牛熊的核心指标</p>
            </div>
            <div className="space-y-4">
              <MarketChart
                title="上证指数"
                description="代表沪市大盘蓝筹股走势，权重股以金融、能源为主。3000点是重要心理关口。"
                data={chartData.indexData}
                series={[
                  { key: 'sh_close', name: '上证指数', color: '#ef4444', type: 'line' },
                ]}
                syncId="market-sync"
                thresholds={[{ value: 3000, label: '3000点', color: '#6b7280' }]}
              />
              <MarketChart
                title="深证成指"
                description="代表深市中小成长股走势，科技、消费权重较高，弹性大于上证。"
                data={chartData.indexData}
                series={[
                  { key: 'sz_close', name: '深证成指', color: '#f97316', type: 'line' },
                ]}
                syncId="market-sync"
              />
            </div>
          </section>
        )}

        {/* 港股指数走势 */}
        {chartVisibility.hkIndex && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-green-400 font-semibold uppercase text-xs tracking-wider">
                <TrendingUp size={14} /> 港股指数
              </div>
              <p className="text-gray-500 text-xs">港股受外资影响大，常领先A股反映市场情绪</p>
            </div>
            <div className="space-y-4">
              <MarketChart
                title="恒生指数"
                description="港股主板代表，涵盖金融、地产、消费龙头，是外资配置中国资产的风向标。"
                data={chartData.indexData}
                series={[
                  { key: 'hk_main', name: '恒生指数', color: '#10b981', type: 'line' },
                ]}
                syncId="market-sync"
              />
              <MarketChart
                title="恒生科技"
                description="聚焦港股互联网龙头（腾讯、阿里、美团等），波动大，是科技情绪的放大器。"
                data={chartData.indexData}
                series={[
                  { key: 'hk_tech', name: '恒生科技', color: '#06b6d4', type: 'line' },
                ]}
                syncId="market-sync"
              />
            </div>
          </section>
        )}

        {/* 纳指 */}
        {chartVisibility.nasdaq && (
          <section>
            <MarketChart
              title="纳斯达克100 ETF (QQQ)"
              description="追踪美股科技龙头表现，是全球风险偏好的风向标。QQQ上涨通常利好A股科技板块。"
              data={chartData.indexData}
              series={[
                { key: 'nasdaq', name: 'QQQ', color: '#f59e0b', type: 'area' },
              ]}
              syncId="market-sync"
            />
          </section>
        )}

        {/* 资金流向 */}
        {chartVisibility.fundFlow && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-red-400 font-semibold uppercase text-xs tracking-wider">
                <Banknote size={14} /> 资金流向
              </div>
              <p className="text-gray-500 text-xs">追踪大资金动向，主力持续流入往往预示上涨行情</p>
            </div>
            <div className="space-y-4">
              <FundFlowChart
                title="主力资金净流入 (亿元)"
                description="主力资金=超大单+大单。红色为流入，绿色为流出。连续多日流入是积极信号。"
                data={filteredData.data.fund_flow}
                dataKey="main_net_yi"
              />
              <FundFlowChart
                title="南向资金净流入 (亿元)"
                description="内地资金流入港股的规模。南向大幅流入说明资金看好港股估值洼地。"
                data={filteredData.data.south}
                dataKey="net_inflow_yi"
              />
            </div>
          </section>
        )}

        {/* 融资融券 + 超大单资金 */}
        {chartVisibility.margin && (
          <section>
            <div className="space-y-4">
              <MarketChart
                title="融资余额 (亿元)"
                description="投资者借钱买股的规模，反映杠杆资金情绪。余额上升说明看多情绪浓，下降则趋于谨慎。"
                data={chartData.marginData}
                series={[
                  { key: 'margin_balance', name: '融资余额', color: '#ec4899', type: 'area' },
                ]}
                syncId="market-sync"
              />
              <FundFlowChart
                title="超大单资金净流入 (亿元)"
                description="单笔成交100万以上的大资金动向，代表机构和游资的真实意图。"
                data={filteredData.data.fund_flow}
                dataKey="super_net_yi"
              />
            </div>
          </section>
        )}

        {/* 利率与汇率 */}
        {chartVisibility.rate && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-purple-400 font-semibold uppercase text-xs tracking-wider">
                <Globe size={14} /> 利率与汇率
              </div>
              <p className="text-gray-500 text-xs">宏观流动性环境，影响资金成本和外资流向</p>
            </div>
            <div className="space-y-4">
              <MarketChart
                title="中美国债收益率"
                description="10年期国债收益率反映长期利率预期。利差为负(倒挂)时，外资流出压力增大。"
                data={chartData.rateData}
                series={[
                  { key: 'cn_10y', name: '中国10年', color: '#ef4444', type: 'line' },
                  { key: 'us_10y', name: '美国10年', color: '#3b82f6', type: 'line' },
                  { key: 'spread', name: '利差', color: '#f59e0b', type: 'line' },
                ]}
                syncId="market-sync"
                thresholds={[{ value: 0, label: '倒挂线', color: '#ef4444' }]}
              />
              <MarketChart
                title="美元/离岸人民币 & Shibor"
                description="汇率破7说明人民币贬值压力大。Shibor隔夜利率反映银行间资金松紧，越低流动性越宽松。"
                data={chartData.rateData}
                series={[
                  { key: 'usd_cny', name: '美元/CNH', color: '#8b5cf6', type: 'line' },
                  { key: 'shibor_overnight', name: 'Shibor隔夜', color: '#14b8a6', type: 'line' },
                ]}
                syncId="market-sync"
                thresholds={[{ value: 7.0, label: '7.0关口', color: '#6b7280' }]}
              />
            </div>
          </section>
        )}
      </div>
      </div>

      {/* Floating Control Dock */}
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40">
        <div className="flex items-center p-1.5 bg-gray-900/90 backdrop-blur-md border border-gray-700/60 rounded-full shadow-2xl shadow-black/50">
          {/* Time Range Selectors */}
          <div className="flex items-center bg-gray-800/50 rounded-full p-1 mr-2">
            <Calendar className="w-4 h-4 text-gray-400 ml-2 mr-3" />
            {(['1年', '2年', '5年', '全部'] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 text-xs font-bold rounded-full transition-all duration-300 ${
                  timeRange === range 
                    ? 'bg-blue-600 text-white shadow-lg' 
                    : 'text-gray-400 hover:text-gray-100 hover:bg-gray-700/50'
                }`}
              >
                {range}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="h-6 w-px bg-gray-700 mx-1"></div>

          {/* Chart Settings Button */}
          <button 
            onClick={() => setShowChartSettings(!showChartSettings)}
            className={`p-2 rounded-full transition-all duration-200 flex items-center justify-center w-9 h-9 ${
              showChartSettings 
                ? 'bg-blue-600 text-white' 
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
            title="图表设置"
          >
            <Settings className="w-5 h-5" />
          </button>

          {/* Export Button */}
          <button 
            onClick={handleExport}
            disabled={isExporting}
            className={`p-2 rounded-full transition-all duration-200 flex items-center justify-center w-9 h-9 ${
              isExporting 
                ? 'bg-green-600 text-white cursor-wait' 
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
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
