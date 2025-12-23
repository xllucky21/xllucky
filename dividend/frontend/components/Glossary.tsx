import React from 'react';
import { X } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export const Glossary: React.FC<Props> = ({ onClose }) => {
  const terms = [
    {
      term: '中证红利指数',
      desc: '由沪深两市中现金股息率高、分红比较稳定的100只股票组成，是红利投资的代表性指数。'
    },
    {
      term: '股息率',
      desc: '每股分红 / 股价。股息率越高，说明分红回报越高。红利股的核心吸引力指标。'
    },
    {
      term: '股债利差',
      desc: '股息率 - 10年国债收益率。利差为正且越大，说明红利股相对债券更有吸引力。'
    },
    {
      term: 'PE (市盈率)',
      desc: '股价 / 每股收益。PE越低，估值越便宜。红利股PE通常较低。'
    },
    {
      term: 'PB (市净率)',
      desc: '股价 / 每股净资产。PB越低，估值越便宜。破净(PB<1)通常是低估信号。'
    },
    {
      term: 'PE/PB 分位数',
      desc: '当前PE/PB在历史数据中的位置。25%以下为低估区间，75%以上为高估区间。'
    },
    {
      term: 'RSI (相对强弱指数)',
      desc: '衡量价格动量的技术指标。RSI<30为超卖(可能反弹)，RSI>70为超买(可能回调)。'
    },
    {
      term: 'MA60 (60日均线)',
      desc: '过去60个交易日的平均价格。价格低于MA60通常表示短期偏弱。'
    },
    {
      term: '综合评分',
      desc: '综合估值(PE/PB分位数)、股债利差、技术趋势等因子计算的买入价值分数。分数越高，买入价值越大。'
    },
    {
      term: '买入信号',
      desc: '评分≥80为强烈买入，65-80为建议买入，50-65为观望，35-50为减仓，<35为卖出。'
    },
  ];

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          📚 名词解释
        </h3>
        <button 
          onClick={onClose}
          className="p-1 hover:bg-slate-800 rounded transition-colors"
        >
          <X className="w-5 h-5 text-slate-400" />
        </button>
      </div>
      
      <div className="p-4 grid md:grid-cols-2 gap-4">
        {terms.map((item, index) => (
          <div key={index} className="bg-slate-800/30 rounded-lg p-3">
            <div className="text-amber-400 font-medium text-sm mb-1">{item.term}</div>
            <div className="text-slate-400 text-xs leading-relaxed">{item.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
