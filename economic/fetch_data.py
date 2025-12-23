import akshare as ak
import pandas as pd
import json
import re
import os
import sys

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
old_request = requests.Session.request
def new_request(self, method, url, *args, **kwargs):
    kwargs['verify'] = False
    if 'headers' not in kwargs:
        kwargs['headers'] = {}
    kwargs['headers'].update({
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    })
    return old_request(self, method, url, *args, **kwargs)
requests.Session.request = new_request

# ==========================================
# ⚙️ 1. 核心指标配置 & 标签字典
# ==========================================
# 既作为熔断检查名单，也作为前端显示的 Label 字典
INDICATOR_MAP = {
    # --- 价格 ---
    'cpi': '居民消费价格指数(CPI)',
    'ppi': '工业品出厂价格指数(PPI)',
    
    # --- 货币 ---
    'm2': 'M2货币供应同比',
    'm1': 'M1货币供应同比',
    'scissors': 'M1-M2剪刀差',
    'social_financing': '社会融资规模增量',
    'lpr_1y': 'LPR利率(1年期)',
    'lpr_5y': 'LPR利率(5年期)',
    
    # --- 增长 ---
    'gdp': 'GDP同比增速',
    'pmi': '制造业PMI',
    'exports_yoy': '出口金额同比',
    
    # --- 消费 ---
    'retail_sales': '社消零售总额同比',
    
    # --- 市场 ---
    'sh_index': '上证指数点位',
    'sh_index_pe': '上证指数市盈率(PE)',
    'sh_index_pb': '上证指数市净率(PB)',
    'us_bond_10y': '10年期美债收益率',
    'cn_bond_10y': '10年期中债收益率',
    'bond_spread': '中美利差(中-美)',
    'usd_cny': '美元兑人民币汇率',
    'fx_reserves': '外汇储备(亿美元)',
    'gold': '上海金(Au99.99)',
    
    # --- 结构 ---
    'resident_leverage': '居民部门杠杆率',
    'real_estate_invest': '国房景气指数',
    'unemployment': '城镇调查失业率'
}

# 核心校验名单
CRITICAL_KEYS = [k for k in INDICATOR_MAP.keys()]

# ==========================================
# 2. 核心工具函数
# ==========================================
def clean_value(val):
    if pd.isna(val) or val == "": return None
    str_val = str(val).replace("%", "").replace(",", "").replace("亿", "").strip()
    try: return float(str_val)
    except: return None

def find_column(columns, keywords):
    for col in columns:
        col_lower = str(col).lower().strip()
        if all(k.lower() in col_lower for k in keywords): return col
    return None

def find_possible_columns(columns, keyword_groups):
    for group in keyword_groups:
        col = find_column(columns, group)
        if col: return col
    return None

def smart_date_parser(date_val):
    val_str = str(date_val).strip()
    if re.match(r'^\d{4}-\d{2}$', val_str): return pd.to_datetime(val_str).strftime('%Y-%m-%d')
    if re.match(r'^\d{4}-\d{2}-\d{2}$', val_str): return val_str
    if val_str.isdigit() and len(val_str) == 6: return pd.to_datetime(val_str, format='%Y%m').strftime('%Y-%m-%d')
    if re.match(r'^\d{4}\.\d{1,2}$', val_str):
        parts = val_str.split('.')
        if len(parts[1]) == 1: val_str = f"{parts[0]}.0{parts[1]}"
        return pd.to_datetime(val_str, format='%Y.%m').strftime('%Y-%m-%d')
    if '季度' in val_str or 'Q' in val_str:
        year_match = re.search(r'(\d{4})', val_str)
        year = year_match.group(1) if year_match else None
        md_map = {'一': '03-31', '1': '03-31', 'Q1': '03-31', '二': '06-30', '2': '06-30', 'Q2': '06-30', '三': '09-30', '3': '09-30', 'Q3': '09-30', '四': '12-31', '4': '12-31', 'Q4': '12-31'}
        if year:
            for k, v in md_map.items():
                if k in val_str: return f"{year}-{v}"
    clean_str = val_str.replace('年', '-').replace('月份', '').replace('月', '').replace('/', '-')
    try: return pd.to_datetime(clean_str).strftime('%Y-%m-%d')
    except: return None

# ==========================================
# 3. 数据获取主逻辑
# ==========================================
def fetch_macro_data_v23():
    print("🚀 启动全量获取脚本 (v23.0 瘦身优化版)...")
    print(f"📦 数据结构已优化: 移除冗余 label 字段")
    print("-" * 60)
    export_data = {}

    # 1. 价格
    print("\n>>> [1. 价格组]")
    try:
        df = ak.macro_china_cpi_monthly()
        col_d = find_possible_columns(df.columns, [['日期'], ['月份']])
        col_v = find_possible_columns(df.columns, [['今值'], ['CPI', '同比']])
        if col_d and col_v:
            df['date'] = df[col_d].apply(smart_date_parser)
            df['value'] = df[col_v].apply(clean_value)
            # 瘦身关键: 只取 date 和 value，不加 label
            res = df.dropna(subset=['value','date']).sort_values('date')[['date','value']].to_dict('records')
            export_data['cpi'] = res
            print(f"✅ CPI: {len(res)} 条")
        else: raise Exception("CPI列名错")
    except Exception as e:
        print(f"❌ CPI失败: {e}")
        export_data['cpi'] = []

    try:
        df = ak.macro_china_ppi_yearly()
        col_d = find_possible_columns(df.columns, [['日期'], ['月份']])
        col_v = find_possible_columns(df.columns, [['今值'], ['PPI', '同比']])
        if col_d and col_v:
            df['date'] = df[col_d].apply(smart_date_parser)
            df['value'] = df[col_v].apply(clean_value)
            res = df.dropna(subset=['value','date']).sort_values('date')[['date','value']].to_dict('records')
            export_data['ppi'] = res
            print(f"✅ PPI: {len(res)} 条")
        else: raise Exception("PPI列名错")
    except Exception as e:
        print(f"❌ PPI失败: {e}")
        export_data['ppi'] = []

    # 2. 货币
    print("\n>>> [2. 货币与利率组]")
    try:
        df = ak.macro_china_money_supply()
        col_d = find_possible_columns(df.columns, [['月份'], ['日期']])
        col_m2 = find_column(df.columns, ['M2','同比'])
        col_m1 = find_column(df.columns, ['M1','同比'])
        if col_d and col_m2 and col_m1:
            df['date'] = df[col_d].apply(smart_date_parser)
            df['m2'] = df[col_m2].apply(clean_value)
            df['m1'] = df[col_m1].apply(clean_value)
            df['sci'] = df['m1'] - df['m2']
            df = df.dropna(subset=['m2','m1','date']).sort_values('date')
            export_data['m2'] = df[['date','m2']].rename(columns={'m2':'value'}).to_dict('records')
            export_data['m1'] = df[['date','m1']].rename(columns={'m1':'value'}).to_dict('records')
            export_data['scissors'] = df[['date','sci']].rename(columns={'sci':'value'}).to_dict('records')
            print(f"✅ M1/M2: {len(df)} 条")
        else: raise Exception("Money列名错")
    except Exception as e:
        print(f"❌ M1/M2失败: {e}")
        export_data['m2'], export_data['m1'], export_data['scissors'] = [], [], []

    try:
        df = ak.macro_china_shrzgm()
        col_d = find_possible_columns(df.columns, [['月份'], ['日期']])
        col_v = find_column(df.columns, ['增量'])
        if col_d and col_v:
            df['date'] = df[col_d].apply(smart_date_parser)
            df['value'] = df[col_v].apply(clean_value)
            res = df.dropna(subset=['value','date']).sort_values('date')[['date','value']].to_dict('records')
            export_data['social_financing'] = res
            print(f"✅ 社融增量: {len(res)} 条")
        else: raise Exception("社融列名错")
    except Exception as e:
        print(f"❌ 社融失败: {e}")
        export_data['social_financing'] = []

    try:
        df = ak.macro_china_lpr()
        col_d = find_column(df.columns, ['日期']) or find_column(df.columns, ['TRADE_DATE'])
        col_1y = find_possible_columns(df.columns, [['1年'], ['LPR1Y']])
        col_5y = find_possible_columns(df.columns, [['5年'], ['LPR5Y']])
        if col_d and col_1y and col_5y:
            df['date'] = df[col_d].apply(smart_date_parser)
            df['val_1y'] = df[col_1y].apply(clean_value)
            df['val_5y'] = df[col_5y].apply(clean_value)
            df = df.dropna(subset=['val_1y', 'val_5y', 'date']).sort_values('date')
            export_data['lpr_1y'] = df[['date', 'val_1y']].rename(columns={'val_1y':'value'}).to_dict('records')
            export_data['lpr_5y'] = df[['date', 'val_5y']].rename(columns={'val_5y':'value'}).to_dict('records')
            print(f"✅ LPR利率: {len(df)} 条")
        else: raise Exception("LPR列名错")
    except Exception as e:
        print(f"❌ LPR利率失败: {e}")
        export_data['lpr_1y'], export_data['lpr_5y'] = [], []

    # 3. 增长
    print("\n>>> [3. 增长组]")
    try:
        df = ak.macro_china_gdp_yearly()
        col_d = find_possible_columns(df.columns, [['日期'], ['季度']])
        col_v = find_possible_columns(df.columns, [['今值'], ['国内生产总值','同比']])
        if col_d and col_v:
            df['date'] = df[col_d].apply(smart_date_parser)
            df['value'] = df[col_v].apply(clean_value)
            res = df.dropna(subset=['value','date']).sort_values('date')[['date','value']].to_dict('records')
            export_data['gdp'] = res
            print(f"✅ GDP: {len(res)} 条")
        else: raise Exception("GDP列名错")
    except Exception as e:
        print(f"❌ GDP失败: {e}")
        export_data['gdp'] = []

    try:
        df = ak.macro_china_pmi_yearly()
        col_d = find_column(df.columns, ['日期'])
        col_v = find_column(df.columns, ['今值'])
        if col_d and col_v:
            df['date'] = df[col_d].apply(smart_date_parser)
            df['value'] = df[col_v].apply(clean_value)
            res = df.dropna(subset=['value','date']).sort_values('date')[['date','value']].to_dict('records')
            export_data['pmi'] = res
            print(f"✅ PMI: {len(res)} 条")
        else: raise Exception("PMI列名错")
    except Exception as e:
        print(f"❌ PMI失败: {e}")
        export_data['pmi'] = []

    try:
        df = ak.macro_china_exports_yoy()
        col_d = find_column(df.columns, ['日期'])
        col_v = find_column(df.columns, ['今值'])
        if col_d and col_v:
            df['date'] = df[col_d].apply(smart_date_parser)
            df['value'] = df[col_v].apply(clean_value)
            res = df.dropna(subset=['value','date']).sort_values('date')[['date','value']].to_dict('records')
            export_data['exports_yoy'] = res
            print(f"✅ 出口: {len(res)} 条")
        else: raise Exception("出口列名错")
    except Exception as e:
        print(f"❌ 出口失败: {e}")
        export_data['exports_yoy'] = []

    # 4. 消费
    print("\n>>> [4. 消费组]")
    try:
        df = ak.macro_china_consumer_goods_retail()
        col_d = find_possible_columns(df.columns, [['月份'], ['日期']])
        col_v = find_column(df.columns, ['同比增长']) 
        if not col_v: col_v = find_column(df.columns, ['当月', '同比'])
        if col_d and col_v:
            df['date'] = df[col_d].apply(smart_date_parser)
            df['value'] = df[col_v].apply(clean_value)
            res = df.dropna(subset=['value','date']).sort_values('date')[['date','value']].to_dict('records')
            export_data['retail_sales'] = res
            print(f"✅ 社消: {len(res)} 条")
        else: raise Exception("社消列名错")
    except Exception as e:
        print(f"❌ 社消失败: {e}")
        export_data['retail_sales'] = []
    
    # 5. 市场
    print("\n>>> [5. 市场与估值组]")
    try:
        df_idx = ak.stock_zh_index_daily(symbol="sh000001")
        if 'date' in df_idx.columns:
            df_idx['date'] = pd.to_datetime(df_idx['date'])
            try: df_m_idx = df_idx.resample('ME', on='date').last().reset_index()
            except: df_m_idx = df_idx.set_index('date').resample('M').last().reset_index()
            df_m_idx['date'] = df_m_idx['date'].dt.strftime('%Y-%m-%d')
            # 移除 label
            export_data['sh_index'] = df_m_idx[['date','close']].rename(columns={'close':'value'}).to_dict('records')
            print(f"✅ 上证点位: {len(df_m_idx)} 条")
        else: export_data['sh_index'] = []
    except Exception as e:
        print(f"❌ 上证点位失败: {e}")
        export_data['sh_index'] = []

    # 乐咕 PE/PB
    try:
        df_pe = ak.stock_market_pe_lg(symbol="上证")
        if '日期' in df_pe.columns and '平均市盈率' in df_pe.columns:
            df_pe['date'] = pd.to_datetime(df_pe['日期'])
            df_pe['value'] = df_pe['平均市盈率'].apply(clean_value)
            try: df_m = df_pe.resample('ME', on='date').last().reset_index()
            except: df_m = df_pe.set_index('date').resample('M').last().reset_index()
            df_m['date'] = df_m['date'].dt.strftime('%Y-%m-%d')
            export_data['sh_index_pe'] = df_m[['date','value']].to_dict('records')
            print(f"✅ 上证PE (Legu): {len(df_m)} 条")
        else: raise Exception("PE列名错")
    except: export_data['sh_index_pe'] = []

    try:
        df_pb = ak.stock_market_pb_lg(symbol="上证")
        if '日期' in df_pb.columns and '市净率' in df_pb.columns:
            df_pb['date'] = pd.to_datetime(df_pb['日期'])
            df_pb['value'] = df_pb['市净率'].apply(clean_value)
            try: df_m = df_pb.resample('ME', on='date').last().reset_index()
            except: df_m = df_pb.set_index('date').resample('M').last().reset_index()
            df_m['date'] = df_m['date'].dt.strftime('%Y-%m-%d')
            export_data['sh_index_pb'] = df_m[['date','value']].to_dict('records')
            print(f"✅ 上证PB (Legu): {len(df_m)} 条")
        else: raise Exception("PB列名错")
    except: export_data['sh_index_pb'] = []

    # 债市
    try:
        df = ak.bond_zh_us_rate()
        col_d = find_column(df.columns, ['日期'])
        col_us = find_column(df.columns, ['美国', '10年'])
        col_cn = find_column(df.columns, ['中国', '10年'])
        if col_d and col_us and col_cn:
            df['date'] = pd.to_datetime(df[col_d])
            df['us'] = df[col_us].apply(clean_value)
            df['cn'] = df[col_cn].apply(clean_value)
            df['spread'] = df['cn'] - df['us']
            df = df.dropna(subset=['us','cn','date']).sort_values('date')
            try: df_m = df.resample('ME', on='date').last().reset_index()
            except: df_m = df.set_index('date').resample('M').last().reset_index()
            df_m['date'] = df_m['date'].dt.strftime('%Y-%m-%d')
            export_data['us_bond_10y'] = df_m[['date','us']].rename(columns={'us':'value'}).to_dict('records')
            export_data['cn_bond_10y'] = df_m[['date','cn']].rename(columns={'cn':'value'}).to_dict('records')
            export_data['bond_spread'] = df_m[['date','spread']].rename(columns={'spread':'value'}).to_dict('records')
            print(f"✅ 债市: {len(df_m)} 条")
        else: raise Exception("债市列名错")
    except Exception as e:
        print(f"❌ 债市失败: {e}")
        export_data['us_bond_10y'], export_data['cn_bond_10y'], export_data['bond_spread'] = [], [], []

    # 汇率
    try:
        df = ak.currency_boc_safe()
        col_d = find_possible_columns(df.columns, [['日期'], ['发布日期']])
        col_usd = find_column(df.columns, ['美元'])
        if col_d and col_usd:
            df['date'] = pd.to_datetime(df[col_d])
            df['value'] = df[col_usd].apply(clean_value)
            df = df.dropna(subset=['value']).sort_values('date')
            try: df_m = df.resample('ME', on='date').last().reset_index()
            except: df_m = df.set_index('date').resample('M').last().reset_index()
            df_m['date'] = df_m['date'].dt.strftime('%Y-%m-%d')
            export_data['usd_cny'] = df_m[['date','value']].to_dict('records')
            print(f"✅ 汇率: {len(df_m)} 条")
        else: raise Exception("汇率列名错")
    except: export_data['usd_cny'] = []

    # 外储
    try:
        df = ak.macro_china_fx_gold()
        col_d = find_column(df.columns, ['月份'])
        col_v = find_possible_columns(df.columns, [['国家外汇储备', '数值'], ['外汇储备', '数值']])
        if col_d and col_v:
            df['date'] = df[col_d].apply(smart_date_parser)
            df['value'] = df[col_v].apply(clean_value)
            res = df.dropna(subset=['value','date']).sort_values('date')[['date','value']].to_dict('records')
            export_data['fx_reserves'] = res
            print(f"✅ 外储: {len(res)} 条")
        else: raise Exception("外储列名错")
    except: export_data['fx_reserves'] = []

    # 黄金
    try:
        df = ak.spot_hist_sge(symbol="Au99.99")
        if 'date' in df.columns:
            df['date'] = pd.to_datetime(df['date'])
            try: df_m = df.resample('ME', on='date').last().reset_index()
            except: df_m = df.set_index('date').resample('M').last().reset_index()
            df_m['date'] = df_m['date'].dt.strftime('%Y-%m-%d')
            df_m['value'] = df_m['close']
            res = df_m[['date','value']].to_dict('records')
            export_data['gold'] = res
            print(f"✅ 黄金: {len(res)} 条")
        else: raise Exception("黄金列名错")
    except: export_data['gold'] = []

    # 6. 结构
    print("\n>>> [6. 结构组]")
    try:
        df = ak.macro_cnbs()
        if '年份' in df.columns and '居民部门' in df.columns:
            df['date'] = df['年份'].apply(smart_date_parser)
            df['value'] = df['居民部门'].apply(clean_value)
            res = df.dropna(subset=['value','date']).sort_values('date')[['date','value']].to_dict('records')
            export_data['resident_leverage'] = res
            print(f"✅ 居民杠杆: {len(res)} 条")
        else: raise Exception("居民杠杆列名错")
    except: export_data['resident_leverage'] = []

    try:
        df = ak.macro_china_real_estate()
        col_d = find_column(df.columns, ['日期'])
        col_v = find_column(df.columns, ['最新值']) or find_column(df.columns, ['指数'])
        if col_d and col_v:
            df['date'] = df[col_d].apply(smart_date_parser)
            df['value'] = df[col_v].apply(clean_value)
            res = df.dropna(subset=['value','date']).sort_values('date')[['date','value']].to_dict('records')
            export_data['real_estate_invest'] = res
            print(f"✅ 国房景气: {len(res)} 条")
        else: raise Exception("国房景气列名错")
    except: export_data['real_estate_invest'] = []

    try:
        df = ak.macro_china_urban_unemployment()
        df.columns = df.columns.str.strip()
        col_d = find_possible_columns(df.columns, [['date'], ['日期']])
        col_v = find_possible_columns(df.columns, [['value'], ['失业率']])
        if col_d and col_v:
            df['date'] = df[col_d].apply(smart_date_parser)
            df['value'] = df[col_v].apply(clean_value)
            if 'item' in df.columns:
                df = df[df['item'].str.contains('全国', na=False)]
            res = df.dropna(subset=['value','date']).sort_values('date')[['date','value']].to_dict('records')
            export_data['unemployment'] = res
            print(f"✅ 失业率: {len(res)} 条")
        else: raise Exception("失业率列名错")
    except: export_data['unemployment'] = []

    # Meta
    export_data["meta"] = {
        "source": "AkShare v23",
        "updated_at": pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S')
    }
    return export_data

# ==========================================
# 3. 校验与生成
# ==========================================
def validate_and_generate(data, filename="macro_data.ts"):
    print("\n" + "="*60)
    print("🚦 熔断校验...")
    missing_data = []
    
    for key in CRITICAL_KEYS:
        if key not in data or not data[key]:
            missing_data.append(key)
    
    if len(missing_data) > 0:
        print("⛔️ 熔断触发！缺失指标：")
        for k in missing_data: print(f"   ❌ {k}")
        sys.exit(1)
    
    print("✅ 校验通过！正在生成瘦身版文件...")
    script_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(script_dir, filename)
    
    # 构造最终输出对象： labels + data
    final_output = {
        "labels": INDICATOR_MAP,
        "data": data,
        "meta": data.pop("meta") # 移动 meta
    }
    
    json_str = json.dumps(final_output, indent=2, ensure_ascii=False)
    
    # TS 结构定义也随之更新
    ts_content = f"""// Auto-generated (v23.0 Optimized)
// Updated at: {final_output['meta']['updated_at']}

export interface MacroDataPoint {{
  date: string;
  value: number;
}}

export interface MacroDataResponse {{
  labels: {{ [key: string]: string }};
  data: {{
    // 价格
    cpi: MacroDataPoint[];
    ppi: MacroDataPoint[];
    // 货币
    m1: MacroDataPoint[];
    m2: MacroDataPoint[];
    scissors: MacroDataPoint[];
    social_financing: MacroDataPoint[];
    lpr_1y: MacroDataPoint[];
    lpr_5y: MacroDataPoint[];
    // 增长
    gdp: MacroDataPoint[];
    pmi: MacroDataPoint[];
    exports_yoy: MacroDataPoint[];
    // 消费
    retail_sales: MacroDataPoint[];
    // 市场
    sh_index: MacroDataPoint[];
    sh_index_pe: MacroDataPoint[];
    sh_index_pb: MacroDataPoint[];
    us_bond_10y: MacroDataPoint[];
    cn_bond_10y: MacroDataPoint[];
    bond_spread: MacroDataPoint[];
    usd_cny: MacroDataPoint[];
    fx_reserves: MacroDataPoint[];
    gold: MacroDataPoint[];
    // 结构
    resident_leverage: MacroDataPoint[];
    real_estate_invest: MacroDataPoint[];
    unemployment: MacroDataPoint[];
  }};
  meta: {{
    source: string;
    updated_at: string;
  }};
}}

export const MACRO_DATA: MacroDataResponse = {json_str};
"""
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(ts_content)
    print(f"✨ 成功! 文件已生成: {file_path}")

if __name__ == "__main__":
    sys.setrecursionlimit(5000)
    data = fetch_macro_data_v23()
    validate_and_generate(data)