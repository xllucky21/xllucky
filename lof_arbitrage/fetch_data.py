#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LOF基金套利监测数据获取脚本
核心改进：使用【盘中实时估值】vs【场内价格】计算真实套利折溢价
而非 T-1 净值 vs 场内价格（会产生假信号）
"""

import json
import os
import sys
import time
from datetime import datetime, date
import warnings
import ssl
import urllib3
import requests
import hashlib

# ==========================================
# 🛡️ 系统底层配置
# ==========================================
warnings.filterwarnings("ignore")
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

try:
    ssl._create_default_https_context = ssl._create_unverified_context
except AttributeError:
    pass

old_session_request = requests.Session.request
def new_session_request(self, method, url, *args, **kwargs):
    kwargs['verify'] = False
    if 'headers' not in kwargs:
        kwargs['headers'] = {}
    kwargs['headers'].update({
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    })
    return old_session_request(self, method, url, *args, **kwargs)
requests.Session.request = new_session_request

old_get = requests.get
old_post = requests.post
def new_get(url, *args, **kwargs):
    kwargs['verify'] = False
    kwargs.setdefault('headers', {})['User-Agent'] = 'Mozilla/5.0'
    return old_get(url, *args, **kwargs)
def new_post(url, *args, **kwargs):
    kwargs['verify'] = False
    kwargs.setdefault('headers', {})['User-Agent'] = 'Mozilla/5.0'
    return old_post(url, *args, **kwargs)
requests.get = new_get
requests.post = new_post

import akshare as ak
import pandas as pd

# 配置
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, "data")
CACHE_DIR = os.path.join(SCRIPT_DIR, ".cache")  # 缓存目录
OUTPUT_FILENAME = "lof_data.ts"
OUTPUT_PATH = os.path.join(DATA_DIR, OUTPUT_FILENAME)

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(CACHE_DIR, exist_ok=True)

# ==========================================
# 🗄️ 缓存配置
# ==========================================
NAV_CACHE_FILE = os.path.join(CACHE_DIR, "nav_cache.json")  # T-1净值缓存
NAV_HISTORY_CACHE_FILE = os.path.join(CACHE_DIR, "nav_history_cache.json")  # 历史净值缓存
PRICE_HISTORY_CACHE_FILE = os.path.join(CACHE_DIR, "price_history_cache.json")  # 历史价格缓存


def get_today_str():
    """获取今天日期字符串"""
    return date.today().strftime('%Y-%m-%d')


def load_cache(cache_file):
    """加载缓存文件"""
    if os.path.exists(cache_file):
        try:
            with open(cache_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            pass
    return {}


def save_cache(cache_file, data):
    """保存缓存文件"""
    with open(cache_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def get_codes_hash(codes):
    """计算基金代码列表的hash，用于判断是否需要更新历史数据"""
    return hashlib.md5(','.join(sorted(codes)).encode()).hexdigest()[:16]

# 热门LOF基金列表
HOT_LOF_LIST = [
    ("501050", "华夏上证50AH", "上证50AH优选"),
    ("160119", "南方中证500ETF联接", "中证500"),
    ("161017", "富国中证500", "中证500"),
    ("160706", "嘉实沪深300", "沪深300"),
    ("160716", "嘉实基本面50", "基本面50"),
    ("163407", "兴全沪深300", "沪深300"),
    ("501057", "华夏创业板动量", "创业板动量"),
    ("161725", "招商中证白酒", "中证白酒"),
    ("161726", "招商中证煤炭", "中证煤炭"),
    ("161028", "富国中证新能源汽车", "新能源车"),
    ("160225", "国泰国证有色金属", "有色金属"),
    ("161024", "富国中证军工", "中证军工"),
    ("160628", "鹏华中证国防", "中证国防"),
    ("160630", "鹏华中证传媒", "中证传媒"),
    ("160633", "鹏华中证环保", "中证环保"),
    ("160635", "鹏华中证银行", "中证银行"),
    ("161720", "招商中证证券", "中证证券"),
    ("161116", "易方达中证银行", "中证银行"),
    ("161121", "易方达中证军工", "中证军工"),
    ("161122", "易方达中证非银金融", "非银金融"),
    ("164906", "交银中证海外互联网", "中概互联"),
    ("501021", "华宝香港中小", "港股中小"),
    ("160717", "嘉实恒生中国企业", "恒生国企"),
    ("164824", "印度基金", "印度市场"),
    ("164701", "汇添富恒生指数", "恒生指数"),
    ("501018", "南方原油", "原油"),
    ("506000", "科创板基金", "科创板"),
    ("506002", "易方达科创板", "科创板"),
    ("162411", "华宝油气LOF", "油气"),
]

# ==========================================
# 🔑 基金分类及溢价阈值配置
# ==========================================
# 不同类型LOF的正常折溢价范围完全不同：
# - A股宽基：流动性好，套利活跃，1%就是异常
# - 行业/主题：波动大，1.5%才算异常
# - QDII/港股：有汇率、时差因素，2-3%是日常
# - 商品/原油：波动极大，5%才算异常

# 基金类型关键词识别
FUND_TYPE_KEYWORDS = {
    # A股宽基LOF - 阈值最低，1%就很异常
    'a_stock_broad': {
        'keywords': ['沪深300', '中证500', '中证1000', '上证50', '创业板', '科创板', 
                     '基本面50', '红利', '价值', '成长', '中小盘', '大盘'],
        'threshold': 1.0,
        'type_name': 'A股宽基',
    },
    # A股行业/主题LOF - 波动较大，1.5%
    'a_stock_sector': {
        'keywords': ['白酒', '医药', '消费', '科技', '新能源', '军工', '国防', '银行', 
                     '证券', '非银', '金融', '地产', '煤炭', '钢铁', '有色', '化工',
                     '环保', '传媒', '互联网', '芯片', '半导体', '光伏', '电池'],
        'threshold': 1.5,
        'type_name': 'A股行业',
    },
    # 港股/QDII LOF - 有时差和汇率因素，3%
    'hk_qdii': {
        'keywords': ['恒生', '港股', '香港', '中概', '海外', 'H股', '国企指数'],
        'threshold': 3.0,
        'type_name': 'QDII港股',
    },
    # 美股/全球 QDII - 时差更大，4%
    'us_global': {
        'keywords': ['纳斯达克', '标普', '美国', '全球', '印度', '德国', '日本', '越南'],
        'threshold': 4.0,
        'type_name': 'QDII全球',
    },
    # 商品/原油 - 波动极大，5%
    'commodity': {
        'keywords': ['原油', '油气', '黄金', '白银', '商品', '能源'],
        'threshold': 5.0,
        'type_name': '商品原油',
    },
}

# 默认阈值（未识别类型）
DEFAULT_THRESHOLD = 2.0


# 最低成交额阈值（万元）- 低于此值套利无意义
MIN_AMOUNT_THRESHOLD = 500  # 500万


# ==========================================
# 🕐 交易时段配置（用于IOPV可信度判断）
# ==========================================
# A股交易时间: 09:30-11:30, 13:00-15:00
# 港股交易时间: 09:30-12:00, 13:00-16:00
# 美股交易时间: 21:30-04:00 (北京时间，夏令时)
#              22:30-05:00 (北京时间，冬令时)

def get_current_hour():
    """获取当前小时（北京时间）"""
    return datetime.now().hour


def is_hk_market_open():
    """港股是否在交易时段"""
    hour = get_current_hour()
    # 港股 09:30-12:00, 13:00-16:00
    return (9 <= hour < 12) or (13 <= hour < 16)


def is_us_market_open():
    """美股是否在交易时段（粗略判断）"""
    hour = get_current_hour()
    # 美股夏令时 21:30-04:00，冬令时 22:30-05:00
    # 简化判断：21:00-05:00 认为可能开盘
    return hour >= 21 or hour < 5


# ==========================================
# 📊 资金效率配置
# ==========================================
# 不同类型LOF的结算周期
SETTLEMENT_DAYS = {
    'A股宽基': 2,      # T+2
    'A股行业': 2,      # T+2
    'QDII港股': 3,     # T+3 (部分T+2)
    'QDII全球': 4,     # T+4 (美股等)
    '商品原油': 3,     # T+3
    '其他': 2,
}


def classify_fund(name):
    """
    根据基金名称识别基金类型，返回(类型名称, 溢价阈值, 结算天数)
    优先级：商品 > QDII全球 > QDII港股 > A股行业 > A股宽基
    """
    name_lower = name.lower()
    
    # 按优先级检查（特殊类型优先）
    priority_order = ['commodity', 'us_global', 'hk_qdii', 'a_stock_sector', 'a_stock_broad']
    
    for fund_type in priority_order:
        config = FUND_TYPE_KEYWORDS[fund_type]
        for keyword in config['keywords']:
            if keyword in name or keyword.lower() in name_lower:
                type_name = config['type_name']
                return type_name, config['threshold'], SETTLEMENT_DAYS.get(type_name, 2)
    
    return '其他', DEFAULT_THRESHOLD, 2


def calculate_iopv_reliability(fund_type, est_change_pct):
    """
    计算IOPV可信度（简化版，减少过度警告）
    
    核心原则：
    - A股类型：IOPV基本可靠，不需要过度警告
    - QDII类型：仅在极端情况下给出警告
    
    返回: (reliability: 'high'|'medium'|'low', reason: str)
    """
    est_change = abs(est_change_pct) if est_change_pct else 0
    
    # A股类型：IOPV可信度高（无论盘中还是收盘后）
    if fund_type in ['A股宽基', 'A股行业']:
        return 'high', 'A股IOPV跟踪准确'
    
    # 港股QDII - 仅在极端波动时警告
    if fund_type == 'QDII港股':
        if est_change > 5:
            return 'medium', f'港股估值波动较大({est_change:.1f}%)'
        return 'high', '港股IOPV'
    
    # 美股/全球QDII - 仅在极端波动时警告
    if fund_type == 'QDII全球':
        if est_change > 5:
            return 'medium', f'全球市场估值波动({est_change:.1f}%)'
        return 'high', '全球IOPV'
    
    # 商品原油 - 波动大时警告
    if fund_type == '商品原油':
        if est_change > 5:
            return 'medium', f'商品类波动({est_change:.1f}%)'
        return 'high', '商品IOPV'
    
    return 'high', 'IOPV'


def determine_arb_path(discount, threshold, can_subscribe, fund_type, iopv_reliability):
    """
    判断套利路径（简化版）
    
    核心区分：
    1. in_to_out: 场内卖出 + 场外申购 → 可套利
    2. price_reversion: 单纯赌价格回归 → 无法申购
    3. none: 未达阈值
    
    返回: (arb_path, arb_path_desc)
    """
    if discount < threshold:
        return 'none', '未达套利阈值'
    
    if can_subscribe:
        return 'in_to_out', '场内→场外套利（经典LOF套利）'
    else:
        return 'price_reversion', '价格回归博弈（无法申购，非无风险套利）'


def calculate_capital_efficiency(discount, settlement_days, fund_type):
    """
    计算资金效率评分
    
    套利不是看百分比，而是看：年化收益 × 周转率 × 资金占用
    
    公式：年化收益率 = 溢价率 / 结算天数 × 365
    评分：0-100，考虑收益率和周转效率
    """
    if discount <= 0 or settlement_days <= 0:
        return 0, 0
    
    # 年化收益率（简化计算，不考虑复利）
    annualized_return = (discount / settlement_days) * 365
    
    # 评分逻辑：
    # - 年化 > 100%: 满分100
    # - 年化 50-100%: 80-100
    # - 年化 20-50%: 60-80
    # - 年化 10-20%: 40-60
    # - 年化 < 10%: 0-40
    
    if annualized_return >= 100:
        score = 100
    elif annualized_return >= 50:
        score = 80 + (annualized_return - 50) / 50 * 20
    elif annualized_return >= 20:
        score = 60 + (annualized_return - 20) / 30 * 20
    elif annualized_return >= 10:
        score = 40 + (annualized_return - 10) / 10 * 20
    else:
        score = annualized_return / 10 * 40
    
    return round(annualized_return, 1), round(score, 0)


def generate_risk_notes(fund_type, iopv_reliability, est_change_pct, discount, settlement_days):
    """
    生成风险提示（精简版，只提示关键风险）
    """
    notes = []
    
    # 只在结算周期长时提示
    if settlement_days >= 4:
        notes.append(f'⏰ T+{settlement_days}结算，资金占用较长')
    
    # 只在波动特别大时提示
    if est_change_pct and abs(est_change_pct) > 3:
        direction = '上涨' if est_change_pct > 0 else '下跌'
        notes.append(f'📈 今日估值{direction}{abs(est_change_pct):.1f}%')
    
    return notes


def get_realtime_estimation():
    """
    获取基金实时估值数据
    这是盘中根据持仓和指数涨跌估算的净值，而非T-1公布净值
    """
    print("📊 获取基金实时估值（盘中IOPV估算）...")
    
    try:
        df = ak.fund_value_estimation_em(symbol="全部")
        
        if df is None or df.empty:
            print("❌ 获取实时估值失败")
            return None
        
        # 动态获取列名（包含日期）
        est_col = [c for c in df.columns if '估算值' in c][0]
        est_rate_col = [c for c in df.columns if '估算增长率' in c][0]
        prev_nav_cols = [c for c in df.columns if '单位净值' in c and '公布' not in c]
        prev_nav_col = prev_nav_cols[-1] if prev_nav_cols else None
        
        result = pd.DataFrame({
            'code': df['基金代码'].astype(str),
            'name': df['基金名称'],
            'est_nav': pd.to_numeric(df[est_col], errors='coerce'),  # 实时估算净值
            'est_change_pct': df[est_rate_col].str.replace('%', '').astype(float, errors='ignore'),
            'prev_nav': pd.to_numeric(df[prev_nav_col], errors='coerce') if prev_nav_col else None,
        })
        
        print(f"✅ 获取到 {len(result)} 只基金实时估值")
        return result
        
    except Exception as e:
        print(f"❌ 获取实时估值失败: {e}")
        return None


def get_lof_spot():
    """获取LOF基金实时行情（场内价格）"""
    print("📊 获取LOF基金场内实时行情...")
    
    try:
        df = ak.fund_lof_spot_em()
        
        if df is None or df.empty:
            print("❌ 获取LOF实时行情失败")
            return None
        
        result = pd.DataFrame({
            'code': df['代码'].astype(str),
            'name': df['名称'],
            'price': pd.to_numeric(df['最新价'], errors='coerce'),
            'change_pct': pd.to_numeric(df['涨跌幅'], errors='coerce'),
            'volume': pd.to_numeric(df['成交量'], errors='coerce'),
            'amount': pd.to_numeric(df['成交额'], errors='coerce'),
            'turnover_rate': pd.to_numeric(df['换手率'], errors='coerce'),
            'prev_close': pd.to_numeric(df['昨收'], errors='coerce'),
        })
        
        print(f"✅ 获取到 {len(result)} 只LOF基金行情")
        return result
        
    except Exception as e:
        print(f"❌ 获取LOF实时行情失败: {e}")
        return None


def get_fund_subscribe_status():
    """
    获取基金申购状态
    这是套利的生死线！80%的LOF溢价 = 申购暂停，永远无法套利
    """
    print("📊 获取基金申购状态...")
    
    try:
        df = ak.fund_purchase_em()
        
        if df is None or df.empty:
            print("❌ 获取申购状态失败")
            return {}
        
        # 构建申购状态字典
        # 申购状态: 开放申购、暂停申购、限大额、封闭期、认购期、场内交易
        status_dict = {}
        for _, row in df.iterrows():
            code = str(row['基金代码'])
            subscribe_status = row['申购状态']
            redeem_status = row['赎回状态']
            daily_limit = row['日累计限定金额']  # 限额（万元）
            
            # 判断是否可申购
            # 开放申购 / 限大额 = 可以申购（限大额对散户影响不大）
            # 暂停申购 / 封闭期 / 认购期 = 不可申购
            can_subscribe = subscribe_status in ['开放申购', '限大额']
            
            # 处理限额：akshare返回的单位是【元】
            # 超过10亿视为无限额（akshare返回1e11表示无限额）
            limit_value = float(daily_limit) if pd.notna(daily_limit) else None
            if limit_value and limit_value >= 1e9:  # 超过10亿视为无限额
                limit_value = None
            
            status_dict[code] = {
                'subscribe_status': subscribe_status,
                'redeem_status': redeem_status,
                'can_subscribe': can_subscribe,
                'daily_limit': limit_value,  # 单位：元
            }
        
        open_count = sum(1 for v in status_dict.values() if v['can_subscribe'])
        print(f"✅ 获取到 {len(status_dict)} 只基金申购状态，其中 {open_count} 只可申购")
        return status_dict
        
    except Exception as e:
        print(f"❌ 获取申购状态失败: {e}")
        return {}


def calculate_realtime_arbitrage(spot_df, est_df, subscribe_status):
    """
    计算真实套利折溢价率
    核心公式：(场内价格 - 实时估值) / 实时估值 × 100%
    
    重要改进：
    1. 不同类型基金使用不同阈值
    2. 判断申购状态（套利生死线！）
    3. IOPV可信度评分（QDII在非交易时段IOPV失真）
    4. 区分套利路径（场内→场外 vs 价格回归博弈）
    5. 资金效率评分（年化收益考虑结算周期）
    6. 风险提示（申购确认价≠IOPV）
    """
    print("\n📈 计算实时套利折溢价率...")
    
    # 合并数据
    merged = spot_df.merge(
        est_df[['code', 'est_nav', 'est_change_pct', 'prev_nav']], 
        on='code', 
        how='left'
    )
    
    # 对于没有实时估值的LOF，尝试从缓存获取T-1净值
    missing_nav_codes = merged[merged['est_nav'].isna() & merged['price'].notna()]['code'].tolist()
    if missing_nav_codes:
        print(f"  📌 {len(missing_nav_codes)} 只LOF没有实时估值，尝试获取T-1净值...")
        
        # 加载T-1净值缓存
        nav_cache = load_cache(NAV_CACHE_FILE)
        today = get_today_str()
        
        # 检查缓存是否是今天的
        cache_date = nav_cache.get('_date', '')
        if cache_date != today:
            nav_cache = {'_date': today}  # 重置缓存
        
        codes_to_fetch = []
        for code in missing_nav_codes[:30]:
            if code in nav_cache:
                # 使用缓存
                latest_nav = nav_cache[code]
                merged.loc[merged['code'] == code, 'est_nav'] = latest_nav
                merged.loc[merged['code'] == code, 'prev_nav'] = latest_nav
                print(f"    ✓ {code} T-1净值(缓存): {latest_nav}")
            else:
                codes_to_fetch.append(code)
        
        # 只请求未缓存的
        if codes_to_fetch:
            print(f"    📡 需要请求 {len(codes_to_fetch)} 只基金的T-1净值...")
            for code in codes_to_fetch:
                try:
                    nav_df = ak.fund_open_fund_info_em(symbol=code, indicator="单位净值走势")
                    if nav_df is not None and not nav_df.empty:
                        latest_nav = float(nav_df.iloc[-1]['单位净值'])
                        merged.loc[merged['code'] == code, 'est_nav'] = latest_nav
                        merged.loc[merged['code'] == code, 'prev_nav'] = latest_nav
                        nav_cache[code] = latest_nav  # 写入缓存
                        print(f"    ✓ {code} T-1净值(API): {latest_nav}")
                except Exception as e:
                    pass
                time.sleep(0.1)
            
            # 保存缓存
            save_cache(NAV_CACHE_FILE, nav_cache)
    
    # 计算实时折溢价率（核心！）
    merged['realtime_discount'] = (merged['price'] - merged['est_nav']) / merged['est_nav'] * 100
    
    # 同时保留T-1净值折溢价（用于对比展示）
    merged['t1_discount'] = (merged['price'] - merged['prev_nav']) / merged['prev_nav'] * 100
    
    # 筛选有效数据
    valid = merged[
        merged['price'].notna() & 
        merged['est_nav'].notna() & 
        (merged['est_nav'] > 0) &
        (merged['price'] > 0)
    ].copy()
    
    # 判断套利信号（基于实时折溢价，使用分类阈值）
    def get_signal(row):
        discount = row['realtime_discount']
        name = row['name']
        code = row['code']
        est_change_pct = row['est_change_pct'] if pd.notna(row['est_change_pct']) else 0
        amount = row['amount'] / 10000 if pd.notna(row['amount']) else 0  # 转为万元
        
        if pd.isna(discount):
            return (None, 0, '其他', DEFAULT_THRESHOLD, False, '', '', True,
                    'medium', '', 'none', '', 2, 0, 0, [], None)
        
        # 获取基金类型、阈值和结算天数
        fund_type, threshold, settlement_days = classify_fund(name)
        
        # 获取申购状态
        status_info = subscribe_status.get(code, {})
        can_subscribe = status_info.get('can_subscribe', True)  # 默认可申购（未查到状态）
        subscribe_status_text = status_info.get('subscribe_status', '未知')
        redeem_status_text = status_info.get('redeem_status', '未知')
        daily_limit = status_info.get('daily_limit', None)  # 限额（万元）
        
        # 流动性判断：成交额 < 500万 = 流动性不足
        low_liquidity = amount < MIN_AMOUNT_THRESHOLD
        
        # 🆕 IOPV可信度评分
        iopv_reliability, iopv_reason = calculate_iopv_reliability(fund_type, est_change_pct)
        
        # 🆕 套利路径判断
        arb_path, arb_path_desc = determine_arb_path(discount, threshold, can_subscribe, fund_type, iopv_reliability)
        
        # 🆕 资金效率评分
        annualized_return, capital_efficiency = calculate_capital_efficiency(discount, settlement_days, fund_type)
        
        # 🆕 风险提示
        risk_notes = generate_risk_notes(fund_type, iopv_reliability, est_change_pct, discount, settlement_days)
        
        # 溢价超过该类型阈值才算套利机会
        if discount >= threshold:
            # 信号强度：超过阈值的倍数
            excess = discount - threshold
            strength = min((excess / threshold) * 100, 100)
            return ("溢价套利", round(strength, 1), fund_type, threshold, can_subscribe, 
                    subscribe_status_text, redeem_status_text, low_liquidity,
                    iopv_reliability, iopv_reason, arb_path, arb_path_desc,
                    settlement_days, annualized_return, capital_efficiency, risk_notes, daily_limit)
        
        return (None, 0, fund_type, threshold, can_subscribe, 
                subscribe_status_text, redeem_status_text, low_liquidity,
                iopv_reliability, iopv_reason, arb_path, arb_path_desc,
                settlement_days, annualized_return, capital_efficiency, risk_notes, daily_limit)
    
    signals = valid.apply(get_signal, axis=1, result_type='expand')
    valid['signal_type'] = signals[0]
    valid['signal_strength'] = signals[1]
    valid['fund_type'] = signals[2]
    valid['threshold'] = signals[3]
    valid['can_subscribe'] = signals[4]
    valid['subscribe_status'] = signals[5]
    valid['redeem_status'] = signals[6]
    valid['low_liquidity'] = signals[7]
    valid['iopv_reliability'] = signals[8]
    valid['iopv_reason'] = signals[9]
    valid['arb_path'] = signals[10]
    valid['arb_path_desc'] = signals[11]
    valid['settlement_days'] = signals[12]
    valid['annualized_return'] = signals[13]
    valid['capital_efficiency'] = signals[14]
    valid['risk_notes'] = signals[15]
    valid['daily_limit'] = signals[16]
    
    # 构建结果
    results = []
    for _, row in valid.iterrows():
        results.append({
            'code': row['code'],
            'name': row['name'],
            'price': round(row['price'], 4),
            'est_nav': round(row['est_nav'], 4),
            'prev_nav': round(row['prev_nav'], 4) if pd.notna(row['prev_nav']) else None,
            'realtime_discount': round(row['realtime_discount'], 2),
            't1_discount': round(row['t1_discount'], 2) if pd.notna(row['t1_discount']) else None,
            'est_change_pct': round(row['est_change_pct'], 2) if pd.notna(row['est_change_pct']) else None,
            'change_pct': round(row['change_pct'], 2) if pd.notna(row['change_pct']) else None,
            'volume': int(row['volume']) if pd.notna(row['volume']) else 0,
            'amount': round(row['amount'] / 10000, 2) if pd.notna(row['amount']) else 0,
            'turnover_rate': round(row['turnover_rate'], 2) if pd.notna(row['turnover_rate']) else None,
            'signal_type': row['signal_type'],
            'signal_strength': row['signal_strength'],
            'fund_type': row['fund_type'],
            'threshold': row['threshold'],
            'can_subscribe': row['can_subscribe'],
            'subscribe_status': row['subscribe_status'],
            'redeem_status': row['redeem_status'],
            'low_liquidity': row['low_liquidity'],
            'daily_limit': float(row['daily_limit']) if pd.notna(row['daily_limit']) else None,  # 限额（元）
            # 其他字段
            'iopv_reliability': row['iopv_reliability'],
            'iopv_reason': row['iopv_reason'],
            'arb_path': row['arb_path'],
            'arb_path_desc': row['arb_path_desc'],
            'settlement_days': row['settlement_days'],
            'annualized_return': row['annualized_return'],
            'capital_efficiency': row['capital_efficiency'],
            'risk_notes': row['risk_notes'],
        })
    
    print(f"✅ 计算完成，有效数据 {len(results)} 只")
    return results


def get_fund_nav_history(fund_code, days=60, cache=None):
    """获取基金历史净值（带缓存）"""
    # 如果有缓存且数据足够新，直接返回
    if cache and fund_code in cache:
        cached_data = cache[fund_code]
        if cached_data:
            return cached_data
    
    try:
        df = ak.fund_open_fund_info_em(symbol=fund_code, indicator="单位净值走势")
        if df is not None and not df.empty:
            df = df.tail(days)
            result = [
                {'date': str(row['净值日期'])[:10], 'nav': float(row['单位净值'])}
                for _, row in df.iterrows()
            ]
            return result
    except:
        pass
    return []


def get_fund_price_history(fund_code, days=60, cache=None):
    """获取LOF基金历史价格（带缓存）"""
    # 如果有缓存且数据足够新，直接返回
    if cache and fund_code in cache:
        cached_data = cache[fund_code]
        if cached_data:
            return cached_data
    
    try:
        df = ak.fund_lof_hist_em(symbol=fund_code, period="daily", adjust="")
        if df is not None and not df.empty:
            df = df.tail(days)
            result = [
                {
                    'date': str(row['日期'])[:10],
                    'close': float(row['收盘']),
                    'volume': int(row['成交量']),
                }
                for _, row in df.iterrows()
            ]
            return result
    except:
        pass
    return []


def get_hot_lof_details(all_funds):
    """获取热门LOF基金详情（带智能缓存）"""
    print("\n📈 获取热门LOF基金历史数据...")
    
    hot_codes = {code for code, _, _ in HOT_LOF_LIST}
    hot_map = {code: (name, track) for code, name, track in HOT_LOF_LIST}
    
    # 加载历史缓存
    nav_history_cache = load_cache(NAV_HISTORY_CACHE_FILE)
    price_history_cache = load_cache(PRICE_HISTORY_CACHE_FILE)
    
    today = get_today_str()
    
    # 检查缓存是否需要更新
    # 条件1: 日期变化（每天更新一次）
    # 条件2: 基金列表变化（code变化时更新）
    current_codes_hash = get_codes_hash(list(hot_codes))
    cache_date = nav_history_cache.get('_date', '')
    cache_hash = nav_history_cache.get('_codes_hash', '')
    
    need_full_refresh = (cache_date != today) or (cache_hash != current_codes_hash)
    
    if need_full_refresh:
        print(f"  📡 缓存需要更新 (日期:{cache_date != today}, 代码变化:{cache_hash != current_codes_hash})")
        nav_history_cache = {'_date': today, '_codes_hash': current_codes_hash}
        price_history_cache = {'_date': today, '_codes_hash': current_codes_hash}
    else:
        print(f"  ✅ 使用今日缓存数据")
    
    hot_details = []
    api_calls = 0
    cache_hits = 0
    
    for fund in all_funds:
        code = fund['code']
        if code not in hot_codes:
            continue
        
        name, track_index = hot_map.get(code, (fund['name'], ''))
        
        # 获取历史数据（优先使用缓存）
        if code in nav_history_cache and not need_full_refresh:
            nav_history = nav_history_cache[code]
            cache_hits += 1
        else:
            print(f"  📡 获取 {code} {name} 历史净值...")
            nav_history = get_fund_nav_history(code, days=60)
            nav_history_cache[code] = nav_history
            api_calls += 1
            time.sleep(0.15)
        
        if code in price_history_cache and not need_full_refresh:
            price_history = price_history_cache[code]
            cache_hits += 1
        else:
            print(f"  📡 获取 {code} {name} 历史价格...")
            price_history = get_fund_price_history(code, days=60)
            price_history_cache[code] = price_history
            api_calls += 1
            time.sleep(0.15)
        
        # 计算历史折溢价率
        discount_history = []
        if price_history and nav_history:
            nav_dict = {item['date']: item['nav'] for item in nav_history}
            for price_item in price_history:
                date_str = price_item['date']
                if date_str in nav_dict and nav_dict[date_str] > 0:
                    discount = (price_item['close'] - nav_dict[date_str]) / nav_dict[date_str] * 100
                    discount_history.append({
                        'date': date_str,
                        'price': price_item['close'],
                        'nav': nav_dict[date_str],
                        'discount_rate': round(discount, 2)
                    })
        
        hot_details.append({
            **fund,
            'track_index': track_index,
            'price_history': price_history[-30:],
            'discount_history': discount_history[-30:],
        })
    
    # 保存缓存
    if api_calls > 0:
        save_cache(NAV_HISTORY_CACHE_FILE, nav_history_cache)
        save_cache(PRICE_HISTORY_CACHE_FILE, price_history_cache)
        print(f"  💾 缓存已更新")
    
    print(f"✅ 获取到 {len(hot_details)} 只热门LOF详情 (API调用:{api_calls}, 缓存命中:{cache_hits})")
    return hot_details


def get_arbitrage_opportunities(signals, top_n=20):
    """获取溢价套利机会"""
    premium_opps = [s for s in signals if s['signal_type'] == "溢价套利"]
    premium_opps.sort(key=lambda x: x['realtime_discount'], reverse=True)
    
    return {
        'premium': premium_opps[:top_n],
    }


def get_market_overview(signals):
    """获取市场概览"""
    if not signals:
        return {
            'total_count': 0,
            'avg_discount_rate': 0,
            'max_discount': 0,
            'max_premium': 0,
            'distribution': {
                'deep_discount': 0, 'slight_discount': 0, 'fair_value': 0,
                'slight_premium': 0, 'deep_premium': 0,
            }
        }
    
    rates = [s['realtime_discount'] for s in signals if s['realtime_discount'] is not None]
    
    if not rates:
        return {
            'total_count': len(signals),
            'avg_discount_rate': 0,
            'max_discount': 0,
            'max_premium': 0,
            'distribution': {
                'deep_discount': 0, 'slight_discount': 0, 'fair_value': 0,
                'slight_premium': 0, 'deep_premium': 0,
            }
        }
    
    return {
        'total_count': len(signals),
        'avg_discount_rate': round(sum(rates) / len(rates), 2),
        'max_discount': round(min(rates), 2),
        'max_premium': round(max(rates), 2),
        'distribution': {
            'deep_discount': len([r for r in rates if r <= -3]),
            'slight_discount': len([r for r in rates if -3 < r <= -1]),
            'fair_value': len([r for r in rates if -1 < r < 1]),
            'slight_premium': len([r for r in rates if 1 <= r < 3]),
            'deep_premium': len([r for r in rates if r >= 3]),
        }
    }


def generate_ts_file(data):
    """生成TypeScript数据文件"""
    ts_content = f"""// LOF基金套利监测数据
// 自动生成于 {data['meta']['updated_at']}
// 核心改进：使用【盘中实时估值】计算折溢价，而非T-1净值

export const LOF_DATA = {json.dumps(data, ensure_ascii=False, indent=2)};

export default LOF_DATA;
"""
    
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        f.write(ts_content)
    
    print(f"\n✅ 数据已保存到: {OUTPUT_PATH}")


def main():
    print("=" * 60)
    print("🚀 LOF基金套利监测数据获取")
    print("📌 核心改进：使用盘中实时估值计算真实套利折溢价")
    print("📌 新增：申购状态判断（套利生死线！）")
    print("=" * 60)
    
    # 1. 获取实时估值（盘中IOPV）
    est_df = get_realtime_estimation()
    if est_df is None:
        print("❌ 获取实时估值失败，退出")
        sys.exit(1)
    
    # 2. 获取LOF场内行情
    spot_df = get_lof_spot()
    if spot_df is None:
        print("❌ 获取LOF行情失败，退出")
        sys.exit(1)
    
    # 3. 获取申购状态（关键！）
    subscribe_status = get_fund_subscribe_status()
    
    # 4. 计算实时套利折溢价（传入申购状态）
    all_funds = calculate_realtime_arbitrage(spot_df, est_df, subscribe_status)
    
    # 5. 获取套利机会
    opportunities = get_arbitrage_opportunities(all_funds)
    
    # 6. 获取市场概览
    overview = get_market_overview(all_funds)
    
    # 7. 获取热门LOF详情
    hot_funds = get_hot_lof_details(all_funds)
    
    # 组装数据
    data = {
        'meta': {
            'updated_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'desc': 'LOF基金套利监测数据（基于盘中实时估值）',
            'note': '折溢价率基于【实时估值】计算 | 申购状态是套利生死线！',
        },
        'overview': overview,
        'opportunities': opportunities,
        'all_funds': all_funds,
        'hot_funds': hot_funds,
    }
    
    generate_ts_file(data)
    
    # 统计可套利数量
    premium_opps = opportunities['premium']
    can_arb_count = sum(1 for f in premium_opps if f.get('can_subscribe', False))
    
    print("\n" + "=" * 60)
    print("📊 数据概览（基于实时估值）:")
    print(f"  - 总基金数: {overview['total_count']}")
    print(f"  - 平均折溢价率: {overview['avg_discount_rate']}%")
    print(f"  - 最大折价: {overview['max_discount']}%")
    print(f"  - 最大溢价: {overview['max_premium']}%")
    print(f"  - 溢价套利机会: {len(premium_opps)} 只")
    print(f"  - ⚠️ 其中可申购（真正可套利）: {can_arb_count} 只")
    print("=" * 60)


if __name__ == "__main__":
    main()
