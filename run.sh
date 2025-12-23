#!/bin/bash

# =====================================================
# 🚀 XLLucky 工具箱一键管理脚本
# =====================================================
# 功能：
#   1. 更新数据 - 运行所有 Python 数据获取脚本
#   2. 启动前端 - 选择性启动各工具箱前端
#   3. 全量操作 - 更新数据 + 启动前端
# =====================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 项目根目录
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"

# ==========================================
# 加载配置文件
# ==========================================
CONFIG_FILE="$PROJECT_ROOT/config.sh"
if [ -f "$CONFIG_FILE" ]; then
    source "$CONFIG_FILE"
else
    # 默认配置（配置文件不存在时使用）
    PORTAL_PORT=5170
    declare -a TOOLBOXES=(
        "债基晴雨表:bondFund:fetch_data.py:5173"
        "宏观经济看板:economic:fetch_data.py:5174"
        "股市分析看板:stocks:fetch_data.py:5175"
        "美股分析看板:us_stocks:fetch_data.py:5176"
        "红利股票工具箱:dividend:fetch_stocks.py:5177"
    )
    declare -a BUILD_CONFIG=(
        "债基晴雨表:bondFund:债基晴雨表"
        "宏观经济看板:economic:宏观经济看板"
        "A股分析看板:stocks:A股分析看板"
        "美股分析看板:us_stocks:美股分析看板"
        "红利股票工具箱:dividend:红利股票工具箱"
    )
    DIST_DIR_NAME="dist"
    CACHE_DIR_NAME=".cache"
    CRON_LOG_NAME="cron.log"
    DEFAULT_CRON_HOUR=8
    DEFAULT_CRON_MINUTE=0
    AUTO_OPEN_BROWSER=true
fi

# 根据配置生成路径
DIST_DIR="$PROJECT_ROOT/${DIST_DIR_NAME:-dist}"
CACHE_DIR="$PROJECT_ROOT/${CACHE_DIR_NAME:-.cache}"
CRON_LOG_FILE="$CACHE_DIR/${CRON_LOG_NAME:-cron.log}"

# 打印带颜色的消息
print_header() {
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC}  $1"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# 显示菜单
show_menu() {
    clear
    echo -e "${CYAN}"
    echo "  ╔═══════════════════════════════════════════════════════════╗"
    echo "  ║                                                           ║"
    echo "  ║        🎯 XLLucky 工具箱一键管理系统                      ║"
    echo "  ║                                                           ║"
    echo "  ╠═══════════════════════════════════════════════════════════╣"
    echo "  ║                                                           ║"
    echo "  ║   [1] 📊 更新所有数据 (并行+增量检测)                     ║"
    echo "  ║   [2] 🌐 启动所有前端                                     ║"
    echo "  ║   [3] 🚀 全量操作 (更新数据 + 启动前端)                   ║"
    echo "  ║   [4] 📦 选择性更新数据                                   ║"
    echo "  ║   [5] 🖥️  选择性启动前端                                   ║"
    echo "  ║   [6] 🛑 停止所有前端服务                                 ║"
    echo "  ║   [7] 📋 查看运行状态                                     ║"
    echo "  ║   [8] 🏠 打开入口页面                                     ║"
    echo "  ║   [9] 📤 一键打包 (生成单HTML文件)                        ║"
    echo "  ║   [f] 🔄 强制更新所有数据 (忽略增量检测)                  ║"
    echo "  ║   [c] ⏰ 定时任务管理                                     ║"
    echo "  ║   [w] 📱 手动推送企业微信                                 ║"
    echo "  ║   [h] 📈 查看执行历史统计                                 ║"
    echo "  ║   [l] 📋 查看日志                                         ║"
    echo "  ║   [d] 📦 检查/安装依赖                                    ║"
    echo "  ║   [r] 🔄 盘中实时更新管理                                 ║"
    echo "  ║   [0] 🚪 退出                                             ║"
    echo "  ║                                                           ║"
    echo "  ╚═══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo -n "  请选择操作 [0-9/f/c/w/h/l/d/r]: "
}

# 激活虚拟环境
activate_venv() {
    if [ -d "$PROJECT_ROOT/venv" ]; then
        source "$PROJECT_ROOT/venv/bin/activate"
        print_success "已激活虚拟环境"
    else
        print_warning "未找到虚拟环境，使用系统 Python"
    fi
}

# 计算文件内容的哈希值（用于增量检测）
compute_data_hash() {
    local dir="$1"
    local data_dir="$PROJECT_ROOT/$dir/data"
    
    if [ -d "$data_dir" ]; then
        # 计算 data 目录下所有 .ts 文件的哈希
        find "$data_dir" -name "*.ts" -type f -exec md5 -q {} \; 2>/dev/null | sort | md5 -q 2>/dev/null || echo "no_hash"
    else
        echo "no_data_dir"
    fi
}

# 保存数据哈希
save_data_hash() {
    local dir="$1"
    local hash="$2"
    mkdir -p "$CACHE_DIR"
    echo "$hash" > "$CACHE_DIR/${dir}_hash"
}

# 获取上次的数据哈希
get_last_hash() {
    local dir="$1"
    local hash_file="$CACHE_DIR/${dir}_hash"
    if [ -f "$hash_file" ]; then
        cat "$hash_file"
    else
        echo "no_previous_hash"
    fi
}

# 更新单个工具箱数据（后台版本，用于并行执行）
update_single_data_bg() {
    local name="$1"
    local dir="$2"
    local script="$3"
    local log_file="$CACHE_DIR/.update_${dir}.log"
    local result_file="$CACHE_DIR/.result_${dir}"
    local status_file="$CACHE_DIR/.status_${dir}"
    
    mkdir -p "$CACHE_DIR"
    
    # 标记开始
    echo "running" > "$status_file"
    
    # 记录更新前的哈希
    local hash_before=$(compute_data_hash "$dir")
    
    cd "$PROJECT_ROOT/$dir"
    
    if [ -f "$script" ]; then
        if python "$script" > "$log_file" 2>&1; then
            # 计算更新后的哈希
            local hash_after=$(compute_data_hash "$dir")
            
            if [ "$hash_before" = "$hash_after" ] && [ "$hash_before" != "no_data_dir" ]; then
                echo "unchanged:$name" > "$result_file"
            else
                save_data_hash "$dir" "$hash_after"
                echo "success:$name" > "$result_file"
            fi
        else
            echo "failed:$name" > "$result_file"
        fi
    else
        echo "not_found:$name" > "$result_file"
    fi
    
    # 标记完成
    echo "done" > "$status_file"
}

# 更新单个工具箱数据（同步版本，用于选择性更新）
update_single_data() {
    local name="$1"
    local dir="$2"
    local script="$3"
    
    print_info "正在更新: $name"
    
    # 记录更新前的哈希
    local hash_before=$(compute_data_hash "$dir")
    
    cd "$PROJECT_ROOT/$dir"
    
    if [ -f "$script" ]; then
        if python "$script"; then
            # 计算更新后的哈希
            local hash_after=$(compute_data_hash "$dir")
            
            if [ "$hash_before" = "$hash_after" ] && [ "$hash_before" != "no_data_dir" ]; then
                print_info "$name 数据无变化（已跳过）"
                return 2  # 返回2表示无变化
            else
                save_data_hash "$dir" "$hash_after"
                print_success "$name 数据更新完成"
                return 0
            fi
        else
            print_error "$name 数据更新失败"
            return 1
        fi
    else
        print_warning "$name 未找到数据脚本: $script"
        return 1
    fi
}

# 更新所有数据（并行版本）
update_all_data() {
    print_header "📊 开始并行更新所有工具箱数据"
    
    activate_venv
    
    # 静默检查并安装缺失依赖
    check_deps_silent
    
    mkdir -p "$CACHE_DIR"
    # 清理旧的结果文件
    rm -f "$CACHE_DIR"/.result_* "$CACHE_DIR"/.update_*.log "$CACHE_DIR"/.status_*
    
    local start_time=$(date +%s)
    
    # 并行启动所有更新任务
    print_info "启动 ${#TOOLBOXES[@]} 个并行更新任务..."
    echo ""
    
    # 显示初始状态
    for toolbox in "${TOOLBOXES[@]}"; do
        IFS=':' read -r name dir script port <<< "$toolbox"
        echo -e "  ${YELLOW}⏳${NC} $name ${YELLOW}(等待中...)${NC}"
    done
    
    local pids=()
    for toolbox in "${TOOLBOXES[@]}"; do
        IFS=':' read -r name dir script port <<< "$toolbox"
        update_single_data_bg "$name" "$dir" "$script" &
        pids+=($!)
    done
    
    # 实时显示进度
    local total=${#TOOLBOXES[@]}
    local completed=0
    local spinner=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
    local spin_idx=0
    
    while [ $completed -lt $total ]; do
        completed=0
        for toolbox in "${TOOLBOXES[@]}"; do
            IFS=':' read -r name dir script port <<< "$toolbox"
            if [ -f "$CACHE_DIR/.result_${dir}" ]; then
                ((completed++))
            fi
        done
        
        # 显示旋转动画和进度
        printf "\r  ${CYAN}${spinner[$spin_idx]}${NC} 正在更新... [$completed/$total] "
        spin_idx=$(( (spin_idx + 1) % ${#spinner[@]} ))
        
        sleep 0.2
    done
    
    # 清除进度行
    printf "\r                                        \r"
    
    # 等待所有任务完成
    for pid in "${pids[@]}"; do
        wait $pid 2>/dev/null
    done
    
    # 统计结果
    local success=0
    local failed=0
    local unchanged=0
    
    echo -e "${CYAN}更新结果:${NC}"
    for toolbox in "${TOOLBOXES[@]}"; do
        IFS=':' read -r name dir script port <<< "$toolbox"
        local result_file="$CACHE_DIR/.result_${dir}"
        
        if [ -f "$result_file" ]; then
            local result=$(cat "$result_file")
            case "$result" in
                success:*)
                    echo -e "  ${GREEN}✅${NC} $name ${GREEN}(已更新)${NC}"
                    ((success++))
                    ;;
                unchanged:*)
                    echo -e "  ${BLUE}⏭️${NC}  $name ${BLUE}(无变化)${NC}"
                    ((unchanged++))
                    ;;
                failed:*)
                    echo -e "  ${RED}❌${NC} $name ${RED}(失败)${NC} - 查看日志: .cache/.update_${dir}.log"
                    ((failed++))
                    ;;
                not_found:*)
                    echo -e "  ${YELLOW}⚠️${NC}  $name ${YELLOW}(脚本不存在)${NC}"
                    ((failed++))
                    ;;
            esac
        fi
    done
    
    # 清理临时文件
    rm -f "$CACHE_DIR"/.result_* "$CACHE_DIR"/.status_*
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    # 记录更新时间
    echo "{\"lastUpdate\": \"$(date '+%Y-%m-%d %H:%M:%S')\", \"success\": $success, \"unchanged\": $unchanged, \"failed\": $failed, \"duration\": $duration}" > "$PROJECT_ROOT/portal/update_status.json"
    
    # 记录执行历史
    local trigger_type="manual"
    [ "${CRON_MODE:-0}" = "1" ] && trigger_type="schedule"
    [ "${FORCE_MODE:-0}" = "1" ] && trigger_type="force"
    python -c "
import sys
sys.path.insert(0, '$PROJECT_ROOT/portal')
from logger import record_execution
record_execution($success, $unchanged, $failed, $duration, '$trigger_type')
" 2>/dev/null || true
    
    # 生成手机端摘要数据
    if [ -f "$PROJECT_ROOT/portal/generate_summary.py" ]; then
        python "$PROJECT_ROOT/portal/generate_summary.py" > /dev/null 2>&1 && \
            print_success "已生成手机端摘要" || \
            print_warning "手机端摘要生成失败"
    fi
    
    echo ""
    print_header "📊 数据更新完成"
    print_success "更新: $success 个"
    [ $unchanged -gt 0 ] && print_info "跳过: $unchanged 个 (数据无变化)"
    [ $failed -gt 0 ] && print_error "失败: $failed 个"
    print_info "耗时: ${duration} 秒"
    
    # 如果是定时任务调用，发送系统通知
    if [ "${CRON_MODE:-0}" = "1" ]; then
        send_schedule_result_notification "$success" "$unchanged" "$failed" "$duration"
        
        # 发送企业微信推送（日报+预警检测）
        if [ "${PUSH_ON_SCHEDULE:-true}" = "true" ] && [ "${WECHAT_WORK_PUSH_ENABLED:-false}" = "true" ]; then
            if [ -f "$PROJECT_ROOT/portal/wechat_work_push.py" ]; then
                python "$PROJECT_ROOT/portal/wechat_work_push.py" full >> "$LAUNCHD_LOG" 2>&1 || true
            fi
        fi
    fi
}

# 选择性更新数据
selective_update_data() {
    print_header "📦 选择要更新的工具箱"
    
    echo ""
    local i=1
    for toolbox in "${TOOLBOXES[@]}"; do
        IFS=':' read -r name dir script port <<< "$toolbox"
        echo -e "  ${CYAN}[$i]${NC} $name"
        ((i++))
    done
    echo -e "  ${CYAN}[a]${NC} 全部更新"
    echo -e "  ${CYAN}[0]${NC} 返回"
    echo ""
    echo -n "  请选择 (可多选，如 1,3,5 或 a): "
    read -r selection
    
    if [ "$selection" = "0" ]; then
        return
    fi
    
    if [ "$selection" = "a" ] || [ "$selection" = "A" ]; then
        update_all_data
        return
    fi
    
    activate_venv
    
    local success=0
    local failed=0
    local unchanged=0
    
    IFS=',' read -ra selections <<< "$selection"
    for sel in "${selections[@]}"; do
        sel=$(echo "$sel" | tr -d ' ')
        if [[ "$sel" =~ ^[0-9]+$ ]] && [ "$sel" -ge 1 ] && [ "$sel" -le ${#TOOLBOXES[@]} ]; then
            IFS=':' read -r name dir script port <<< "${TOOLBOXES[$((sel-1))]}"
            update_single_data "$name" "$dir" "$script"
            local ret=$?
            case $ret in
                0) ((success++)) ;;
                1) ((failed++)) ;;
                2) ((unchanged++)) ;;
            esac
            echo ""
        fi
    done
    
    echo ""
    print_info "统计: 更新 $success 个, 跳过 $unchanged 个, 失败 $failed 个"
}

# 启动单个前端
start_single_frontend() {
    local name="$1"
    local dir="$2"
    local port="$3"
    
    print_info "正在启动: $name (端口: $port)"
    
    cd "$PROJECT_ROOT/$dir/frontend"
    
    # 检查是否已安装依赖
    if [ ! -d "node_modules" ]; then
        print_info "正在安装依赖..."
        npm install
    fi
    
    # 后台启动 vite
    npm run dev -- --port "$port" &
    
    print_success "$name 已启动: http://localhost:$port"
}

# 启动所有前端
start_all_frontends() {
    print_header "🌐 启动所有前端服务"
    
    # 先启动入口页面
    start_portal
    
    for toolbox in "${TOOLBOXES[@]}"; do
        IFS=':' read -r name dir script port <<< "$toolbox"
        start_single_frontend "$name" "$dir" "$port"
        echo ""
    done
    
    echo ""
    print_header "🌐 所有前端已启动"
    echo ""
    echo -e "${GREEN}访问地址:${NC}"
    echo -e "  ${CYAN}•${NC} 🏠 入口页面: ${BLUE}http://localhost:$PORTAL_PORT${NC}"
    for toolbox in "${TOOLBOXES[@]}"; do
        IFS=':' read -r name dir script port <<< "$toolbox"
        echo -e "  ${CYAN}•${NC} $name: ${BLUE}http://localhost:$port${NC}"
    done
    echo ""
    print_info "按 Ctrl+C 停止所有服务"
    
    # 根据配置决定是否自动打开浏览器
    if [ "${AUTO_OPEN_BROWSER:-true}" = "true" ]; then
        sleep 2
        open "http://localhost:$PORTAL_PORT" 2>/dev/null || true
    fi
    
    # 等待用户中断
    wait
}

# 选择性启动前端
selective_start_frontend() {
    print_header "🖥️  选择要启动的前端"
    
    echo ""
    local i=1
    for toolbox in "${TOOLBOXES[@]}"; do
        IFS=':' read -r name dir script port <<< "$toolbox"
        echo -e "  ${CYAN}[$i]${NC} $name (端口: $port)"
        ((i++))
    done
    echo -e "  ${CYAN}[a]${NC} 全部启动"
    echo -e "  ${CYAN}[0]${NC} 返回"
    echo ""
    echo -n "  请选择 (可多选，如 1,3,5 或 a): "
    read -r selection
    
    if [ "$selection" = "0" ]; then
        return
    fi
    
    if [ "$selection" = "a" ] || [ "$selection" = "A" ]; then
        start_all_frontends
        return
    fi
    
    IFS=',' read -ra selections <<< "$selection"
    local started=()
    
    for sel in "${selections[@]}"; do
        sel=$(echo "$sel" | tr -d ' ')
        if [[ "$sel" =~ ^[0-9]+$ ]] && [ "$sel" -ge 1 ] && [ "$sel" -le ${#TOOLBOXES[@]} ]; then
            IFS=':' read -r name dir script port <<< "${TOOLBOXES[$((sel-1))]}"
            start_single_frontend "$name" "$dir" "$port"
            started+=("$name:$port")
            echo ""
        fi
    done
    
    if [ ${#started[@]} -gt 0 ]; then
        echo ""
        print_header "🌐 前端已启动"
        echo ""
        echo -e "${GREEN}访问地址:${NC}"
        for item in "${started[@]}"; do
            IFS=':' read -r name port <<< "$item"
            echo -e "  ${CYAN}•${NC} $name: ${BLUE}http://localhost:$port${NC}"
        done
        echo ""
        print_info "按 Ctrl+C 停止服务"
        wait
    fi
}

# 停止所有前端服务
stop_all_frontends() {
    print_header "🛑 停止所有前端服务"
    
    # 查找并终止所有 vite 进程
    local pids=$(pgrep -f "vite" 2>/dev/null || true)
    
    if [ -n "$pids" ]; then
        echo "$pids" | xargs kill 2>/dev/null || true
        print_success "已停止所有 Vite 服务"
    else
        print_info "没有运行中的 Vite 服务"
    fi
    
    # 停止入口页面服务
    local portal_pids=$(pgrep -f "python.*http.server.*$PORTAL_PORT" 2>/dev/null || true)
    if [ -n "$portal_pids" ]; then
        echo "$portal_pids" | xargs kill 2>/dev/null || true
        print_success "已停止入口页面服务"
    fi
}

# 启动入口页面
start_portal() {
    print_info "正在启动入口页面 (端口: $PORTAL_PORT)"
    cd "$PROJECT_ROOT/portal"
    python -m http.server "$PORTAL_PORT" &
    print_success "入口页面已启动: http://localhost:$PORTAL_PORT"
}

# 打开入口页面
open_portal() {
    # 检查入口页面是否已运行
    if ! lsof -i ":$PORTAL_PORT" > /dev/null 2>&1; then
        start_portal
        sleep 1
    fi
    open "http://localhost:$PORTAL_PORT" 2>/dev/null || xdg-open "http://localhost:$PORTAL_PORT" 2>/dev/null || print_info "请手动打开: http://localhost:$PORTAL_PORT"
}

# 查看运行状态
show_status() {
    print_header "📋 运行状态"
    
    echo ""
    echo -e "${CYAN}前端服务状态:${NC}"
    echo ""
    
    # 入口页面状态
    if lsof -i ":$PORTAL_PORT" > /dev/null 2>&1; then
        echo -e "  ${GREEN}●${NC} 🏠 入口页面 (端口 $PORTAL_PORT) - ${GREEN}运行中${NC}"
    else
        echo -e "  ${RED}○${NC} 🏠 入口页面 (端口 $PORTAL_PORT) - ${RED}未运行${NC}"
    fi
    
    for toolbox in "${TOOLBOXES[@]}"; do
        IFS=':' read -r name dir script port <<< "$toolbox"
        
        if lsof -i ":$port" > /dev/null 2>&1; then
            echo -e "  ${GREEN}●${NC} $name (端口 $port) - ${GREEN}运行中${NC}"
        else
            echo -e "  ${RED}○${NC} $name (端口 $port) - ${RED}未运行${NC}"
        fi
    done
    
    # 定时任务状态
    echo ""
    echo -e "${CYAN}定时任务状态:${NC}"
    local current_time=$(get_schedule_status)
    if [ -n "$current_time" ]; then
        echo -e "  ${GREEN}●${NC} 已启用 - 每天 ${current_time} 自动更新"
    else
        echo -e "  ${RED}○${NC} 未启用"
    fi
    
    # 企业微信推送状态
    echo ""
    echo -e "${CYAN}企业微信推送:${NC}"
    if [ "${WECHAT_WORK_PUSH_ENABLED:-false}" = "true" ]; then
        echo -e "  ${GREEN}●${NC} 已启用"
    else
        echo -e "  ${RED}○${NC} 未启用"
    fi
    
    # 最近更新状态
    if [ -f "$PROJECT_ROOT/portal/update_status.json" ]; then
        echo ""
        echo -e "${CYAN}最近更新:${NC}"
        local last_update=$(cat "$PROJECT_ROOT/portal/update_status.json" 2>/dev/null | grep -o '"lastUpdate": "[^"]*"' | cut -d'"' -f4)
        [ -n "$last_update" ] && echo -e "  ⏰ $last_update"
    fi
    
    echo ""
}

# 全量操作
full_operation() {
    update_all_data
    echo ""
    print_success "数据更新完成，正在启动前端..."
    sleep 1
    start_all_frontends
}

# 强制更新所有数据（忽略增量检测）
force_update_all_data() {
    print_header "🔄 强制更新所有工具箱数据（忽略缓存）"
    
    # 清除所有哈希缓存
    rm -rf "$CACHE_DIR"/*_hash 2>/dev/null
    print_info "已清除增量检测缓存"
    echo ""
    
    # 设置强制模式标记
    export FORCE_MODE=1
    
    # 调用正常更新
    update_all_data
    
    unset FORCE_MODE
}

# ==========================================
# ⏰ 定时任务管理 (LaunchAgent)
# ==========================================

LAUNCHD_PLIST="$HOME/Library/LaunchAgents/com.xllucky.update.plist"
LAUNCHD_LABEL="com.xllucky.update"
LAUNCHD_LOG="$PROJECT_ROOT/.cache/launchd.log"

# 获取当前定时任务状态
get_schedule_status() {
    if [ -f "$LAUNCHD_PLIST" ] && launchctl list 2>/dev/null | grep -q "$LAUNCHD_LABEL"; then
        # 读取配置的时间
        local hour=$(plutil -p "$LAUNCHD_PLIST" 2>/dev/null | grep '"Hour"' | awk '{print $NF}')
        local minute=$(plutil -p "$LAUNCHD_PLIST" 2>/dev/null | grep '"Minute"' | awk '{print $NF}')
        echo "${hour}:$(printf '%02d' $minute)"
    else
        echo ""
    fi
}

# 显示定时任务菜单
show_schedule_menu() {
    print_header "⏰ 定时任务管理"
    
    local current_time=$(get_schedule_status)
    
    echo ""
    echo -e "${CYAN}当前状态:${NC}"
    if [ -n "$current_time" ]; then
        echo -e "  ${GREEN}●${NC} 定时任务已启用"
        echo -e "  ${BLUE}⏰${NC} 每天 ${current_time} 自动更新数据"
    else
        echo -e "  ${RED}○${NC} 定时任务未启用"
    fi
    
    # 显示最近日志
    if [ -f "$LAUNCHD_LOG" ]; then
        echo ""
        echo -e "${CYAN}最近执行记录 (最后5条):${NC}"
        tail -5 "$LAUNCHD_LOG" 2>/dev/null | while read line; do
            echo -e "  ${BLUE}│${NC} $line"
        done
    fi
    
    echo ""
    echo -e "${CYAN}操作选项:${NC}"
    echo -e "  ${CYAN}[1]${NC} 启用定时任务 (每天早上 8:00)"
    echo -e "  ${CYAN}[2]${NC} 启用定时任务 (每天晚上 20:00)"
    echo -e "  ${CYAN}[3]${NC} 自定义定时任务时间"
    echo -e "  ${CYAN}[4]${NC} 禁用定时任务"
    echo -e "  ${CYAN}[5]${NC} 查看完整日志"
    echo -e "  ${CYAN}[6]${NC} 立即执行一次"
    echo -e "  ${CYAN}[7]${NC} 查看当前配置详情"
    echo -e "  ${CYAN}[0]${NC} 返回主菜单"
    echo ""
    echo -n "  请选择: "
}

# 创建 LaunchAgent plist 文件
create_launchd_plist() {
    local hour="$1"
    local minute="$2"
    
    mkdir -p "$HOME/Library/LaunchAgents"
    mkdir -p "$PROJECT_ROOT/.cache"
    
    cat > "$LAUNCHD_PLIST" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$LAUNCHD_LABEL</string>
    
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>-c</string>
        <string>cd $PROJECT_ROOT &amp;&amp; export PATH="$PROJECT_ROOT/venv/bin:\$PATH" &amp;&amp; CRON_MODE=1 ./run.sh --update</string>
    </array>
    
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>$hour</integer>
        <key>Minute</key>
        <integer>$minute</integer>
    </dict>
    
    <key>StandardOutPath</key>
    <string>$LAUNCHD_LOG</string>
    
    <key>StandardErrorPath</key>
    <string>$PROJECT_ROOT/.cache/launchd_error.log</string>
    
    <key>RunAtLoad</key>
    <false/>
</dict>
</plist>
EOF
}

# 添加定时任务
add_schedule() {
    local hour="$1"
    local minute="$2"
    
    # 先卸载旧任务
    launchctl unload "$LAUNCHD_PLIST" 2>/dev/null || true
    
    # 创建新配置
    create_launchd_plist "$hour" "$minute"
    
    # 加载任务
    if launchctl load "$LAUNCHD_PLIST" 2>/dev/null; then
        local time_str="${hour}:$(printf '%02d' $minute)"
        print_success "定时任务已设置: 每天 ${time_str} 自动更新数据"
        print_info "日志文件: $LAUNCHD_LOG"
        send_notification "XLLucky 定时任务" "✅ 已启用 | ⏰ 每天 ${time_str} 自动更新" "Pop"
    else
        print_error "定时任务设置失败"
    fi
}

# 移除定时任务
remove_schedule() {
    if [ -f "$LAUNCHD_PLIST" ]; then
        launchctl unload "$LAUNCHD_PLIST" 2>/dev/null || true
        rm -f "$LAUNCHD_PLIST"
        print_success "定时任务已禁用"
        send_notification "XLLucky 定时任务" "🛑 已禁用定时任务" "Pop"
    else
        print_warning "当前没有启用定时任务"
    fi
}

# 自定义时间
custom_schedule_time() {
    echo ""
    echo -n "  请输入小时 (0-23): "
    read -r hour
    echo -n "  请输入分钟 (0-59): "
    read -r minute
    
    # 验证输入
    if ! [[ "$hour" =~ ^[0-9]+$ ]] || [ "$hour" -lt 0 ] || [ "$hour" -gt 23 ]; then
        print_error "小时格式错误，请输入 0-23"
        return
    fi
    if ! [[ "$minute" =~ ^[0-9]+$ ]] || [ "$minute" -lt 0 ] || [ "$minute" -gt 59 ]; then
        print_error "分钟格式错误，请输入 0-59"
        return
    fi
    
    add_schedule "$hour" "$minute"
}

# 查看完整日志
view_schedule_log() {
    echo ""
    if [ -f "$LAUNCHD_LOG" ]; then
        print_header "📋 定时任务执行日志"
        echo ""
        cat "$LAUNCHD_LOG"
    else
        print_info "暂无执行日志"
    fi
    
    if [ -f "$PROJECT_ROOT/.cache/launchd_error.log" ]; then
        local err_content=$(cat "$PROJECT_ROOT/.cache/launchd_error.log" 2>/dev/null)
        if [ -n "$err_content" ]; then
            echo ""
            print_warning "错误日志:"
            echo "$err_content"
        fi
    fi
}

# 立即执行一次
run_schedule_now() {
    if launchctl list 2>/dev/null | grep -q "$LAUNCHD_LABEL"; then
        print_info "正在触发定时任务..."
        launchctl start "$LAUNCHD_LABEL"
        print_success "已触发执行，请稍后查看日志"
    else
        print_warning "定时任务未启用，请先启用"
    fi
}

# 查看当前配置详情
view_schedule_config() {
    print_header "📋 定时任务配置详情"
    
    echo ""
    if [ -f "$LAUNCHD_PLIST" ]; then
        echo -e "${CYAN}配置文件路径:${NC}"
        echo -e "  ${BLUE}$LAUNCHD_PLIST${NC}"
        echo ""
        
        # 检查是否已加载
        if launchctl list 2>/dev/null | grep -q "$LAUNCHD_LABEL"; then
            echo -e "${GREEN}●${NC} 任务状态: ${GREEN}已加载运行${NC}"
        else
            echo -e "${YELLOW}○${NC} 任务状态: ${YELLOW}未加载${NC}"
        fi
        echo ""
        
        # 解析配置
        local hour=$(plutil -p "$LAUNCHD_PLIST" 2>/dev/null | grep '"Hour"' | awk '{print $NF}')
        local minute=$(plutil -p "$LAUNCHD_PLIST" 2>/dev/null | grep '"Minute"' | awk '{print $NF}')
        
        echo -e "${CYAN}定时设置:${NC}"
        echo -e "  ⏰ 执行时间: 每天 ${hour}:$(printf '%02d' $minute)"
        echo ""
        
        echo -e "${CYAN}执行命令:${NC}"
        echo -e "  ${BLUE}cd $PROJECT_ROOT && CRON_MODE=1 ./run.sh --update${NC}"
        echo ""
        
        echo -e "${CYAN}日志文件:${NC}"
        echo -e "  标准输出: ${BLUE}$LAUNCHD_LOG${NC}"
        echo -e "  错误日志: ${BLUE}$PROJECT_ROOT/.cache/launchd_error.log${NC}"
        echo ""
        
        echo -e "${CYAN}企业微信推送:${NC}"
        if [ "${WECHAT_WORK_PUSH_ENABLED:-false}" = "true" ] && [ "${PUSH_ON_SCHEDULE:-true}" = "true" ]; then
            echo -e "  ${GREEN}●${NC} 已启用 (定时任务完成后自动推送)"
        else
            echo -e "  ${RED}○${NC} 未启用"
        fi
        echo ""
        
        echo -e "${CYAN}原始配置文件内容:${NC}"
        echo -e "${BLUE}─────────────────────────────────────────${NC}"
        cat "$LAUNCHD_PLIST" | head -30
        echo -e "${BLUE}─────────────────────────────────────────${NC}"
    else
        print_warning "未找到定时任务配置文件"
        print_info "请先启用定时任务"
    fi
}

# 定时任务管理主函数
manage_schedule() {
    while true; do
        show_schedule_menu
        read -r choice
        
        case $choice in
            1) add_schedule 8 0; echo ""; echo "按回车继续..."; read -r ;;
            2) add_schedule 20 0; echo ""; echo "按回车继续..."; read -r ;;
            3) custom_schedule_time; echo ""; echo "按回车继续..."; read -r ;;
            4) remove_schedule; echo ""; echo "按回车继续..."; read -r ;;
            5) view_schedule_log; echo ""; echo "按回车继续..."; read -r ;;
            6) run_schedule_now; echo ""; echo "按回车继续..."; read -r ;;
            7) view_schedule_config; echo ""; echo "按回车继续..."; read -r ;;
            0) return ;;
            *) print_error "无效选项"; sleep 1 ;;
        esac
    done
}

# ==========================================
# 🔔 通知功能（仅用于定时任务）
# ==========================================

# 发送 macOS 通知
send_notification() {
    local title="$1"
    local message="$2"
    local sound="${3:-default}"
    
    # macOS 通知中心
    if command -v osascript &> /dev/null; then
        osascript -e "display notification \"$message\" with title \"$title\" sound name \"$sound\"" 2>/dev/null || true
    fi
}

# 发送定时任务执行结果通知
send_schedule_result_notification() {
    local success="$1"
    local unchanged="$2"
    local failed="$3"
    local duration="$4"
    
    local title="XLLucky 定时更新完成"
    local message="✅ 更新: ${success} 个"
    [ "$unchanged" -gt 0 ] && message="$message | ⏭️ 跳过: ${unchanged}"
    [ "$failed" -gt 0 ] && message="$message | ❌ 失败: ${failed}"
    message="$message | ⏱️ ${duration}秒"
    
    local sound="Glass"
    [ "$failed" -gt 0 ] && sound="Basso"
    
    send_notification "$title" "$message" "$sound"
}

# 手动推送企业微信
manual_wechat_push() {
    print_header "📱 企业微信推送"
    
    echo ""
    echo -e "${CYAN}推送选项:${NC}"
    echo -e "  ${CYAN}[1]${NC} 发送每日市场报告"
    echo -e "  ${CYAN}[2]${NC} 检查并发送异常预警"
    echo -e "  ${CYAN}[3]${NC} 发送涨跌排行榜"
    echo -e "  ${CYAN}[4]${NC} 完整推送 (日报+预警)"
    echo -e "  ${CYAN}[5]${NC} 发送测试消息"
    echo -e "  ${CYAN}[0]${NC} 返回"
    echo ""
    echo -n "  请选择: "
    read -r choice
    
    activate_venv
    
    case $choice in
        1)
            if [ -f "$PROJECT_ROOT/portal/wechat_work_push.py" ]; then
                print_info "正在发送每日报告..."
                python "$PROJECT_ROOT/portal/wechat_work_push.py" daily
            else
                print_error "推送脚本不存在"
            fi
            ;;
        2)
            if [ -f "$PROJECT_ROOT/portal/wechat_work_push.py" ]; then
                print_info "正在检查异常预警..."
                python "$PROJECT_ROOT/portal/wechat_work_push.py" alert
            else
                print_error "推送脚本不存在"
            fi
            ;;
        3)
            if [ -f "$PROJECT_ROOT/portal/wechat_work_push.py" ]; then
                print_info "正在发送涨跌排行榜..."
                python "$PROJECT_ROOT/portal/wechat_work_push.py" ranking
            else
                print_error "推送脚本不存在"
            fi
            ;;
        4)
            if [ -f "$PROJECT_ROOT/portal/wechat_work_push.py" ]; then
                print_info "正在发送完整推送..."
                python "$PROJECT_ROOT/portal/wechat_work_push.py" full
            else
                print_error "推送脚本不存在"
            fi
            ;;
        5)
            if [ -f "$PROJECT_ROOT/portal/wechat_work_push.py" ]; then
                print_info "正在发送测试消息..."
                python "$PROJECT_ROOT/portal/wechat_work_push.py" test
            else
                print_error "推送脚本不存在"
            fi
            ;;
        0)
            return
            ;;
        *)
            print_error "无效选项"
            ;;
    esac
}

# ==========================================
# 📦 依赖检查
# ==========================================

# 检查 Python 依赖
check_python_deps() {
    print_info "正在检查 Python 依赖..."
    
    local requirements_file="$PROJECT_ROOT/requirements.txt"
    if [ ! -f "$requirements_file" ]; then
        print_warning "未找到 requirements.txt"
        return 0
    fi
    
    local missing_deps=()
    local outdated_deps=()
    
    # 读取 requirements.txt 并检查每个包
    while IFS= read -r line || [ -n "$line" ]; do
        # 跳过空行和注释
        [[ -z "$line" || "$line" =~ ^# ]] && continue
        
        # 提取包名（去掉版本号）
        local pkg_name=$(echo "$line" | sed 's/[>=<].*//' | tr -d ' ')
        
        # 检查包是否已安装
        if ! python -c "import $pkg_name" 2>/dev/null; then
            # 有些包名和 import 名不同，尝试 pip show
            if ! pip show "$pkg_name" > /dev/null 2>&1; then
                missing_deps+=("$pkg_name")
            fi
        fi
    done < "$requirements_file"
    
    if [ ${#missing_deps[@]} -eq 0 ]; then
        print_success "所有 Python 依赖已安装"
        return 0
    fi
    
    # 显示缺失的依赖
    echo ""
    print_warning "发现 ${#missing_deps[@]} 个缺失的依赖:"
    for dep in "${missing_deps[@]}"; do
        echo -e "  ${RED}•${NC} $dep"
    done
    
    return 1
}

# 安装缺失的 Python 依赖
install_python_deps() {
    print_info "正在安装 Python 依赖..."
    
    local requirements_file="$PROJECT_ROOT/requirements.txt"
    
    if pip install -r "$requirements_file" --quiet; then
        print_success "Python 依赖安装完成"
        return 0
    else
        print_error "部分依赖安装失败"
        return 1
    fi
}

# 检查并安装依赖（交互式）
check_and_install_deps() {
    print_header "📦 依赖检查"
    
    activate_venv
    
    if check_python_deps; then
        return 0
    fi
    
    echo ""
    echo -n "是否自动安装缺失的依赖? [Y/n]: "
    read -r answer
    
    if [ "$answer" != "n" ] && [ "$answer" != "N" ]; then
        install_python_deps
    fi
}

# 静默检查依赖（用于自动任务）
check_deps_silent() {
    local requirements_file="$PROJECT_ROOT/requirements.txt"
    [ ! -f "$requirements_file" ] && return 0
    
    local has_missing=false
    
    while IFS= read -r line || [ -n "$line" ]; do
        [[ -z "$line" || "$line" =~ ^# ]] && continue
        local pkg_name=$(echo "$line" | sed 's/[>=<].*//' | tr -d ' ')
        
        if ! pip show "$pkg_name" > /dev/null 2>&1; then
            has_missing=true
            break
        fi
    done < "$requirements_file"
    
    if [ "$has_missing" = true ]; then
        print_warning "检测到缺失依赖，正在自动安装..."
        pip install -r "$requirements_file" --quiet 2>/dev/null || true
    fi
}

# ==========================================
# 📈 执行历史统计
# ==========================================

# 查看执行历史统计
show_execution_history() {
    print_header "📈 执行历史统计"
    
    activate_venv
    
    echo ""
    # 调用 Python 获取统计
    python -c "
import sys
sys.path.insert(0, '$PROJECT_ROOT/portal')
from logger import get_execution_summary, get_recent_executions

print(get_execution_summary())
print()
print('📋 最近10次执行记录:')
records = get_recent_executions(10)
if not records:
    print('  暂无记录')
else:
    for r in reversed(records):
        status = '✅' if r['failed'] == 0 else '❌'
        trigger = {'manual': '手动', 'schedule': '定时', 'force': '强制'}.get(r['trigger'], r['trigger'])
        print(f\"  {status} {r['timestamp']} | {trigger} | 成功:{r['success']} 跳过:{r['unchanged']} 失败:{r['failed']} | {r['duration']}秒\")
" 2>/dev/null || print_warning "无法读取执行历史"
    
    echo ""
}

# ==========================================
# 📋 日志查看
# ==========================================

# 查看日志菜单
show_log_menu() {
    print_header "📋 日志查看"
    
    echo ""
    echo -e "${CYAN}日志文件:${NC}"
    echo -e "  ${CYAN}[1]${NC} 主日志 (xllucky.log)"
    echo -e "  ${CYAN}[2]${NC} 定时任务日志 (launchd.log)"
    echo -e "  ${CYAN}[3]${NC} 定时任务错误日志"
    echo -e "  ${CYAN}[4]${NC} 清理旧日志"
    echo -e "  ${CYAN}[0]${NC} 返回"
    echo ""
    echo -n "  请选择: "
}

# 查看日志
view_logs() {
    while true; do
        show_log_menu
        read -r choice
        
        case $choice in
            1)
                local log_file="$PROJECT_ROOT/.cache/logs/xllucky.log"
                if [ -f "$log_file" ]; then
                    print_header "📋 主日志 (最后50行)"
                    echo ""
                    tail -50 "$log_file"
                else
                    print_info "暂无主日志"
                fi
                echo ""
                echo "按回车继续..."
                read -r
                ;;
            2)
                if [ -f "$LAUNCHD_LOG" ]; then
                    print_header "📋 定时任务日志"
                    echo ""
                    cat "$LAUNCHD_LOG"
                else
                    print_info "暂无定时任务日志"
                fi
                echo ""
                echo "按回车继续..."
                read -r
                ;;
            3)
                local err_log="$PROJECT_ROOT/.cache/launchd_error.log"
                if [ -f "$err_log" ] && [ -s "$err_log" ]; then
                    print_header "📋 定时任务错误日志"
                    echo ""
                    cat "$err_log"
                else
                    print_info "暂无错误日志"
                fi
                echo ""
                echo "按回车继续..."
                read -r
                ;;
            4)
                print_info "正在清理旧日志..."
                # 清理超过7天的日志备份
                find "$PROJECT_ROOT/.cache/logs" -name "*.log.*" -mtime +7 -delete 2>/dev/null || true
                # 清空错误日志
                > "$PROJECT_ROOT/.cache/launchd_error.log" 2>/dev/null || true
                print_success "日志清理完成"
                echo ""
                echo "按回车继续..."
                read -r
                ;;
            0)
                return
                ;;
            *)
                print_error "无效选项"
                sleep 1
                ;;
        esac
    done
}

# 打包单个工具箱
build_single() {
    local name="$1"
    local dir="$2"
    local output_name="$3"
    
    cd "$PROJECT_ROOT/$dir/frontend"
    
    # 检查是否已安装依赖
    if [ ! -d "node_modules" ]; then
        npm install > /dev/null 2>&1
    fi
    
    # 执行打包（静默模式）
    if npm run build > /dev/null 2>&1; then
        # 复制产物到统一目录
        if [ -f "dist/index.html" ]; then
            cp "dist/index.html" "$DIST_DIR/$output_name.html"
            echo -e "${GREEN}✅ $name${NC}"
            return 0
        fi
    fi
    echo -e "${RED}❌ $name${NC}"
    return 1
}

# 并行打包单个（后台任务）
build_single_bg() {
    local name="$1"
    local dir="$2"
    local output_name="$3"
    local log_file="$DIST_DIR/.build_${dir}.log"
    
    cd "$PROJECT_ROOT/$dir/frontend"
    
    # 检查是否已安装依赖
    if [ ! -d "node_modules" ]; then
        npm install > "$log_file" 2>&1
    fi
    
    # 执行打包
    if npm run build >> "$log_file" 2>&1; then
        if [ -f "dist/index.html" ]; then
            cp "dist/index.html" "$DIST_DIR/$output_name.html"
            echo "success:$name" > "$DIST_DIR/.result_${dir}"
            return 0
        fi
    fi
    echo "failed:$name" > "$DIST_DIR/.result_${dir}"
    return 1
}

# 一键打包所有工具箱（并行版本）
build_all() {
    print_header "📤 开始并行打包所有工具箱"
    
    # 创建输出目录
    mkdir -p "$DIST_DIR"
    # 清理旧的结果文件
    rm -f "$DIST_DIR"/.result_* "$DIST_DIR"/.build_*.log
    
    local start_time=$(date +%s)
    
    # 并行启动所有打包任务（使用配置文件中的 BUILD_CONFIG）
    print_info "启动 ${#BUILD_CONFIG[@]} 个并行打包任务..."
    echo ""
    
    local pids=()
    for config in "${BUILD_CONFIG[@]}"; do
        IFS=':' read -r name dir output <<< "$config"
        build_single_bg "$name" "$dir" "$output" &
        pids+=($!)
    done
    
    # 等待所有任务完成
    for pid in "${pids[@]}"; do
        wait $pid 2>/dev/null
    done
    
    # 统计结果
    local success=0
    local failed=0
    echo -e "${CYAN}打包结果:${NC}"
    for config in "${BUILD_CONFIG[@]}"; do
        IFS=':' read -r name dir output <<< "$config"
        if [ -f "$DIST_DIR/.result_${dir}" ]; then
            result=$(cat "$DIST_DIR/.result_${dir}")
            if [[ "$result" == success:* ]]; then
                echo -e "  ${GREEN}✅${NC} $name"
                ((success++))
            else
                echo -e "  ${RED}❌${NC} $name (查看日志: dist/.build_${dir}.log)"
                ((failed++))
            fi
        fi
    done
    
    # 生成入口页面
    echo ""
    print_info "正在生成入口页面..."
    local build_time=$(date '+%Y-%m-%d %H:%M:%S')
    sed "s/__BUILD_TIME__/$build_time/g" "$PROJECT_ROOT/portal/index_dist.html" > "$DIST_DIR/工具箱入口.html"
    echo -e "  ${GREEN}✅${NC} 入口页面"
    
    # 清理临时文件
    rm -f "$DIST_DIR"/.result_*
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    echo ""
    print_header "📤 打包完成"
    print_success "成功: $success 个工具箱 + 1 个入口页面"
    [ $failed -gt 0 ] && print_error "失败: $failed 个"
    print_info "耗时: ${duration} 秒"
    echo ""
    
    # 自动生成 zip
    if [ $success -gt 0 ]; then
        print_info "正在生成压缩包..."
        local zip_name="XLLucky工具箱_$(date '+%Y%m%d_%H%M%S').zip"
        cd "$DIST_DIR"
        zip -q "$zip_name" *.html
        echo -e "${GREEN}✅ 压缩包已生成: ${BLUE}$zip_name${NC}"
        echo ""
    fi
    
    echo -e "${CYAN}文件列表:${NC}"
    ls -lh "$DIST_DIR"/*.html "$DIST_DIR"/*.zip 2>/dev/null | awk '{print "  " $9 " (" $5 ")"}'
    echo ""
    
    # 打开产物目录
    open "$DIST_DIR" 2>/dev/null || xdg-open "$DIST_DIR" 2>/dev/null || true
}

# 主循环
main() {
    # 处理命令行参数
    case "${1:-}" in
        --update|-u)
            update_all_data
            exit 0
            ;;
        --start|-s)
            start_all_frontends
            exit 0
            ;;
        --full|-f)
            full_operation
            exit 0
            ;;
        --stop)
            stop_all_frontends
            exit 0
            ;;
        --status)
            show_status
            exit 0
            ;;
        --help|-h)
            echo "用法: $0 [选项]"
            echo ""
            echo "选项:"
            echo "  --update, -u        更新所有数据 (并行+增量检测)"
            echo "  --force             强制更新所有数据 (忽略增量检测)"
            echo "  --start, -s         启动所有前端"
            echo "  --full, -f          全量操作 (更新+启动)"
            echo "  --stop              停止所有前端"
            echo "  --status            查看运行状态"
            echo "  --portal, -p        打开入口页面"
            echo "  --build, -b         一键打包所有工具箱"
            echo "  --schedule-enable   启用定时任务 (默认每天8:00)"
            echo "  --schedule-disable  禁用定时任务"
            echo "  --schedule-status   查看定时任务状态"
            echo "  --push              手动推送企业微信消息"
            echo "  --history           查看执行历史统计"
            echo "  --check-deps        检查并安装 Python 依赖"
            echo "  --help, -h          显示帮助"
            echo ""
            echo "不带参数运行将显示交互式菜单"
            exit 0
            ;;
        --portal|-p)
            open_portal
            exit 0
            ;;
        --build|-b)
            build_all
            exit 0
            ;;
        --force)
            force_update_all_data
            exit 0
            ;;
        --schedule-enable)
            add_schedule "${DEFAULT_CRON_HOUR:-8}" "${DEFAULT_CRON_MINUTE:-0}"
            exit 0
            ;;
        --schedule-disable)
            remove_schedule
            exit 0
            ;;
        --schedule-status)
            local current_time=$(get_schedule_status)
            if [ -n "$current_time" ]; then
                print_success "定时任务已启用: 每天 ${current_time}"
            else
                print_info "定时任务未启用"
            fi
            exit 0
            ;;
        --check-deps)
            check_and_install_deps
            exit 0
            ;;
        --push)
            activate_venv
            if [ -f "$PROJECT_ROOT/portal/wechat_work_push.py" ]; then
                python "$PROJECT_ROOT/portal/wechat_work_push.py" daily
            else
                print_error "推送脚本不存在"
            fi
            exit 0
            ;;
        --history)
            show_execution_history
            exit 0
            ;;
    esac
    
    # 交互式菜单
    while true; do
        show_menu
        read -r choice
        
        case $choice in
            1) update_all_data; echo ""; echo "按回车继续..."; read -r ;;
            2) start_all_frontends ;;
            3) full_operation ;;
            4) selective_update_data; echo ""; echo "按回车继续..."; read -r ;;
            5) selective_start_frontend ;;
            6) stop_all_frontends; echo ""; echo "按回车继续..."; read -r ;;
            7) show_status; echo ""; echo "按回车继续..."; read -r ;;
            8) open_portal; echo ""; echo "按回车继续..."; read -r ;;
            9) build_all; echo ""; echo "按回车继续..."; read -r ;;
            f|F) force_update_all_data; echo ""; echo "按回车继续..."; read -r ;;
            c|C) manage_schedule ;;
            w|W) manual_wechat_push; echo ""; echo "按回车继续..."; read -r ;;
            h|H) show_execution_history; echo ""; echo "按回车继续..."; read -r ;;
            l|L) view_logs ;;
            d|D) check_and_install_deps; echo ""; echo "按回车继续..."; read -r ;;
            r|R) "$PROJECT_ROOT/realtime_update.sh" ;;
            0) echo ""; print_info "再见！"; exit 0 ;;
            *) print_error "无效选项"; sleep 1 ;;
        esac
    done
}

# 运行主程序
main "$@"
