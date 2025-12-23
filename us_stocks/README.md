# 美股全维分析看板

美股市场综合分析看板，覆盖三大指数、VIX、国债、美元、板块ETF、七巨头等多维度数据。

## 功能特性

- 📊 **三大指数** - 道琼斯、标普500、纳斯达克走势
- 😱 **VIX恐慌指数** - 市场情绪温度计，识别恐慌/贪婪时刻
- 📈 **美债收益率** - 2年/10年期国债，2-10年利差（衰退预警）
- 💵 **美元指数** - DXY走势，全球资金流向风向标
- 🏭 **板块轮动** - XLK/XLF/XLE/XLV等板块ETF对比
- ⭐ **七巨头** - AAPL/MSFT/NVDA/GOOGL/AMZN/META/TSLA

### 图表功能
- 均线系统 (MA5/MA10/MA20)
- 关键高低点标注
- 时间范围选择 (1年/2年/5年/全部)
- 图表显示/隐藏设置
- 整体/单图导出为PNG

## 数据维度

| 类别 | 数据项 | 说明 |
|------|--------|------|
| 指数 | DJI, SPX, IXIC | 三大指数收盘价、成交量 |
| 波动率 | VIX | 恐慌指数，<20平静，>30恐慌 |
| 利率 | 2Y/10Y Treasury | 美债收益率及利差 |
| 汇率 | DXY | 美元指数 |
| 板块 | XLK/XLF/XLE/XLV/XLI/XLY | 科技/金融/能源/医疗/工业/消费 |
| 个股 | Magnificent 7 | 七巨头股价走势 |

## 项目结构

```
us_stocks/
├── fetch_data.py          # 数据获取脚本 (akshare)
├── us_market_data.ts      # 生成的数据文件
└── frontend/              # React前端
    ├── App.tsx            # 主应用
    ├── components/        # 图表组件
    ├── utils/             # 工具函数
    └── ...
```

## 快速开始

### 1. 获取数据

```bash
# 安装依赖
pip install akshare pandas

# 增量更新 (默认最近30天)
python fetch_data.py

# 全量获取
python fetch_data.py --mode full

# 指定增量天数
python fetch_data.py --days 60
```

### 2. 启动前端

```bash
cd frontend
npm install
npm run dev
```

访问 http://localhost:3002

### 3. 构建生产版本

```bash
npm run build
```

## 数据源

使用 [akshare](https://github.com/akfamily/akshare) 获取数据：

| 数据 | 来源 |
|------|------|
| 三大指数 | 新浪财经 |
| VIX | CBOE |
| 美债收益率 | 中美国债数据 |
| 美元指数 | 东方财富/新浪 |
| 个股/ETF | 东方财富美股 |
| 联邦基金利率 | 美国宏观数据 |

## 投资参考

### VIX 恐慌指数
- **< 15**: 极度平静，可能过于乐观
- **15-20**: 正常水平
- **20-30**: 市场紧张，需警惕
- **> 30**: 恐慌模式，往往是逆向买入机会

### 2-10年利差
- **正值**: 正常收益率曲线
- **接近0**: 经济放缓信号
- **负值(倒挂)**: 衰退预警，历史准确率极高

### 七巨头权重
AAPL、MSFT、NVDA、GOOGL、AMZN、META、TSLA 合计占标普500权重超过30%，它们的走势很大程度上决定了大盘方向。

## 技术栈

- **数据获取**: Python + akshare
- **前端**: React 19 + TypeScript + Vite
- **图表**: Recharts
- **样式**: Tailwind CSS
- **图标**: Lucide React
- **导出**: html2canvas
