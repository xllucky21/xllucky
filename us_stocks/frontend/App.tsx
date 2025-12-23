import React, { useState, useMemo, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { US_MARKET } from './data';
import { Overview } from './components/Overview';
import { MarketChart } from './components/MarketChart';
import { VixChart } from './components/VixChart';
import { Glossary } from './components/Glossary';
import { 
  BarChart3, 
  Calendar,
  TrendingUp,
  DollarSign,
  Globe,
  ArrowUp,
  HelpCircle,
  Eye,
  EyeOff,
  Settings,
  X,
  Download,
  Loader2,
  Zap,
} from 'lucide-react';

type TimeRange = '1年' | '2年' | '5年' | '全部';

// 图表配置
type ChartKey = 'indices' | 'vix' | 'bond' | 'dollar' | 'sectors' | 'stars';

const CHART_LABELS: Record<ChartKey, string> = {
  indices: '三大指数',
  vix: 'VIX恐慌',
  bond: '美债收益率',
  dollar: '美元指数',
  sectors: '板块ETF',
  stars: '七巨头',
};

const App: React.FC = () => {
  const [timeRange, setTimeRange] = useState<TimeRange>('1年');
  const [showGlossary, setShowGlossary] = useState(false);
  const [showChartSettings, setShowChartSettings] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  
  // 图表可见性状态
  const [chartVisibility, setChartVisibility] = useState<Record<ChartKey, boolean>>(() => {
    const saved = localStorage.getItem('usChartVisibility');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // ignore
      }
    }
    return {
      indices: true,
      vix: true,
      bond: true,
      dollar: true,
      sectors: true,
      stars: true,
    };
  });

  useEffect(() => {
    localStorage.setItem('usChartVisibility', JSON.stringify(chartVisibility));
  }, [chartVisibility]);

  const toggleChart = (key: ChartKey) => {
    setChartVisibility(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // 数据过滤
  const filteredData = useMemo(() => {
    const data = US_MARKET.data;
    
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

    const filterObject = (obj: Record<string, any[]>) => {
      const result: Record<string, any[]> = {};
      for (const key in obj) {
        result[key] = filterArray(obj[key]);
      }
      return result;
    };

    return {
      meta: US_MARKET.meta,
      data: {
        indices: filterObject(data.indices),
        vix: filterArray(data.vix),
        bond: filterArray(data.bond),
        dollar: filterArray(data.dollar),
        fed_rate: filterArray(data.fed_rate),
        sectors: filterObject(data.sectors),
        stars: filterObject(data.stars),
      },
    };
  }, [timeRange]);

  // 准备图表数据 (优化: 使用 Map 进行 O(n) 合并)
  const chartData = useMemo(() => {
    const { indices, bond, dollar, fed_rate, sectors, stars } = filteredData.data;

    // 辅助函数: 将数组转为日期索引的 Map
    const toDateMap = (arr: any[]) => {
      const map = new Map();
      arr?.forEach(d => map.set(d.date, d));
      return map;
    };

    // 合并三大指数数据 (O(n) 优化)
    const spxMap = toDateMap(indices.spx);
    const ndxMap = toDateMap(indices.ndx);
    const indexData = (indices.dji || []).map((d: any) => ({
      date: d.date,
      dji: d.close,
      spx: spxMap.get(d.date)?.close,
      ndx: ndxMap.get(d.date)?.close,
    }));

    // 利率数据
    const bondData = bond.map((d: any) => ({
      date: d.date,
      us_2y: d.us_2y,
      us_10y: d.us_10y,
      spread: d.spread_2_10,
    }));

    // 美元指数数据
    const dollarData = dollar.map((d: any) => ({
      date: d.date,
      dollar: d.close,
    }));

    // 合并板块数据 (O(n) 优化)
    const xlfMap = toDateMap(sectors.xlf);
    const xleMap = toDateMap(sectors.xle);
    const xlvMap = toDateMap(sectors.xlv);
    const sectorData = (sectors.xlk || []).map((d: any) => ({
      date: d.date,
      xlk: d.close,
      xlf: xlfMap.get(d.date)?.close,
      xle: xleMap.get(d.date)?.close,
      xlv: xlvMap.get(d.date)?.close,
    }));

    // 合并明星股数据 (O(n) 优化)
    const msftMap = toDateMap(stars.msft);
    const nvdaMap = toDateMap(stars.nvda);
    const googlMap = toDateMap(stars.googl);
    const amznMap = toDateMap(stars.amzn);
    const metaMap = toDateMap(stars.meta);
    const tslaMap = toDateMap(stars.tsla);
    const starData = (stars.aapl || []).map((d: any) => ({
      date: d.date,
      aapl: d.close,
      msft: msftMap.get(d.date)?.close,
      nvda: nvdaMap.get(d.date)?.close,
      googl: googlMap.get(d.date)?.close,
      amzn: amznMap.get(d.date)?.close,
      meta: metaMap.get(d.date)?.close,
      tsla: tslaMap.get(d.date)?.close,
    }));

    return { indexData, bondData, dollarData, sectorData, starData };
  }, [filteredData]);

  // 计算区间涨跌幅
  const calcRangeChange = (arr: any[], field = 'close') => {
    if (!arr?.length) return 0;
    const first = arr[0]?.[field];
    const last = arr[arr.length - 1]?.[field];
    if (!first || !last) return 0;
    return ((last - first) / first) * 100;
  };

  // 七巨头区间涨跌幅
  const starRangeChanges = useMemo(() => {
    const stars = filteredData.data.stars;
    return {
      aapl: calcRangeChange(stars.aapl),
      msft: calcRangeChange(stars.msft),
      nvda: calcRangeChange(stars.nvda),
      googl: calcRangeChange(stars.googl),
      amzn: calcRangeChange(stars.amzn),
      meta: calcRangeChange(stars.meta),
      tsla: calcRangeChange(stars.tsla),
    };
  }, [filteredData]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleExport = async () => {
    if (!contentRef.current || isExporting) return;
    
    setIsExporting(true);
    try {
      window.scrollTo(0, 0);
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const canvas = await html2canvas(contentRef.current, {
        backgroundColor: '#030712',
        scale: 2,
        useCORS: true,
        logging: false,
        windowHeight: contentRef.current.scrollHeight,
        height: contentRef.current.scrollHeight,
      });
      
      const link = document.createElement('a');
      const date = new Date().toISOString().slice(0, 10);
      link.download = `美股分析看板_${date}.png`;
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
            <BarChart3 className="w-7 h-7 text-green-500" />
            美股全维分析看板
            <span className="text-xs font-bold text-gray-950 self-end mb-1 px-2 py-0.5 rounded tracking-wider bg-green-500">
              US MARKET
            </span>
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            三大指数/VIX/国债/美元/板块/七巨头 综合分析 · 更新于 {US_MARKET.meta.updated_at}
          </p>
        </div>
        <button
          onClick={() => setShowGlossary(!showGlossary)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
            showGlossary 
              ? 'bg-green-600 text-white' 
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
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {(Object.keys(CHART_LABELS) as ChartKey[]).map(key => (
                <button
                  key={key}
                  onClick={() => toggleChart(key)}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                    chartVisibility[key] 
                      ? 'bg-green-500/10 border-green-500/30 text-green-400' 
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

      {/* Charts Grid */}
      <div className="space-y-4">
        {/* 三大指数 */}
        {chartVisibility.indices && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-green-400 font-semibold uppercase text-xs tracking-wider">
                <TrendingUp size={14} /> 三大指数
              </div>
              <p className="text-gray-500 text-xs">道琼斯代表蓝筹，标普代表大盘，纳指代表科技</p>
            </div>
            <div className="space-y-4">
              <MarketChart
                title="道琼斯工业指数"
                description="30家美国大型蓝筹股，以金融、工业、消费为主，是美股历史最悠久的指数。"
                data={chartData.indexData}
                series={[
                  { key: 'dji', name: '道琼斯', color: '#3b82f6', type: 'line' },
                ]}
                syncId="us-sync"
              />
              <MarketChart
                title="标普500指数"
                description="500家美国大型公司，覆盖面最广，是衡量美股整体表现的最佳指标。"
                data={chartData.indexData}
                series={[
                  { key: 'spx', name: '标普500', color: '#22c55e', type: 'line' },
                ]}
                syncId="us-sync"
              />
              <MarketChart
                title="纳斯达克综合指数"
                description="以科技股为主，包含苹果、微软、英伟达等科技巨头，波动性较大。"
                data={chartData.indexData}
                series={[
                  { key: 'ndx', name: '纳斯达克', color: '#a855f7', type: 'line' },
                ]}
                syncId="us-sync"
              />
            </div>
          </section>
        )}

        {/* VIX恐慌指数 */}
        {chartVisibility.vix && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-yellow-400 font-semibold uppercase text-xs tracking-wider">
                <Zap size={14} /> VIX 恐慌指数
              </div>
              <p className="text-gray-500 text-xs">市场恐慌情绪温度计，VIX飙升往往伴随大跌</p>
            </div>
            <VixChart
              title="CBOE波动率指数 (VIX)"
              description="衡量标普500期权隐含波动率。<20平静，20-30警惕，>30恐慌。逆向指标，VIX极高时往往是买入机会。"
              data={filteredData.data.vix}
              syncId="us-sync"
            />
          </section>
        )}

        {/* 美债收益率 */}
        {chartVisibility.bond && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-blue-400 font-semibold uppercase text-xs tracking-wider">
                <DollarSign size={14} /> 美债收益率
              </div>
              <p className="text-gray-500 text-xs">无风险利率基准，影响股市估值</p>
            </div>
            <div className="space-y-4">
              <MarketChart
                title="美债收益率曲线"
                description="10年期代表长期利率预期，2年期反映短期政策预期。利差倒挂(负值)预示经济衰退。"
                data={chartData.bondData}
                series={[
                  { key: 'us_10y', name: '10年期', color: '#3b82f6', type: 'line' },
                  { key: 'us_2y', name: '2年期', color: '#f59e0b', type: 'line' },
                ]}
                syncId="us-sync"
              />
              <MarketChart
                title="2-10年利差"
                description="10年期减2年期收益率。倒挂(负值)是经济衰退的领先指标，历史准确率极高。"
                data={chartData.bondData}
                series={[
                  { key: 'spread', name: '利差', color: '#ef4444', type: 'area' },
                ]}
                syncId="us-sync"
                thresholds={[{ value: 0, label: '倒挂线', color: '#ef4444' }]}
              />
            </div>
          </section>
        )}

        {/* 美元指数 */}
        {chartVisibility.dollar && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-cyan-400 font-semibold uppercase text-xs tracking-wider">
                <Globe size={14} /> 美元指数
              </div>
              <p className="text-gray-500 text-xs">美元强弱影响全球资金流向</p>
            </div>
            <MarketChart
              title="美元指数 (DXY)"
              description="衡量美元对一篮子货币的强弱。美元走强对新兴市场和大宗商品形成压力，对美股影响复杂。"
              data={chartData.dollarData}
              series={[
                { key: 'dollar', name: '美元指数', color: '#06b6d4', type: 'area' },
              ]}
              syncId="us-sync"
              thresholds={[{ value: 100, label: '100关口', color: '#6b7280' }]}
            />
          </section>
        )}

        {/* 板块ETF */}
        {chartVisibility.sectors && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-purple-400 font-semibold uppercase text-xs tracking-wider">
                <BarChart3 size={14} /> 板块轮动
              </div>
              <p className="text-gray-500 text-xs">追踪不同行业表现，判断市场风格</p>
            </div>
            <MarketChart
              title="主要板块ETF走势"
              description="XLK(科技)、XLF(金融)、XLE(能源)、XLV(医疗)。科技领涨=成长风格，金融/能源领涨=价值风格。"
              data={chartData.sectorData}
              series={[
                { key: 'xlk', name: '科技XLK', color: '#a855f7', type: 'line' },
                { key: 'xlf', name: '金融XLF', color: '#3b82f6', type: 'line' },
                { key: 'xle', name: '能源XLE', color: '#f59e0b', type: 'line' },
                { key: 'xlv', name: '医疗XLV', color: '#22c55e', type: 'line' },
              ]}
              syncId="us-sync"
            />
          </section>
        )}

        {/* 七巨头 */}
        {chartVisibility.stars && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-red-400 font-semibold uppercase text-xs tracking-wider">
                <Zap size={14} /> 七巨头 Magnificent 7
              </div>
              <p className="text-gray-500 text-xs">占标普500权重超30%，决定大盘走向</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MarketChart
                title={`AAPL 苹果 ${starRangeChanges.aapl >= 0 ? '+' : ''}${starRangeChanges.aapl.toFixed(1)}%`}
                description="全球市值最大公司，消费电子+服务生态，现金流之王。"
                data={filteredData.data.stars.aapl?.map((d: any) => ({ date: d.date, close: d.close })) || []}
                series={[{ key: 'close', name: 'AAPL', color: starRangeChanges.aapl >= 0 ? '#22c55e' : '#ef4444', type: 'area' }]}
                syncId="us-sync"
              />
              <MarketChart
                title={`MSFT 微软 ${starRangeChanges.msft >= 0 ? '+' : ''}${starRangeChanges.msft.toFixed(1)}%`}
                description="云计算+AI双龙头，Azure增长强劲，Copilot商业化领先。"
                data={filteredData.data.stars.msft?.map((d: any) => ({ date: d.date, close: d.close })) || []}
                series={[{ key: 'close', name: 'MSFT', color: starRangeChanges.msft >= 0 ? '#22c55e' : '#ef4444', type: 'area' }]}
                syncId="us-sync"
              />
              <MarketChart
                title={`NVDA 英伟达 ${starRangeChanges.nvda >= 0 ? '+' : ''}${starRangeChanges.nvda.toFixed(1)}%`}
                description="AI算力霸主，GPU垄断地位，波动极大但趋势强劲。"
                data={filteredData.data.stars.nvda?.map((d: any) => ({ date: d.date, close: d.close })) || []}
                series={[{ key: 'close', name: 'NVDA', color: starRangeChanges.nvda >= 0 ? '#22c55e' : '#ef4444', type: 'area' }]}
                syncId="us-sync"
              />
              <MarketChart
                title={`GOOGL 谷歌 ${starRangeChanges.googl >= 0 ? '+' : ''}${starRangeChanges.googl.toFixed(1)}%`}
                description="搜索+广告+云+AI，Gemini追赶OpenAI，YouTube稳定增长。"
                data={filteredData.data.stars.googl?.map((d: any) => ({ date: d.date, close: d.close })) || []}
                series={[{ key: 'close', name: 'GOOGL', color: starRangeChanges.googl >= 0 ? '#22c55e' : '#ef4444', type: 'area' }]}
                syncId="us-sync"
              />
              <MarketChart
                title={`AMZN 亚马逊 ${starRangeChanges.amzn >= 0 ? '+' : ''}${starRangeChanges.amzn.toFixed(1)}%`}
                description="电商+AWS云服务，AI基础设施投资巨大，利润率持续改善。"
                data={filteredData.data.stars.amzn?.map((d: any) => ({ date: d.date, close: d.close })) || []}
                series={[{ key: 'close', name: 'AMZN', color: starRangeChanges.amzn >= 0 ? '#22c55e' : '#ef4444', type: 'area' }]}
                syncId="us-sync"
              />
              <MarketChart
                title={`META ${starRangeChanges.meta >= 0 ? '+' : ''}${starRangeChanges.meta.toFixed(1)}%`}
                description="社交广告+元宇宙，Reels增长强劲，AI广告效率提升显著。"
                data={filteredData.data.stars.meta?.map((d: any) => ({ date: d.date, close: d.close })) || []}
                series={[{ key: 'close', name: 'META', color: starRangeChanges.meta >= 0 ? '#22c55e' : '#ef4444', type: 'area' }]}
                syncId="us-sync"
              />
              <MarketChart
                title={`TSLA 特斯拉 ${starRangeChanges.tsla >= 0 ? '+' : ''}${starRangeChanges.tsla.toFixed(1)}%`}
                description="电动车+能源+FSD，马斯克效应，波动性最大的七巨头成员。"
                data={filteredData.data.stars.tsla?.map((d: any) => ({ date: d.date, close: d.close })) || []}
                series={[{ key: 'close', name: 'TSLA', color: starRangeChanges.tsla >= 0 ? '#22c55e' : '#ef4444', type: 'area' }]}
                syncId="us-sync"
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
                    ? 'bg-green-600 text-white shadow-lg' 
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
                ? 'bg-green-600 text-white' 
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
