import React, { useMemo, useState } from 'react';
import { MacroDataPoint } from '../types';
import { 
  Compass, 
  TrendingUp, 
  TrendingDown, 
  Flame, 
  Snowflake,
  ArrowRight,
  Info,
  History
} from 'lucide-react';

interface CycleQuadrantProps {
  data: { [key: string]: MacroDataPoint[] };
  theme: string;
}

// 经济周期四象限定义
const QUADRANTS = {
  recovery: {
    name: '复苏',
    nameEn: 'Recovery',
    icon: TrendingUp,
    color: 'emerald',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    description: '增长上行 + 通胀低位',
    strategy: '超配股票，尤其是周期股和成长股',
    position: { x: 'right', y: 'bottom' }
  },
  overheat: {
    name: '过热',
    nameEn: 'Overheat',
    icon: Flame,
    color: 'orange',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
    description: '增长上行 + 通胀上行',
    strategy: '配置商品和通胀保护资产',
    position: { x: 'right', y: 'top' }
  },
  stagflation: {
    name: '滞胀',
    nameEn: 'Stagflation',
    icon: Snowflake,
    color: 'red',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    description: '增长下行 + 通胀上行',
    strategy: '持有现金，防御为主',
    position: { x: 'left', y: 'top' }
  },
  recession: {
    name: '衰退',
    nameEn: 'Recession',
    icon: TrendingDown,
    color: 'blue',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    description: '增长下行 + 通胀低位',
    strategy: '超配债券，等待政策转向',
    position: { x: 'left', y: 'bottom' }
  }
};

// 计算移动平均
const calculateMA = (values: number[], period: number): number => {
  if (values.length < period) return values[values.length - 1] || 0;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
};

// 计算动量（当前值 vs 3个月前）
const calculateMomentum = (values: number[]): number => {
  if (values.length < 4) return 0;
  const current = values[values.length - 1];
  const prev = values[values.length - 4]; // 3个月前
  return current - prev;
};

export const CycleQuadrant: React.FC<CycleQuadrantProps> = ({ data, theme }) => {
  const [showHistory, setShowHistory] = useState(false);

  // 计算当前周期位置
  const cyclePosition = useMemo(() => {
    // 增长指标：使用 PMI 和 GDP
    const pmiSeries = data.pmi || [];
    const gdpSeries = data.gdp || [];
    
    // 通胀指标：使用 CPI 和 PPI
    const cpiSeries = data.cpi || [];
    const ppiSeries = data.ppi || [];

    if (pmiSeries.length < 6 || cpiSeries.length < 6) {
      return null;
    }

    // 提取数值
    const pmiValues = pmiSeries.map(d => d.value);
    const gdpValues = gdpSeries.map(d => d.value);
    const cpiValues = cpiSeries.map(d => d.value);
    const ppiValues = ppiSeries.map(d => d.value);

    // 当前值
    const currentPmi = pmiValues[pmiValues.length - 1];
    const currentGdp = gdpValues.length > 0 ? gdpValues[gdpValues.length - 1] : 5;
    const currentCpi = cpiValues[cpiValues.length - 1];
    const currentPpi = ppiValues.length > 0 ? ppiValues[ppiValues.length - 1] : 0;

    // 计算增长得分 (-100 到 100)
    // PMI: 50为中性，45-55正常波动
    // GDP: 5%为目标
    const pmiScore = (currentPmi - 50) * 20; // 50=0, 55=100, 45=-100
    const gdpScore = (currentGdp - 5) * 20;  // 5%=0
    const growthScore = (pmiScore * 0.7 + gdpScore * 0.3); // PMI权重更高（更及时）

    // 计算通胀得分 (-100 到 100)
    // CPI: 2%为理想，0-3%正常
    // PPI: 0%为中性
    const cpiScore = (currentCpi - 2) * 33; // 2%=0, 5%=100, -1%=-100
    const ppiScore = currentPpi * 10;       // 0%=0
    const inflationScore = (cpiScore * 0.6 + ppiScore * 0.4);

    // 计算动量（趋势方向）
    const growthMomentum = calculateMomentum(pmiValues);
    const inflationMomentum = calculateMomentum(cpiValues);

    // 标准化到 -100 到 100
    const normalizedGrowth = Math.max(-100, Math.min(100, growthScore));
    const normalizedInflation = Math.max(-100, Math.min(100, inflationScore));

    // 判断象限
    let quadrant: keyof typeof QUADRANTS;
    if (normalizedGrowth >= 0 && normalizedInflation < 0) {
      quadrant = 'recovery';
    } else if (normalizedGrowth >= 0 && normalizedInflation >= 0) {
      quadrant = 'overheat';
    } else if (normalizedGrowth < 0 && normalizedInflation >= 0) {
      quadrant = 'stagflation';
    } else {
      quadrant = 'recession';
    }

    // 历史轨迹（最近12个月）
    const historyLength = Math.min(12, pmiSeries.length);
    const history: { x: number; y: number; date: string }[] = [];
    
    for (let i = historyLength; i >= 1; i--) {
      const idx = pmiSeries.length - i;
      if (idx >= 0) {
        const histPmi = pmiValues[idx];
        const histCpi = cpiValues[Math.min(idx, cpiValues.length - 1)];
        const histPpi = ppiValues.length > 0 ? ppiValues[Math.min(idx, ppiValues.length - 1)] : 0;
        
        const histGrowth = (histPmi - 50) * 20;
        const histInflation = ((histCpi - 2) * 33 * 0.6) + (histPpi * 10 * 0.4);
        
        history.push({
          x: Math.max(-100, Math.min(100, histGrowth)),
          y: Math.max(-100, Math.min(100, histInflation)),
          date: pmiSeries[idx].date.substring(0, 7)
        });
      }
    }

    return {
      growth: normalizedGrowth,
      inflation: normalizedInflation,
      quadrant,
      growthMomentum,
      inflationMomentum,
      currentPmi,
      currentCpi,
      currentGdp,
      currentPpi,
      history
    };
  }, [data]);

  if (!cyclePosition) {
    return (
      <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6 text-center text-gray-500">
        数据不足，无法计算周期位置
      </div>
    );
  }

  const currentQuadrant = QUADRANTS[cyclePosition.quadrant];
  const QuadrantIcon = currentQuadrant.icon;

  // 将得分转换为图表坐标 (0-100%)
  const dotX = ((cyclePosition.growth + 100) / 200) * 100;
  const dotY = ((100 - cyclePosition.inflation) / 200) * 100; // Y轴反转

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-${theme}-500/20`}>
            <Compass className={`w-5 h-5 text-${theme}-400`} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              经济周期定位
              <span className="text-xs text-gray-500 font-normal">Cycle Positioning</span>
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              基于增长-通胀双维度的美林时钟框架
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-all ${
            showHistory 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-800 text-gray-400 hover:text-white'
          }`}
        >
          <History size={12} />
          {showHistory ? '隐藏轨迹' : '显示轨迹'}
        </button>
      </div>

      <div className="p-4">
        <div className="flex gap-4">
          {/* 四象限图 */}
          <div className="flex-1">
            <div className="relative aspect-square max-w-[280px] mx-auto">
              {/* 象限背景 */}
              <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-0.5 rounded-lg overflow-hidden">
                {/* 滞胀 - 左上 */}
                <div className={`${QUADRANTS.stagflation.bgColor} flex items-center justify-center relative group`}>
                  <div className="text-center opacity-60 group-hover:opacity-100 transition-opacity">
                    <Snowflake className="w-5 h-5 text-red-400 mx-auto mb-1" />
                    <span className="text-[10px] text-red-400 font-medium">滞胀</span>
                  </div>
                </div>
                {/* 过热 - 右上 */}
                <div className={`${QUADRANTS.overheat.bgColor} flex items-center justify-center relative group`}>
                  <div className="text-center opacity-60 group-hover:opacity-100 transition-opacity">
                    <Flame className="w-5 h-5 text-orange-400 mx-auto mb-1" />
                    <span className="text-[10px] text-orange-400 font-medium">过热</span>
                  </div>
                </div>
                {/* 衰退 - 左下 */}
                <div className={`${QUADRANTS.recession.bgColor} flex items-center justify-center relative group`}>
                  <div className="text-center opacity-60 group-hover:opacity-100 transition-opacity">
                    <TrendingDown className="w-5 h-5 text-blue-400 mx-auto mb-1" />
                    <span className="text-[10px] text-blue-400 font-medium">衰退</span>
                  </div>
                </div>
                {/* 复苏 - 右下 */}
                <div className={`${QUADRANTS.recovery.bgColor} flex items-center justify-center relative group`}>
                  <div className="text-center opacity-60 group-hover:opacity-100 transition-opacity">
                    <TrendingUp className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                    <span className="text-[10px] text-emerald-400 font-medium">复苏</span>
                  </div>
                </div>
              </div>

              {/* 坐标轴 */}
              <div className="absolute inset-0 pointer-events-none">
                {/* 横轴 */}
                <div className="absolute top-1/2 left-0 right-0 h-px bg-gray-600"></div>
                {/* 纵轴 */}
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-600"></div>
              </div>

              {/* 轴标签 */}
              <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-gray-500 flex items-center gap-1">
                <span>增长</span>
                <ArrowRight size={10} />
              </div>
              <div className="absolute -left-1 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] text-gray-500 flex items-center gap-1 origin-center">
                <span>通胀</span>
                <ArrowRight size={10} />
              </div>

              {/* 历史轨迹 */}
              {showHistory && cyclePosition.history.length > 1 && (
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  <defs>
                    <linearGradient id="pathGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#6b7280" stopOpacity="0.2" />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.8" />
                    </linearGradient>
                  </defs>
                  {/* 连接线 */}
                  <path
                    d={cyclePosition.history.map((point, i) => {
                      const px = ((point.x + 100) / 200) * 100;
                      const py = ((100 - point.y) / 200) * 100;
                      return `${i === 0 ? 'M' : 'L'} ${px}% ${py}%`;
                    }).join(' ')}
                    fill="none"
                    stroke="url(#pathGradient)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* 历史点 */}
                  {cyclePosition.history.slice(0, -1).map((point, i) => {
                    const px = ((point.x + 100) / 200) * 100;
                    const py = ((100 - point.y) / 200) * 100;
                    const opacity = 0.3 + (i / cyclePosition.history.length) * 0.5;
                    return (
                      <circle
                        key={i}
                        cx={`${px}%`}
                        cy={`${py}%`}
                        r="3"
                        fill="#6b7280"
                        fillOpacity={opacity}
                      />
                    );
                  })}
                </svg>
              )}

              {/* 当前位置点 */}
              <div 
                className="absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2 z-10"
                style={{ left: `${dotX}%`, top: `${dotY}%` }}
              >
                <div className={`w-full h-full rounded-full bg-${currentQuadrant.color}-500 shadow-lg shadow-${currentQuadrant.color}-500/50 animate-pulse`}></div>
                <div className={`absolute inset-0 rounded-full bg-${currentQuadrant.color}-400 animate-ping opacity-75`}></div>
              </div>
            </div>
          </div>

          {/* 右侧信息面板 */}
          <div className="w-48 space-y-3">
            {/* 当前象限 */}
            <div className={`${currentQuadrant.bgColor} ${currentQuadrant.borderColor} border rounded-lg p-3`}>
              <div className="flex items-center gap-2 mb-2">
                <QuadrantIcon className={`w-4 h-4 text-${currentQuadrant.color}-400`} />
                <span className={`text-sm font-bold text-${currentQuadrant.color}-400`}>
                  {currentQuadrant.name}期
                </span>
              </div>
              <p className="text-[10px] text-gray-400 leading-relaxed">
                {currentQuadrant.description}
              </p>
            </div>

            {/* 核心指标 */}
            <div className="bg-gray-800/50 rounded-lg p-3 space-y-2">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">核心指标</div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">PMI</span>
                <span className={`font-mono font-medium ${cyclePosition.currentPmi >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {cyclePosition.currentPmi.toFixed(1)}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">GDP</span>
                <span className="font-mono font-medium text-white">
                  {cyclePosition.currentGdp.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">CPI</span>
                <span className={`font-mono font-medium ${cyclePosition.currentCpi > 3 ? 'text-orange-400' : cyclePosition.currentCpi < 0 ? 'text-blue-400' : 'text-white'}`}>
                  {cyclePosition.currentCpi.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">PPI</span>
                <span className={`font-mono font-medium ${cyclePosition.currentPpi < 0 ? 'text-blue-400' : 'text-white'}`}>
                  {cyclePosition.currentPpi.toFixed(1)}%
                </span>
              </div>
            </div>

            {/* 配置建议 */}
            <div className="bg-gray-800/30 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Info size={10} className="text-gray-500" />
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">配置建议</span>
              </div>
              <p className="text-[11px] text-gray-300 leading-relaxed">
                {currentQuadrant.strategy}
              </p>
            </div>

            {/* 动量指示 */}
            <div className="flex gap-2">
              <div className={`flex-1 text-center py-1.5 rounded text-[10px] ${
                cyclePosition.growthMomentum > 0 
                  ? 'bg-emerald-500/20 text-emerald-400' 
                  : cyclePosition.growthMomentum < 0 
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-gray-800 text-gray-500'
              }`}>
                增长 {cyclePosition.growthMomentum > 0 ? '↑' : cyclePosition.growthMomentum < 0 ? '↓' : '→'}
              </div>
              <div className={`flex-1 text-center py-1.5 rounded text-[10px] ${
                cyclePosition.inflationMomentum > 0 
                  ? 'bg-orange-500/20 text-orange-400' 
                  : cyclePosition.inflationMomentum < 0 
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'bg-gray-800 text-gray-500'
              }`}>
                通胀 {cyclePosition.inflationMomentum > 0 ? '↑' : cyclePosition.inflationMomentum < 0 ? '↓' : '→'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
