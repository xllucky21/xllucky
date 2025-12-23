import akshare as ak
import yfinance as yf
import pandas as pd
import json
import os
import sys
import time
import argparse
from datetime import datetime, timedelta

import requests
import urllib3
import ssl
import warnings

# ==========================================
# 🛡️ 系统底层配置
# ==========================================
warnings.filterwarnings("ignore")
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# 全局 SSL 禁用
try:
    _create_unverified_https_context = ssl._create_unverified_context
except AttributeError:
    pass
else:
    ssl._create_default_https_context = _create_unverified_https_context

# Requests 伪装
old_session_request = requests.Session.request
def new_session_request(self, method, url, *args, **kwargs):
    kwargs['verify'] = False
    if 'headers' not in kwargs:
        kwargs['headers'] = {}
    kwargs['headers'].update({
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    })
    return old_session_request(self, method, url, *args, **kwargs)
requests.Session.request = new_session_request

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

# ================= ⚙️ 配置区域 =================
OUTPUT_FILENAME = "us_market_data.ts"
LIMIT_DAYS = 2000  # 获取最近多少天的数据 (约8年)

CURRENT_DIR = sys.path[0]
OUTPUT_PATH = os.path.join(CURRENT_DIR, OUTPUT_FILENAME)

# 明星股票代码 (东财格式)
STAR_STOCKS = {
    "AAPL": "105.AAPL",   # 苹果
    "MSFT": "105.MSFT",   # 微软
    "NVDA": "105.NVDA",   # 英伟达
    "GOOGL": "105.GOOGL", # 谷歌
    "AMZN": "105.AMZN",   # 亚马逊
    "META": "105.META",   # Meta
    "TSLA": "105.TSLA",   # 特斯拉
}

# 板块ETF (使用yfinance获取)
SECTOR_ETFS = {
    "XLK": "XLK",   # 科技
    "XLF": "XLF",   # 金融
    "XLE": "XLE",   # 能源
    "XLV": "XLV",   # 医疗健康
    "XLI": "XLI",   # 工业
    "XLY": "XLY",   # 可选消费
}

# ================= 🛠️ 工具函数 =================

def safe_fetch(func, name, **kwargs):
    """通用安全抓取函数"""
    print(f"⏳ [{name}] 正在获取...", end="", flush=True)
    try:
        start = time.time()
        df = func(**kwargs)
        
        if df is None or df.empty:
            print(f"\r⚠️ [{name}] 获取结果为空")
            return []
            
        elapsed = time.time() - start
        print(f"\r✅ [{name}] 成功! ({len(df)} 条, {elapsed:.2f}s)")
        return df.to_dict(orient='records')
    except Exception as e:
        print(f"\r❌ [{name}] 失败: {str(e)}")
        return []

# ================= 📊 数据获取逻辑 =================

def get_us_index(symbol):
    """获取美股指数 (道琼斯/标普500/纳斯达克)"""
    # 使用东财接口获取美股指数
    df = ak.index_us_stock_sina(symbol=symbol)
    
    df = df.reset_index()
    if 'date' not in df.columns:
        df.rename(columns={'index': 'date'}, inplace=True)
    
    result = pd.DataFrame()
    result['date'] = pd.to_datetime(df['date']).dt.strftime('%Y-%m-%d')
    result['close'] = pd.to_numeric(df['close'], errors='coerce')
    result['open'] = pd.to_numeric(df['open'], errors='coerce')
    result['high'] = pd.to_numeric(df['high'], errors='coerce')
    result['low'] = pd.to_numeric(df['low'], errors='coerce')
    
    if 'volume' in df.columns:
        result['volume'] = pd.to_numeric(df['volume'], errors='coerce')
    else:
        result['volume'] = 0
    
    result = result.dropna(subset=['close'])
    result = result.sort_values('date')
    
    if LIMIT_DAYS:
        result = result.tail(LIMIT_DAYS)
    return result

def get_us_stock(symbol_code):
    """获取美股个股数据"""
    df = ak.stock_us_hist(symbol=symbol_code, start_date="20150101", end_date="20501231", adjust="qfq")
    
    if df is None or df.empty:
        return pd.DataFrame()
    
    result = pd.DataFrame()
    result['date'] = pd.to_datetime(df['日期']).dt.strftime('%Y-%m-%d')
    result['close'] = pd.to_numeric(df['收盘'], errors='coerce')
    result['open'] = pd.to_numeric(df['开盘'], errors='coerce')
    result['high'] = pd.to_numeric(df['最高'], errors='coerce')
    result['low'] = pd.to_numeric(df['最低'], errors='coerce')
    result['volume'] = pd.to_numeric(df['成交量'], errors='coerce')
    result['change_pct'] = pd.to_numeric(df['涨跌幅'], errors='coerce')
    
    result = result.dropna(subset=['close'])
    result = result.sort_values('date')
    
    if LIMIT_DAYS:
        result = result.tail(LIMIT_DAYS)
    return result

def get_etf_yf(symbol):
    """使用yfinance获取ETF数据"""
    try:
        ticker = yf.Ticker(symbol)
        df = ticker.history(period="max")
        
        if df.empty:
            return pd.DataFrame()
        
        df = df.reset_index()
        result = pd.DataFrame()
        result['date'] = pd.to_datetime(df['Date']).dt.strftime('%Y-%m-%d')
        result['close'] = pd.to_numeric(df['Close'], errors='coerce')
        result['open'] = pd.to_numeric(df['Open'], errors='coerce')
        result['high'] = pd.to_numeric(df['High'], errors='coerce')
        result['low'] = pd.to_numeric(df['Low'], errors='coerce')
        result['volume'] = pd.to_numeric(df['Volume'], errors='coerce')
        
        result = result.dropna(subset=['close'])
        result = result.sort_values('date')
        
        if LIMIT_DAYS:
            result = result.tail(LIMIT_DAYS)
        return result
    except Exception as e:
        print(f"ETF {symbol} 获取失败: {e}")
        return pd.DataFrame()

def get_vix():
    """获取VIX恐慌指数 (使用yfinance)"""
    try:
        ticker = yf.Ticker("^VIX")
        df = ticker.history(period="max")
        
        if df.empty:
            return pd.DataFrame()
        
        df = df.reset_index()
        result = pd.DataFrame()
        result['date'] = pd.to_datetime(df['Date']).dt.strftime('%Y-%m-%d')
        result['close'] = pd.to_numeric(df['Close'], errors='coerce')
        result['open'] = pd.to_numeric(df['Open'], errors='coerce')
        result['high'] = pd.to_numeric(df['High'], errors='coerce')
        result['low'] = pd.to_numeric(df['Low'], errors='coerce')
        
        result = result.dropna(subset=['close'])
        result = result.sort_values('date')
        
        if LIMIT_DAYS:
            result = result.tail(LIMIT_DAYS)
        return result
    except Exception as e:
        print(f"VIX获取失败: {e}")
        return pd.DataFrame()

def get_us_bond_yield():
    """获取美国国债收益率 (2年/10年)"""
    df = ak.bond_zh_us_rate()
    
    if df.empty:
        return pd.DataFrame()
    
    result = pd.DataFrame()
    result['date'] = pd.to_datetime(df['日期']).dt.strftime('%Y-%m-%d')
    result['us_2y'] = pd.to_numeric(df['美国国债收益率2年'], errors='coerce')
    result['us_10y'] = pd.to_numeric(df['美国国债收益率10年'], errors='coerce')
    # 2-10年利差 (收益率曲线)
    result['spread_2_10'] = round(result['us_10y'] - result['us_2y'], 4)
    
    result = result.dropna(subset=['us_10y'])
    result = result.sort_values('date')
    
    if LIMIT_DAYS:
        result = result.tail(LIMIT_DAYS)
    return result

def get_dollar_index():
    """获取美元指数 DXY (使用yfinance)"""
    try:
        ticker = yf.Ticker("DX-Y.NYB")  # 美元指数期货
        df = ticker.history(period="max")
        
        if df.empty:
            return pd.DataFrame()
        
        df = df.reset_index()
        result = pd.DataFrame()
        result['date'] = pd.to_datetime(df['Date']).dt.strftime('%Y-%m-%d')
        result['close'] = pd.to_numeric(df['Close'], errors='coerce')
        
        result = result.dropna(subset=['close'])
        result = result.sort_values('date')
        
        if LIMIT_DAYS:
            result = result.tail(LIMIT_DAYS)
        return result
    except Exception as e:
        print(f"美元指数获取失败: {e}")
        return pd.DataFrame()

def get_fed_funds_rate():
    """获取联邦基金利率"""
    # 该接口已不可用，返回空数据
    return pd.DataFrame()

# ================= 💾 生成逻辑 =================

def load_existing_data():
    """加载现有数据文件"""
    if not os.path.exists(OUTPUT_PATH):
        return None
    try:
        with open(OUTPUT_PATH, 'r', encoding='utf-8') as f:
            content = f.read()
            start = content.find('{')
            end = content.rfind('}') + 1
            if start == -1 or end == 0:
                return None
            json_str = content[start:end]
            return json.loads(json_str)
    except Exception as e:
        print(f"⚠️ 加载现有数据失败: {e}")
        return None

def merge_data(existing_list, new_list, date_key='date'):
    """合并数据，去重并按日期排序"""
    if not existing_list:
        return new_list
    if not new_list:
        return existing_list
    
    merged = {d[date_key]: d for d in existing_list}
    for d in new_list:
        merged[d[date_key]] = d
    
    result = sorted(merged.values(), key=lambda x: x[date_key])
    
    if LIMIT_DAYS and len(result) > LIMIT_DAYS:
        result = result[-LIMIT_DAYS:]
    
    return result

def generate_ts_file(data_map):
    print("\n💾 正在生成 TypeScript 文件...")
    
    final_obj = {
        "meta": {
            "updated_at": datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            "desc": "美股市场综合数据 - 三大指数/VIX/国债/美元/板块/明星股"
        },
        "data": data_map
    }
    
    json_str = json.dumps(final_obj, ensure_ascii=False, indent=2)
    
    ts_content = f"""/**
 * 美股全维分析数据
 * 自动生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
 */

export const US_MARKET = {json_str};
"""
    try:
        with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
            f.write(ts_content)
        print(f"🎉 成功! 文件已生成在: {OUTPUT_PATH}")
    except Exception as e:
        print(f"❌ 文件写入失败: {e}")

def fetch_full_data():
    """全量获取所有数据"""
    print("🚀 开始获取美股市场数据 (全量模式)...")
    print("-" * 40)
    
    # 1. 三大指数
    dji = safe_fetch(get_us_index, "道琼斯工业", symbol=".DJI")
    spx = safe_fetch(get_us_index, "标普500", symbol=".INX")
    ndx = safe_fetch(get_us_index, "纳斯达克", symbol=".IXIC")
    
    # 2. VIX恐慌指数
    vix = safe_fetch(get_vix, "VIX恐慌指数")
    
    # 3. 美债收益率
    bond = safe_fetch(get_us_bond_yield, "美国国债收益率")
    
    # 4. 美元指数
    dollar = safe_fetch(get_dollar_index, "美元指数")
    
    # 5. 联邦基金利率
    fed_rate = safe_fetch(get_fed_funds_rate, "联邦基金利率")
    
    # 6. 板块ETF (使用yfinance)
    sectors = {}
    for etf_name, symbol in SECTOR_ETFS.items():
        sectors[etf_name.lower()] = safe_fetch(get_etf_yf, f"板块ETF-{etf_name}", symbol=symbol)
        time.sleep(0.3)  # 避免请求过快
    
    # 7. 明星股票
    stars = {}
    for stock_name, code in STAR_STOCKS.items():
        stars[stock_name.lower()] = safe_fetch(get_us_stock, f"明星股-{stock_name}", symbol_code=code)
        time.sleep(0.3)
    
    print("-" * 40)
    
    # 检查核心数据
    if not dji and not spx and not ndx:
        print("🛑 严重错误：三大指数数据全部获取失败，取消生成文件。")
        sys.exit(1)
        
    return {
        "indices": {
            "dji": dji,      # 道琼斯
            "spx": spx,      # 标普500
            "ndx": ndx,      # 纳斯达克
        },
        "vix": vix,
        "bond": bond,
        "dollar": dollar,
        "fed_rate": fed_rate,
        "sectors": sectors,
        "stars": stars,
    }

def fetch_incremental_data(days=30):
    """增量获取最近N天数据"""
    print(f"🚀 开始获取美股市场数据 (增量模式: 最近{days}天)...")
    print("-" * 40)
    
    existing = load_existing_data()
    if not existing:
        print("⚠️ 未找到现有数据，切换到全量模式...")
        return fetch_full_data()
    
    existing_data = existing.get('data', {})
    last_update = existing.get('meta', {}).get('updated_at', '未知')
    print(f"📂 已加载现有数据 (上次更新: {last_update})")
    
    global LIMIT_DAYS
    original_limit = LIMIT_DAYS
    LIMIT_DAYS = days
    
    try:
        # 获取新数据
        dji_new = safe_fetch(get_us_index, "道琼斯工业", symbol=".DJI")
        spx_new = safe_fetch(get_us_index, "标普500", symbol=".INX")
        ndx_new = safe_fetch(get_us_index, "纳斯达克", symbol=".IXIC")
        vix_new = safe_fetch(get_vix, "VIX恐慌指数")
        bond_new = safe_fetch(get_us_bond_yield, "美国国债收益率")
        dollar_new = safe_fetch(get_dollar_index, "美元指数")
        fed_rate_new = safe_fetch(get_fed_funds_rate, "联邦基金利率")
        
        sectors_new = {}
        for etf_name, symbol in SECTOR_ETFS.items():
            sectors_new[etf_name.lower()] = safe_fetch(get_etf_yf, f"板块ETF-{etf_name}", symbol=symbol)
            time.sleep(0.3)
        
        stars_new = {}
        for stock_name, code in STAR_STOCKS.items():
            stars_new[stock_name.lower()] = safe_fetch(get_us_stock, f"明星股-{stock_name}", symbol_code=code)
            time.sleep(0.3)
            
    finally:
        LIMIT_DAYS = original_limit
    
    print("-" * 40)
    print("🔄 正在合并数据...")
    
    # 合并指数数据
    existing_indices = existing_data.get('indices', {})
    merged_indices = {
        "dji": merge_data(existing_indices.get('dji', []), dji_new),
        "spx": merge_data(existing_indices.get('spx', []), spx_new),
        "ndx": merge_data(existing_indices.get('ndx', []), ndx_new),
    }
    
    # 合并板块数据
    existing_sectors = existing_data.get('sectors', {})
    merged_sectors = {}
    for name in SECTOR_ETFS.keys():
        key = name.lower()
        merged_sectors[key] = merge_data(existing_sectors.get(key, []), sectors_new.get(key, []))
    
    # 合并明星股数据
    existing_stars = existing_data.get('stars', {})
    merged_stars = {}
    for name in STAR_STOCKS.keys():
        key = name.lower()
        merged_stars[key] = merge_data(existing_stars.get(key, []), stars_new.get(key, []))
    
    return {
        "indices": merged_indices,
        "vix": merge_data(existing_data.get('vix', []), vix_new),
        "bond": merge_data(existing_data.get('bond', []), bond_new),
        "dollar": merge_data(existing_data.get('dollar', []), dollar_new),
        "fed_rate": merge_data(existing_data.get('fed_rate', []), fed_rate_new),
        "sectors": merged_sectors,
        "stars": merged_stars,
    }

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='美股数据获取工具')
    parser.add_argument('--mode', choices=['full', 'incremental'], default='incremental',
                        help='获取模式: full=全量, incremental=增量 (默认: incremental)')
    parser.add_argument('--days', type=int, default=30,
                        help='增量模式下获取最近多少天的数据 (默认: 30)')
    args = parser.parse_args()
    
    if args.mode == 'full':
        data_map = fetch_full_data()
    else:
        data_map = fetch_incremental_data(days=args.days)
    
    generate_ts_file(data_map)
