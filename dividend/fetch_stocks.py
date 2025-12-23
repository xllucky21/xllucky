"""
红利股票工具箱 - 数据获取脚本（合并版）

功能：
1. 中证红利指数分析 - 判断整体红利股买卖点
2. 个股红利监控 - 分析单只红利股的投资价值

核心指标：
- 股债息差 = 股息率 - 国债收益率
- 市净率 PB / 市盈率 PE
- 分红连续性、ROE、行业属性
"""

import akshare as ak
import pandas as pd
import numpy as np
from scipy import stats
import json
import os
import time
from datetime import datetime, timedelta
import ssl
import urllib3
import requests
import warnings

# ==========================================
# 🛡️ 系统底层配置
# ==========================================
warnings.filterwarnings("ignore")
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

try:
    _create_unverified_https_context = ssl._create_unverified_context
except AttributeError:
    pass
else:
    ssl._create_default_https_context = _create_unverified_https_context

old_get = requests.get
old_post = requests.post
def new_get(url, *args, **kwargs):
    kwargs['verify'] = False
    if 'headers' not in kwargs:
        kwargs['headers'] = {}
    kwargs['headers'].setdefault('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36')
    return old_get(url, *args, **kwargs)
def new_post(url, *args, **kwargs):
    kwargs['verify'] = False
    if 'headers' not in kwargs:
        kwargs['headers'] = {}
    kwargs['headers'].setdefault('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36')
    return old_post(url, *args, **kwargs)
requests.get = new_get
requests.post = new_post

# ==========================================
# ⚙️ 配置
# ==========================================

class Config:
    """红利策略配置参数"""
    DATA_YEARS = 10
    DIVIDEND_INDEX = "000922"  # 中证红利指数
    
    # 技术指标参数
    MA_SHORT = 20
    MA_LONG = 60
    RSI_PERIOD = 14
    
    # 股债性价比阈值
    SPREAD_VERY_ATTRACTIVE = 2.0
    SPREAD_ATTRACTIVE = 1.0
    SPREAD_NEUTRAL = 0.0
    SPREAD_UNATTRACTIVE = -1.0
    
    # 评分权重
    SCORE_BASE = 50
    SCORE_SPREAD_WEIGHT = 0.5
    SCORE_TREND_WEIGHT = 0.5
    
    # 天气评分区间
    WEATHER_SUNNY = 80
    WEATHER_CLEAR = 65
    WEATHER_CLOUDY = 50
    WEATHER_RAINY = 35
    WEATHER_STORM = 20

# 稳定红利股列表
DIVIDEND_STOCKS = [
    # 银行股
    {"code": "601398", "name": "工商银行", "industry": "银行", "type": "stable"},
    {"code": "601939", "name": "建设银行", "industry": "银行", "type": "stable"},
    {"code": "601288", "name": "农业银行", "industry": "银行", "type": "stable"},
    {"code": "601988", "name": "中国银行", "industry": "银行", "type": "stable"},
    {"code": "600036", "name": "招商银行", "industry": "银行", "type": "stable"},
    {"code": "601658", "name": "邮储银行", "industry": "银行", "type": "stable"},
    # 电力股（水电优先）
    {"code": "600900", "name": "长江电力", "industry": "电力", "type": "stable"},
    {"code": "600674", "name": "川投能源", "industry": "电力", "type": "stable"},
    {"code": "600886", "name": "国投电力", "industry": "电力", "type": "stable"},
    # 交通运输
    {"code": "601006", "name": "大秦铁路", "industry": "交运", "type": "stable"},
    {"code": "600377", "name": "宁沪高速", "industry": "交运", "type": "stable"},
    # 通信运营商
    {"code": "600941", "name": "中国移动", "industry": "通信", "type": "stable"},
]

# 个股评分标准
SCORE_CRITERIA = {
    "spread": {"gold": 3.0, "good": 2.0, "warn": 1.0},
    "pb": {"gold": 0.8, "good": 1.0, "warn": 1.5},
    "payout_ratio": {"min": 30, "max": 70, "danger_high": 90, "danger_low": 10},
    "dividend_years": {"gold": 10, "good": 5, "warn": 3},
    "roe": {"gold": 15, "good": 10, "warn": 6},
}

# ROE 预设值
ROE_PRESET = {
    "601398": 10.5, "601939": 11.2, "601288": 10.8, "601988": 9.8, "600036": 15.2,
    "601658": 11.0,
    "600900": 16.5, "600674": 12.3, "600886": 11.8,
    "601006": 10.2, "600377": 9.5,
    "600941": 11.0,
}

# 全局缓存
_spot_cache = None

# ==========================================
# 🛠️ 工具函数
# ==========================================

def safe_fetch(func, name, **kwargs):
    """通用安全抓取函数"""
    print(f"⏳ [{name}] 正在获取...", end="", flush=True)
    try:
        start = time.time()
        result = func(**kwargs)
        if result is None or (hasattr(result, 'empty') and result.empty):
            print(f"\r⚠️ [{name}] 获取结果为空")
            return None
        elapsed = time.time() - start
        count = len(result) if hasattr(result, '__len__') else 1
        print(f"\r✅ [{name}] 成功! ({count} 条, {elapsed:.2f}s)")
        return result
    except Exception as e:
        print(f"\r❌ [{name}] 失败: {str(e)[:50]}")
        return None

# ==========================================
# 📥 数据获取 - 指数相关
# ==========================================

def get_dividend_index():
    """获取中证红利指数日线数据"""
    df = ak.stock_zh_index_daily_em(symbol=f"sh{Config.DIVIDEND_INDEX}")
    df['date'] = pd.to_datetime(df['date'])
    df = df.sort_values('date')
    return df[['date', 'open', 'high', 'low', 'close', 'volume', 'amount']]

def get_dividend_yield_data():
    """获取中证红利指数股息率数据（使用中证指数官方数据）"""
    try:
        df = ak.stock_zh_index_value_csindex(symbol=Config.DIVIDEND_INDEX)
        if df is not None and not df.empty:
            df_dy = df[['日期', '股息率1']].copy()
            df_dy.columns = ['date', 'dividend_yield']
            df_dy['date'] = pd.to_datetime(df_dy['date'])
            df_dy = df_dy.sort_values('date')
            return df_dy
    except Exception as e:
        print(f"⚠️ 股息率数据获取失败: {e}")
    return None

def get_bond_yield_history():
    """获取10年期国债收益率历史"""
    start_date = (datetime.now() - timedelta(days=Config.DATA_YEARS*365)).strftime("%Y%m%d")
    df = ak.bond_zh_us_rate(start_date=start_date)
    result = pd.DataFrame()
    result['date'] = pd.to_datetime(df['日期'])
    result['bond_yield'] = pd.to_numeric(df['中国国债收益率10年'], errors='coerce')
    result = result.dropna()
    result = result.sort_values('date')
    return result

def get_bond_yield_latest():
    """获取当前10年期国债收益率"""
    try:
        df = ak.bond_zh_us_rate()
        if df is not None and not df.empty:
            latest = df.iloc[-1]
            return float(latest['中国国债收益率10年'])
    except:
        pass
    return 1.7

# ==========================================
# 📥 数据获取 - 个股相关
# ==========================================

def get_stock_pb_history(code):
    """获取股票历史PB数据"""
    try:
        df = ak.stock_zh_valuation_baidu(symbol=code, indicator='市净率')
        if df is not None and not df.empty:
            return df
    except:
        pass
    return None

def get_stock_price_history(code):
    """获取股票历史价格数据"""
    try:
        df = ak.stock_zh_a_hist(symbol=code, period="daily", adjust="qfq")
        if df is not None and not df.empty:
            return df
    except:
        pass
    return None

def get_stock_dividend_history(code):
    """获取股票历史分红数据"""
    try:
        df = ak.stock_history_dividend_detail(symbol=code, indicator='分红')
        if df is not None and not df.empty:
            return df
    except:
        pass
    return None

def get_stock_price(code):
    """获取股票当前价格（使用缓存）"""
    global _spot_cache
    try:
        if _spot_cache is None:
            _spot_cache = ak.stock_zh_a_spot_em()
        if _spot_cache is not None and not _spot_cache.empty:
            row = _spot_cache[_spot_cache['代码'] == code]
            if not row.empty:
                return float(row.iloc[0]['最新价'])
    except:
        pass
    return None

# ==========================================
# 🧠 指数计算引擎
# ==========================================

def calculate_technical_indicators(df):
    """计算技术指标"""
    df = df.copy()
    df['MA20'] = df['close'].rolling(window=Config.MA_SHORT).mean()
    df['MA60'] = df['close'].rolling(window=Config.MA_LONG).mean()
    
    delta = df['close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=Config.RSI_PERIOD).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=Config.RSI_PERIOD).mean()
    rs = gain / loss
    df['RSI'] = 100 - (100 / (1 + rs))
    
    df['pct_change'] = df['close'].pct_change() * 100
    df['pct_change_5d'] = df['close'].pct_change(5) * 100
    df['pct_change_20d'] = df['close'].pct_change(20) * 100
    return df

def calculate_composite_score(spread, ma_deviation, rsi):
    """计算综合买入价值评分（0-100）"""
    score = Config.SCORE_BASE
    
    if spread is not None:
        spread_normalized = (spread - Config.SPREAD_NEUTRAL) / (Config.SPREAD_VERY_ATTRACTIVE - Config.SPREAD_NEUTRAL)
        spread_normalized = max(-1, min(1, spread_normalized))
        spread_score = spread_normalized * 25
        score += spread_score * Config.SCORE_SPREAD_WEIGHT * 2
    
    trend_score = 0
    if ma_deviation is not None:
        ma_normalized = -ma_deviation / 10
        ma_normalized = max(-1, min(1, ma_normalized))
        trend_score += ma_normalized * 15
    
    if rsi is not None:
        if rsi < 30:
            trend_score += (30 - rsi) / 30 * 10
        elif rsi > 70:
            trend_score -= (rsi - 70) / 30 * 10
    
    score += trend_score * Config.SCORE_TREND_WEIGHT * 2
    return max(0, min(100, score))

def get_weather_and_suggestion(score):
    """根据评分获取天气和建议"""
    if score >= Config.WEATHER_SUNNY:
        weather = "☀️ 烈日 (极佳买点)"
        suggestion_con = "【强烈建议买入】红利股估值极低，股息率远超国债，是绝佳的配置时机。"
        suggestion_agg = "【重仓出击】可考虑红利ETF或高股息个股，长期持有吃股息。"
        signal = "strong_buy"
    elif score >= Config.WEATHER_CLEAR:
        weather = "🌤️ 晴朗 (较好买点)"
        suggestion_con = "【建议买入】估值合理偏低，股债性价比良好，适合定投建仓。"
        suggestion_agg = "【逢低加仓】可分批买入，重点关注高股息龙头。"
        signal = "buy"
    elif score >= Config.WEATHER_CLOUDY:
        weather = "☁️ 多云 (观望)"
        suggestion_con = "【持有观望】估值中性，已有持仓可继续持有，新资金暂缓。"
        suggestion_agg = "【小仓试探】可小仓位参与，等待更好的入场时机。"
        signal = "hold"
    elif score >= Config.WEATHER_RAINY:
        weather = "🌧️ 小雨 (谨慎)"
        suggestion_con = "【暂不建议买入】估值偏高，股债性价比下降，建议等待回调。"
        suggestion_agg = "【减仓观望】已有持仓可逐步止盈，锁定利润。"
        signal = "reduce"
    else:
        weather = "⛈️ 暴雨 (卖出信号)"
        suggestion_con = "【建议卖出】估值过高，股息率已无吸引力，风险大于收益。"
        suggestion_agg = "【清仓离场】建议转入债券或货币基金，等待下一轮机会。"
        signal = "sell"
    return weather, suggestion_con, suggestion_agg, signal

# ==========================================
# 🧮 个股计算函数
# ==========================================

def calculate_ttm_dividend_yield(price, dividend_df):
    """计算TTM股息率"""
    if price is None or dividend_df is None or dividend_df.empty:
        return None
    try:
        implemented = dividend_df[dividend_df['进度'] == '实施'].copy()
        if implemented.empty:
            return None
        implemented['派息日期'] = pd.to_datetime(implemented['除权除息日'], errors='coerce')
        implemented = implemented.dropna(subset=['派息日期'])
        if implemented.empty:
            return None
        
        today = datetime.now()
        one_year_ago = today - timedelta(days=365)
        recent_dividends = implemented[implemented['派息日期'] >= one_year_ago]
        
        if recent_dividends.empty:
            implemented = implemented.sort_values('派息日期', ascending=False)
            latest_date = implemented.iloc[0]['派息日期']
            one_year_before_latest = latest_date - timedelta(days=365)
            recent_dividends = implemented[implemented['派息日期'] >= one_year_before_latest]
        
        total_dividend_per_10 = recent_dividends['派息'].astype(float).sum()
        dividend_per_share = total_dividend_per_10 / 10
        ttm_yield = (dividend_per_share / price) * 100
        return round(ttm_yield, 2)
    except Exception as e:
        print(f"    ⚠️ TTM股息率计算异常: {e}")
        return None

def calculate_dividend_yield_history(dividend_df, price_df):
    """计算历史TTM股息率序列"""
    if dividend_df is None or dividend_df.empty or price_df is None or price_df.empty:
        return []
    try:
        implemented = dividend_df[dividend_df['进度'] == '实施'].copy()
        if implemented.empty:
            return []
        implemented['派息日期'] = pd.to_datetime(implemented['除权除息日'], errors='coerce')
        implemented = implemented.dropna(subset=['派息日期'])
        implemented['每股派息'] = implemented['派息'].astype(float) / 10
        implemented = implemented.sort_values('派息日期')
        if implemented.empty:
            return []
        
        price_df = price_df.copy()
        price_df['日期'] = pd.to_datetime(price_df['日期'])
        price_df = price_df.sort_values('日期')
        
        dividend_dates = implemented['派息日期'].values
        dividend_amounts = implemented['每股派息'].values
        
        result = []
        price_dates = price_df['日期'].values
        price_values = price_df['收盘'].astype(float).values
        
        for current_date, current_price in zip(price_dates, price_values):
            one_year_ago = current_date - np.timedelta64(365, 'D')
            mask = (dividend_dates <= current_date) & (dividend_dates > one_year_ago)
            total_dividend = dividend_amounts[mask].sum()
            if total_dividend > 0:
                ttm_yield = (total_dividend / current_price) * 100
                result.append({
                    'date': pd.Timestamp(current_date).strftime('%Y-%m-%d'),
                    'value': round(ttm_yield, 2)
                })
        return result[-1260:] if len(result) > 1260 else result
    except Exception as e:
        print(f"    ⚠️ 历史股息率计算异常: {e}")
        return []

def calculate_dividend_years(dividend_df):
    """计算连续分红年数"""
    if dividend_df is None or dividend_df.empty:
        return 0
    try:
        implemented = dividend_df[dividend_df['进度'] == '实施']
        if implemented.empty:
            return 0
        years = []
        for _, row in implemented.iterrows():
            try:
                date = pd.to_datetime(row['公告日期'])
                years.append(date.year)
            except:
                continue
        if not years:
            return 0
        years = sorted(set(years), reverse=True)
        consecutive = 1
        for i in range(1, len(years)):
            if years[i-1] - years[i] == 1:
                consecutive += 1
            else:
                break
        return consecutive
    except:
        return 0

def calculate_payout_ratio(dividend_df):
    """计算股息支付率（简化估算）"""
    if dividend_df is None or dividend_df.empty:
        return None
    try:
        recent = dividend_df[dividend_df['进度'] == '实施'].head(1)
        if recent.empty:
            return None
        dividend = float(recent.iloc[0]['派息'])
        if dividend > 15:
            return 50
        elif dividend > 8:
            return 40
        else:
            return 30
    except:
        return None

# ==========================================
# 📊 个股评分函数
# ==========================================

def score_spread(spread):
    if spread is None:
        return {"score": 0, "level": "unknown", "text": "数据缺失"}
    if spread >= SCORE_CRITERIA["spread"]["gold"]:
        return {"score": 100, "level": "gold", "text": f"极佳 ({spread:.1f}%)"}
    elif spread >= SCORE_CRITERIA["spread"]["good"]:
        return {"score": 80, "level": "good", "text": f"良好 ({spread:.1f}%)"}
    elif spread >= SCORE_CRITERIA["spread"]["warn"]:
        return {"score": 50, "level": "warn", "text": f"一般 ({spread:.1f}%)"}
    else:
        return {"score": 20, "level": "bad", "text": f"偏低 ({spread:.1f}%)"}

def score_pb(pb):
    if pb is None:
        return {"score": 0, "level": "unknown", "text": "数据缺失"}
    if pb <= SCORE_CRITERIA["pb"]["gold"]:
        return {"score": 100, "level": "gold", "text": f"极低 ({pb:.2f})"}
    elif pb <= SCORE_CRITERIA["pb"]["good"]:
        return {"score": 80, "level": "good", "text": f"较低 ({pb:.2f})"}
    elif pb <= SCORE_CRITERIA["pb"]["warn"]:
        return {"score": 50, "level": "warn", "text": f"适中 ({pb:.2f})"}
    else:
        return {"score": 20, "level": "bad", "text": f"偏高 ({pb:.2f})"}

def score_payout_ratio(ratio):
    if ratio is None:
        return {"score": 0, "level": "unknown", "text": "数据缺失"}
    criteria = SCORE_CRITERIA["payout_ratio"]
    if ratio >= criteria["danger_high"]:
        return {"score": 20, "level": "bad", "text": f"过高 ({ratio:.0f}%)"}
    elif ratio <= criteria["danger_low"]:
        return {"score": 20, "level": "bad", "text": f"过低 ({ratio:.0f}%)"}
    elif criteria["min"] <= ratio <= criteria["max"]:
        return {"score": 100, "level": "gold", "text": f"健康 ({ratio:.0f}%)"}
    else:
        return {"score": 60, "level": "warn", "text": f"偏离 ({ratio:.0f}%)"}

def score_dividend_years(years):
    if years == 0:
        return {"score": 0, "level": "unknown", "text": "无分红记录"}
    if years >= SCORE_CRITERIA["dividend_years"]["gold"]:
        return {"score": 100, "level": "gold", "text": f"优秀 ({years}年)"}
    elif years >= SCORE_CRITERIA["dividend_years"]["good"]:
        return {"score": 80, "level": "good", "text": f"良好 ({years}年)"}
    elif years >= SCORE_CRITERIA["dividend_years"]["warn"]:
        return {"score": 50, "level": "warn", "text": f"一般 ({years}年)"}
    else:
        return {"score": 20, "level": "bad", "text": f"较短 ({years}年)"}

def score_roe(roe):
    if roe is None:
        return {"score": 0, "level": "unknown", "text": "数据缺失"}
    if roe >= SCORE_CRITERIA["roe"]["gold"]:
        return {"score": 100, "level": "gold", "text": f"优秀 ({roe:.1f}%)"}
    elif roe >= SCORE_CRITERIA["roe"]["good"]:
        return {"score": 80, "level": "good", "text": f"良好 ({roe:.1f}%)"}
    elif roe >= SCORE_CRITERIA["roe"]["warn"]:
        return {"score": 50, "level": "warn", "text": f"一般 ({roe:.1f}%)"}
    else:
        return {"score": 20, "level": "bad", "text": f"较低 ({roe:.1f}%)"}

def score_industry(industry_type):
    if industry_type == "stable":
        return {"score": 100, "level": "gold", "text": "稳定型"}
    elif industry_type == "semi_stable":
        return {"score": 60, "level": "warn", "text": "半周期"}
    else:
        return {"score": 30, "level": "bad", "text": "强周期"}

# ==========================================
# 📊 主程序 - 指数分析
# ==========================================

def analyze_index(df_bond):
    """分析中证红利指数"""
    print("\n" + "=" * 60)
    print("📈 第一部分：中证红利指数分析")
    print("=" * 60)
    
    df_index = safe_fetch(get_dividend_index, "中证红利指数")
    if df_index is None:
        print("❌ 指数数据获取失败")
        return None
    
    df_dividend = safe_fetch(get_dividend_yield_data, "红利指数股息率")
    
    # 计算技术指标
    df_index = calculate_technical_indicators(df_index)
    
    # 合并数据
    df = df_index.copy()
    if df_dividend is not None:
        df = pd.merge(df, df_dividend, on='date', how='left')
    if df_bond is not None:
        df = pd.merge(df, df_bond, on='date', how='left')
    df = df.ffill()
    
    # 计算股债利差
    if 'dividend_yield' in df.columns and 'bond_yield' in df.columns:
        df['spread'] = df['dividend_yield'] - df['bond_yield']
    
    last = df.iloc[-1]
    
    # 计算MA偏离
    ma_deviation = None
    if pd.notna(last.get('MA60')) and last['MA60'] > 0:
        ma_deviation = (last['close'] - last['MA60']) / last['MA60'] * 100
    
    spread = last.get('spread') if pd.notna(last.get('spread')) else None
    rsi = last.get('RSI') if pd.notna(last.get('RSI')) else None
    
    score = calculate_composite_score(spread, ma_deviation, rsi)
    weather, suggestion_con, suggestion_agg, signal = get_weather_and_suggestion(score)
    
    # 状态判断
    spread_status = "⚖️ 中性"
    if spread is not None:
        if spread >= Config.SPREAD_VERY_ATTRACTIVE:
            spread_status = "🟢 极具吸引力"
        elif spread >= Config.SPREAD_ATTRACTIVE:
            spread_status = "🟢 有吸引力"
        elif spread <= Config.SPREAD_UNATTRACTIVE:
            spread_status = "🔴 缺乏吸引力"
    
    trend_status = "⚖️ 震荡"
    if pd.notna(last.get('MA20')) and pd.notna(last.get('MA60')):
        if last['close'] > last['MA20'] > last['MA60']:
            trend_status = "🟢 多头排列"
        elif last['close'] < last['MA20'] < last['MA60']:
            trend_status = "🔴 空头排列"
    
    # 打印结果
    print(f"\n🔮 【综合评分】: {score:.1f} 分  --->  {weather}")
    print(f"💰 【股债利差】: {spread_status} ({spread:.2f}%)" if spread else "💰 【股债利差】: 数据缺失")
    print(f"📈 【趋势状态】: {trend_status}")
    
    # 计算历史评分
    score_history = []
    for i in range(max(0, len(df) - 2520), len(df), 5):
        row = df.iloc[i]
        if pd.isna(row.get('close')):
            continue
        hist_ma_dev = None
        if pd.notna(row.get('MA60')) and row['MA60'] > 0:
            hist_ma_dev = (row['close'] - row['MA60']) / row['MA60'] * 100
        hist_spread = row.get('spread') if pd.notna(row.get('spread')) else None
        hist_rsi = row.get('RSI') if pd.notna(row.get('RSI')) else None
        hist_score = calculate_composite_score(hist_spread, hist_ma_dev, hist_rsi)
        score_history.append({
            'date': row['date'].strftime('%Y-%m-%d'),
            'score': round(hist_score, 1),
            'close': round(row['close'], 2)
        })
    
    # 准备原始数据（精简版，只保留最近500条）
    index_records = df[['date', 'close', 'MA20', 'MA60', 'RSI', 'pct_change']].copy()
    index_records['date'] = index_records['date'].dt.strftime('%Y-%m-%d')
    index_records = index_records.dropna(subset=['close']).tail(500)
    
    bond_records = []
    if df_bond is not None:
        bond_df = df_bond.copy()
        bond_df['date'] = bond_df['date'].dt.strftime('%Y-%m-%d')
        bond_records = bond_df.tail(500).to_dict(orient='records')
    
    return {
        "conclusion": {
            "last_date": last['date'].strftime('%Y-%m-%d'),
            "last_close": float(last['close']),
            "score": float(score),
            "weather": weather,
            "signal": signal,
            "dividend_yield": float(last['dividend_yield']) if pd.notna(last.get('dividend_yield')) else None,
            "bond_yield": float(last['bond_yield']) if pd.notna(last.get('bond_yield')) else None,
            "spread": float(spread) if spread else None,
            "spread_status": spread_status,
            "trend_status": trend_status,
            "ma_deviation": float(ma_deviation) if ma_deviation else None,
            "rsi": float(rsi) if rsi else None,
            "pct_change_5d": float(last['pct_change_5d']) if pd.notna(last.get('pct_change_5d')) else None,
            "pct_change_20d": float(last['pct_change_20d']) if pd.notna(last.get('pct_change_20d')) else None,
            "suggestion_con": suggestion_con,
            "suggestion_agg": suggestion_agg
        },
        "score_history": score_history,
        "raw": {
            "index": index_records.to_dict(orient='records'),
            "bond": bond_records
        }
    }

# ==========================================
# 📊 主程序 - 个股分析
# ==========================================

def fetch_stock_data(stock_info, bond_yield):
    """获取单只股票的完整数据"""
    code = stock_info["code"]
    name = stock_info["name"]
    industry = stock_info["industry"]
    stock_type = stock_info["type"]
    
    print(f"\n  📈 分析: {name} ({code})")
    
    pb_df = safe_fetch(get_stock_pb_history, f"{name}-PB", code=code)
    price_df = safe_fetch(get_stock_price_history, f"{name}-股价历史", code=code)
    dividend_df = safe_fetch(get_stock_dividend_history, f"{name}-分红", code=code)
    price = safe_fetch(get_stock_price, f"{name}-股价", code=code)
    
    pb = float(pb_df.iloc[-1]['value']) if pb_df is not None and not pb_df.empty else None
    
    ttm_dividend_yield = calculate_ttm_dividend_yield(price, dividend_df)
    spread = (ttm_dividend_yield - bond_yield) if ttm_dividend_yield is not None else None
    dividend_years = calculate_dividend_years(dividend_df)
    payout_ratio = calculate_payout_ratio(dividend_df)
    
    print(f"  ⏳ [{name}-TTM股息率历史] 正在计算...", end="", flush=True)
    dividend_yield_history = calculate_dividend_yield_history(dividend_df, price_df)
    print(f"\r  ✅ [{name}-TTM股息率历史] 完成! ({len(dividend_yield_history)} 条)")
    
    roe = ROE_PRESET.get(code)
    
    scores = {
        "valuation": {
            "spread": score_spread(spread),
            "pb": score_pb(pb),
        },
        "dividend_ability": {
            "payout_ratio": score_payout_ratio(payout_ratio),
            "dividend_years": score_dividend_years(dividend_years),
        },
        "asset_quality": {
            "roe": score_roe(roe),
            "industry": score_industry(stock_type),
        }
    }
    
    all_scores = []
    for group in scores.values():
        for item in group.values():
            if item["score"] > 0:
                all_scores.append(item["score"])
    total_score = round(sum(all_scores) / len(all_scores), 1) if all_scores else 0
    
    return {
        "code": code,
        "name": name,
        "industry": industry,
        "type": stock_type,
        "price": price,
        "metrics": {
            "dividend_yield": ttm_dividend_yield,
            "spread": round(spread, 2) if spread else None,
            "pb": pb,
            "payout_ratio": payout_ratio,
            "dividend_years": dividend_years,
            "roe": roe,
        },
        "scores": scores,
        "total_score": total_score,
        "pb_history": [{"date": str(r['date']), "value": float(r['value'])} for r in pb_df[['date', 'value']].tail(1260).to_dict(orient='records')] if pb_df is not None and not pb_df.empty else [],
        "dividend_yield_history": dividend_yield_history,
        "price_history": [{"date": str(r['日期']), "value": float(r['收盘'])} for r in price_df[['日期', '收盘']].tail(1260).to_dict(orient='records')] if price_df is not None and not price_df.empty else [],
    }

def analyze_stocks(bond_yield):
    """分析所有红利个股"""
    print("\n" + "=" * 60)
    print("📈 第二部分：红利个股监控")
    print("=" * 60)
    
    stocks_data = []
    for stock in DIVIDEND_STOCKS:
        try:
            data = fetch_stock_data(stock, bond_yield)
            stocks_data.append(data)
            time.sleep(0.5)
        except Exception as e:
            print(f"  ❌ {stock['name']} 获取失败: {e}")
    
    stocks_data.sort(key=lambda x: x['total_score'], reverse=True)
    
    print("\n📊 红利股评分排行")
    print("-" * 60)
    for i, stock in enumerate(stocks_data, 1):
        m = stock['metrics']
        print(f"{i:2}. {stock['name']:6} | 总分:{stock['total_score']:5.1f} | "
              f"股息率:{m['dividend_yield'] or 'N/A':>5} | PB:{m['pb'] or 'N/A':>5} | "
              f"息差:{m['spread'] or 'N/A':>5}")
    
    return stocks_data

# ==========================================
# 📊 主程序入口
# ==========================================

def run_system():
    """主程序"""
    global _spot_cache
    _spot_cache = None
    
    print("🚀 红利股票工具箱启动...")
    print("=" * 60)
    
    # 预加载实时行情
    print("⏳ [实时行情] 正在预加载...", end="", flush=True)
    try:
        _spot_cache = ak.stock_zh_a_spot_em()
        print(f"\r✅ [实时行情] 预加载完成! ({len(_spot_cache)} 条)")
    except Exception as e:
        print(f"\r⚠️ [实时行情] 预加载失败: {e}")
    
    # 获取国债收益率
    bond_yield = safe_fetch(get_bond_yield_latest, "10年国债收益率")
    if bond_yield is None:
        bond_yield = 1.7
    print(f"📊 当前10年国债收益率: {bond_yield}%")
    
    # 获取国债历史数据
    df_bond = safe_fetch(get_bond_yield_history, "国债收益率历史")
    
    # 1. 指数分析
    index_data = analyze_index(df_bond)
    
    # 2. 个股分析
    stocks_data = analyze_stocks(bond_yield)
    
    # 准备导出数据
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(script_dir, "data")
    if not os.path.exists(data_dir):
        os.makedirs(data_dir)
    
    # 构建合并后的数据
    export_data = {
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "bond_yield": bond_yield,
        # 指数分析数据
        "index": index_data,
        # 个股数据
        "stocks": stocks_data,
    }
    
    # 更新汇总文件（保留历史记录）
    ts_path = os.path.join(data_dir, "dividendData.ts")
    try:
        existing_reports = []
        if os.path.exists(ts_path):
            with open(ts_path, "r", encoding="utf-8") as f:
                content = f.read()
            begin = content.find("[")
            end = content.rfind("]")
            if begin != -1 and end != -1:
                array_str = content[begin:end+1]
                try:
                    existing_reports = json.loads(array_str)
                except json.JSONDecodeError:
                    existing_reports = []
        
        # 按日期去重
        new_last_date = export_data["index"]["conclusion"]["last_date"] if index_data else None
        if new_last_date:
            filtered_reports = [r for r in existing_reports 
                              if r.get("index", {}).get("conclusion", {}).get("last_date") != new_last_date]
        else:
            filtered_reports = existing_reports
        
        # 历史记录移除 raw 和 stocks 详细数据
        for report in filtered_reports:
            if "index" in report and "raw" in report["index"]:
                del report["index"]["raw"]
            if "stocks" in report:
                # 只保留简要信息
                report["stocks"] = [{
                    "code": s["code"],
                    "name": s["name"],
                    "total_score": s["total_score"],
                    "metrics": {
                        "dividend_yield": s["metrics"]["dividend_yield"],
                        "spread": s["metrics"]["spread"],
                        "pb": s["metrics"]["pb"],
                    }
                } for s in report.get("stocks", [])]
        
        filtered_reports.insert(0, export_data)
        filtered_reports.sort(key=lambda x: x.get("generated_at", ""), reverse=True)
        filtered_reports = filtered_reports[:100]
        
        ts_content = "export const dividendData = " + json.dumps(filtered_reports, ensure_ascii=False, indent=2) + ";\nexport default dividendData;\n"
        with open(ts_path, "w", encoding="utf-8") as f:
            f.write(ts_content)
        print(f"\n✅ 数据已保存: {ts_path} (共 {len(filtered_reports)} 条记录)")
    except Exception as e:
        print(f"❌ 数据保存失败: {e}")
    
    print("\n" + "█" * 60)
    print("   🏆 红利股票工具箱运行完成")
    print("█" * 60 + "\n")

if __name__ == "__main__":
    run_system()
