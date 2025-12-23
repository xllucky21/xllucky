# XLLucky 金融量化分析工具箱

一个集成宏观经济分析、债基智能投顾、股票市场监控的金融量化工具箱。采用 **Python 后端 + React/TypeScript 前端** 架构。

## 项目结构

```
xllucky/
├── economic/           # 宏观经济数据看板
├── bondFund/           # 债基智能投顾系统
├── stocks/             # A股市场数据模块
├── us_stocks/          # 美股市场数据模块
├── dividend/           # 红利股票工具箱
├── portal/             # 统一入口页面 + 推送服务
│   ├── logger.py       # 统一日志管理
│   ├── wechat_work_push.py  # 企业微信推送
│   └── generate_summary.py  # 摘要数据生成
├── dist/               # 打包输出目录
├── .cache/             # 缓存目录（日志、执行历史）
├── run.sh              # 一键管理脚本
├── config.sh           # 配置文件
└── requirements.txt    # Python 依赖
```

## 快速开始

### 一键管理（推荐）

```bash
# 交互式菜单
./run.sh

# 或使用命令行参数
./run.sh --update      # 更新所有数据
./run.sh --force       # 强制更新（忽略增量检测）
./run.sh --start       # 启动所有前端
./run.sh --full        # 更新数据 + 启动前端
./run.sh --build       # 一键打包
./run.sh --push        # 手动推送企业微信
./run.sh --history     # 查看执行历史统计
./run.sh --help        # 查看所有命令
```

### 功能菜单

```
╔═══════════════════════════════════════════════════════════╗
║        🎯 XLLucky 工具箱一键管理系统                      ║
╠═══════════════════════════════════════════════════════════╣
║   [1] 📊 更新所有数据 (并行+增量检测)                     ║
║   [2] 🌐 启动所有前端                                     ║
║   [3] 🚀 全量操作 (更新数据 + 启动前端)                   ║
║   [4] 📦 选择性更新数据                                   ║
║   [5] 🖥️  选择性启动前端                                   ║
║   [6] 🛑 停止所有前端服务                                 ║
║   [7] 📋 查看运行状态                                     ║
║   [8] 🏠 打开入口页面                                     ║
║   [9] 📤 一键打包 (生成单HTML文件)                        ║
║   [f] 🔄 强制更新所有数据 (忽略增量检测)                  ║
║   [c] ⏰ 定时任务管理                                     ║
║   [w] 📱 手动推送企业微信                                 ║
║   [h] 📈 查看执行历史统计                                 ║
║   [l] 📋 查看日志                                         ║
║   [d] 📦 检查/安装依赖                                    ║
╚═══════════════════════════════════════════════════════════╝
```

### 访问地址

| 工具箱 | 端口 | 地址 |
|--------|------|------|
| 🏠 入口页面 | 5170 | http://localhost:5170 |
| 宏观经济看板 | 5174 | http://localhost:5174 |
| 债基晴雨表 | 5173 | http://localhost:5173 |
| A股分析看板 | 5175 | http://localhost:5175 |
| 美股分析看板 | 5176 | http://localhost:5176 |
| 红利股票工具箱 | 5177 | http://localhost:5177 |

## 核心功能

### 🚀 自动化特性

| 功能 | 说明 |
|------|------|
| **并行更新** | 5个工具箱同时更新，速度提升 5 倍 |
| **增量检测** | 数据无变化时自动跳过，节省时间 |
| **定时任务** | 支持 LaunchAgent 定时自动更新 + 系统通知 |
| **依赖检查** | 自动检测并安装缺失的 Python 包 |
| **一键打包** | 并行打包所有工具箱为单 HTML 文件 |
| **配置管理** | 端口、路径等配置独立管理 |

### 📱 企业微信推送

支持向企业微信群推送市场数据，无需 IP 白名单。

```bash
# 推送选项
python portal/wechat_work_push.py daily    # 每日市场报告
python portal/wechat_work_push.py alert    # 异常预警
python portal/wechat_work_push.py ranking  # 涨跌排行榜
python portal/wechat_work_push.py full     # 完整推送（日报+预警）
python portal/wechat_work_push.py test     # 测试消息
```

**异常预警阈值**:
- 指数涨跌幅 ≥3% 触发预警
- VIX 恐慌指数 ≥30 触发高级预警
- 七巨头涨跌幅 ≥5% 触发预警

### 📋 日志与监控

**统一日志系统**:
- 日志目录: `.cache/logs/`
- 自动轮转: 主日志最大 5MB，保留 5 个备份
- 分模块日志: 各模块独立日志文件

**执行历史统计**:
- 记录每次更新的成功/失败/跳过数量
- 统计成功率、平均耗时
- 近7天执行统计

```bash
./run.sh --history  # 查看执行历史
```

### 📊 工具箱介绍

#### 1. 宏观经济看板 (economic)

- 获取 24+ 宏观经济指标
- 基于达里奥经济机器模型进行周期定位
- 五大分析模式：宏观观测、信用周期、房地产、全球外贸、资产配置

#### 2. 债基晴雨表 (bondFund)

- 获取中国10年期国债收益率、沪深300市盈率、Shibor隔夜利率
- 计算技术指标：MA60、MACD、RSI、布林带
- 生成 0-100 分综合评分
- 输出"天气预报"式投资建议（☀️烈日/🌤️晴朗/☁️多云/🌧️小雨/⛈️暴雨）

#### 3. A股分析看板 (stocks)

- 沪深两市成交额与收盘价
- 港股（恒生指数、恒生科技）
- 沪深港通资金流向

#### 4. 美股分析看板 (us_stocks)

- 纳斯达克、标普500、道琼斯指数
- 美元指数、美债收益率
- 七巨头专区

#### 5. 红利股票工具箱 (dividend)

- 高股息股票筛选
- 红利 ETF 分析
- 股息率排行

## 配置文件

编辑 `config.sh` 自定义配置：

```bash
# 端口配置
PORTAL_PORT=5170
BONDFUND_PORT=5173
...

# 定时任务默认时间
DEFAULT_SCHEDULE_HOUR=8
DEFAULT_SCHEDULE_MINUTE=0

# 是否自动打开浏览器
AUTO_OPEN_BROWSER=true

# 企业微信推送
WECHAT_WORK_PUSH_ENABLED=true
PUSH_ON_SCHEDULE=true
```

## 定时任务

```bash
# 启用定时任务（默认每天 8:00）
./run.sh --schedule-enable

# 禁用定时任务
./run.sh --schedule-disable

# 查看状态
./run.sh --schedule-status

# 或通过菜单管理（按 c）
./run.sh
```

定时任务执行完成后会：
1. 弹出系统通知，显示更新结果
2. 自动推送企业微信（如已启用）
3. 记录执行历史

## 技术栈

### 后端 (Python)
| 库 | 用途 |
|-----|------|
| akshare | 国内金融数据 API |
| yfinance | 美股数据 API |
| pandas | 数据处理 |
| numpy | 数值计算 |
| requests | HTTP 请求 |

### 前端 (React + TypeScript)
| 技术 | 用途 |
|------|------|
| React 18 | UI 框架 |
| TypeScript | 类型安全 |
| Tailwind CSS | 样式 |
| Recharts | 数据可视化 |
| Vite | 构建工具 |

## 手动安装

```bash
# 1. Python 环境
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 2. 前端依赖（每个工具箱）
cd bondFund/frontend && npm install
cd economic/frontend && npm install
# ...
```

## License

MIT
