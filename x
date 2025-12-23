#!/bin/bash
# XLLucky 快捷命令
# 用法: ./x [命令]
#   ./x        - 打开菜单
#   ./x u      - 更新数据
#   ./x s      - 启动前端
#   ./x b      - 打包
#   ./x f      - 全量操作
#   ./x p      - 打开入口
#   ./x stop   - 停止服务

cd "$(dirname "$0")"

case "${1:-}" in
    u|update)   ./run.sh -u ;;
    s|start)    ./run.sh -s ;;
    b|build)    ./run.sh -b ;;
    f|full)     ./run.sh -f ;;
    p|portal)   ./run.sh -p ;;
    stop)       ./run.sh --stop ;;
    status)     ./run.sh --status ;;
    h|help|-h|--help)
        echo "XLLucky 快捷命令"
        echo ""
        echo "用法: ./x [命令]"
        echo ""
        echo "命令:"
        echo "  (无)     打开交互式菜单"
        echo "  u        更新所有数据"
        echo "  s        启动所有前端"
        echo "  b        一键打包"
        echo "  f        全量操作 (更新+启动)"
        echo "  p        打开入口页面"
        echo "  stop     停止所有服务"
        echo "  status   查看运行状态"
        ;;
    *)          ./run.sh ;;
esac
