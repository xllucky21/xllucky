import React from 'react';
import { X, BookOpen, TrendingUp, AlertTriangle, Calculator, Clock, CheckCircle } from 'lucide-react';

interface KnowledgeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KnowledgeModal: React.FC<KnowledgeModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* 遮罩 */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* 弹窗内容 */}
      <div className="relative bg-gray-900 border border-gray-700 rounded-2xl max-w-3xl w-full mx-4 max-h-[85vh] overflow-hidden shadow-2xl">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 bg-gray-800/50">
          <div className="flex items-center gap-3">
            <BookOpen className="text-blue-400" size={24} />
            <h2 className="text-xl font-bold text-white">LOF套利原理与知识</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <X className="text-slate-400" size={20} />
          </button>
        </div>
        
        {/* 内容区域 */}
        <div className="overflow-y-auto max-h-[calc(85vh-80px)] p-6 space-y-6">
          {/* 什么是LOF */}
          <section>
            <h3 className="text-lg font-semibold text-blue-400 mb-3 flex items-center gap-2">
              <BookOpen size={18} />
              什么是LOF基金？
            </h3>
            <div className="bg-gray-800/50 rounded-lg p-4 text-sm text-slate-300 space-y-2">
              <p>
                <strong className="text-white">LOF（Listed Open-Ended Fund）</strong>即上市型开放式基金，
                是一种既可以在<span className="text-green-400">场外申购赎回</span>，
                又可以在<span className="text-blue-400">场内买卖交易</span>的基金。
              </p>
              <p>
                由于存在两个交易市场，当场内价格与场外净值出现偏差时，就产生了<span className="text-yellow-400">套利机会</span>。
              </p>
            </div>
          </section>

          {/* 套利原理 */}
          <section>
            <h3 className="text-lg font-semibold text-green-400 mb-3 flex items-center gap-2">
              <TrendingUp size={18} />
              溢价套利原理
            </h3>
            <div className="bg-gray-800/50 rounded-lg p-4 text-sm text-slate-300 space-y-3">
              <p className="text-white font-medium">当场内价格 &gt; 净值时（溢价）：</p>
              <div className="pl-4 border-l-2 border-green-500 space-y-2">
                <p><span className="text-green-400">①</span> 场外按净值申购基金份额（当日收盘净值确认）</p>
                <p><span className="text-green-400">②</span> 等待份额确认（T+1）</p>
                <p><span className="text-green-400">③</span> 办理跨系统转托管（场外→场内，T+1~2）</p>
                <p><span className="text-green-400">④</span> 场内按市价卖出（赚取溢价差）</p>
              </div>
              <div className="mt-3 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                <p className="text-green-400 font-medium">
                  💰 收益 = 场内卖出价 - 申购净值 - 手续费
                </p>
              </div>
              <div className="mt-2 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                <p className="text-amber-400 text-xs">
                  ⚠️ 注意：从申购到卖出需要 T+2~4 个交易日，期间溢价可能收窄甚至消失！
                </p>
              </div>
            </div>
          </section>

          {/* 关键指标 */}
          <section>
            <h3 className="text-lg font-semibold text-yellow-400 mb-3 flex items-center gap-2">
              <Calculator size={18} />
              关键指标解读
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-gray-800/50 rounded-lg p-4 text-sm">
                <div className="text-yellow-400 font-medium mb-2">溢价率</div>
                <p className="text-slate-400 text-xs mb-2">（场内价 - 净值）÷ 净值 × 100%</p>
                <p className="text-slate-300">溢价率越高，套利空间越大，但风险也越高。</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4 text-sm">
                <div className="text-green-400 font-medium mb-2">预期年化</div>
                <p className="text-slate-400 text-xs mb-2">溢价率 ÷ 结算天数 × 365</p>
                <p className="text-slate-300">考虑资金占用时间后的年化收益率。</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4 text-sm">
                <div className="text-amber-400 font-medium mb-2">申购限额</div>
                <p className="text-slate-400 text-xs mb-2">单日最大申购金额</p>
                <p className="text-slate-300">限额越低，单次套利收入上限越低。</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4 text-sm">
                <div className="text-blue-400 font-medium mb-2">预期最大收入</div>
                <p className="text-slate-400 text-xs mb-2">限额 × 溢价率</p>
                <p className="text-slate-300">拉满限额单次套利的最大收益。</p>
              </div>
            </div>
          </section>

          {/* 结算周期 */}
          <section>
            <h3 className="text-lg font-semibold text-blue-400 mb-3 flex items-center gap-2">
              <Clock size={18} />
              结算周期（T+N）
            </h3>
            <div className="bg-gray-800/50 rounded-lg p-4 text-sm text-slate-300">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="flex justify-between">
                  <span className="text-blue-400">A股宽基</span>
                  <span className="text-white">T+2</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-purple-400">A股行业</span>
                  <span className="text-white">T+2</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-orange-400">QDII港股</span>
                  <span className="text-white">T+3</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-amber-400">QDII全球</span>
                  <span className="text-white">T+4</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-red-400">商品原油</span>
                  <span className="text-white">T+3</span>
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                * T+N 表示从申购到可卖出需要的交易日天数，期间溢价可能收窄甚至变为折价
              </p>
            </div>
          </section>

          {/* 风险提示 */}
          <section>
            <h3 className="text-lg font-semibold text-red-400 mb-3 flex items-center gap-2">
              <AlertTriangle size={18} />
              风险提示
            </h3>
            <div className="bg-red-500/10 rounded-lg p-4 text-sm text-slate-300 space-y-2 border border-red-500/20">
              <p className="flex items-start gap-2">
                <span className="text-red-400 mt-0.5">⚠️</span>
                <span><strong className="text-red-400">溢价收窄风险：</strong>等待期间溢价可能大幅收窄甚至变为折价，导致亏损。</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-red-400 mt-0.5">⚠️</span>
                <span><strong className="text-red-400">净值波动风险：</strong>基金净值在等待期间可能下跌，侵蚀套利收益。</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-red-400 mt-0.5">⚠️</span>
                <span><strong className="text-red-400">流动性风险：</strong>场内成交量不足可能导致无法按预期价格卖出。</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-red-400 mt-0.5">⚠️</span>
                <span><strong className="text-red-400">申购限制风险：</strong>基金可能随时暂停申购，导致无法套利。</span>
              </p>
            </div>
          </section>

          {/* 操作建议 */}
          <section>
            <h3 className="text-lg font-semibold text-green-400 mb-3 flex items-center gap-2">
              <CheckCircle size={18} />
              操作建议
            </h3>
            <div className="bg-green-500/10 rounded-lg p-4 text-sm text-slate-300 space-y-2 border border-green-500/20">
              <p className="flex items-start gap-2">
                <span className="text-green-400">✓</span>
                <span>优先选择<strong className="text-green-400">可申购</strong>且<strong className="text-blue-400">流动性充足</strong>的基金</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-green-400">✓</span>
                <span>关注<strong className="text-yellow-400">溢价率</strong>是否超过该类型基金的正常阈值</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-green-400">✓</span>
                <span>A股类LOF套利确定性更高，QDII类风险较大</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-green-400">✓</span>
                <span>注意申购限额，计算好<strong className="text-amber-400">预期最大收入</strong>是否值得操作</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-green-400">✓</span>
                <span>小资金可多只基金分散套利，降低单只风险</span>
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
