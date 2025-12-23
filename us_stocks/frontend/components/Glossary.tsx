import React from 'react';
import { Card } from './Card';

const GLOSSARY_ITEMS = [
  {
    term: '道琼斯工业指数 (DJI)',
    desc: '追踪30家美国大型蓝筹股，是美股历史最悠久的指数，代表传统工业和金融巨头。',
  },
  {
    term: '标普500 (SPX)',
    desc: '追踪500家美国大型上市公司，覆盖面广，是衡量美股整体表现的最佳指标。',
  },
  {
    term: '纳斯达克综合指数 (IXIC)',
    desc: '以科技股为主的指数，包含苹果、微软、英伟达等科技巨头，波动性较大。',
  },
  {
    term: 'VIX 恐慌指数',
    desc: '衡量市场预期波动率。<20为平静，20-30为警惕，>30为恐慌。VIX飙升往往意味着市场大跌。',
  },
  {
    term: '美债收益率',
    desc: '10年期国债收益率是无风险利率基准，上升意味着资金成本增加，对股市形成压力。',
  },
  {
    term: '2-10年利差',
    desc: '10年期减2年期国债收益率。倒挂(负值)通常预示经济衰退，历史上准确率很高。',
  },
  {
    term: '美元指数 (DXY)',
    desc: '衡量美元对一篮子货币的强弱。美元走强通常对新兴市场和大宗商品形成压力。',
  },
  {
    term: '联邦基金利率',
    desc: '美联储设定的基准利率，影响整个金融市场的资金成本。加息压制股市，降息利好股市。',
  },
  {
    term: '七巨头 (Magnificent 7)',
    desc: 'AAPL、MSFT、NVDA、GOOGL、AMZN、META、TSLA，这7家公司占标普500权重超过30%。',
  },
  {
    term: '板块ETF',
    desc: 'XLK(科技)、XLF(金融)、XLE(能源)、XLV(医疗)等，用于追踪特定行业表现。',
  },
];

export const Glossary: React.FC = () => {
  return (
    <Card>
      <h3 className="text-sm font-semibold text-gray-300 mb-4">📖 名词解释</h3>
      <div className="grid md:grid-cols-2 gap-3">
        {GLOSSARY_ITEMS.map((item) => (
          <div key={item.term} className="p-3 bg-gray-800/50 rounded-lg">
            <div className="text-sm font-medium text-blue-400">{item.term}</div>
            <div className="text-xs text-gray-400 mt-1">{item.desc}</div>
          </div>
        ))}
      </div>
    </Card>
  );
};
