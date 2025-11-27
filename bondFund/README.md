这是一个为您量身定制的专业级 README 文档。不仅包含了使用说明，更是一个**债券量化投资的迷你百科全书**。

---

# 🏆 债基智能投顾(全知全能版)

这是一个基于 Python 的机构级债券基金量化分析系统。它不只是简单地告诉你“买”或“卖”，而是通过融合**技术面、基本面、资金面和宏观对冲**四大维度，模拟专业基金经理的决策逻辑，生成一个 **0-100 分**的综合投资评分。

---

## 🛠 快速开始 (Quick Start)

### 1. 环境准备
本项目专为 **Mac / Windows** 双平台优化，已内置 SSL 证书修复补丁。

- Python: `>=3.8`
- Node.js: `>=18`

Python 依赖安装：

```bash
python3 -m venv venv
source venv/bin/activate
python --version
pip install akshare pandas matplotlib scipy requests
```

前端依赖安装（在 `frontend/` 目录内）：

```bash
cd frontend
npm install
```

### 2. 运行系统
第一步：生成数据与报告（在仓库根目录）：

```bash
python bondFund.py
```

第二步：启动前端仪表盘（在 `frontend/` 目录）：

```bash
npm run dev
```

默认访问地址：`http://localhost:3000`

---

## 🧠 核心评分逻辑 (The Scoring Model)

系统将复杂的数据输入一个独家算法，输出 **0 (极度危险)** 到 **100 (极度机会)** 的评分。

| 分数区间 | 定义 | 天气 | 投资策略 |
| :--- | :--- | :--- | :--- |
| **80 - 100** | **极度低估** | ☀️ 烈日 | **【重仓/贪婪】** 历史性大底，胜率极高，可上杠杆或买长债。 |
| **60 - 80** | **舒适区间** | 🌤️ 晴朗 | **【加仓/持有】** 趋势向好，适合定投，安心持有。 |
| **40 - 60** | **震荡区间** | ☁️ 多云 | **【观望/卧倒】** 方向不明朗，多看少动，拿住票息即可。 |
| **20 - 40** | **风险区间** | 🌧️ 小雨 | **【减仓/止盈】** 性价比低，鱼尾行情，建议落袋为安。 |
| **0 - 20** | **极度高估** | ⛈️ 暴雨 | **【清仓/做空】** 估值极贵或流动性枯竭，转入货币基金保命。 |

---

## 📖 深度术语解析 (Glossary)

为了读懂分析报告，你需要理解以下核心金融概念。

### 1. 基础概念：国债收益率与价格
> **核心法则：跷跷板效应**
> *   **收益率 (Yield) ↑ 上涨** = **债券价格 (Price) ↓ 下跌** (债基亏钱)
> *   **收益率 (Yield) ↓ 下跌** = **债券价格 (Price) ↑ 上涨** (债基赚钱)

我们分析的是“10年期国债收益率”。由于它是倒着走的，所以**收益率越高，代表东西越便宜（买点）；收益率越低，代表东西越贵（卖点）**。

### 2. 估值维度 (Valuation) - 权重 40%
*   **历史分位数 (Percentile)**:
    *   *定义*: 当前收益率在过去 5 年中排在什么位置。
    *   *逻辑*: **均值回归**。如果当前分位数为 90%，说明现在的利率比过去 90% 的时间都高（极便宜），未来大概率会跌回去（债基上涨）。

### 3. 趋势维度 (Trend) - 权重 30%
*   **MA60 (60日均线)**:
    *   *定义*: 过去 60 个交易日的平均收益率，被视为**“牛熊分界线”**。
    *   *判定*:
        *   **Yield < MA60**: 利率在均线下方运行，处于下行通道 → **债牛 (Bull)**。
        *   **Yield > MA60**: 利率在均线上方运行，处于上行通道 → **债熊 (Bear)**。

### 4. 动量与情绪 (Tactical) - 权重 30%
*   **MACD (异同移动平均线)**:
    *   *作用*: 判断趋势的强弱和转折。
    *   *判定*: 当 MACD 柱状图翻红，说明收益率上涨动能增强（利空债市）；翻绿则利好。
*   **RSI (相对强弱指标)**:
    *   *作用*: 衡量市场的贪婪与恐慌。
    *   *超买 (>70)*: 收益率涨疯了（债市跌过头了）。此时往往是**短线抢反弹**的好机会。
    *   *超卖 (<30)*: 收益率跌疯了（债市涨过头了）。此时切勿追高，谨防回调。

### 5. 宏观对冲 (Macro Hedge) - 扣分项
*   **ERP (股权风险溢价 / 股债利差)**:
    *   *公式*: `(1 / 沪深300市盈率) - 10年国债收益率`
    *   *逻辑*: 资金永远流向性价比高的地方。
    *   *警报*: 当 **ERP > 5.5%** 时，说明股票比债券便宜太多了。主力资金可能会**卖出债券，去买股票**。这对债市是巨大的抽血风险（即使债券本身看起来不贵）。

### 6. 流动性 (Liquidity) - 扣分项
*   **Shibor (银行间拆借利率)**:
    *   *定义*: 银行之间互相借钱的成本。它是债市的“水源”。
    *   *逻辑*: 债券是用钱买的。如果借钱成本变高，银行就没钱买债，甚至要卖债还钱。
    *   *阈值*: **1.8%**。如果隔夜 Shibor 持续高于 1.8%，说明央行在收紧银根，债市面临普跌风险。

---

## 📊 图表阅读指南 (Dashboard Guide)

程序运行后会弹出“三联屏”专业图表：

### 1. 主图 (Top Panel) - 战略视野
*   **黑线**: 实时收益率。
*   **橙色虚线**: MA60 趋势线。
    *   *看点*: 黑线在橙线下方是好事。
*   **红/绿背景**:
    *   🟩 **绿色区域**: 极具投资价值区（分位数 > 80%）。
    *   🟥 **红色区域**: 高风险高估区（分位数 < 20%）。
*   **红点 (Scatter)**: 标记出了历史上恐慌性抛售的时刻（布林带上轨突破），往往是绝佳买点。

### 2. 左下 (Bottom Left) - 宏观视野
*   **紫色线 (ERP)**: 代表股票相对于债券的性价比。
*   **绿色虚线 (5.5)**: 警戒线。紫线超过这里，说明**股票太便宜了**，要小心资金从债市流出。

### 3. 右下 (Bottom Right) - 战术视野
*   **柱状图 (MACD)**: 红柱代表收益率上涨动能，绿柱代表下跌动能。
*   **蓝线 (RSI)**: 情绪心电图。触碰上方红线 (70) 代表市场恐慌，触碰下方绿线 (30) 代表市场贪婪。

---

## 💡 分层操作建议 (User Profiling)

系统会根据评分生成两种风格的建议：

### 🐢 稳健型 (Conservative)
*   **适合人群**: 追求绝对收益，厌恶回撤，理财替代。
*   **策略**: 只在“晴天”和“烈日”入场。一旦评分跌破 40 分，坚决止盈离场。不参与左侧抄底，不碰垃圾时间。

### 🐇 激进型 (Aggressive)
*   **适合人群**: 交易型选手，懂波段，能承受波动。
*   **策略**: 善于利用 **RSI 超买 (>70)** 的信号进行左侧交易（抢反弹）。利用 **ERP** 指标进行股债轮动切换。

---

## ⚠️ 免责声明

本软件仅基于历史数据、统计学模型和公开金融理论进行分析。
1.  **过往业绩不代表未来表现**。
2.  极端市场环境下（如战争、政策突变），技术指标可能暂时失效。
3.  **最终投资决策请由您自行判断**，作者不承担任何资金损失责任。

---

*Powered by Python, AkShare & Quantitative Finance Logic.*

---

## 📦 数据文件说明 (Data Schema)

本系统会在与 `bondFund.py` 同级的 `data/` 目录内生成时间命名的 TypeScript 数据文件（例如 `2025-11-27_14-33-15.ts`）。该文件导出一个对象 `bondReportData`，包含原始数据与计算结论，可直接在前端使用。

### 1. 顶层字段 (Top Level)
- `generated_at`: 数据生成时间，字符串格式 `YYYY-MM-DD HH:MM:SS`
- `report_folder`: 本次报告的目录名，例如 `Report_<时间戳>`
- `files`: 关联文件名集合
  - `markdown`: 报告文件名，固定为 `Bond_Analysis.md`
  - `chart`: 图表文件名，固定为 `Chart_Dashboard.png`
  - `ts`: 本次生成的数据文件名（时间命名）

### 2. 结论字段 (Conclusion)
- `last_date`: 最新数据日期，`YYYY-MM-DD`
- `last_yield`: 最新 10 年国债收益率 (数值)
- `score`: 综合评分 (0-100)
- `weather`: 天气标签文本（如：☀️ 烈日、🌤️ 晴朗、☁️ 多云、🌧️ 小雨、⛈️ 暴雨）
- `percentile`: 近 5 年分位数 (百分比数值)
- `val_status`: 估值状态（如：🟢 便宜 / ⚖️ 适中 / 🔴 极贵）
- `trend_val`: 趋势判定（“牛”或“熊”）
- `trend_status`: 趋势文字描述（如：🟢 Yield < MA60 / 🔴 Yield > MA60）
- `macd_val`: 动量方向（“向好”或“恶化”）
- `macd_status`: MACD 金叉/死叉文本描述
- `pe_val`: 股市估值字符串（形如 `PE=12.3`），数据缺失时为 `N/A`
- `macro_msg`: ERP 结论（如：⚠️ 股市极具性价比 / ⚖️ 股债平衡 / ✅ 股市泡沫）
- `shibor_val`: 隔夜 Shibor 数值字符串（如 `1.45%`），数据缺失时为 `N/A`
- `liquidity_msg`: 资金面状态（如：🔥 资金紧张 / ⚖️ 适度 / 💧 极度宽松）
- `suggestion_con`: 稳健型建议
- `suggestion_agg`: 激进型建议

### 3. 原始数据 (Raw)
- `bond_10y`: 数组，元素为 `{ date, yield }`，分别表示日期与 10 年国债收益率
- `stock_pe`: 数组，元素为 `{ date, pe }`，分别表示日期与沪深 300 市盈率；若获取失败则为空数组
- `shibor_on`: 数组，元素为 `{ date, shibor }`，分别表示日期与隔夜 Shibor；若获取失败则为空数组

### 4. 使用示例 (Usage)

```ts
import bondReportData from './data/2025-11-27_14-33-15.ts'

console.log(bondReportData.conclusion.score)
console.log(bondReportData.raw.bond_10y[0])
```

---

## 📚 聚合历史文件 (Aggregated History)

为便于统一消费所有历史运行数据，系统维护 `data/bondReports.ts` 聚合文件：
- 导出 `bondReports` 数组，最新一次运行的数据对象位于数组最前面（时间倒序）。
- 每次运行会自动将新对象前置插入，无需手动维护。
- 数组元素结构与单次 `bondReportData` 一致，包含 `generated_at`、`report_folder`、`files`、`conclusion`、`raw`。

### 使用示例

```ts
import bondReports from './data/bondReports.ts'

// 最新一次运行的结论
const latest = bondReports[0]
console.log(latest.conclusion.score, latest.conclusion.weather)

// 历史遍历
for (const entry of bondReports) {
  console.log(entry.generated_at, entry.conclusion.score)
}

// 根据日期筛选（示例：按 report_folder 或 generated_at 前缀）
const target = bondReports.find(x => x.report_folder.startsWith('Report_2025-11-27'))
```

---

## 🗂 项目结构 (Project Structure)

- `bondFund.py`: Python主程序，采集、计算、生成报告与图表，并导出 TS 数据。
- `data/`: 自动生成的数据目录
  - `bondReports.ts`: 历史聚合数组，最新数据位于数组最前。
  - `<YYYY-MM-DD_HH-MM-SS>.ts`: 单次运行的默认导出对象 `bondReportData`。
- `Report_<timestamp>/`: 单次运行的报告目录，含 `Bond_Analysis.md` 与 `Chart_Dashboard.png`。
- `frontend/`: 前端应用（React + Vite + TypeScript）
  - `index.html`, `index.tsx`, `App.tsx`, `components/*`, `types.ts`
  - `package.json`, `vite.config.ts`, `tsconfig.json`

---

## 🖥️ 前端运行与构建 (Frontend Guide)

- 开发启动（在 `frontend/` 目录）：
  - `npm run dev` → `http://localhost:3000`
- 生产构建与预览：
  - `npm run build`
  - `npm run preview`
- 数据消费：前端直接导入 `../data/bondReports.ts`，取最新数据展示。

示例：

```ts
import bondReports from '../data/bondReports'

const latest = bondReports[0]
console.log(latest.conclusion.score, latest.conclusion.weather)
```

说明：当前页面样式使用 Tailwind CDN，无需本地安装；如需生产落地，建议改为本地构建方案或移除 CDN。

---

## 🔧 可选环境变量 (Optional Env)

- 预留变量：`GEMINI_API_KEY`
  - 如需使用，可在 `frontend/.env` 中设置：`GEMINI_API_KEY=xxxx`
  - 该变量已通过构建注入，当前应用默认不依赖。

---

## ❓ 常见问题 (FAQ)

- 启动前端报无法导入 `../data/*`：请先运行 `python bondFund.py` 生成数据文件，再启动前端。
- 样式或图标加载异常：CDN 网络受限时可能无法加载 Tailwind 或图标，刷新或切换网络即可；生产环境建议本地依赖。
- 端口占用：如 `3000` 被占用，可在 `frontend/vite.config.ts` 修改 `server.port`。
- Python 依赖版本：为提高可复现性，建议后续添加 `requirements.txt` 固定版本。
