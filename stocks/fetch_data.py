import akshare as ak
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

# Requests 伪装 - 同时 patch Session.request 和全局 request/get/post
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

# Patch requests.get/post 等全局方法 (akshare 部分接口直接调用这些)
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
OUTPUT_FILENAME = "market_data_full.ts"
LIMIT_DAYS = 3000  # 获取最近多少天的数据 (约8年)

# 确保文件生成在脚本所在的同级目录
CURRENT_DIR = sys.path[0]
OUTPUT_PATH = os.path.join(CURRENT_DIR, OUTPUT_FILENAME)

# ================= 🛠️ 工具函数 =================

def safe_fetch(func, name, **kwargs):
    """通用安全抓取函数，带重试和错误捕获"""
    print(f"⏳ [{name}] 正在获取...", end="", flush=True)
    try:
        start = time.time()
        # 执行传入的函数
        df = func(**kwargs)
        
        if df is None or df.empty:
            print(f"\r⚠️ [{name}] 获取结果为空 (可能是接口无数据)")
            return []
            
        elapsed = time.time() - start
        print(f"\r✅ [{name}] 成功! ({len(df)} 条, {elapsed:.2f}s)")
        return df.to_dict(orient='records')
    except Exception as e:
        print(f"\r❌ [{name}] 失败: {str(e)}")
        return []

# ================= 📊 数据获取逻辑 =================

def get_a_share():
    """A股两市成交额 (东方财富源)"""
    # 上证指数
    sh = ak.stock_zh_index_daily_em(symbol="sh000001")
    # 深证成指
    sz = ak.stock_zh_index_daily_em(symbol="sz399001")
    
    # 提取需要的列
    sh = sh[['date', 'amount', 'close']].rename(columns={'amount': 'sh_amt', 'close': 'sh_close'})
    sz = sz[['date', 'amount', 'close']].rename(columns={'amount': 'sz_amt', 'close': 'sz_close'})
    
    # 合并
    df = pd.merge(sh, sz, on='date', how='inner')
    
    # 计算总成交额 (亿元)
    df['total_amount_yi'] = round((df['sh_amt'] + df['sz_amt']) / 100000000, 2)
    df['date'] = pd.to_datetime(df['date']).dt.strftime('%Y-%m-%d')
    df = df.sort_values('date')
    
    if LIMIT_DAYS: df = df.tail(LIMIT_DAYS)
    return df[['date', 'total_amount_yi', 'sh_close', 'sz_close']]

def get_hk_index_data(symbol_em, symbol_sina, name_arg):
    """
    港股指数获取 (优先尝试东财EM源，失败尝试新浪Sina源)
    symbol_em: 东财代码 (如 'HSI')
    symbol_sina: 新浪代码 (如 'HSI')
    """
    # 1. 尝试东财源 (通常包含成交额)
    # 这里的 symbol 实际上 akshare 内部会自动处理前缀，通常传 'HSI' 即可
    # 对应的接口文档: stock_hk_index_daily_em
    try:
        df = ak.stock_hk_index_daily_em(symbol=symbol_em)
        # 东财返回列: date, open, close, high, low, volume, amount
        if 'amount' in df.columns:
             # 港股 amount 单位通常是元，转为亿元
            df['amount_yi'] = round(df['amount'] / 100000000, 2)
        else:
            df['amount_yi'] = 0 # 如果没成交额，设为0
            
        df['date'] = pd.to_datetime(df['date']).dt.strftime('%Y-%m-%d')
        df = df.sort_values('date')
        if LIMIT_DAYS: df = df.tail(LIMIT_DAYS)
        return df[['date', 'amount_yi', 'close']]
        
    except Exception:
        # print(f"\r⚠️ [{name_arg}] 东财源失败，尝试新浪源...", end="")
        pass

    # 2. 回退到新浪源 (stock_hk_index_daily_sina)
    try:
        df = ak.stock_hk_index_daily_sina(symbol=symbol_sina)
        df = df.reset_index()
        if 'date' not in df.columns: df.rename(columns={'index': 'date'}, inplace=True)
        
        # 新浪源经常只有 volume (成交量股数) 没有 amount (成交额资金)
        # 如果有 amount 则使用，没有则置 0
        if 'amount' in df.columns:
            df['amount_yi'] = round(df['amount'] / 100000000, 2)
        else:
            df['amount_yi'] = 0 
            
        df['date'] = pd.to_datetime(df['date']).dt.strftime('%Y-%m-%d')
        df = df.sort_values('date')
        if LIMIT_DAYS: df = df.tail(LIMIT_DAYS)
        return df[['date', 'amount_yi', 'close']]
    except Exception as e:
        raise e # 抛出异常给 safe_fetch 处理

def get_hsgt_funds(symbol):
    """沪深港通资金 (北向/南向)
    
    注意: 2024年8月19日起，北向资金不再披露每日流入流出数据，改为按季度发布
    因此 2024-08-19 之后的北向资金数据将为空
    """
    df = ak.stock_hsgt_hist_em(symbol=symbol)
    
    # 直接使用原始列名，更精确
    # akshare 返回的列: 日期, 当日成交净买额, 买入成交额, 卖出成交额, ...
    if '日期' not in df.columns or '当日成交净买额' not in df.columns:
        return pd.DataFrame()
    
    result = pd.DataFrame()
    result['date'] = pd.to_datetime(df['日期']).dt.strftime('%Y-%m-%d')
    result['net_inflow_yi'] = pd.to_numeric(df['当日成交净买额'], errors='coerce')
    
    # 过滤掉 NaN 数据 (2024-08-19 起北向资金停止每日披露)
    result = result.dropna(subset=['net_inflow_yi'])
    result = result.sort_values('date')
    
    if LIMIT_DAYS: result = result.tail(LIMIT_DAYS)
    return result[['date', 'net_inflow_yi']]

def get_exchange_rate():
    """汇率: 使用东方财富外汇历史数据"""
    try:
        # 使用 forex_hist_em 获取美元兑离岸人民币历史
        df = ak.forex_hist_em(symbol='USDCNH')
        
        if df.empty: 
            raise Exception("forex_hist_em 返回空")
        
        result = pd.DataFrame()
        result['date'] = pd.to_datetime(df['日期']).dt.strftime('%Y-%m-%d')
        result['rate'] = pd.to_numeric(df['最新价'], errors='coerce')
        result = result.dropna()
        result = result.sort_values('date')
        
        if LIMIT_DAYS: result = result.tail(LIMIT_DAYS)
        return result[['date', 'rate']]
        
    except Exception as e:
        print(f"forex_hist_em error: {e}")
        return pd.DataFrame()

def get_nasdaq_etf():
    """美股: 使用 QQQ (纳指100 ETF) 代替指数，接口更稳"""
    # stock_us_hist 接口，symbol="105.QQQ" (东财代码)
    df = ak.stock_us_hist(symbol="105.QQQ", start_date="20150101", end_date="20500101", adjust="qfq")
    
    df = df.rename(columns={'日期': 'date', '收盘': 'close'})
    df['date'] = pd.to_datetime(df['date']).dt.strftime('%Y-%m-%d')
    df = df.sort_values('date')
    
    if LIMIT_DAYS: df = df.tail(LIMIT_DAYS)
    return df[['date', 'close']]

def get_margin_balance():
    """融资融券余额 (上交所历史数据)"""
    df = ak.stock_margin_sse(start_date='20100101', end_date='20501231')
    
    if df.empty:
        return pd.DataFrame()
    
    result = pd.DataFrame()
    # 日期格式: 20251216
    result['date'] = pd.to_datetime(df['信用交易日期'], format='%Y%m%d').dt.strftime('%Y-%m-%d')
    # 融资余额 (转为亿元)
    result['margin_balance_yi'] = round(pd.to_numeric(df['融资余额'], errors='coerce') / 100000000, 2)
    # 融资融券余额 (转为亿元)
    result['total_balance_yi'] = round(pd.to_numeric(df['融资融券余额'], errors='coerce') / 100000000, 2)
    result = result.dropna()
    result = result.sort_values('date')
    
    if LIMIT_DAYS: result = result.tail(LIMIT_DAYS)
    return result

def get_shibor():
    """Shibor利率 (隔夜/1周/1月)"""
    df = ak.macro_china_shibor_all()
    
    if df.empty:
        return pd.DataFrame()
    
    result = pd.DataFrame()
    result['date'] = pd.to_datetime(df['日期']).dt.strftime('%Y-%m-%d')
    result['overnight'] = pd.to_numeric(df['O/N-定价'], errors='coerce')  # 隔夜
    result['week_1'] = pd.to_numeric(df['1W-定价'], errors='coerce')      # 1周
    result['month_1'] = pd.to_numeric(df['1M-定价'], errors='coerce')     # 1月
    result = result.dropna()
    result = result.sort_values('date')
    
    if LIMIT_DAYS: result = result.tail(LIMIT_DAYS)
    return result

def get_bond_yield():
    """中美国债收益率"""
    df = ak.bond_zh_us_rate()
    
    if df.empty:
        return pd.DataFrame()
    
    result = pd.DataFrame()
    result['date'] = pd.to_datetime(df['日期']).dt.strftime('%Y-%m-%d')
    result['cn_10y'] = pd.to_numeric(df['中国国债收益率10年'], errors='coerce')
    result['us_10y'] = pd.to_numeric(df['美国国债收益率10年'], errors='coerce')
    # 中美利差 = 中国10年 - 美国10年
    result['spread'] = round(result['cn_10y'] - result['us_10y'], 4)
    
    # 过滤掉任何包含 NaN 的行 (避免前端显示问题)
    result = result.dropna(subset=['cn_10y', 'us_10y', 'spread'])
    result = result.sort_values('date')
    
    if LIMIT_DAYS: result = result.tail(LIMIT_DAYS)
    return result

def get_market_fund_flow():
    """市场资金流向 (主力/超大单/大单净流入)"""
    df = ak.stock_market_fund_flow()
    
    if df.empty:
        return pd.DataFrame()
    
    result = pd.DataFrame()
    result['date'] = pd.to_datetime(df['日期']).dt.strftime('%Y-%m-%d')
    # 主力净流入 (亿元)
    result['main_net_yi'] = round(pd.to_numeric(df['主力净流入-净额'], errors='coerce') / 100000000, 2)
    # 主力净占比 (%)
    result['main_pct'] = pd.to_numeric(df['主力净流入-净占比'], errors='coerce')
    # 超大单净流入 (亿元)
    result['super_net_yi'] = round(pd.to_numeric(df['超大单净流入-净额'], errors='coerce') / 100000000, 2)
    result = result.dropna()
    result = result.sort_values('date')
    
    if LIMIT_DAYS: result = result.tail(LIMIT_DAYS)
    return result

# ================= 💾 生成逻辑 =================

def load_existing_data():
    """加载现有数据文件"""
    if not os.path.exists(OUTPUT_PATH):
        return None
    try:
        with open(OUTPUT_PATH, 'r', encoding='utf-8') as f:
            content = f.read()
            # 提取 JSON 部分
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
    
    # 用字典去重，新数据覆盖旧数据
    merged = {d[date_key]: d for d in existing_list}
    for d in new_list:
        merged[d[date_key]] = d
    
    # 按日期排序
    result = sorted(merged.values(), key=lambda x: x[date_key])
    
    # 限制总数据量
    if LIMIT_DAYS and len(result) > LIMIT_DAYS:
        result = result[-LIMIT_DAYS:]
    
    return result

def generate_ts_file(data_map):
    print("\n💾 正在生成 TypeScript 文件...")
    
    final_obj = {
        "meta": {
            "updated_at": datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            "desc": "A股/港股/资金/汇率/美股/融资融券/利率/国债 综合数据"
        },
        "data": data_map
    }
    
    json_str = json.dumps(final_obj, ensure_ascii=False, indent=2)
    
    ts_content = f"""/**
 * 股市全维分析数据
 * 自动生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
 * 注意: 港股若无成交额(amount_yi)则为0, 请使用南向资金辅助判断
 */

export const MARKET_FULL = {json_str};
"""
    try:
        with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
            f.write(ts_content)
        print(f"🎉 成功! 文件已生成在: {OUTPUT_PATH}")
    except Exception as e:
        print(f"❌ 文件写入失败: {e}")

def fetch_full_data():
    """全量获取所有数据"""
    print("🚀 开始获取全球市场数据 (全量模式)...")
    print("-" * 40)
    
    # 1. 核心数据 (必须成功)
    a_share = safe_fetch(get_a_share, "A股大盘(沪深)")
    north = safe_fetch(get_hsgt_funds, "北向资金", symbol="北向资金")
    
    # 2. 辅助数据 (允许偶尔失败，失败给空数组)
    hk_main = safe_fetch(get_hk_index_data, "恒生指数", symbol_em="HSI", symbol_sina="HSI", name_arg="恒生指数")
    hk_tech = safe_fetch(get_hk_index_data, "恒生科技", symbol_em="HSTECH", symbol_sina="HSTECH", name_arg="恒生科技")
    south = safe_fetch(get_hsgt_funds, "南向资金", symbol="南向资金")
    rate = safe_fetch(get_exchange_rate, "人民币汇率")
    nasdaq = safe_fetch(get_nasdaq_etf, "纳斯达克(QQQ)")
    
    # 3. 新增辅助指标
    margin = safe_fetch(get_margin_balance, "融资融券(上交所)")
    shibor = safe_fetch(get_shibor, "Shibor利率")
    bond = safe_fetch(get_bond_yield, "中美国债收益率")
    fund_flow = safe_fetch(get_market_fund_flow, "市场资金流向")
    
    print("-" * 40)
    
    # 4. 安全检查：只有核心数据存在才生成文件
    if not a_share or not north:
        print("🛑 严重错误：A股或北向资金数据获取失败，取消生成文件。")
        print("   请检查网络或 akshare 版本 (pip install --upgrade akshare)")
        sys.exit(1)
        
    return {
        "a_share": a_share,
        "hk_main": hk_main,
        "hk_tech": hk_tech,
        "north": north,
        "south": south,
        "rate": rate,
        "nasdaq": nasdaq,
        "margin": margin,
        "shibor": shibor,
        "bond": bond,
        "fund_flow": fund_flow
    }

def fetch_incremental_data(days=30):
    """增量获取最近N天数据，并与现有数据合并"""
    print(f"🚀 开始获取全球市场数据 (增量模式: 最近{days}天)...")
    print("-" * 40)
    
    # 加载现有数据
    existing = load_existing_data()
    if not existing:
        print("⚠️ 未找到现有数据，切换到全量模式...")
        return fetch_full_data()
    
    existing_data = existing.get('data', {})
    last_update = existing.get('meta', {}).get('updated_at', '未知')
    print(f"📂 已加载现有数据 (上次更新: {last_update})")
    
    # 临时修改 LIMIT_DAYS 只获取最近的数据
    global LIMIT_DAYS
    original_limit = LIMIT_DAYS
    LIMIT_DAYS = days
    
    try:
        # 获取新数据
        a_share_new = safe_fetch(get_a_share, "A股大盘(沪深)")
        north_new = safe_fetch(get_hsgt_funds, "北向资金", symbol="北向资金")
        hk_main_new = safe_fetch(get_hk_index_data, "恒生指数", symbol_em="HSI", symbol_sina="HSI", name_arg="恒生指数")
        hk_tech_new = safe_fetch(get_hk_index_data, "恒生科技", symbol_em="HSTECH", symbol_sina="HSTECH", name_arg="恒生科技")
        south_new = safe_fetch(get_hsgt_funds, "南向资金", symbol="南向资金")
        rate_new = safe_fetch(get_exchange_rate, "人民币汇率")
        nasdaq_new = safe_fetch(get_nasdaq_etf, "纳斯达克(QQQ)")
        margin_new = safe_fetch(get_margin_balance, "融资融券(上交所)")
        shibor_new = safe_fetch(get_shibor, "Shibor利率")
        bond_new = safe_fetch(get_bond_yield, "中美国债收益率")
        fund_flow_new = safe_fetch(get_market_fund_flow, "市场资金流向")
    finally:
        LIMIT_DAYS = original_limit
    
    print("-" * 40)
    
    # 核心数据检查
    if not a_share_new:
        print("🛑 严重错误：A股数据获取失败，取消更新。")
        sys.exit(1)
    
    # 合并数据
    print("🔄 正在合并数据...")
    
    return {
        "a_share": merge_data(existing_data.get('a_share', []), a_share_new),
        "hk_main": merge_data(existing_data.get('hk_main', []), hk_main_new),
        "hk_tech": merge_data(existing_data.get('hk_tech', []), hk_tech_new),
        "north": merge_data(existing_data.get('north', []), north_new),
        "south": merge_data(existing_data.get('south', []), south_new),
        "rate": merge_data(existing_data.get('rate', []), rate_new),
        "nasdaq": merge_data(existing_data.get('nasdaq', []), nasdaq_new),
        "margin": merge_data(existing_data.get('margin', []), margin_new),
        "shibor": merge_data(existing_data.get('shibor', []), shibor_new),
        "bond": merge_data(existing_data.get('bond', []), bond_new),
        "fund_flow": merge_data(existing_data.get('fund_flow', []), fund_flow_new),
    }

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='股市数据获取工具')
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