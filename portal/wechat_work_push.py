#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
企业微信群机器人消息推送
通过 Webhook 向企业微信群发送消息（无需 IP 白名单）
支持：每日报告、异常预警、涨跌排行榜
"""

import json
import os
import sys
import requests
import urllib3
from datetime import datetime

# 禁用 SSL 警告
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# 企业微信群机器人 Webhook 地址
WEBHOOK_URL = "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=4ba7b800-2c3d-43f3-8c56-f987b1690329"

# LOF套利专用机器人 Webhook 地址
LOF_WEBHOOK_URL = "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=236b86b3-e959-4f4e-a7cf-ff56e3602a66"

# 异常预警阈值
ALERT_THRESHOLDS = {
    'index_change': 3.0,      # 指数涨跌幅超过3%
    'vix_high': 30,           # VIX 恐慌指数超过30
    'volume_surge': 2.0,      # 成交量是平均的2倍
    'stock_change': 5.0,      # 个股涨跌幅超过5%
}


def send_text_message(content):
    """发送文本消息"""
    payload = {
        "msgtype": "text",
        "text": {
            "content": content
        }
    }
    
    try:
        resp = requests.post(WEBHOOK_URL, json=payload, timeout=10, verify=False)
        data = resp.json()
        
        if data.get('errcode', 0) != 0:
            print(f"❌ 发送消息失败: {data.get('errmsg')}")
            return False
        
        print("✅ 企业微信消息发送成功")
        return True
    except Exception as e:
        print(f"❌ 发送消息异常: {e}")
        return False


def send_markdown_message(content, webhook_url=None):
    """发送 Markdown 消息
    
    Args:
        content: Markdown 内容
        webhook_url: 指定 webhook 地址，默认使用 WEBHOOK_URL
    """
    url = webhook_url or WEBHOOK_URL
    payload = {
        "msgtype": "markdown",
        "markdown": {
            "content": content
        }
    }
    
    try:
        resp = requests.post(url, json=payload, timeout=10, verify=False)
        data = resp.json()
        
        if data.get('errcode', 0) != 0:
            print(f"❌ 发送消息失败: {data.get('errmsg')}")
            return False
        
        print("✅ 企业微信 Markdown 消息发送成功")
        return True
    except Exception as e:
        print(f"❌ 发送消息异常: {e}")
        return False


def generate_markdown_content():
    """从 summary.json 生成 Markdown 推送内容"""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    summary_file = os.path.join(script_dir, "summary.json")
    
    if not os.path.exists(summary_file):
        return None
    
    try:
        with open(summary_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        print(f"❌ 读取摘要文件失败: {e}")
        return None
    
    update_time = data.get('generated_at', '未知')
    
    lines = []
    
    # ========== 标题 ==========
    lines.append("# 📊 XLLucky 市场日报")
    lines.append(f"<font color=\"comment\">更新时间: {update_time}</font>")
    lines.append("")
    
    # ========== 债基晴雨表 ==========
    bond = data.get('bond', {})
    if bond:
        weather = bond.get('weather', '未知')
        score = bond.get('score', 0)
        yield_val = bond.get('yield', 'N/A')
        valuation = bond.get('valuation', '未知')
        suggestion = bond.get('suggestion', '')
        
        score_color = "info" if score >= 60 else "warning"
        
        lines.append("---")
        lines.append("### 💰 债基晴雨表")
        lines.append(f"**天气**: {weather}")
        lines.append(f"**评分**: <font color=\"{score_color}\">{score}</font>")
        lines.append(f"**收益率**: {yield_val}　**估值**: {valuation}")
        if suggestion:
            lines.append(f"> 💡 {suggestion}")
        lines.append("")
    
    # ========== 红利股票 ==========
    dividend = data.get('dividend', {})
    if dividend:
        weather = dividend.get('weather', '未知')
        score = dividend.get('score', 0)
        div_yield = dividend.get('dividend_yield', 'N/A')
        spread = dividend.get('spread', 'N/A')
        rsi = dividend.get('rsi', 'N/A')
        suggestion = dividend.get('suggestion', '')
        top_stocks = dividend.get('top_stocks', [])
        
        score_color = "info" if score >= 60 else "warning"
        
        lines.append("---")
        lines.append("### 🎯 红利股票")
        lines.append(f"**天气**: {weather}")
        lines.append(f"**评分**: <font color=\"{score_color}\">{score}</font>")
        lines.append(f"**股息率**: {div_yield}　**股债利差**: {spread}　**RSI**: {rsi}")
        if suggestion:
            lines.append(f"> 💡 {suggestion}")
        
        # TOP5 红利股
        if top_stocks:
            lines.append("")
            lines.append("**TOP5 红利股**:")
            for i, stock in enumerate(top_stocks[:5], 1):
                name = stock.get('name', '')
                s_yield = stock.get('yield', '')
                s_score = stock.get('score', '')
                lines.append(f"> {i}. {name}　股息率 {s_yield}　评分 {s_score}")
        lines.append("")
    
    # ========== A股行情 ==========
    stocks = data.get('stocks', {})
    if stocks:
        sh_index = stocks.get('sh_index', 'N/A')
        sh_change = stocks.get('sh_change', 'N/A')
        sz_index = stocks.get('sz_index', 'N/A')
        sz_change = stocks.get('sz_change', 'N/A')
        volume = stocks.get('volume', 'N/A')
        sentiment = stocks.get('sentiment', '未知')
        volume_percentile = stocks.get('volume_percentile')
        
        sh_color = "info" if '+' in str(sh_change) else "warning"
        sz_color = "info" if '+' in str(sz_change) else "warning"
        
        lines.append("---")
        lines.append("### 🇨🇳 A股行情")
        lines.append(f"**上证**: {sh_index} <font color=\"{sh_color}\">{sh_change}</font>")
        lines.append(f"**深证**: {sz_index} <font color=\"{sz_color}\">{sz_change}</font>")
        
        # 成交量和百分位
        volume_line = f"**成交量**: {volume}"
        if volume_percentile is not None:
            # 根据百分位判断颜色
            if volume_percentile >= 80:
                pct_color = "warning"  # 高位放量
            elif volume_percentile <= 20:
                pct_color = "comment"  # 低位缩量
            else:
                pct_color = "info"
            volume_line += f" <font color=\"{pct_color}\">({volume_percentile}%分位)</font>"
        volume_line += f"　**情绪**: {sentiment}"
        lines.append(volume_line)
        lines.append("")
    
    # ========== 美股行情 ==========
    us = data.get('us_stocks', {})
    if us:
        nasdaq = us.get('nasdaq', 'N/A')
        nasdaq_change = us.get('nasdaq_change', 'N/A')
        spx = us.get('spx', 'N/A')
        spx_change = us.get('spx_change', 'N/A')
        vix = us.get('vix', 'N/A')
        bond_10y = us.get('bond_10y', 'N/A')
        mag7 = us.get('mag7', [])
        
        nq_color = "info" if '+' in str(nasdaq_change) else "warning"
        sp_color = "info" if '+' in str(spx_change) else "warning"
        
        lines.append("---")
        lines.append("### 🇺🇸 美股行情")
        lines.append(f"**纳斯达克**: {nasdaq} <font color=\"{nq_color}\">{nasdaq_change}</font>")
        lines.append(f"**标普500**: {spx} <font color=\"{sp_color}\">{spx_change}</font>")
        lines.append(f"**VIX**: {vix}　**10Y国债**: {bond_10y}")
        
        # 七巨头
        if mag7:
            lines.append("")
            lines.append("**七巨头**:")
            for s in mag7:
                name = s.get('name', '')
                change = s.get('change', '')
                color = "info" if '+' in change else "warning"
                lines.append(f"> {name} <font color=\"{color}\">{change}</font>")
        lines.append("")
    
    # ========== 宏观经济 ==========
    eco = data.get('economic', {})
    if eco:
        cpi = eco.get('cpi', 'N/A')
        ppi = eco.get('ppi', 'N/A')
        pmi = eco.get('pmi', 'N/A')
        scissors = eco.get('scissors', 'N/A')
        social = eco.get('social_financing', 'N/A')
        lpr = eco.get('lpr_5y', 'N/A')
        
        lines.append("---")
        lines.append("### 📈 宏观经济")
        lines.append(f"**CPI**: {cpi}　**PPI**: {ppi}　**剪刀差**: {scissors}")
        lines.append(f"**PMI**: {pmi}　**社融**: {social}　**LPR(5Y)**: {lpr}")
        lines.append("")
    
    # ========== 底部 ==========
    lines.append("---")
    lines.append("<font color=\"comment\">数据仅供参考，投资需谨慎</font>")
    
    return "\n".join(lines)


def check_alerts(data: dict) -> list:
    """检查异常预警"""
    alerts = []
    
    # 检查A股指数异常波动
    stocks = data.get('stocks', {})
    if stocks:
        sh_change = stocks.get('sh_change', '')
        sz_change = stocks.get('sz_change', '')
        
        try:
            sh_val = float(sh_change.replace('%', '').replace('+', ''))
            if abs(sh_val) >= ALERT_THRESHOLDS['index_change']:
                direction = '暴涨' if sh_val > 0 else '暴跌'
                alerts.append({
                    'type': 'index',
                    'level': 'high' if abs(sh_val) >= 5 else 'medium',
                    'message': f"🚨 上证指数{direction} {sh_change}"
                })
        except:
            pass
        
        try:
            sz_val = float(sz_change.replace('%', '').replace('+', ''))
            if abs(sz_val) >= ALERT_THRESHOLDS['index_change']:
                direction = '暴涨' if sz_val > 0 else '暴跌'
                alerts.append({
                    'type': 'index',
                    'level': 'high' if abs(sz_val) >= 5 else 'medium',
                    'message': f"🚨 深证成指{direction} {sz_change}"
                })
        except:
            pass
    
    # 检查美股异常
    us = data.get('us_stocks', {})
    if us:
        # VIX 恐慌指数
        vix = us.get('vix', '')
        try:
            vix_val = float(vix)
            if vix_val >= ALERT_THRESHOLDS['vix_high']:
                alerts.append({
                    'type': 'vix',
                    'level': 'high',
                    'message': f"⚠️ VIX恐慌指数飙升至 {vix}，市场恐慌情绪加剧"
                })
        except:
            pass
        
        # 纳斯达克异常波动
        nasdaq_change = us.get('nasdaq_change', '')
        try:
            nq_val = float(nasdaq_change.replace('%', '').replace('+', ''))
            if abs(nq_val) >= ALERT_THRESHOLDS['index_change']:
                direction = '暴涨' if nq_val > 0 else '暴跌'
                alerts.append({
                    'type': 'index',
                    'level': 'high' if abs(nq_val) >= 5 else 'medium',
                    'message': f"🚨 纳斯达克{direction} {nasdaq_change}"
                })
        except:
            pass
        
        # 七巨头异常波动
        mag7 = us.get('mag7', [])
        for stock in mag7:
            name = stock.get('name', '')
            change = stock.get('change', '')
            try:
                change_val = float(change.replace('%', '').replace('+', ''))
                if abs(change_val) >= ALERT_THRESHOLDS['stock_change']:
                    direction = '暴涨' if change_val > 0 else '暴跌'
                    alerts.append({
                        'type': 'stock',
                        'level': 'medium',
                        'message': f"📈 {name}{direction} {change}"
                    })
            except:
                pass
    
    return alerts


def generate_alert_content(alerts: list) -> str:
    """生成预警消息内容"""
    if not alerts:
        return None
    
    lines = [
        "# ⚠️ XLLucky 市场异常预警",
        f"<font color=\"warning\">预警时间: {datetime.now().strftime('%Y-%m-%d %H:%M')}</font>",
        ""
    ]
    
    # 按级别分组
    high_alerts = [a for a in alerts if a['level'] == 'high']
    medium_alerts = [a for a in alerts if a['level'] == 'medium']
    
    if high_alerts:
        lines.append("### 🔴 高级预警")
        for alert in high_alerts:
            lines.append(f"> {alert['message']}")
        lines.append("")
    
    if medium_alerts:
        lines.append("### 🟡 中级预警")
        for alert in medium_alerts:
            lines.append(f"> {alert['message']}")
        lines.append("")
    
    lines.append("---")
    lines.append("<font color=\"comment\">请关注市场动态，谨慎操作</font>")
    
    return "\n".join(lines)


def generate_ranking_content(data: dict) -> str:
    """生成涨跌排行榜内容"""
    lines = [
        "# 📊 七巨头涨跌排行",
        f"<font color=\"comment\">更新时间: {data.get('generated_at', '未知')}</font>",
        ""
    ]
    
    us = data.get('us_stocks', {})
    mag7 = us.get('mag7', [])
    
    if not mag7:
        return None
    
    # 解析涨跌幅并排序
    parsed = []
    for stock in mag7:
        name = stock.get('name', '')
        change = stock.get('change', '0%')
        try:
            change_val = float(change.replace('%', '').replace('+', ''))
            parsed.append((name, change_val, change))
        except:
            pass
    
    # 按涨跌幅排序
    parsed.sort(key=lambda x: x[1], reverse=True)
    
    lines.append("### 📈 涨幅榜")
    gainers = [p for p in parsed if p[1] > 0]
    if gainers:
        for i, (name, val, change) in enumerate(gainers[:3], 1):
            lines.append(f"> {i}. {name} <font color=\"info\">{change}</font>")
    else:
        lines.append("> 暂无上涨")
    lines.append("")
    
    lines.append("### 📉 跌幅榜")
    losers = [p for p in parsed if p[1] < 0]
    losers.sort(key=lambda x: x[1])  # 跌幅最大的排前面
    if losers:
        for i, (name, val, change) in enumerate(losers[:3], 1):
            lines.append(f"> {i}. {name} <font color=\"warning\">{change}</font>")
    else:
        lines.append("> 暂无下跌")
    
    return "\n".join(lines)


def send_daily_report():
    """发送每日报告"""
    content = generate_markdown_content()
    
    if not content:
        print("⚠️ 无法生成摘要内容，发送默认消息")
        content = f"## 📊 XLLucky 数据更新完成\n\n> ⏰ 更新时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
    
    return send_markdown_message(content)


def send_alert_report():
    """发送异常预警报告"""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    summary_file = os.path.join(script_dir, "summary.json")
    
    if not os.path.exists(summary_file):
        print("⚠️ 摘要文件不存在")
        return False
    
    try:
        with open(summary_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        print(f"❌ 读取摘要文件失败: {e}")
        return False
    
    alerts = check_alerts(data)
    
    if not alerts:
        print("✅ 市场正常，无异常预警")
        return True
    
    content = generate_alert_content(alerts)
    if content:
        print(f"⚠️ 检测到 {len(alerts)} 条异常预警")
        return send_markdown_message(content)
    
    return False


def send_ranking_report():
    """发送涨跌排行榜"""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    summary_file = os.path.join(script_dir, "summary.json")
    
    if not os.path.exists(summary_file):
        print("⚠️ 摘要文件不存在")
        return False
    
    try:
        with open(summary_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        print(f"❌ 读取摘要文件失败: {e}")
        return False
    
    content = generate_ranking_content(data)
    if content:
        return send_markdown_message(content)
    
    print("⚠️ 无法生成排行榜内容")
    return False


def test_push():
    """测试推送"""
    content = f"""## 📊 XLLucky 推送测试

> ✅ 企业微信群机器人配置成功！
> ⏰ 测试时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

后续定时任务将自动推送市场日报。"""
    
    return send_markdown_message(content)


def send_lof_arbitrage_report(force=False):
    """
    发送LOF套利机会报告
    
    Args:
        force: 是否强制推送（忽略变化检测）
    """
    import hashlib
    import re
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    lof_data_file = os.path.join(script_dir, "..", "lof_arbitrage", "data", "lof_data.ts")
    cache_file = os.path.join(script_dir, "..", ".cache", "lof_push_hash")
    
    if not os.path.exists(lof_data_file):
        print("⚠️ LOF数据文件不存在")
        return False
    
    try:
        # 读取 TypeScript 文件并解析 JSON
        with open(lof_data_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 提取 JSON 部分
        json_match = re.search(r'export const LOF_DATA = ({.*?});', content, re.DOTALL)
        if not json_match:
            print("❌ 无法解析LOF数据")
            return False
        
        data = json.loads(json_match.group(1))
    except Exception as e:
        print(f"❌ 读取LOF数据失败: {e}")
        return False
    
    meta = data.get('meta', {})
    updated_at = meta.get('updated_at', '未知')
    opportunities = data.get('opportunities', {})
    premium_list = opportunities.get('premium', [])
    
    # 筛选真正可套利的机会（可申购 + 流动性足够）
    real_opps = [
        f for f in premium_list 
        if f.get('can_subscribe', False) and not f.get('low_liquidity', True)
    ]
    
    # 如果没有套利机会，不推送
    if not real_opps:
        print("✅ 暂无可套利机会，不推送")
        return True
    
    # ========== 变化检测 ==========
    # 生成当前数据的指纹（基于：基金代码列表 + 溢价率四舍五入到整数）
    # 只有基金列表变化或溢价率变化超过1%才推送
    real_opps.sort(key=lambda x: x.get('annualized_return', 0), reverse=True)
    top_opps = real_opps[:5]  # 只关注TOP5
    
    fingerprint_parts = []
    for f in top_opps:
        code = f.get('code', '')
        premium = round(f.get('realtime_discount', 0))  # 四舍五入到整数
        fingerprint_parts.append(f"{code}:{premium}")
    
    current_fingerprint = hashlib.md5(','.join(fingerprint_parts).encode()).hexdigest()[:16]
    
    # 读取上次的指纹
    last_fingerprint = ""
    if os.path.exists(cache_file):
        try:
            with open(cache_file, 'r') as f:
                last_fingerprint = f.read().strip()
        except:
            pass
    
    # 比较指纹
    if not force and current_fingerprint == last_fingerprint:
        print("✅ 套利机会无显著变化，跳过推送")
        return True
    
    # ========== 生成推送内容 ==========
    lines = [
        "# 🔄 LOF套利机会监测",
        f"<font color=\"comment\">更新时间: {updated_at}</font>",
        ""
    ]
    
    lines.append(f"### 💰 发现 {len(real_opps)} 个套利机会")
    lines.append("")
    
    for i, fund in enumerate(top_opps, 1):
        code = fund.get('code', '')
        name = fund.get('name', '')
        premium = fund.get('realtime_discount', 0)
        annualized = fund.get('annualized_return', 0)
        fund_type = fund.get('fund_type', '')
        settlement = fund.get('settlement_days', 2)
        amount = fund.get('amount', 0)  # 成交额（万元）
        daily_limit = fund.get('daily_limit')  # 限额（元）
        
        # 颜色标记
        premium_color = "warning" if premium >= 5 else "info"
        
        # 格式化限额
        if daily_limit:
            limit_wan = daily_limit / 10000  # 转为万元
            if limit_wan >= 10000:
                limit_str = f"{limit_wan/10000:.0f}亿"
            elif limit_wan >= 1:
                limit_str = f"{limit_wan:.0f}万"
            else:
                limit_str = f"{daily_limit:.0f}元"
            
            # 计算预期最大收益（限额 × 溢价率）
            max_profit = daily_limit * premium / 100
            if max_profit >= 10000:
                profit_str = f"{max_profit/10000:.2f}万"
            else:
                profit_str = f"{max_profit:.0f}元"
        else:
            limit_str = "无限额"
            profit_str = "无上限"
        
        lines.append(f"**{i}. {name}** ({code})")
        lines.append(f"> 溢价率: <font color=\"{premium_color}\">+{premium}%</font>")
        lines.append(f"> 年化: {annualized}%　结算: T+{settlement}")
        lines.append(f"> 限额: {limit_str}　预期收益: {profit_str}")
        lines.append("")
    
    if len(real_opps) > 5:
        lines.append(f"<font color=\"comment\">还有 {len(real_opps) - 5} 个机会，详见工具箱</font>")
        lines.append("")
    
    # 风险提示
    lines.append("---")
    lines.append("<font color=\"comment\">⚠️ 套利有风险：申购确认价≠当前估值，溢价可能收窄</font>")
    
    # 发送消息（使用LOF专用机器人）
    result = send_markdown_message("\n".join(lines), webhook_url=LOF_WEBHOOK_URL)
    
    # 推送成功后保存指纹
    if result:
        try:
            os.makedirs(os.path.dirname(cache_file), exist_ok=True)
            with open(cache_file, 'w') as f:
                f.write(current_fingerprint)
        except:
            pass
    
    return result


if __name__ == "__main__":
    if len(sys.argv) > 1:
        cmd = sys.argv[1]
        if cmd == "test":
            test_push()
        elif cmd == "daily":
            send_daily_report()
        elif cmd == "alert":
            send_alert_report()
        elif cmd == "ranking":
            send_ranking_report()
        elif cmd == "lof":
            # 支持 --force 参数强制推送
            force = "--force" in sys.argv or "-f" in sys.argv
            send_lof_arbitrage_report(force=force)
        elif cmd == "full":
            # 完整推送：日报 + 预警检测
            send_daily_report()
            send_alert_report()
        else:
            print("用法: python wechat_work_push.py [test|daily|alert|ranking|lof|full]")
            print("  test    - 发送测试消息")
            print("  daily   - 发送每日市场报告")
            print("  alert   - 检查并发送异常预警")
            print("  ranking - 发送涨跌排行榜")
            print("  lof     - 发送LOF套利机会（有变化才推送）")
            print("  lof -f  - 强制发送LOF套利机会")
            print("  full    - 发送日报并检查预警")
    else:
        # 默认发送每日报告
        send_daily_report()
