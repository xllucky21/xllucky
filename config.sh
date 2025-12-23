#!/bin/bash
# =====================================================
# 🔧 XLLucky 配置文件
# =====================================================
# 修改此文件后，无需重启脚本即可生效
# =====================================================

# ==========================================
# 端口配置
# ==========================================
# 入口页面端口
PORTAL_PORT=5170

# 工具箱端口配置（按顺序对应下方工具箱列表）
BONDFUND_PORT=5173      # 债基晴雨表
ECONOMIC_PORT=5174      # 宏观经济看板
STOCKS_PORT=5175        # A股分析看板
US_STOCKS_PORT=5176     # 美股分析看板
DIVIDEND_PORT=5177      # 红利股票工具箱

# ==========================================
# 工具箱配置
# ==========================================
# 格式: "名称:目录:Python脚本:端口"
# 如需添加新工具箱，按此格式添加即可
declare -a TOOLBOXES=(
    "宏观经济看板:economic:fetch_data.py:$ECONOMIC_PORT"
    "债基晴雨表:bondFund:fetch_data.py:$BONDFUND_PORT"
    "股市分析看板:stocks:fetch_data.py:$STOCKS_PORT"
    "美股分析看板:us_stocks:fetch_data.py:$US_STOCKS_PORT"
    "红利股票工具箱:dividend:fetch_stocks.py:$DIVIDEND_PORT"
)

# 打包配置 (名称:目录:输出文件名)
declare -a BUILD_CONFIG=(
    "宏观经济看板:economic:宏观经济看板"
    "债基晴雨表:bondFund:债基晴雨表"
    "A股分析看板:stocks:A股分析看板"
    "美股分析看板:us_stocks:美股分析看板"
    "红利股票工具箱:dividend:红利股票工具箱"
)

# ==========================================
# 路径配置
# ==========================================
# 打包输出目录（相对于项目根目录）
DIST_DIR_NAME="dist"

# 缓存目录（相对于项目根目录）
CACHE_DIR_NAME=".cache"

# 定时任务日志文件名
SCHEDULE_LOG_NAME="launchd.log"

# ==========================================
# 定时任务默认配置
# ==========================================
# 默认更新时间（小时:分钟）
DEFAULT_SCHEDULE_HOUR=8
DEFAULT_SCHEDULE_MINUTE=0

# ==========================================
# 其他配置
# ==========================================
# 是否自动打开浏览器（启动前端后）
AUTO_OPEN_BROWSER=true

# 是否显示详细日志
VERBOSE=false

# ==========================================
# 企业微信推送配置
# ==========================================
# 是否启用企业微信推送（true/false）
WECHAT_WORK_PUSH_ENABLED=true

# 是否在定时任务完成后自动推送（true/false）
PUSH_ON_SCHEDULE=true

# Webhook 地址（群机器人）
# 如需更换，修改 portal/wechat_work_push.py 中的 WEBHOOK_URL

# ==========================================
# 实时更新工具配置（盘中频繁更新）
# ==========================================
# 格式: "名称:目录:Python脚本:更新间隔(分钟)"
# 这些工具与日常更新分开，由 realtime_update.sh 管理
declare -a REALTIME_TOOLS=(
    "LOF套利监测:lof_arbitrage:fetch_data.py:30"
    # 未来可添加更多实时工具：
    # "ETF溢价监测:etf_premium:fetch_data.py:15"
    # "可转债监测:convertible_bond:fetch_data.py:10"
)

# 交易时间配置
TRADING_START_HOUR=9
TRADING_START_MIN=30
TRADING_END_HOUR=15
TRADING_END_MIN=0
# 午休时间
LUNCH_START_HOUR=11
LUNCH_START_MIN=30
LUNCH_END_HOUR=13
LUNCH_END_MIN=0
