import React from 'react';
import { LofData } from '../types';
import { TrendingUp, Activity, PieChart, AlertTriangle } from 'lucide-react';
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface OverviewProps {
  data: LofData;
}

export const Overview: React.FC<OverviewProps> = ({ data }) => {
  const { overview, opportunities } = data;
  
  const distributionData = [
    { name: '深度折价(<-3%)', value: overview.distribution.deep_discount, color: '#22c55e' },
    { name: '轻度折价(-3%~-1%)', value: overview.distribution.slight_discount, color: '#86efac' },
    { name: '合理区间(-1%~1%)', value: overview.distribution.fair_value, color: '#94a3b8' },
    { name: '轻度溢价(1%~3%)', value: overview.distribution.slight_premium, color: '#fca5a5' },
    { name: '深度溢价(>3%)', value: overview.distribution.deep_premium, color: '#ef4444' },
  ];

  const stats = [
    {
      label: '总基金数',
      value: overview.total_count,
      icon: Activity,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
    },
    {
      label: '溢价套利机会',
      value: opportunities.premium.length,
      icon: TrendingUp,
      color: 'text-red-400',
      bgColor: 'bg-red-500/10',
    },
    {
      label: '平均折溢价率',
      value: `${overview.avg_discount_rate >= 0 ? '+' : ''}${overview.avg_discount_rate}%`,
      icon: PieChart,
      color: overview.avg_discount_rate >= 0 ? 'text-red-400' : 'text-green-400',
      bgColor: overview.avg_discount_rate >= 0 ? 'bg-red-500/10' : 'bg-green-500/10',
    },
    {
      label: '最大溢价',
      value: `+${overview.max_premium}%`,
      icon: TrendingUp,
      color: 'text-red-400',
      bgColor: 'bg-red-500/10',
    },
  ];

  return (
    <div className="space-y-6">
      {/* 重要提示 */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="text-blue-400 mt-0.5" size={20} />
          <div>
            <h3 className="text-blue-400 font-medium">数据说明</h3>
            <p className="text-sm text-slate-400 mt-1">
              折溢价率基于【盘中实时估值】计算，而非T-1公布净值。
              实时估值根据基金持仓和指数涨跌动态估算，更准确反映套利机会。
            </p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={index}
              className="bg-gray-900/50 rounded-xl p-4 border border-gray-800"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <Icon className={stat.color} size={20} />
                </div>
                <div>
                  <div className="text-sm text-slate-400">{stat.label}</div>
                  <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Distribution Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <PieChart size={20} className="text-blue-400" />
            折溢价分布（实时估值）
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPie>
                <Pie
                  data={distributionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, value }) => `${value}`}
                >
                  {distributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
              </RechartsPie>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800">
          <h3 className="text-lg font-semibold mb-4">溢价套利机会</h3>
          
          <div className="space-y-4">
            <div className="bg-red-500/10 rounded-lg p-4 border border-red-500/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-red-400 font-medium flex items-center gap-2">
                  <TrendingUp size={18} />
                  当前溢价套利机会
                </span>
                <span className="text-2xl font-bold text-red-400">
                  {opportunities.premium.length}
                </span>
              </div>
              <p className="text-sm text-slate-400">
                场内价格高于实时估值超过1.5%，可申购基金后卖出场内份额获利
              </p>
              {opportunities.premium.length > 0 && (
                <div className="mt-3 pt-3 border-t border-red-500/20">
                  <div className="text-sm text-slate-400">最佳机会:</div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-white">{opportunities.premium[0].name}</span>
                    <span className="text-red-400 font-semibold">
                      +{opportunities.premium[0].realtime_discount}%
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-slate-500/10 rounded-lg p-4 border border-slate-500/20">
              <h4 className="text-slate-300 font-medium mb-2">为什么只关注溢价套利？</h4>
              <p className="text-sm text-slate-400">
                折价套利需要买入后赎回，但LOF基金申赎费率高（1.5%+）、周期长（T+2/T+3），
                折价长期存在是常态，实际套利空间很小。溢价套利（申购后场内卖出）更具可行性。
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Arbitrage Guide */}
      <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800">
        <h3 className="text-lg font-semibold mb-4">溢价套利操作指南</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-red-400 font-medium mb-2 flex items-center gap-2">
              <TrendingUp size={16} />
              操作步骤
            </h4>
            <ol className="text-sm text-slate-400 space-y-1 list-decimal list-inside">
              <li>在场外申购LOF基金份额（T日）</li>
              <li>等待份额确认（T+1日）</li>
              <li>将场外份额转托管到场内（T+2日）</li>
              <li>在二级市场卖出基金份额</li>
              <li>获得溢价部分的收益（扣除费用）</li>
            </ol>
          </div>
          <div>
            <h4 className="text-amber-400 font-medium mb-2">风险提示</h4>
            <ul className="text-sm text-slate-400 space-y-1 list-disc list-inside">
              <li>申购费约0.15%（部分平台有折扣）</li>
              <li>转托管需要T+2个交易日</li>
              <li>期间溢价可能收窄甚至消失</li>
              <li>建议选择溢价率较高（&gt;3%）的品种</li>
              <li>关注成交量，流动性差的品种谨慎操作</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
