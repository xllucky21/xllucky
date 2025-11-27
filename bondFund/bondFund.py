import akshare as ak
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
from scipy import stats
import datetime
import numpy as np
import requests
import urllib3
import warnings
import ssl
import os
import json

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

# 绘图字体
plt.rcParams['font.sans-serif'] = ['Arial Unicode MS', 'SimHei', 'DejaVu Sans'] 
plt.rcParams['axes.unicode_minus'] = False

# ==========================================
# 🧠 核心计算引擎
# ==========================================

def calculate_technical_indicators(df):
    df['MA60'] = df['yield'].rolling(window=60).mean()
    exp1 = df['yield'].ewm(span=12, adjust=False).mean()
    exp2 = df['yield'].ewm(span=26, adjust=False).mean()
    df['MACD'] = exp1 - exp2
    df['Signal_Line'] = df['MACD'].ewm(span=9, adjust=False).mean()
    df['MACD_Hist'] = df['MACD'] - df['Signal_Line']
    
    delta = df['yield'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    rs = gain / loss
    df['RSI'] = 100 - (100 / (1 + rs))
    
    df['BB_Mid'] = df['yield'].rolling(window=20).mean()
    df['BB_Std'] = df['yield'].rolling(window=20).std()
    df['BB_Up'] = df['BB_Mid'] + 2 * df['BB_Std']
    df['BB_Low'] = df['BB_Mid'] - 2 * df['BB_Std']
    return df

def calculate_composite_score(row, percentile, liquidity_msg, macro_msg):
    score = 50 
    score += (percentile - 50) * 0.4
    if row['yield'] < row['MA60']: score += 15
    else: score -= 15
    if row['MACD'] < row['Signal_Line']: score += 10
    else: score -= 10
    if row['RSI'] < 30: score -= 10
    if row['RSI'] > 70: score += 10
    if "资金紧张" in liquidity_msg: score -= 10
    if "资金流出" in macro_msg: score -= 15 
    return max(0, min(100, score))

# ==========================================
# 📥 数据获取
# ==========================================

def get_final_data():
    print("🚀 正在启动 V7.5 自动研报版...")
    start_date = (datetime.datetime.now() - datetime.timedelta(days=5*365)).strftime("%Y%m%d")
    
    # 1. 国债
    print("📡 1/3 获取国债数据...")
    try:
        df_bond = ak.bond_zh_us_rate(start_date=start_date)
        df_bond = df_bond[['日期', '中国国债收益率10年']].dropna()
        df_bond.columns = ['date', 'yield']
        df_bond['date'] = pd.to_datetime(df_bond['date'])
        df_bond['yield'] = pd.to_numeric(df_bond['yield'])
        df_bond.sort_values(by='date', inplace=True)
        print(f"   ✅ 国债数据获取成功")
    except Exception as e:
        print(f"❌ 错误: 国债数据失败 {e}")
        return None

    # 2. 股市
    print("📡 2/3 获取股市估值...")
    try:
        df_stock = ak.stock_zh_index_value_csindex(symbol="000300")
        pe_col = '市盈率1' if '市盈率1' in df_stock.columns else '市盈率2'
        df_stock = df_stock[['日期', pe_col]].dropna()
        df_stock.columns = ['date', 'pe']
        df_stock['date'] = pd.to_datetime(df_stock['date'])
        df_stock['pe'] = pd.to_numeric(df_stock['pe'])
        print(f"   ✅ 股市数据获取成功")
    except Exception as e:
        print(f"⚠️ 警告: 股市数据获取失败，忽略股债联动。")
        df_stock = pd.DataFrame(columns=['date', 'pe'])

    # 3. 流动性
    print("📡 3/3 获取流动性数据...")
    try:
        df_shibor = ak.macro_china_shibor_all()
        target_col = None
        possible_names = ['隔夜', 'ON', 'O/N', '1D', 'Day']
        for name in possible_names:
            if name in df_shibor.columns:
                target_col = name
                break
        if target_col is None and len(df_shibor.columns) >= 2:
            target_col = df_shibor.columns[1]
        
        if target_col is not None:
            df_shibor = df_shibor[['日期', target_col]].dropna()
            df_shibor.columns = ['date', 'shibor']
            df_shibor['date'] = pd.to_datetime(df_shibor['date'])
            df_shibor['shibor'] = pd.to_numeric(df_shibor['shibor'])
            print(f"   ✅ 流动性数据获取成功")
        else:
            raise ValueError("未找到利率列")

    except Exception as e:
        print(f"⚠️ 警告: 流动性数据获取失败 ({e})")
        df_shibor = pd.DataFrame(columns=['date', 'shibor'])

    df = pd.merge(df_bond, df_stock, on='date', how='left')
    df = pd.merge(df, df_shibor, on='date', how='left')
    df.fillna(method='ffill', inplace=True)
    
    return df, df_bond, df_stock, df_shibor

# ==========================================
# 📄 Markdown 生成器
# ==========================================
def save_markdown_report(filename, chart_filename, data_dict):
    md_content = f"""# 🏆 债基智能投顾分析报告

> **生成时间**: {data_dict['gen_time']}

---

## 🔮 综合评分: {data_dict['score']:.1f} 分

### 🌤️ 当前天气: **{data_dict['weather']}**

---

## 📊 核心指标拆解

| 维度 | 指标值 | 状态 | 解释 |
| :--- | :--- | :--- | :--- |
| **国债收益率** | **{data_dict['yield']:.4f}%** | - | 债市锚点 |
| **估值水位** | **{data_dict['percentile']:.1f}%** | {data_dict['val_status']} | 历史分位数 (越高越便宜) |
| **长期趋势** | {data_dict['trend_val']} | {data_dict['trend_status']} | 60日均线判定 |
| **短期动量** | {data_dict['macd_val']} | {data_dict['macd_status']} | MACD 动能 |
| **宏观对冲** | {data_dict['pe_val']} | {data_dict['macro_msg']} | 股债性价比 (ERP) |
| **流动性** | {data_dict['shibor_val']} | {data_dict['liquidity_msg']} | 资金面松紧 (Shibor) |

---

## 💡 投资操作建议

### 🐢 稳健型 (理财替代)
> **{data_dict['suggestion_con']}**

### 🐇 激进型 (波段交易)
> **{data_dict['suggestion_agg']}**

---

## 📈 市场全景图

![Market Chart]({chart_filename})

---

*免责声明：本报告由量化程序自动生成，仅供参考，不构成投资建议。*
"""
    try:
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(md_content)
        print(f"\n✅ 报告已生成: {filename}")
    except Exception as e:
        print(f"\n❌ 报告生成失败: {e}")

# ==========================================
# 📊 主程序逻辑
# ==========================================

def run_system():
    result = get_final_data()
    if result is None: return
    df, df_bond, df_stock, df_shibor = result

    df = calculate_technical_indicators(df)
    last = df.iloc[-1]
    
    recent_df = df[df['date'] > (df.iloc[-1]['date'] - datetime.timedelta(days=5*365))]
    percentile = stats.percentileofscore(recent_df['yield'], last['yield'])
    
    # 状态判定
    val_status = "🔴 极贵" if percentile < 20 else ("🟢 便宜" if percentile > 80 else "⚖️ 适中")
    
    macro_msg = "⚪️ 缺失"
    pe_val_str = "N/A"
    pe_val = last.get('pe')
    if pd.notna(pe_val) and pe_val > 0:
        pe_val_str = f"PE={pe_val:.1f}"
        stock_yield = 100 / pe_val
        erp = stock_yield - last['yield']
        if erp > 5.5: macro_msg = f"⚠️ 股市极具性价比"
        elif erp < 2.0: macro_msg = f"✅ 股市泡沫"
        else: macro_msg = f"⚖️ 股债平衡"
        
    liquidity_msg = "⚪️ 缺失"
    shibor_val_str = "N/A"
    shibor_val = last.get('shibor')
    if pd.notna(shibor_val) and shibor_val > 0:
        shibor_val_str = f"{shibor_val:.2f}%"
        if shibor_val > 1.8: liquidity_msg = f"🔥 资金紧张"
        elif shibor_val < 1.3: liquidity_msg = f"💧 极度宽松"
        else: liquidity_msg = f"⚖️ 适度"

    score = calculate_composite_score(last, percentile, liquidity_msg, macro_msg)
    
    # 建议
    suggestion_con = "" 
    suggestion_agg = "" 
    weather = ""
    if score >= 80:
        weather = "☀️ 烈日 (极好)"
        suggestion_con = "【大力买入】估值便宜+趋势向好，闭眼定投。"
        suggestion_agg = "【上杠杆】机会难得，可考虑长债或杠杆债基。"
    elif score >= 60:
        weather = "🌤️ 晴朗 (较好)"
        suggestion_con = "【买入/持有】环境舒适，适合按部就班。"
        suggestion_agg = "【逢低加仓】如果有回调，大胆接货。"
    elif score >= 40:
        weather = "☁️ 多云 (震荡)"
        suggestion_con = "【卧倒不动】多看少动，拿住票息即可。"
        suggestion_agg = "【网格交易】高抛低吸，做小波段。"
    elif score >= 20:
        weather = "🌧️ 小雨 (较差)"
        suggestion_con = "【止盈/减仓】性价比低，先把利润落袋。"
        suggestion_agg = "【轻仓尝试】仅在RSI超卖时抢反弹，快进快出。"
    else:
        weather = "⛈️ 暴雨 (极差)"
        suggestion_con = "【清仓/空仓】极度危险，转入货币基金保命。"
        suggestion_agg = "【做空/回避】不要接飞刀。"

    # 获取当前时间字符串
    current_time_str = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    
    # 1. 获取脚本所在的绝对根目录
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # 2. 定义新文件夹的名称 (例如: Report_2025-11-26_15-30-00)
    new_folder_name = f"Report_{current_time_str}"
    
    # 3. 组合出新文件夹的完整路径
    output_dir = os.path.join(script_dir, new_folder_name)
    
    # 4. 创建这个文件夹
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        print(f"\n📂 已创建独立报告文件夹: {new_folder_name}")
    
    # 5. 定义内部文件名 
    # (因为文件夹名已经有时间了，里面的文件可以命名简单点，方便阅读)
    report_basename = "Bond_Analysis.md"
    chart_basename = "Chart_Dashboard.png"
    # 统一数据文件命名为时间，并保存到同级 data 目录
    ts_basename = f"{current_time_str}.ts"
    
    # 6. 组合最终保存的完整路径 (指向新文件夹内部)
    report_full_path = os.path.join(output_dir, report_basename)
    chart_full_path = os.path.join(output_dir, chart_basename)
    data_dir = os.path.join(script_dir, "data")
    if not os.path.exists(data_dir):
        os.makedirs(data_dir)
        print(f"\n📂 已创建数据文件夹: data")
    ts_full_path = os.path.join(data_dir, ts_basename)
    
    data_dict = {
        'gen_time': datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        'yield': last['yield'],
        'score': score,
        'weather': weather,
        'percentile': percentile,
        'val_status': val_status,
        'trend_val': "牛" if last['yield'] < last['MA60'] else "熊",
        'trend_status': "🟢 Yield < MA60" if last['yield'] < last['MA60'] else "🔴 Yield > MA60",
        'macd_val': "向好" if last['MACD'] < last['Signal_Line'] else "恶化",
        'macd_status': "🟢 死叉(跌)" if last['MACD'] < last['Signal_Line'] else "🔴 金叉(涨)",
        'pe_val': pe_val_str,
        'macro_msg': macro_msg,
        'shibor_val': shibor_val_str,
        'liquidity_msg': liquidity_msg,
        'suggestion_con': suggestion_con,
        'suggestion_agg': suggestion_agg
    }

    # 终端打印
    print("\n" + "█"*60)
    print(f"   🏆 债基晴雨表 V7.5 (Auto-Report)")
    print(f"   日期: {last['date'].strftime('%Y-%m-%d')} | 10年国债收益率: {last['yield']:.4f}%")
    print("█"*60)
    print(f"\n🔮 【综合评分】: {score:.1f} 分  --->  {weather}")
    print("-" * 60)
    print(f"💡 操作建议:")
    print(f"   🐢 [稳健型]: {suggestion_con}")
    print(f"   🐇 [激进型]: {suggestion_agg}")
    print("█"*60 + "\n")
    bond_records = df_bond[["date","yield"]].copy()
    bond_records["date"] = bond_records["date"].dt.strftime("%Y-%m-%d")
    stock_records = df_stock[["date","pe"]].copy() if set(["date","pe"]).issubset(df_stock.columns) else pd.DataFrame(columns=["date","pe"]) 
    if "date" in stock_records.columns:
        stock_records["date"] = pd.to_datetime(stock_records["date"]).dt.strftime("%Y-%m-%d")
    shibor_records = df_shibor[["date","shibor"]].copy() if set(["date","shibor"]).issubset(df_shibor.columns) else pd.DataFrame(columns=["date","shibor"]) 
    if "date" in shibor_records.columns:
        shibor_records["date"] = pd.to_datetime(shibor_records["date"]).dt.strftime("%Y-%m-%d")
    data_export = {
        "generated_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "report_folder": new_folder_name,
        "files": {
            "markdown": report_basename,
            "chart": chart_basename,
            "ts": ts_basename
        },
        "conclusion": {
            "last_date": last['date'].strftime('%Y-%m-%d'),
            "last_yield": float(last['yield']),
            "score": float(score),
            "weather": weather,
            "percentile": float(percentile),
            "val_status": val_status,
            "trend_val": "牛" if last['yield'] < last['MA60'] else "熊",
            "trend_status": "🟢 Yield < MA60" if last['yield'] < last['MA60'] else "🔴 Yield > MA60",
            "macd_val": "向好" if last['MACD'] < last['Signal_Line'] else "恶化",
            "macd_status": "🟢 死叉(跌)" if last['MACD'] < last['Signal_Line'] else "🔴 金叉(涨)",
            "pe_val": pe_val_str,
            "macro_msg": macro_msg,
            "shibor_val": shibor_val_str,
            "liquidity_msg": liquidity_msg,
            "suggestion_con": suggestion_con,
            "suggestion_agg": suggestion_agg
        },
        "raw": {
            "bond_10y": bond_records.to_dict(orient="records"),
            "stock_pe": stock_records.to_dict(orient="records"),
            "shibor_on": shibor_records.to_dict(orient="records")
        }
    }
    try:
        ts_content = "export const bondReportData = " + json.dumps(data_export, ensure_ascii=False, indent=2) + "\nexport default bondReportData;\n"
        with open(ts_full_path, "w", encoding="utf-8") as f:
            f.write(ts_content)
        print(f"✅ 数据文件已生成: {ts_full_path}")
    except Exception as e:
        print(f"❌ 数据文件生成失败: {e}")
    all_ts_path = os.path.join(data_dir, "bondReports.ts")
    try:
        existing_interior = ""
        if os.path.exists(all_ts_path):
            with open(all_ts_path, "r", encoding="utf-8") as f:
                content = f.read()
            begin = content.find("[")
            end = content.rfind("]")
            if begin != -1 and end != -1:
                interior = content[begin+1:end].strip()
                existing_interior = interior
        new_entry = json.dumps(data_export, ensure_ascii=False, indent=2)
        if existing_interior:
            interior_new = new_entry + ",\n" + existing_interior
        else:
            interior_new = new_entry
        aggregated = "export const bondReports = [\n" + interior_new + "\n];\nexport default bondReports;\n"
        with open(all_ts_path, "w", encoding="utf-8") as f:
            f.write(aggregated)
        print(f"✅ 汇总数据已更新: {all_ts_path}")
    except Exception as e:
        print(f"❌ 汇总数据更新失败: {e}")
    
    # 绘图并保存
    plot_dashboard(df, recent_df, last, score, chart_full_path)
    
    # 生成 Markdown
    save_markdown_report(report_full_path, chart_basename, data_dict)

def plot_dashboard(df, recent_df, last, score, filename):
    plot_df = df[df['date'] > (df.iloc[-1]['date'] - datetime.timedelta(days=2*365))].copy()
    fig = plt.figure(figsize=(16, 12))
    gs = gridspec.GridSpec(2, 2, height_ratios=[2, 1])
    
    # Chart 1
    ax1 = plt.subplot(gs[0, :])
    q80 = recent_df['yield'].quantile(0.8)
    q20 = recent_df['yield'].quantile(0.2)
    ax1.axhspan(q80, plot_df['yield'].max(), color='green', alpha=0.08, label='Buy Zone')
    ax1.axhspan(plot_df['yield'].min(), q20, color='red', alpha=0.08, label='Sell Zone')
    ax1.plot(plot_df['date'], plot_df['yield'], color='black', linewidth=2, label='10Y Yield')
    ax1.plot(plot_df['date'], plot_df['MA60'], color='orange', linestyle='--', linewidth=1.5, label='MA60')
    ax1.set_title(f"Strategic View (Score: {score:.1f})", fontsize=14, fontweight='bold')
    ax1.legend(loc='upper left')
    ax1.grid(True, alpha=0.3)
    
    # Chart 2
    ax2 = plt.subplot(gs[1, 0])
    if 'pe' in plot_df.columns and not plot_df['pe'].isna().all():
        erp_series = (100 / plot_df['pe']) - plot_df['yield']
        ax2.plot(plot_df['date'], erp_series, color='purple', label='ERP')
        ax2.axhline(5.5, color='green', linestyle=':')
        ax2.axhline(2.0, color='red', linestyle=':')
        ax2.set_title("Macro View: ERP")
        ax2.grid(True, alpha=0.3)
    else:
        ax2.text(0.5, 0.5, "Data Missing", ha='center', va='center')

    # Chart 3
    ax3 = plt.subplot(gs[1, 1])
    ax3.bar(plot_df['date'], plot_df['MACD_Hist'], color=['red' if v > 0 else 'green' for v in plot_df['MACD_Hist']], alpha=0.5)
    ax3_rhs = ax3.twinx()
    ax3_rhs.plot(plot_df['date'], plot_df['RSI'], color='blue', linewidth=1)
    ax3_rhs.axhline(70, color='red', linestyle='--', alpha=0.5)
    ax3_rhs.axhline(30, color='green', linestyle='--', alpha=0.5)
    ax3_rhs.set_ylim(0, 100)
    ax3.set_title("Tactical View: Momentum & RSI")
    ax3.grid(True, alpha=0.3)
    
    plt.tight_layout()
    # 保存图片
    plt.savefig(filename)
    print(f"✅ 图表已保存: {filename}")
    # 不显示弹窗，直接结束，方便自动化
    # plt.show() 

if __name__ == "__main__":
    run_system()
