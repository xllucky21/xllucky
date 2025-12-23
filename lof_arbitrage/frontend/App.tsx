import React, { useState, useMemo } from 'react';
import { LOF_DATA } from './data';
import { LofData, LofFund, HotLofFund } from './types';
import { Overview } from './components/Overview';
import { OpportunityList } from './components/OpportunityList';
import { HotFundList } from './components/HotFundList';
import { AllFundTable } from './components/AllFundTable';
import { DiscountChart } from './components/DiscountChart';
import { KnowledgeModal } from './components/KnowledgeModal';
import { TrendingUp, BarChart3, List, Star, LineChart, BookOpen } from 'lucide-react';

type TabType = 'overview' | 'premium' | 'hot' | 'all' | 'chart';

const data = LOF_DATA as LofData;

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [showKnowledge, setShowKnowledge] = useState(false);

  const tabs = [
    { id: 'overview' as TabType, label: '市场概览', icon: BarChart3 },
    { id: 'premium' as TabType, label: '溢价套利', icon: TrendingUp },
    { id: 'hot' as TabType, label: '热门LOF', icon: Star },
    { id: 'chart' as TabType, label: '走势图', icon: LineChart },
    { id: 'all' as TabType, label: '全部基金', icon: List },
  ];

  const filteredFunds = useMemo(() => {
    if (!searchTerm) return data.all_funds;
    const term = searchTerm.toLowerCase();
    return data.all_funds.filter(
      fund => fund.code.includes(term) || fund.name.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  return (
    <div className="min-h-screen bg-gray-950 text-slate-200">
      {/* 知识弹窗 */}
      <KnowledgeModal isOpen={showKnowledge} onClose={() => setShowKnowledge(false)} />

      {/* Header */}
      <header className="bg-gray-900/80 backdrop-blur-sm border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                LOF基金套利监测
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                更新于 {data.meta.updated_at}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowKnowledge(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 transition-colors text-sm"
              >
                <BookOpen size={14} />
                <span>套利指南</span>
              </button>
              <div className="text-right">
                <div className="text-sm text-slate-400">总基金数</div>
                <div className="text-xl font-semibold text-white">{data.overview.total_count}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-slate-400">溢价套利</div>
                <div className="text-xl font-semibold text-red-400">
                  {data.opportunities.premium.length} 只
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <nav className="bg-gray-900/50 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto py-2">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  <Icon size={16} />
                  {tab.label}
                  {tab.id === 'premium' && (
                    <span className="bg-red-600/30 text-red-400 px-1.5 py-0.5 rounded text-xs">
                      {data.opportunities.premium.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'overview' && <Overview data={data} />}
        
        {activeTab === 'premium' && (
          <OpportunityList
            title="溢价套利机会"
            subtitle="场内价格高于净值，可申购基金后卖出场内份额获利（T+2到账）"
            funds={data.opportunities.premium}
          />
        )}
        
        {activeTab === 'hot' && <HotFundList funds={data.hot_funds} />}
        
        {activeTab === 'chart' && <DiscountChart funds={data.hot_funds} />}
        
        {activeTab === 'all' && (
          <AllFundTable
            funds={filteredFunds}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-gray-900/50 border-t border-gray-800 py-4 mt-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-slate-500">
          <p>LOF基金套利监测工具 | 数据仅供参考，投资需谨慎</p>
        </div>
      </footer>
    </div>
  );
};

export default App;
