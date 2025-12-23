import React, { useMemo } from 'react';
import { Card } from './Card';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus,
  ArrowUp,
  ArrowDown,
  Activity,
} from 'lucide-react';

interface TrendAnalysisProps {
  data: any;
}

export const TrendAnalysis: React.FC<TrendAnalysisProps> = ({ data }) => {
  const trends = useMemo(() => {
    const aShare = data.data.a_share || [];
    const fundFlow = data.data.fund_flow || [];
    const margin = data.data.margin || [];
    const shibor = data.data.shibor || [];
    const bond = data.data.bond || [];

    // 计算趋势的辅助函数
    const calcTrend = (arr: number[], days: number) => {
      if (arr.length < days) return { change: 0, trend: 'flat' as const };
      const recent = arr.slice(-days);
      const prev = arr.slice(-days * 2, -days);
      if (prev.length === 0) return { change: 0, trend: 'flat' as const };
      
      const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
      const prevAvg = prev.reduce((a, b) => a + b, 0) / prev.length;
      const change = prevAvg !== 0 ? ((recentAvg - prevAvg) / Math.abs(prevAvg)) * 100 : 0;
      
      return {
        change,
        trend: change > 2 ? 'up' as const : change < -2 ? 'down' as const : 'flat' as const,
      };
    };

    // 计算累计值
    const calcSum = (arr: any[], key: string, days: number) => {
      return arr.slice(-days).reduce((sum, d) => sum + (d[key] || 0), 0);
    };

    // 各指标趋势
    const shTrend = calcTrend(aShare.map((d: any) => d.sh_close), 5);
    const amountTrend = calcTrend(aShare.map((d: any) => d.total_amount_yi), 5);
    const marginTrend = calcTrend(margin.map((d: any) => d.margin_balance_yi), 5);
    const shiborTrend = calcTrend(shibor.map((d: any) => d.overnight), 5);
    const spreadTrend = calcTrend(bond.map((d: any) => d.spread), 5);

    // 主力资金累计 (2024年8月起北向资金停止每日披露，改用主力资金)
    const main5d = calcSum(fundFlow, 'main_net_yi', 5);
    const main20d = calcSum(fundFlow, 'main_net_yi', 20);

    return {
      index: {
        name: '上证指数',
        ...shTrend,
        detail: `近5日${shTrend.trend === 'up' ? '上涨' : shTrend.trend === 'down' ? '下跌' : '震荡'}`,
      },
      amount: {
        name: '成交额',
        ...amountTrend,
        detail: `近5日${amountTrend.trend === 'up' ? '放量' : amountTrend.trend === 'down' ? '缩量' : '持平'}`,
      },
      margin: {
        name: '融资余额',
        ...marginTrend,
        detail: `杠杆资金${marginTrend.trend === 'up' ? '加仓' : marginTrend.trend === 'down' ? '减仓' : '观望'}`,
      },
      shibor: {
        name: 'Shibor隔夜',
        ...shiborTrend,
        detail: `资金面${shiborTrend.trend === 'up' ? '收紧' : shiborTrend.trend === 'down' ? '宽松' : '平稳'}`,
      },
      spread: {
        name: '中美利差',
        ...spreadTrend,
        detail: `利差${spreadTrend.trend === 'up' ? '收窄' : spreadTrend.trend === 'down' ? '扩大' : '稳定'}`,
      },
      mainFlow: {
        name: '主力资金',
        value5d: main5d,
        value20d: main20d,
        trend: main5d > 100 ? 'up' as const : main5d < -100 ? 'down' as const : 'flat' as const,
      },
    };
  }, [data]);

  const TrendIcon = ({ trend }: { trend: 'up' | 'down' | 'flat' }) => {
    if (trend === 'up') return <ArrowUp className="w-4 h-4 text-red-500" />;
    if (trend === 'down') return <ArrowDown className="w-4 h-4 text-green-500" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  const getTrendColor = (trend: 'up' | 'down' | 'flat') => {
    if (trend === 'up') return 'border-red-500/30 bg-red-500/5';
    if (trend === 'down') return 'border-green-500/30 bg-green-500/5';
    return 'border-gray-500/30 bg-gray-500/5';
  };

  const trendItems = [
    trends.index,
    trends.amount,
    trends.margin,
    trends.shibor,
    trends.spread,
  ];

  return (
    <Card>
      <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
        <Activity className="w-4 h-4 text-purple-400" />
        趋势分析 (近5日)
      </h3>
      
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        {trendItems.map((item, i) => (
          <div 
            key={i}
            className={`p-3 rounded-lg border ${getTrendColor(item.trend)}`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-400">{item.name}</span>
              <TrendIcon trend={item.trend} />
            </div>
            <div className={`text-lg font-bold ${
              item.trend === 'up' ? 'text-red-400' :
              item.trend === 'down' ? 'text-green-400' :
              'text-gray-300'
            }`}>
              {item.change > 0 ? '+' : ''}{item.change.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-500 mt-1">{item.detail}</div>
          </div>
        ))}
      </div>

      {/* 主力资金特殊展示 */}
      <div className={`p-4 rounded-lg border ${getTrendColor(trends.mainFlow.trend)}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-300 font-medium">主力资金累计</div>
            <div className="text-xs text-gray-500 mt-1">
              主力净流入是市场重要风向标
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-4">
              <div>
                <div className="text-xs text-gray-500">近5日</div>
                <div className={`text-xl font-bold ${trends.mainFlow.value5d >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {trends.mainFlow.value5d >= 0 ? '+' : ''}{trends.mainFlow.value5d.toFixed(1)}亿
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">近20日</div>
                <div className={`text-xl font-bold ${trends.mainFlow.value20d >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {trends.mainFlow.value20d >= 0 ? '+' : ''}{trends.mainFlow.value20d.toFixed(1)}亿
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
