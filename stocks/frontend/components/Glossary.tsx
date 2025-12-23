import React from 'react';
import { Card } from './Card';
import { 
  BookOpen, 
  TrendingUp, 
  Banknote, 
  Globe, 
  BarChart3,
  AlertCircle,
} from 'lucide-react';

interface GlossaryItem {
  term: string;
  definition: string;
  tip?: string;
}

interface GlossarySection {
  title: string;
  icon: React.ReactNode;
  color: string;
  items: GlossaryItem[];
}

export const Glossary: React.FC = () => {
  const sections: GlossarySection[] = [
    {
      title: '指数类',
      icon: <TrendingUp className="w-4 h-4" />,
      color: 'text-blue-400',
      items: [
        {
          term: '上证指数',
          definition: '上海证券交易所的综合指数，以大盘蓝筹股为主，代表A股整体走势。',
          tip: '站上3000点通常被视为市场信心恢复的标志',
        },
        {
          term: '深证成指',
          definition: '深圳证券交易所的成份指数，中小盘和成长股占比较高。',
          tip: '与上证同涨为普涨行情，分化时关注风格切换',
        },
        {
          term: '恒生指数',
          definition: '香港股市的主要指数，包含50家最大的上市公司。',
          tip: '港股受外资影响大，常领先A股反映全球情绪',
        },
        {
          term: '恒生科技',
          definition: '追踪香港上市的30家最大科技公司，包括腾讯、阿里、美团等。',
          tip: '科技股风向标，对政策和美股科技股敏感',
        },
        {
          term: 'QQQ (纳指100 ETF)',
          definition: '追踪纳斯达克100指数的ETF，代表美股科技龙头表现。',
          tip: 'QQQ上涨通常利好A股科技板块',
        },
      ],
    },
    {
      title: '成交量价',
      icon: <BarChart3 className="w-4 h-4" />,
      color: 'text-cyan-400',
      items: [
        {
          term: '两市成交额',
          definition: '沪深两市当日股票交易的总金额，反映市场活跃程度。',
          tip: '万亿以上活跃，1.5万亿火爆，低于8000亿偏冷清',
        },
        {
          term: '量价配合',
          definition: '价格上涨伴随成交量放大，说明上涨有资金支撑，更可持续。',
          tip: '缩量上涨需警惕，放量下跌是危险信号',
        },
      ],
    },
    {
      title: '资金流向',
      icon: <Banknote className="w-4 h-4" />,
      color: 'text-red-400',
      items: [
        {
          term: '主力资金',
          definition: '超大单(>100万)+大单(20-100万)的净流入金额，代表机构和大户动向。',
          tip: '连续多日流入是积极信号，流出需谨慎',
        },
        {
          term: '超大单资金',
          definition: '单笔成交金额超过100万元的订单，通常代表机构行为。',
          tip: '超大单持续流入某板块，可能有重大利好',
        },
        {
          term: '南向资金',
          definition: '内地投资者通过港股通买入港股的资金，反映内资对港股的态度。',
          tip: '大幅流入说明资金看好港股估值洼地',
        },
        {
          term: '北向资金',
          definition: '外资通过沪深港通买入A股的资金。注：2024年8月起停止每日披露，改为季度发布。',
          tip: '历史上被称为"聪明钱"，但现已无法每日追踪',
        },
        {
          term: '融资余额',
          definition: '投资者向券商借钱买股票的总规模，反映杠杆资金情绪。',
          tip: '余额上升说明看多情绪浓，下降则趋于谨慎',
        },
      ],
    },
    {
      title: '利率汇率',
      icon: <Globe className="w-4 h-4" />,
      color: 'text-purple-400',
      items: [
        {
          term: '10年期国债收益率',
          definition: '国家发行的10年期国债的年化收益率，是长期无风险利率的基准。',
          tip: '收益率上升说明资金成本提高，对股市有压制',
        },
        {
          term: '中美利差',
          definition: '中国10年期国债收益率减去美国10年期国债收益率。',
          tip: '利差为负(倒挂)时，外资流出压力增大',
        },
        {
          term: 'Shibor隔夜',
          definition: '上海银行间同业拆放利率(隔夜)，反映银行间短期资金松紧。',
          tip: '利率越低流动性越宽松，对股市越有利',
        },
        {
          term: '美元/离岸人民币',
          definition: '1美元可兑换多少离岸人民币(CNH)，反映人民币汇率。',
          tip: '数值上升=人民币贬值，破7说明贬值压力大',
        },
      ],
    },
  ];

  return (
    <Card className="bg-gradient-to-br from-gray-900 to-gray-950">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
          <BookOpen className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">名词解释</h2>
          <p className="text-gray-500 text-sm">帮助您理解图表中的专业术语</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sections.map((section, sIdx) => (
          <div key={sIdx} className="space-y-3">
            <div className={`flex items-center gap-2 ${section.color} font-semibold text-sm`}>
              {section.icon}
              {section.title}
            </div>
            <div className="space-y-2">
              {section.items.map((item, iIdx) => (
                <div key={iIdx} className="bg-gray-800/50 rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium text-white text-sm">{item.term}</div>
                  </div>
                  <p className="text-gray-400 text-xs mt-1 leading-relaxed">
                    {item.definition}
                  </p>
                  {item.tip && (
                    <div className="flex items-start gap-1.5 mt-2 text-xs text-yellow-500/80">
                      <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      <span>{item.tip}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};
