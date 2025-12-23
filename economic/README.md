# 中国宏观经济与金融市场深度数据看板

一个基于 React + TypeScript 构建的中国宏观经济数据可视化看板，通过 AkShare 获取实时数据，提供多维度的经济指标分析。

## 功能特性

- **多维度数据展示**：涵盖价格、货币、增长、消费、市场、结构六大类共 24 项核心指标
- **多种分析模式**：支持数据分析、宏观观察、投资决策、信用分析、房地产、外部环境等视角
- **时间范围筛选**：支持 5 年、10 年、20 年及全部历史数据查看
- **丰富的可视化组件**：
  - 指标卡片与趋势图表
  - 相关性热力图
  - 百分位仪表盘
  - 经济周期象限图
  - Z-Score 分析图
  - 领先/滞后指标分析
- **AI 策略分析**：集成 Google Gemini AI 提供智能分析建议
- **一键导出**：支持将看板导出为图片

## 数据指标

| 分类 | 指标 |
|------|------|
| 价格 | CPI、PPI |
| 货币 | M1、M2、M1-M2 剪刀差、社融增量、LPR(1Y/5Y) |
| 增长 | GDP、PMI、出口同比 |
| 消费 | 社消零售总额同比 |
| 市场 | 上证指数、PE、PB、中美国债收益率、中美利差、汇率、外储、黄金 |
| 结构 | 居民杠杆率、国房景气指数、失业率 |

## 项目结构

```
economic/
├── fetch_data.py          # 数据获取脚本 (AkShare)
├── macro_data.ts          # 生成的数据文件
└── frontend/
    ├── App.tsx            # 主应用组件
    ├── types.ts           # TypeScript 类型定义
    ├── constants.ts       # 配置常量
    ├── data.ts            # 数据导入
    ├── index.html         # HTML 入口
    ├── index.tsx          # React 入口
    ├── vite.config.ts     # Vite 配置
    └── components/        # 组件目录
        ├── AIStrategist.tsx       # AI 策略分析
        ├── AlertPanel.tsx         # 预警面板
        ├── CorrelationHeatmap.tsx # 相关性热力图
        ├── CycleQuadrant.tsx      # 经济周期象限
        ├── GroupedMetrics.tsx     # 分组指标
        ├── LeadLagChart.tsx       # 领先滞后分析
        ├── MacroChart.tsx         # 宏观图表
        ├── MetricCard.tsx         # 指标卡片
        ├── Overview.tsx           # 概览组件
        ├── PercentileGauge.tsx    # 百分位仪表
        └── ZScoreChart.tsx        # Z-Score 图表
```

## 快速开始

### 1. 安装依赖

```bash
# 安装 Python 依赖
pip install akshare pandas

# 安装前端依赖
cd frontend
npm install
```

### 2. 获取数据

```bash
python fetch_data.py
```

### 3. 启动开发服务器

```bash
cd frontend
npm run dev
```

### 4. 构建生产版本

```bash
cd frontend
npm run build
```

## 技术栈

- **前端框架**: React 19 + TypeScript
- **图表库**: Recharts
- **构建工具**: Vite
- **数据源**: AkShare
- **AI 集成**: Google Gemini API
- **图标库**: Lucide React

## 数据更新

运行 `python fetch_data.py` 即可从 AkShare 获取最新数据并自动生成 `macro_data.ts` 文件。脚本包含熔断校验机制，确保所有核心指标数据完整。
