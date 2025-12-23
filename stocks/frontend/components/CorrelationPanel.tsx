import React, { useMemo } from 'react';
import { Card } from './Card';
import { ArrowRight, TrendingUp, TrendingDown } from 'lucide-react';

interface CorrelationPanelProps {
  data: any;
}

export const CorrelationPanel: React.FC<CorrelationPanelProps> = ({ data }) => {
  const correlations = useMemo(() => {
    const aShare = data.data.a_share || [];
    const fundFlow = data.data.fund_flow || [];
    const margin = data.data.margin || [];
    const bond = data.data.bond || [];
    const rate = data.data.rate || [];
    const nasdaq = data.data.nasdaq || [];

    // 计算相关性的辅助函数
    const calcCorrelation = (arr1: number[], arr2: number[]) => {
      const n = Math.min(arr1.length, arr2.length);
      if (n < 10) return 0;
      
      const slice1 = arr1.slice(-n);
      const slice2 = arr2.slice(-n);
      
      const mean1 = slice1.reduce((a, b) => a + b, 0) / n;
      const mean2 = slice2.reduce((a, b) => a + b, 0) / n;
      
      let num = 0, den1 = 0, den2 = 0;
      for (let i = 0; i < n; i++) {
        const d1 = slice1[i] - mean1;
        const d2 = slice2[i] - mean2;
        num += d1 * d2;
        den1 += d1 * d1;
        den2 += d2 * d2;
      }
      
      return den1 && den2 ? num / Math.sqrt(den1 * den2) : 0;
    };

    // 提取数值数组
    const shIndex = aShare.map((d: any) => d.sh_close);
    const amount = aShare.map((d: any) => d.total_amount_yi);
    const mainFlow = fundFlow.map((d: any) => d.main_net_yi);
    const marginBal = margin.map((d: any) => d.margin_balance_yi);
    const spread = bond.map((d: any) => d.spread);
    const usdCny = rate.map((d: any) => d.rate);
    const nasdaqClose = nasdaq.map((d: any) => d.close);

    return [
      {
        name: '上证 vs 主力资金',
        value: calcCorrelation(shIndex, mainFlow),
        desc: '主力流入与A股走势',
      },
      {
        name: '上证 vs 成交额',
        value: calcCorrelation(shIndex, amount),
        desc: '量价关系',
      },
      {
        name: '上证 vs 融资余额',
        value: calcCorrelation(shIndex, marginBal),
        desc: '杠杆资金与指数',
      },
      {
        name: '上证 vs 中美利差',
        value: calcCorrelation(shIndex, spread),
        desc: '利差对A股影响',
      },
      {
        name: '上证 vs 汇率',
        value: calcCorrelation(shIndex, usdCny),
        desc: '汇率与股市关系',
      },
      {
        name: '上证 vs 纳指',
        value: calcCorrelation(shIndex, nasdaqClose),
        desc: '中美股市联动',
      },
    ];
  }, [data]);

  const getCorrelationColor = (value: number) => {
    const abs = Math.abs(value);
    if (abs > 0.7) return value > 0 ? 'text-red-400' : 'text-green-400';
    if (abs > 0.4) return value > 0 ? 'text-orange-400' : 'text-cyan-400';
    return 'text-gray-400';
  };

  const getCorrelationLabel = (value: number) => {
    const abs = Math.abs(value);
    if (abs > 0.7) return '强';
    if (abs > 0.4) return '中';
    return '弱';
  };

  return (
    <Card>
      <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-blue-400" />
        指标相关性分析
      </h3>
      <div className="space-y-3">
        {correlations.map((corr, i) => (
          <div key={i} className="flex items-center justify-between p-2 bg-gray-800/30 rounded-lg">
            <div className="flex-1">
              <div className="text-sm text-gray-300">{corr.name}</div>
              <div className="text-xs text-gray-500">{corr.desc}</div>
            </div>
            <div className="flex items-center gap-2">
              <div className={`text-lg font-bold ${getCorrelationColor(corr.value)}`}>
                {corr.value > 0 ? '+' : ''}{(corr.value * 100).toFixed(0)}%
              </div>
              <div className={`text-xs px-2 py-0.5 rounded ${
                Math.abs(corr.value) > 0.7 ? 'bg-purple-500/20 text-purple-400' :
                Math.abs(corr.value) > 0.4 ? 'bg-blue-500/20 text-blue-400' :
                'bg-gray-500/20 text-gray-400'
              }`}>
                {getCorrelationLabel(corr.value)}相关
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 text-xs text-gray-500">
        * 基于近期数据计算的皮尔逊相关系数
      </div>
    </Card>
  );
};
