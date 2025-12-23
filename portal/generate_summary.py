#!/usr/bin/env python3
"""
生成手机端摘要数据
从各工具箱数据文件提取关键指标，生成 summary.json
"""

import json
import re
import os
from datetime import datetime
from pathlib import Path

# 项目根目录
PROJECT_ROOT = Path(__file__).parent.parent

def extract_ts_data(file_path: Path) -> dict:
    """从 TypeScript 文件中提取数据"""
    if not file_path.exists():
        return {}
    
    content = file_path.read_text(encoding='utf-8')
    
    # 移除 export 语句，提取 JSON 部分
    # 匹配 export const xxx = { ... } 或 export default { ... }
    match = re.search(r'export\s+(?:const\s+\w+\s*=|default)\s*(\{[\s\S]*\})\s*;?\s*$', content)
    if not match:
        # 尝试匹配简单的对象
        match = re.search(r'=\s*(\{[\s\S]*\})\s*;?\s*$', content)
    
    if match:
        json_str = match.group(1)
        # 处理 TypeScript 特有的语法
        # 移除尾随逗号
        json_str = re.sub(r',(\s*[}\]])', r'\1', json_str)
        # 处理单引号
        json_str = json_str.replace("'", '"')
        
        try:
            return json.loads(json_str)
        except json.JSONDecodeError:
            pass
    
    return {}

def parse_bond_data() -> dict:
    """解析债基晴雨表数据"""
    file_path = PROJECT_ROOT / 'bondFund' / 'data' / 'bondReports.ts'
    if not file_path.exists():
        return {}
    
    content = file_path.read_text(encoding='utf-8')
    
    result = {}
    
    # 提取 conclusion 部分的关键字段
    patterns = {
        'score': r'"score":\s*([\d.]+)',
        'weather': r'"weather":\s*"([^"]+)"',
        'percentile': r'"percentile":\s*"?([^",}]+)"?',
        'val_status': r'"val_status":\s*"([^"]+)"',
        'trend_status': r'"trend_status":\s*"([^"]+)"',
        'last_yield': r'"last_yield":\s*([\d.]+)',
        'suggestion_con': r'"suggestion_con":\s*"([^"]+)"',
        'last_date': r'"last_date":\s*"([^"]+)"',
    }
    
    for key, pattern in patterns.items():
        match = re.search(pattern, content)
        if match:
            result[key] = match.group(1)
    
    # 格式化输出
    if result:
        weather = result.get('weather', '')
        weather_icon = '☀️'
        if '大雨' in weather or '暴雨' in weather:
            weather_icon = '🌧️'
        elif '小雨' in weather or '阴' in weather:
            weather_icon = '🌧️'
        elif '多云' in weather:
            weather_icon = '⛅'
        elif '晴' in weather:
            weather_icon = '☀️'
        
        return {
            'score': round(float(result.get('score', 0)), 1),
            'weather': weather,
            'weather_icon': weather_icon,
            'yield': f"{float(result.get('last_yield', 0)):.2f}%",
            'percentile': result.get('percentile', '--'),
            'valuation': result.get('val_status', '--').replace('🔴 ', '').replace('🟢 ', '').replace('🟡 ', ''),
            'trend': result.get('trend_status', '--').replace('🔴 ', '').replace('🟢 ', ''),
            'suggestion': result.get('suggestion_con', '').replace('【', '').replace('】', ' - ')[:100],
            'date': result.get('last_date', ''),
        }
    
    return {}

def parse_dividend_data() -> dict:
    """解析红利股票数据"""
    file_path = PROJECT_ROOT / 'dividend' / 'data' / 'dividendData.ts'
    if not file_path.exists():
        return {}
    
    content = file_path.read_text(encoding='utf-8')
    
    result = {}
    
    # 提取 index.conclusion 部分
    patterns = {
        'score': r'"score":\s*([\d.]+)',
        'weather': r'"weather":\s*"([^"]+)"',
        'signal': r'"signal":\s*"([^"]+)"',
        'dividend_yield': r'"dividend_yield":\s*"?([^",}]+)"?',
        'spread': r'"spread":\s*"?([^",}]+)"?',
        'rsi': r'"rsi":\s*([\d.]+)',
        'suggestion_con': r'"suggestion_con":\s*"([^"]+)"',
        'last_date': r'"last_date":\s*"([^"]+)"',
    }
    
    for key, pattern in patterns.items():
        match = re.search(pattern, content)
        if match:
            result[key] = match.group(1)
    
    # 提取 top_stocks（文件末尾的简化版 stocks 数组）
    top_stocks = []
    # 找最后一个 stocks 数组（简化版）
    all_stocks_matches = list(re.finditer(r'"stocks":\s*\[', content))
    if len(all_stocks_matches) >= 2:
        # 使用最后一个 stocks 数组
        last_match = all_stocks_matches[-1]
        stocks_start = last_match.end()
        # 找到对应的结束括号
        bracket_count = 1
        pos = stocks_start
        while bracket_count > 0 and pos < len(content):
            if content[pos] == '[':
                bracket_count += 1
            elif content[pos] == ']':
                bracket_count -= 1
            pos += 1
        
        stocks_content = content[stocks_start:pos-1]
        # 提取每个股票
        stock_pattern = r'\{\s*"code":\s*"([^"]+)",\s*"name":\s*"([^"]+)",\s*"total_score":\s*([\d.]+),\s*"metrics":\s*\{[^}]*"dividend_yield":\s*([\d.]+)'
        matches = re.findall(stock_pattern, stocks_content)
        for code, name, score, div_yield in matches[:5]:
            top_stocks.append({
                'code': code,
                'name': name,
                'score': round(float(score), 1),
                'yield': f"{div_yield}%"
            })
    
    if result:
        weather = result.get('weather', '')
        weather_icon = '☀️'
        if '大雨' in weather or '暴雨' in weather:
            weather_icon = '🌧️'
        elif '小雨' in weather or '阴' in weather:
            weather_icon = '🌧️'
        elif '多云' in weather:
            weather_icon = '⛅'
        elif '晴' in weather:
            weather_icon = '☀️'
        
        signal = result.get('signal', 'hold')
        if signal not in ['buy', 'sell', 'hold']:
            signal = 'hold'
        
        # 格式化 spread
        spread = result.get('spread', '--')
        try:
            spread = f"{float(spread):.2f}%"
        except:
            pass
        
        return {
            'score': round(float(result.get('score', 0)), 1),
            'weather': weather,
            'weather_icon': weather_icon,
            'signal': signal,
            'dividend_yield': f"{result.get('dividend_yield', '--')}%",
            'spread': spread,
            'rsi': round(float(result.get('rsi', 0)), 1),
            'suggestion': result.get('suggestion_con', '').replace('【', '').replace('】', ' - ')[:100],
            'top_stocks': top_stocks,
            'date': result.get('last_date', ''),
        }
    
    return {}

def parse_economic_data() -> dict:
    """解析宏观经济数据"""
    file_path = PROJECT_ROOT / 'economic' / 'macro_data.ts'
    if not file_path.exists():
        return {}
    
    content = file_path.read_text(encoding='utf-8')
    
    result = {}
    
    def extract_latest_value(indicator: str) -> str:
        """提取指标最新值"""
        pattern = rf'"{indicator}":\s*\[([\s\S]*?)\]'
        match = re.search(pattern, content)
        if match:
            array_content = match.group(1)
            # 提取所有记录
            records = re.findall(r'\{[^{}]+\}', array_content)
            if records:
                last = records[-1]
                value_match = re.search(r'"value":\s*(-?[\d.]+)', last)
                if value_match:
                    return value_match.group(1)
        return None
    
    # 提取各指标
    cpi = extract_latest_value('cpi')
    ppi = extract_latest_value('ppi')
    pmi = extract_latest_value('pmi')
    m1 = extract_latest_value('m1')
    m2 = extract_latest_value('m2')
    lpr_5y = extract_latest_value('lpr_5y')
    social_financing = extract_latest_value('social_financing')
    
    # 格式化输出
    formatted = {}
    
    if cpi:
        formatted['cpi'] = f"{cpi}%"
    if ppi:
        formatted['ppi'] = f"{ppi}%"
    if pmi:
        formatted['pmi'] = pmi
    
    # M1-M2 剪刀差
    if m1 and m2:
        try:
            scissors = float(m1) - float(m2)
            formatted['scissors'] = f"{scissors:.1f}%"
        except:
            formatted['scissors'] = '--'
    
    # 社融（亿元，转换为万亿）
    if social_financing:
        try:
            sf = float(social_financing)
            if sf >= 10000:
                formatted['social_financing'] = f"{sf/10000:.1f}万亿"
            else:
                formatted['social_financing'] = f"{sf:.0f}亿"
        except:
            formatted['social_financing'] = '--'
    
    if lpr_5y:
        formatted['lpr_5y'] = f"{lpr_5y}%"
    
    return formatted

def parse_stocks_data() -> dict:
    """解析A股市场数据"""
    file_path = PROJECT_ROOT / 'stocks' / 'market_data_full.ts'
    if not file_path.exists():
        return {}
    
    content = file_path.read_text(encoding='utf-8')
    
    result = {}
    
    # 提取 a_share 数组的最后几条记录
    a_share_match = re.search(r'"a_share":\s*\[([\s\S]*?)\],\s*"hk_', content)
    if a_share_match:
        a_share_content = a_share_match.group(1)
        # 提取所有记录
        records = re.findall(r'\{[^{}]+\}', a_share_content)
        if len(records) >= 2:
            # 解析最后两条
            try:
                last = records[-1]
                prev = records[-2]
                
                sh_last = float(re.search(r'"sh_close":\s*([\d.]+)', last).group(1))
                sh_prev = float(re.search(r'"sh_close":\s*([\d.]+)', prev).group(1))
                sz_last = float(re.search(r'"sz_close":\s*([\d.]+)', last).group(1))
                sz_prev = float(re.search(r'"sz_close":\s*([\d.]+)', prev).group(1))
                vol_last = float(re.search(r'"total_amount_yi":\s*([\d.]+)', last).group(1))
                
                result['sh_index'] = f"{sh_last:.0f}"
                sh_change = (sh_last - sh_prev) / sh_prev * 100
                result['sh_change'] = f"{'+' if sh_change >= 0 else ''}{sh_change:.2f}%"
                result['sh_change_class'] = 'up' if sh_change >= 0 else 'down'
                
                result['sz_index'] = f"{sz_last:.0f}"
                sz_change = (sz_last - sz_prev) / sz_prev * 100
                result['sz_change'] = f"{'+' if sz_change >= 0 else ''}{sz_change:.2f}%"
                result['sz_change_class'] = 'up' if sz_change >= 0 else 'down'
                
                if vol_last >= 10000:
                    result['volume'] = f"{vol_last/10000:.2f}万亿"
                else:
                    result['volume'] = f"{vol_last:.0f}亿"
                
                # 计算成交额近3年百分位
                # 提取近3年（约756个交易日）的成交额数据
                recent_records = records[-756:] if len(records) >= 756 else records
                volumes = []
                for rec in recent_records:
                    vol_match = re.search(r'"total_amount_yi":\s*([\d.]+)', rec)
                    if vol_match:
                        volumes.append(float(vol_match.group(1)))
                
                if volumes:
                    # 计算百分位：当前成交额在历史数据中的排名（与前端保持一致，使用 <=）
                    below_or_equal_count = sum(1 for v in volumes if v <= vol_last)
                    percentile = (below_or_equal_count / len(volumes)) * 100
                    result['volume_percentile'] = round(percentile)
            except:
                pass
    
    # 提取北向资金
    north_match = re.search(r'"north":\s*\[([\s\S]*?)\],\s*"south"', content)
    if north_match:
        north_content = north_match.group(1)
        records = re.findall(r'\{[^{}]+\}', north_content)
        if records:
            try:
                last = records[-1]
                net = float(re.search(r'"net":\s*(-?[\d.]+)', last).group(1))
                result['north_flow'] = f"{'+' if net >= 0 else ''}{net:.1f}亿"
                result['north_flow_class'] = 'up' if net >= 0 else 'down'
            except:
                pass
    
    # 提取融资余额
    margin_match = re.search(r'"margin":\s*\[([\s\S]*?)\],', content)
    if margin_match:
        margin_content = margin_match.group(1)
        records = re.findall(r'\{[^{}]+\}', margin_content)
        if records:
            try:
                last = records[-1]
                balance = float(re.search(r'"balance":\s*([\d.]+)', last).group(1))
                result['margin'] = f"{balance/10000:.2f}万亿"
            except:
                pass
    
    # 市场情绪判断
    if result.get('sh_change_class') == 'up' and result.get('north_flow_class') == 'up':
        result['sentiment'] = '偏多'
        result['sentiment_class'] = 'up'
    elif result.get('sh_change_class') == 'down' and result.get('north_flow_class') == 'down':
        result['sentiment'] = '偏空'
        result['sentiment_class'] = 'down'
    else:
        result['sentiment'] = '震荡'
        result['sentiment_class'] = 'neutral'
    
    return result

def parse_us_stocks_data() -> dict:
    """解析美股市场数据"""
    file_path = PROJECT_ROOT / 'us_stocks' / 'us_market_data.ts'
    if not file_path.exists():
        return {}
    
    content = file_path.read_text(encoding='utf-8')
    
    result = {}
    
    def extract_index_data(index_name: str, section: str = None) -> tuple:
        """提取指数数据"""
        if section:
            # 先找到对应的 section
            section_match = re.search(rf'"{section}":\s*\{{([\s\S]*?)\}}\s*,\s*"', content)
            if section_match:
                search_content = section_match.group(1)
            else:
                return None, None
        else:
            search_content = content
            
        pattern = rf'"{index_name}":\s*\[([\s\S]*?)\]'
        match = re.search(pattern, search_content)
        if match:
            records = re.findall(r'\{[^{}]+\}', match.group(1))
            if len(records) >= 2:
                try:
                    last = records[-1]
                    prev = records[-2]
                    close_last = float(re.search(r'"close":\s*([\d.]+)', last).group(1))
                    close_prev = float(re.search(r'"close":\s*([\d.]+)', prev).group(1))
                    change = (close_last - close_prev) / close_prev * 100
                    return close_last, change
                except:
                    pass
        return None, None
    
    # 纳斯达克 (在 indices 里)
    ndx_close, ndx_change = extract_index_data('ndx', 'indices')
    if ndx_close:
        result['nasdaq'] = f"{ndx_close:,.0f}"
        result['nasdaq_change'] = f"{'+' if ndx_change >= 0 else ''}{ndx_change:.2f}%"
        result['nasdaq_change_class'] = 'up' if ndx_change >= 0 else 'down'
    
    # 标普500 (在 indices 里)
    spx_close, spx_change = extract_index_data('spx', 'indices')
    if spx_close:
        result['spx'] = f"{spx_close:,.0f}"
        result['spx_change'] = f"{'+' if spx_change >= 0 else ''}{spx_change:.2f}%"
        result['spx_change_class'] = 'up' if spx_change >= 0 else 'down'
    
    # VIX
    vix_match = re.search(r'"vix":\s*\[([\s\S]*?)\],', content)
    if vix_match:
        records = re.findall(r'\{[^{}]+\}', vix_match.group(1))
        if records:
            try:
                last = records[-1]
                vix = float(re.search(r'"close":\s*([\d.]+)', last).group(1))
                result['vix'] = f"{vix:.1f}"
                if vix >= 30:
                    result['vix_class'] = 'up'
                    result['vix_color'] = '#ff6b6b'
                elif vix >= 20:
                    result['vix_class'] = 'neutral'
                    result['vix_color'] = '#ffd93d'
                else:
                    result['vix_class'] = 'down'
                    result['vix_color'] = '#64ffda'
            except:
                pass
    
    # 美债
    bond_match = re.search(r'"bond":\s*\[([\s\S]*?)\],', content)
    if bond_match:
        records = re.findall(r'\{[^{}]+\}', bond_match.group(1))
        if records:
            try:
                last = records[-1]
                us_10y = re.search(r'"us_10y":\s*([\d.]+)', last)
                spread = re.search(r'"spread_2_10":\s*(-?[\d.]+)', last)
                if us_10y:
                    result['bond_10y'] = f"{us_10y.group(1)}%"
                if spread:
                    result['yield_spread'] = f"{spread.group(1)}%"
            except:
                pass
    
    # 七巨头 (在 stars 里)
    mag7_names = {'aapl': '苹果', 'msft': '微软', 'nvda': '英伟达', 'googl': '谷歌', 
                  'amzn': '亚马逊', 'meta': 'Meta', 'tsla': '特斯拉'}
    mag7 = []
    
    # 找到 stars 部分
    stars_match = re.search(r'"stars":\s*\{([\s\S]*?)\}\s*\}', content)
    if stars_match:
        stars_content = stars_match.group(1)
        for symbol, name in mag7_names.items():
            pattern = rf'"{symbol}":\s*\[([\s\S]*?)\]'
            match = re.search(pattern, stars_content)
            if match:
                records = re.findall(r'\{[^{}]+\}', match.group(1))
                if len(records) >= 2:
                    try:
                        last = records[-1]
                        prev = records[-2]
                        close_last = float(re.search(r'"close":\s*([\d.]+)', last).group(1))
                        close_prev = float(re.search(r'"close":\s*([\d.]+)', prev).group(1))
                        change = (close_last - close_prev) / close_prev * 100
                        mag7.append({
                            'name': name,
                            'change': f"{'+' if change >= 0 else ''}{change:.1f}%",
                            'change_class': 'up' if change >= 0 else 'down'
                        })
                    except:
                        pass
    
    if mag7:
        result['mag7'] = mag7
    
    return result

def generate_summary():
    """生成摘要数据"""
    summary = {
        'generated_at': datetime.now().strftime('%Y-%m-%d %H:%M'),
        'bond': parse_bond_data(),
        'dividend': parse_dividend_data(),
        'economic': parse_economic_data(),
        'stocks': parse_stocks_data(),
        'us_stocks': parse_us_stocks_data(),
    }
    
    # 写入 JSON 文件
    output_path = PROJECT_ROOT / 'portal' / 'summary.json'
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)
    
    print(f"✅ 摘要数据已生成: {output_path}")
    return summary

if __name__ == '__main__':
    generate_summary()
