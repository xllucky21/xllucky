import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { MacroDataResponse } from '../types';
import { Bot, Sparkles, RefreshCw, AlertCircle, FileText, Loader2, BrainCircuit } from 'lucide-react';
import { Card } from './Card';

interface AIStrategistProps {
  data: MacroDataResponse;
  mode: 'observation' | 'investment' | 'credit' | 'real_estate' | 'external';
  timeRange: string;
}

const LOADING_STEPS = [
  "正在读取宏观数据磁带...",
  "正在构建多维因子模型...",
  "AI 正在进行深度推理 (Deep Thinking)...", // Updated
  "正在推演二阶效应与反身性...", // Updated
  "正在生成资产配置策略..."
];

export const AIStrategist: React.FC<AIStrategistProps> = ({ data, mode, timeRange }) => {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<number | null>(null);

  // Clear analysis when mode changes to encourage regeneration with correct persona
  useEffect(() => {
    setAnalysis(null);
  }, [mode, timeRange]); // Also reset when timeRange changes

  // Cycle loading text
  useEffect(() => {
    if (loading) {
      intervalRef.current = window.setInterval(() => {
        setLoadingStep((prev) => (prev + 1) % LOADING_STEPS.length);
      }, 2000); // Slower interval for thinking perception
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setLoadingStep(0);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loading]);

  const generateAnalysis = async () => {
    setLoading(true);
    setError(null);

    try {
      const getLast = (key: string) => {
        const series = data.data[key];
        if (!series || series.length === 0) return "N/A";
        const latest = series[series.length - 1];
        return `${latest.value} (${latest.date})`;
      };

      const erpSeries = data.data['equity_risk_premium'];
      const currentERP = erpSeries && erpSeries.length > 0 ? erpSeries[erpSeries.length - 1].value : "N/A";

      let promptContext = "";

      // Time Range Context
      const rangeText = timeRange === 'ALL' ? "全部历史数据" : `过去 ${timeRange.replace('Y', '年')} 的数据`;

      if (mode === 'investment') {
        promptContext = `
          你是一位顶级投资银行的**首席投资官 (CIO)**，精通雷·达里奥（Ray Dalio）的“全天候策略”和资产配置理论。用户的目标是利用当前的宏观数据进行**资产增值和配置**。
          
          【时间窗口】你正在分析**${rangeText}**。

          【核心数据快照】
          - **核心估值跷跷板**: 股权风险溢价 (ERP) = ${currentERP}% (如果 >3% 则股票极具性价比)
          - 增长: GDP=${getLast('gdp')}%, PMI=${getLast('pmi')}, 出口=${getLast('exports_yoy')}%
          - 通胀: CPI=${getLast('cpi')}%, PPI=${getLast('ppi')}%
          - 货币: M1=${getLast('m1')}%, M2=${getLast('m2')}%, 社融=${getLast('social_financing')}
          - 市场: 上证指数=${getLast('sh_index')}, 10年国债=${getLast('cn_bond_10y')}%, 中美利差=${getLast('bond_spread')}%

          【思考要求】
          在生成回答之前，请深入思考以下逻辑链条：
          1.  ERP 所处的历史分位隐含的赔率是多少？
          2.  M1-M2 剪刀差的变化趋势对股市估值有何滞后影响？
          3.  通胀与名义利率的组合是否支持加杠杆？

          【输出要求】
          1. **角色定位**：你是管理百亿资金的基金经理，你需要决定仓位，不要模棱两可。
          2. **输出结构**（必须严格遵守）：
             - 📌 **核心结论**：一句话概括当前最核心的交易逻辑（不超过30字）。
             - 🧭 **宏观象限定位**：当前是在复苏、过热、滞胀还是衰退期？
             - 💰 **资产配置建议**：
               *   **权益 (股票)**：建议仓位（低配/标配/超配）？请明确引用 ERP 数据。
               *   **固收 (债券)**：是做多还是防守？
               *   **大宗/黄金**：是否具备对冲价值？
             - ⚠️ **风险提示**：当前最大的潜在回撤风险点。
          
          请用**专业、犀利、以结果为导向**的语气输出。字数控制在 400 字以内。
        `;
      } else if (mode === 'credit') {
        promptContext = `
          你是一位精通中国金融体系的**首席信贷分析师**。你的目标是分析货币政策的传导效率、信用周期的位置以及债务风险。

          【时间窗口】你正在分析**${rangeText}**。

          【核心数据快照】
          - **资金活化跷跷板**: M1=${getLast('m1')}%, M2=${getLast('m2')}%, 剪刀差=${getLast('scissors')}% (负值代表流动性陷阱风险)
          - **信用需求**: 社融增量=${getLast('social_financing')}, 居民杠杆率=${getLast('resident_leverage')}%
          - **资金价格**: LPR 1Y=${getLast('lpr_1y')}%, LPR 5Y=${getLast('lpr_5y')}%, 10年国债=${getLast('cn_bond_10y')}%
          - **抵押品价值**: 房地产投资=${getLast('real_estate_invest')}, PPI=${getLast('ppi')}% (影响企业偿债)

          【思考要求】
          1.  分析社融脉冲与实体经济数据的领先滞后关系。
          2.  判断当前是否存在“宽货币、紧信用”的淤堵现象。

          【输出要求】
          1. **角色定位**：你是商业银行或债券基金的信贷策略师，关注资金的安全性与流向。
          2. **输出结构**（必须严格遵守）：
             - 📌 **核心结论**：一句话概括当前信用环境（如：宽货币紧信用/主动去杠杆）。
             - 🌊 **流动性状态**：资金是在空转（剪刀差为负）还是在活化（剪刀差回升）？
             - 🏗️ **信用周期位置**：处于扩张、收缩、还是修复期？
             - 🔮 **信贷展望**：未来半年信用环境会如何演变？
          
          请用**深刻、逻辑严密、侧重金融机制**的语气输出。字数控制在 400 字以内。
        `;
      } else if (mode === 'real_estate') {
        promptContext = `
          你是一位专注中国房地产市场的**首席地产研究员**。你的目标是分析楼市周期、政策有效性及未来趋势。

          【时间窗口】你正在分析**${rangeText}**。

          【核心数据快照】
          - **行业景气**: 国房景气指数=${getLast('real_estate_invest')} (100为枯荣分界线)
          - **购房成本**: LPR 5Y=${getLast('lpr_5y')}%, 10年国债=${getLast('cn_bond_10y')}%
          - **需求端**: 居民杠杆率=${getLast('resident_leverage')}%, 社消零售=${getLast('retail_sales')}% (财富效应)
          - **货币环境**: M1=${getLast('m1')}% (房企现金流)

          【思考要求】
          1.  居民资产负债表是否在收缩（去杠杆）？
          2.  降息政策（LPR）对实际购房需求的边际效用是否在递减？

          【输出要求】
          1. **角色定位**：你是地产基金的研究主管，关注行业拐点。
          2. **输出结构**（必须严格遵守）：
             - 📌 **核心结论**：一句话判断楼市是否见底。
             - 🏠 **楼市体温**：当前市场是冷是热？去库存压力如何？
             - 📉 **核心阻力**：制约复苏的最大因素是什么（收入预期？交付担忧？）
             - 🔮 **趋势研判**：未来房价和投资企稳的条件是什么？
          
          请用**客观、数据支撑、不回避问题**的语气输出。字数控制在 400 字以内。
        `;
      } else if (mode === 'external') {
        promptContext = `
          你是一位**全球宏观对冲基金经理**，专注于汇率（FX）、大宗商品和跨境资本流动。

          【时间窗口】你正在分析**${rangeText}**。

          【核心数据快照】
          - **贸易**: 出口增速=${getLast('exports_yoy')}% (0% 为衰退警戒线)
          - **汇率与资本**: 美元兑人民币=${getLast('usd_cny')}, 外汇储备=${getLast('fx_reserves')}亿美元
          - **政策跷跷板 (不可能三角)**: 中美10年期国债利差=${getLast('bond_spread')}% (负值代表倒挂，限制降息空间)
          - **全球资产**: 10年美债=${getLast('us_bond_10y')}%, 黄金=${getLast('gold')}

          【思考要求】
          1.  中美利差倒挂对汇率的压力传导机制。
          2.  出口数据是否能持续对冲内需疲软？

          【输出要求】
          1. **角色定位**：你是索罗斯式的宏观交易员，关注全球资金流向。
          2. **输出结构**（必须严格遵守）：
             - 📌 **核心结论**：一句话概括外部风险等级。
             - 🌍 **外部环境评分**：顺风还是逆风？出口是否能支撑经济？
             - 💱 **汇率分析**：人民币面临的升贬值压力来源（不可能三角）？
             - 🛡️ **对冲策略**：在当前全球环境下，应配置黄金还是美元资产？
          
          请用**国际化视野、关注资金流向**的语气输出。字数控制在 400 字以内。
        `;
      } else {
        promptContext = `
          你是一位世界顶级的**宏观经济学家**，擅长使用雷·达里奥（Ray Dalio）的“经济机器”模型分析经济周期。你的目标是帮助用户理解当前的**经济运行状态和深层机制**。

          【时间窗口】你正在分析**${rangeText}**。请结合该周期内的经济波动特征进行分析。

          【核心数据快照】
          - 增长: GDP=${getLast('gdp')}%, PMI=${getLast('pmi')} (50为荣枯线), 出口=${getLast('exports_yoy')}%
          - 通胀: CPI=${getLast('cpi')}% (3%警戒, 0%通缩), PPI=${getLast('ppi')}%
          - 债务与杠杆: 居民杠杆=${getLast('resident_leverage')}%, 房地产投资=${getLast('real_estate_invest')}
          - 货币循环: M1=${getLast('m1')}%, M2=${getLast('m2')}%, 剪刀差=${getLast('scissors')} (正负代表资金活化度), 社融=${getLast('social_financing')}
          - 外部约束: 中美利差=${getLast('bond_spread')}%, 汇率=${getLast('usd_cny')}

          【思考要求】
          1.  当前经济处于债务周期的哪个阶段（通缩去杠杆 vs 再通胀）？
          2.  生产率增长与债务积累的匹配程度如何？

          【输出要求】
          1. **角色定位**：你是学者型专家，透过现象看本质。
          2. **分析逻辑**：请使用达里奥的术语（如：去杠杆、信贷脉冲、生产率、贫富差距）。
          3. **输出结构**（必须严格遵守）：
             - 📌 **核心结论**：一句话定义当前处于债务周期的哪个阶段。
             - ⚙️ **机器运行状态**：增长与债务的匹配度如何？
             - 🔍 **核心矛盾分析**：是否存在资产负债表衰退或流动性陷阱？
             - 🔮 **政策与演变**：政策制定者正在做什么？未来大概率会发生什么？
          
          请用**深刻、逻辑严密、学术但易懂**的语气输出。字数控制在 400 字以内。
        `;
      }

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: promptContext,
        config: {
            temperature: 0.7,
            thinkingConfig: { thinkingBudget: 2048 } // Enable Thinking Mode for deeper reasoning
        }
      });

      const text = response.text;
      if (text) {
        setAnalysis(text);
      } else {
        throw new Error("No analysis generated.");
      }

    } catch (err) {
      console.error(err);
      setError("AI 服务暂时不可用，请检查 API Key 或网络连接。");
    } finally {
      setLoading(false);
    }
  };

  const getThemeColor = () => {
    if (mode === 'investment') return 'emerald';
    if (mode === 'credit') return 'purple';
    if (mode === 'real_estate') return 'orange';
    if (mode === 'external') return 'cyan';
    return 'blue';
  };
  const theme = getThemeColor();

  return (
    <Card className={`relative overflow-hidden border border-${theme}-900/30 bg-gradient-to-br from-gray-900 to-gray-900/50`}>
      {/* Background Decor */}
      <div className={`absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full blur-3xl pointer-events-none bg-${theme}-500/5`}></div>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg border bg-${theme}-600/20 border-${theme}-500/30 text-${theme}-400`}>
            {loading ? <BrainCircuit className="w-6 h-6 animate-pulse" /> : <Bot className="w-6 h-6" />}
          </div>
          <div>
            <h3 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
              {mode === 'investment' ? 'AI 首席投资策略师 (CIO)' : 
               mode === 'credit' ? 'AI 首席信贷分析师' : 
               mode === 'real_estate' ? 'AI 首席地产研究员' :
               mode === 'external' ? 'AI 全球宏观策略师' :
               'AI 首席宏观经济学家'}
              <span className={`px-2 py-0.5 rounded text-[10px] font-normal border bg-${theme}-500/20 text-${theme}-300 border-${theme}-500/30 flex items-center gap-1`}>
                <Sparkles size={10} /> Gemini 2.5 Thinking
              </span>
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {mode === 'investment' ? '基于 ERP 估值模型与 FED 模型的实战配置建议' : 
               mode === 'credit' ? '基于信贷脉冲与货币传导机制的深度研判' :
               mode === 'real_estate' ? '基于周期理论与居民资产负债表的楼市分析' :
               mode === 'external' ? '基于不可能三角与跨境资金流动的策略研判' :
               '基于达里奥债务周期模型的深度经济研判'}
            </p>
          </div>
        </div>

        {!analysis && !loading && (
          <button 
            onClick={generateAnalysis}
            className={`flex items-center gap-2 px-4 py-2 text-white text-sm font-semibold rounded-lg transition-all shadow-lg group bg-${theme}-600 hover:bg-${theme}-500 shadow-${theme}-900/50`}
          >
            <BrainCircuit size={16} className="group-hover:animate-pulse" />
            {mode === 'investment' ? '生成配置策略' : '生成深度研报'}
          </button>
        )}
        
        {(analysis || loading) && (
           <button 
             onClick={generateAnalysis}
             disabled={loading}
             className="p-2 text-gray-400 hover:text-white transition-colors"
             title="重新生成"
           >
             <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
           </button>
        )}
      </div>

      {/* Content Area */}
      <div className="min-h-[120px] bg-gray-950/50 rounded-xl border border-gray-800 p-6 relative">
        
        {/* Empty State */}
        {!analysis && !loading && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-600 gap-3">
            <FileText size={48} className="opacity-20" />
            <p className="text-sm font-medium text-center">
              点击上方按钮，启动 <span className="text-gray-400">Gemini 2.5</span> 进行深度思考<br/>
              获取{mode === 'investment' ? '资产配置建议' : mode === 'real_estate' ? '楼市周期研报' : mode === 'external' ? '全球宏观研报' : '深度研报'}
            </p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className={`absolute inset-0 flex flex-col items-center justify-center gap-4 text-${theme}-400`}>
            <Loader2 size={32} className="animate-spin" />
            <div className="flex flex-col items-center gap-1">
              <span className="text-sm font-medium animate-pulse transition-all duration-500">
                {LOADING_STEPS[loadingStep]}
              </span>
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <BrainCircuit size={10} />
                Gemini Thinking Budget: 2048 tokens
              </span>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-red-400 gap-2">
            <AlertCircle size={32} />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Analysis Output */}
        {analysis && !loading && (
          <div className="prose prose-invert prose-sm max-w-none animate-in fade-in slide-in-from-bottom-2 duration-700">
            <div className="markdown-content whitespace-pre-wrap leading-relaxed text-gray-300 font-light">
              {analysis}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-800 flex justify-end">
               <span className="text-[10px] text-gray-600 font-mono flex items-center gap-1">
                 <Sparkles size={10} />
                 Generated by Gemini 2.5 Flash Thinking • {mode === 'investment' ? 'Investment decisions are your own' : 'Theoretical analysis only'}
               </span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};