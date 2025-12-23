#!/bin/bash

# =====================================================
# 🔄 XLLucky 盘中实时更新脚本
# =====================================================
# 用于需要频繁更新的工具（如LOF套利监测）
# 支持：
#   - 交易时间自动判断
#   - 可配置的更新间隔
#   - 多工具并行更新
# =====================================================

# 不使用 set -e，因为我们需要手动处理错误
# set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 项目根目录
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"

# ==========================================
# 实时更新工具配置
# ==========================================
# 格式: "名称:目录:Python脚本:更新间隔(分钟)"
declare -a REALTIME_TOOLS=(
    "LOF套利监测:lof_arbitrage:fetch_data.py:30"
    # 未来可添加更多实时工具，例如：
    # "ETF溢价监测:etf_premium:fetch_data.py:15"
    # "可转债监测:convertible_bond:fetch_data.py:10"
)

# 交易时间配置
TRADING_START_HOUR=9
TRADING_START_MIN=30
TRADING_END_HOUR=15
TRADING_END_MIN=0
# 午休时间（可选，设为空则不休息）
LUNCH_START_HOUR=11
LUNCH_START_MIN=30
LUNCH_END_HOUR=13
LUNCH_END_MIN=0

# 日志文件
REALTIME_LOG="$PROJECT_ROOT/.cache/realtime.log"
REALTIME_PID_FILE="$PROJECT_ROOT/.cache/realtime.pid"

# ==========================================
# 工具函数
# ==========================================

print_log() {
    local level="$1"
    local msg="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $msg" >> "$REALTIME_LOG"
    
    case $level in
        INFO)  echo -e "${BLUE}[$timestamp]${NC} $msg" ;;
        OK)    echo -e "${GREEN}[$timestamp]${NC} ✅ $msg" ;;
        WARN)  echo -e "${YELLOW}[$timestamp]${NC} ⚠️  $msg" ;;
        ERROR) echo -e "${RED}[$timestamp]${NC} ❌ $msg" ;;
    esac
}

# 检查是否为交易日（简单判断：周一到周五）
is_trading_day() {
    local day_of_week=$(date +%u)
    [ "$day_of_week" -le 5 ]
}

# 检查是否在交易时间内
is_trading_time() {
    if ! is_trading_day; then
        return 1
    fi
    
    local current_hour=$(date +%H)
    local current_min=$(date +%M)
    local current_time=$((current_hour * 60 + current_min))
    
    local start_time=$((TRADING_START_HOUR * 60 + TRADING_START_MIN))
    local end_time=$((TRADING_END_HOUR * 60 + TRADING_END_MIN))
    
    # 检查是否在交易时间
    if [ $current_time -lt $start_time ] || [ $current_time -ge $end_time ]; then
        return 1
    fi
    
    # 检查是否在午休时间（如果配置了）
    if [ -n "$LUNCH_START_HOUR" ] && [ -n "$LUNCH_END_HOUR" ]; then
        local lunch_start=$((LUNCH_START_HOUR * 60 + LUNCH_START_MIN))
        local lunch_end=$((LUNCH_END_HOUR * 60 + LUNCH_END_MIN))
        
        if [ $current_time -ge $lunch_start ] && [ $current_time -lt $lunch_end ]; then
            return 1
        fi
    fi
    
    return 0
}

# 获取下次交易时间
get_next_trading_time() {
    local current_hour=$(date +%H)
    local current_min=$(date +%M)
    local current_time=$((current_hour * 60 + current_min))
    
    local start_time=$((TRADING_START_HOUR * 60 + TRADING_START_MIN))
    local end_time=$((TRADING_END_HOUR * 60 + TRADING_END_MIN))
    
    if ! is_trading_day; then
        echo "下个交易日 ${TRADING_START_HOUR}:$(printf '%02d' $TRADING_START_MIN)"
    elif [ $current_time -lt $start_time ]; then
        echo "今日 ${TRADING_START_HOUR}:$(printf '%02d' $TRADING_START_MIN)"
    elif [ -n "$LUNCH_START_HOUR" ]; then
        local lunch_start=$((LUNCH_START_HOUR * 60 + LUNCH_START_MIN))
        local lunch_end=$((LUNCH_END_HOUR * 60 + LUNCH_END_MIN))
        
        if [ $current_time -ge $lunch_start ] && [ $current_time -lt $lunch_end ]; then
            echo "今日 ${LUNCH_END_HOUR}:$(printf '%02d' $LUNCH_END_MIN)"
        else
            echo "下个交易日 ${TRADING_START_HOUR}:$(printf '%02d' $TRADING_START_MIN)"
        fi
    else
        echo "下个交易日 ${TRADING_START_HOUR}:$(printf '%02d' $TRADING_START_MIN)"
    fi
}

# 激活虚拟环境
activate_venv() {
    if [ -d "$PROJECT_ROOT/venv" ]; then
        source "$PROJECT_ROOT/venv/bin/activate"
    fi
}

# 更新单个工具
update_tool() {
    local name="$1"
    local dir="$2"
    local script="$3"
    local log_file="$PROJECT_ROOT/.cache/realtime_${dir}.log"
    
    cd "$PROJECT_ROOT/$dir"
    
    if [ -f "$script" ]; then
        if python "$script" > "$log_file" 2>&1; then
            print_log "OK" "$name 更新成功"
            return 0
        else
            print_log "ERROR" "$name 更新失败 (详见: $log_file)"
            # 输出最后几行错误信息
            tail -5 "$log_file" 2>/dev/null | while read line; do
                echo "    $line"
            done
            return 1
        fi
    else
        print_log "WARN" "$name 脚本不存在: $script"
        return 1
    fi
}

# 更新所有实时工具
update_all_realtime() {
    print_log "INFO" "开始更新实时数据..."
    
    local success=0
    local failed=0
    
    for tool in "${REALTIME_TOOLS[@]}"; do
        IFS=':' read -r name dir script interval <<< "$tool"
        if update_tool "$name" "$dir" "$script"; then
            ((success++))
            
            # 更新成功后发送企微推送（LOF套利）
            if [ "$dir" = "lof_arbitrage" ]; then
                if [ -f "$PROJECT_ROOT/portal/wechat_work_push.py" ]; then
                    print_log "INFO" "发送LOF套利推送..."
                    if python "$PROJECT_ROOT/portal/wechat_work_push.py" lof 2>/dev/null; then
                        print_log "OK" "企微推送成功"
                    else
                        print_log "WARN" "企微推送失败或无套利机会"
                    fi
                fi
            fi
        else
            ((failed++))
        fi
    done
    
    print_log "INFO" "更新完成: 成功 $success, 失败 $failed"
}

# ==========================================
# 主要功能
# ==========================================

# 显示状态
show_status() {
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC}  🔄 盘中实时更新状态                                        ${CYAN}║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    # 检查是否在运行
    if [ -f "$REALTIME_PID_FILE" ]; then
        local pid=$(cat "$REALTIME_PID_FILE")
        if ps -p "$pid" > /dev/null 2>&1; then
            echo -e "  ${GREEN}●${NC} 守护进程: ${GREEN}运行中${NC} (PID: $pid)"
        else
            echo -e "  ${RED}○${NC} 守护进程: ${RED}未运行${NC} (PID文件过期)"
            rm -f "$REALTIME_PID_FILE"
        fi
    else
        echo -e "  ${RED}○${NC} 守护进程: ${RED}未运行${NC}"
    fi
    
    # 交易时间状态
    if is_trading_time; then
        echo -e "  ${GREEN}●${NC} 交易时间: ${GREEN}进行中${NC}"
    else
        local next_time=$(get_next_trading_time)
        echo -e "  ${YELLOW}○${NC} 交易时间: ${YELLOW}已结束${NC} (下次: $next_time)"
    fi
    
    echo ""
    echo -e "${CYAN}配置的实时工具:${NC}"
    for tool in "${REALTIME_TOOLS[@]}"; do
        IFS=':' read -r name dir script interval <<< "$tool"
        echo -e "  ${BLUE}•${NC} $name (每 ${interval} 分钟)"
    done
    
    echo ""
    echo -e "${CYAN}交易时间配置:${NC}"
    echo -e "  上午: ${TRADING_START_HOUR}:$(printf '%02d' $TRADING_START_MIN) - ${LUNCH_START_HOUR}:$(printf '%02d' $LUNCH_START_MIN)"
    echo -e "  下午: ${LUNCH_END_HOUR}:$(printf '%02d' $LUNCH_END_MIN) - ${TRADING_END_HOUR}:$(printf '%02d' $TRADING_END_MIN)"
    echo ""
}

# 守护进程模式
daemon_mode() {
    mkdir -p "$PROJECT_ROOT/.cache"
    
    # 检查是否已在运行
    if [ -f "$REALTIME_PID_FILE" ]; then
        local old_pid=$(cat "$REALTIME_PID_FILE")
        if ps -p "$old_pid" > /dev/null 2>&1; then
            print_log "WARN" "守护进程已在运行 (PID: $old_pid)"
            exit 1
        fi
    fi
    
    # 记录PID
    echo $$ > "$REALTIME_PID_FILE"
    
    print_log "INFO" "守护进程启动 (PID: $$)"
    
    activate_venv
    
    # 获取最小更新间隔
    local min_interval=30
    for tool in "${REALTIME_TOOLS[@]}"; do
        IFS=':' read -r name dir script interval <<< "$tool"
        if [ "$interval" -lt "$min_interval" ]; then
            min_interval=$interval
        fi
    done
    
    print_log "INFO" "更新间隔: ${min_interval} 分钟"
    
    # 主循环
    while true; do
        if is_trading_time; then
            update_all_realtime
        else
            local next_time=$(get_next_trading_time)
            print_log "INFO" "非交易时间，等待中... (下次: $next_time)"
        fi
        
        # 等待到下一个更新周期
        sleep $((min_interval * 60))
    done
}

# 启动守护进程（后台）
start_daemon() {
    mkdir -p "$PROJECT_ROOT/.cache"
    
    # 检查是否已在运行
    if [ -f "$REALTIME_PID_FILE" ]; then
        local old_pid=$(cat "$REALTIME_PID_FILE")
        if ps -p "$old_pid" > /dev/null 2>&1; then
            echo -e "${YELLOW}⚠️  守护进程已在运行 (PID: $old_pid)${NC}"
            return 1
        fi
    fi
    
    # 后台启动
    nohup "$0" --daemon > /dev/null 2>&1 &
    local new_pid=$!
    
    sleep 1
    
    if ps -p "$new_pid" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ 守护进程已启动 (PID: $new_pid)${NC}"
        echo -e "${BLUE}ℹ️  日志文件: $REALTIME_LOG${NC}"
    else
        echo -e "${RED}❌ 守护进程启动失败${NC}"
    fi
}

# 停止守护进程
stop_daemon() {
    if [ -f "$REALTIME_PID_FILE" ]; then
        local pid=$(cat "$REALTIME_PID_FILE")
        if ps -p "$pid" > /dev/null 2>&1; then
            kill "$pid" 2>/dev/null
            rm -f "$REALTIME_PID_FILE"
            echo -e "${GREEN}✅ 守护进程已停止 (PID: $pid)${NC}"
        else
            rm -f "$REALTIME_PID_FILE"
            echo -e "${YELLOW}⚠️  守护进程未运行 (PID文件已清理)${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  守护进程未运行${NC}"
    fi
}

# 立即执行一次更新
run_once() {
    echo -e "${BLUE}ℹ️  立即执行一次更新...${NC}"
    activate_venv
    update_all_realtime
}

# 查看日志
view_log() {
    if [ -f "$REALTIME_LOG" ]; then
        echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
        echo -e "${CYAN}  📋 实时更新日志 (最后 30 行)${NC}"
        echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
        echo ""
        tail -30 "$REALTIME_LOG"
    else
        echo -e "${YELLOW}⚠️  暂无日志${NC}"
    fi
}

# 显示帮助
show_help() {
    echo ""
    echo -e "${CYAN}🔄 XLLucky 盘中实时更新脚本${NC}"
    echo ""
    echo "用法: $0 [命令]"
    echo ""
    echo "命令:"
    echo "  start       启动守护进程（后台运行）"
    echo "  stop        停止守护进程"
    echo "  restart     重启守护进程"
    echo "  status      查看状态"
    echo "  run         立即执行一次更新"
    echo "  log         查看日志"
    echo "  help        显示帮助"
    echo ""
    echo "示例:"
    echo "  $0 start    # 启动后台守护进程，交易时间自动更新"
    echo "  $0 run      # 手动执行一次更新"
    echo ""
}

# 显示菜单
show_menu() {
    clear
    echo -e "${CYAN}"
    echo "  ╔═══════════════════════════════════════════════════════════╗"
    echo "  ║                                                           ║"
    echo "  ║        🔄 盘中实时更新管理                                ║"
    echo "  ║                                                           ║"
    echo "  ╠═══════════════════════════════════════════════════════════╣"
    echo "  ║                                                           ║"
    echo "  ║   [1] ▶️  启动守护进程                                     ║"
    echo "  ║   [2] ⏹️  停止守护进程                                     ║"
    echo "  ║   [3] 🔄 重启守护进程                                     ║"
    echo "  ║   [4] 📊 查看状态                                         ║"
    echo "  ║   [5] ⚡ 立即执行一次                                     ║"
    echo "  ║   [6] 📋 查看日志                                         ║"
    echo "  ║   [0] 🚪 退出                                             ║"
    echo "  ║                                                           ║"
    echo "  ╚═══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo -n "  请选择操作 [0-6]: "
}

# ==========================================
# 主入口
# ==========================================

main() {
    mkdir -p "$PROJECT_ROOT/.cache"
    
    case "${1:-}" in
        start)
            start_daemon
            ;;
        stop)
            stop_daemon
            ;;
        restart)
            stop_daemon
            sleep 1
            start_daemon
            ;;
        status)
            show_status
            ;;
        run)
            run_once
            ;;
        log)
            view_log
            ;;
        --daemon)
            # 内部使用：守护进程模式
            daemon_mode
            ;;
        help|--help|-h)
            show_help
            ;;
        "")
            # 交互式菜单
            while true; do
                show_menu
                read -r choice
                
                case $choice in
                    1) start_daemon; echo ""; echo "按回车继续..."; read -r ;;
                    2) stop_daemon; echo ""; echo "按回车继续..."; read -r ;;
                    3) stop_daemon; sleep 1; start_daemon; echo ""; echo "按回车继续..."; read -r ;;
                    4) show_status; echo ""; echo "按回车继续..."; read -r ;;
                    5) run_once; echo ""; echo "按回车继续..."; read -r ;;
                    6) view_log; echo ""; echo "按回车继续..."; read -r ;;
                    0) echo ""; echo -e "${BLUE}ℹ️  再见！${NC}"; exit 0 ;;
                    *) echo -e "${RED}❌ 无效选项${NC}"; sleep 1 ;;
                esac
            done
            ;;
        *)
            echo -e "${RED}❌ 未知命令: $1${NC}"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
