import React, { useState, useMemo, useRef } from 'react';
import html2canvas from 'html2canvas';
import { ScoreDashboard } from './components/ScoreDashboard';
import { DividendChart } from './components/DividendChart';
import { ValuationChart } from './components/ValuationChart';
import { HistoryList } from './components/HistoryList';
import { StockMonitor } from './components/StockMonitor';
import { Glossary } from './components/Glossary';
import { dividendReports, stocksData } from './data';
import { DividendReportData, TimeRange } from './types';
import { 
  Calendar, 
  ArrowUp, 
  HelpCircle, 
  Download, 
  Loader2,
  TrendingUp,
} from 'lucide-react';

const App: React.FC = () => {
  const [timeRange, setTimeRange] = useState<TimeRange>('2年');
  const [showGlossary, setShowGlossary] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // 加载数据
  const reports = useMemo(() => {
    const sortedReports = [...(dividendReports as DividendReportData[])].sort((a, b) => 
      new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime()
    );
    return sortedReports;
  }, []);

  // 最新报告
  const latestReport = reports[0];
  const previousReport = reports.length > 1 ? reports[1] : undefined;

  // 滚动到顶部
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 导出功能
  const handleExport = async () => {
    if (!contentRef.current || isExporting) return;
    
    setIsExporting(true);
    try {
      window.scrollTo(0, 0);
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const canvas = await html2canvas(contentRef.current, {
        backgroundColor: '#020617',
        scale: 2,
        useCORS: true,
        logging: false,
        windowHeight: contentRef.current.scrollHeight,
        height: contentRef.current.scrollHeight,
      });
      
      const link = document.createElement('a');
      const date = new Date().toISOString().slice(0, 10);
      link.download = `红利股票分析_${date}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('导出失败:', error);
      alert('导出失败，请重试');
    } finally {
      setIsExporting(false);
    }
  };

  // 加载中状态
  if (reports.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-12 w-12 bg-amber-500/20 rounded-full mb-4"></div>
          <div className="h-4 w-32 bg-slate-800 rounded"></div>
          <p className="mt-4 text-slate-500 text-sm">正在加载数据...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24 selection:bg-amber-500/30">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50 backdrop-blur-md bg-slate-900/80">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-6 h-6 text-amber-500" />
            <span className="font-bold text-slate-100 tracking-tight text-lg">红利股票工具箱</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowGlossary(!showGlossary)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all text-sm ${
                showGlossary 
                  ? 'bg-amber-600 text-white' 
                  : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              <HelpCircle className="w-4 h-4" />
              名词解释
            </button>
            <div className="text-xs font-medium px-3 py-1 bg-amber-950/50 border border-amber-500/30 text-amber-300 rounded-full">
              买卖点辅助决策
            </div>
          </div>
        </div>
      </header>

      <div ref={contentRef}>
        {/* 名词解释面板 */}
        {showGlossary && (
          <div className="max-w-6xl mx-auto px-4 pt-6">
            <Glossary onClose={() => setShowGlossary(false)} />
          </div>
        )}

        {/* 主评分面板 */}
        <ScoreDashboard data={latestReport} prevData={previousReport} />

        <main className="max-w-6xl mx-auto px-4 space-y-6 mt-6">
          {/* 图表区域 */}
          {latestReport.raw?.index && latestReport.raw.index.length > 0 && (
            <DividendChart 
              indexData={latestReport.raw.index}
              scoreHistory={latestReport.score_history}
              timeRange={timeRange}
            />
          )}

          {/* 估值图表 */}
          {latestReport.raw?.bond && latestReport.raw.bond.length > 0 && (
            <ValuationChart 
              bondData={latestReport.raw.bond}
              timeRange={timeRange}
            />
          )}

          {/* 历史记录 */}
          <HistoryList reports={reports} />

          {/* 红利股监控面板 */}
          {stocksData && stocksData.stocks && stocksData.stocks.length > 0 && (
            <StockMonitor data={stocksData} timeRange={timeRange} />
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="text-center text-slate-500 text-xs py-8 border-t border-slate-900 mt-12">
        <p>© 2025 红利股票工具箱. Generated by Python Quant System.</p>
        <p className="mt-2 opacity-60">投资有风险，决策需谨慎。本工具仅供参考。</p>
      </footer>

      {/* 浮动控制栏 */}
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40">
        <div className="flex items-center p-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-700/60 rounded-full shadow-2xl shadow-black/50">
          {/* 时间范围选择 */}
          <div className="flex items-center bg-slate-800/50 rounded-full p-1 mr-2">
            <Calendar className="w-4 h-4 text-slate-400 ml-2 mr-3" />
            {(['1年', '2年', '5年', '全部'] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 text-xs font-bold rounded-full transition-all duration-300 ${
                  timeRange === range 
                    ? 'bg-amber-600 text-white shadow-lg' 
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-700/50'
                }`}
              >
                {range}
              </button>
            ))}
          </div>

          {/* 分隔线 */}
          <div className="h-6 w-px bg-slate-700 mx-1"></div>

          {/* 导出按钮 */}
          <button 
            onClick={handleExport}
            disabled={isExporting}
            className={`p-2 rounded-full transition-all duration-200 flex items-center justify-center w-9 h-9 ${
              isExporting 
                ? 'bg-green-600 text-white cursor-wait' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="导出为图片"
          >
            {isExporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
          </button>

          {/* 回到顶部 */}
          <button 
            onClick={scrollToTop}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-all duration-200 flex items-center justify-center w-9 h-9"
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
