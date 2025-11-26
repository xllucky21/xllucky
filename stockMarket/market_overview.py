#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import pandas as pd
import os
import ssl
import time
import datetime
import argparse
import random
import requests
import urllib3
import json
from pathlib import Path

from pyecharts.charts import Line, Grid, Tab
from pyecharts import options as opts

# ================= 配置区域 =================

BASE_DIR = Path(__file__).resolve().parent
DATA_FILE = BASE_DIR / "market_data_amount.csv"
HTML_FILE = BASE_DIR / "market_view.html"

# 新浪接口限制，大概能抓最近几年的数据
DEFAULT_START_DATE = "20180101"

INDICES = [
    {"name": "上证指数", "code": "sh000001", "type": "A"},
    {"name": "沪深300", "code": "sh000300", "type": "A"},
    {"name": "创业板指", "code": "sz399006", "type": "A"},
    {"name": "恒生指数", "code": "hkHSI",    "type": "HK"}, # 注意代码格式变化
    {"name": "恒生科技", "code": "hkHSTECH", "type": "HK"},
]

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
]

# ================= 网络底层优化 =================

def configure_network_security():
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    try:
        _create_unverified_https_context = ssl._create_unverified_context
    except AttributeError:
        pass
    else:
        ssl._create_default_https_context = _create_unverified_https_context
    print("网络配置完成。")

# ================= 数据获取逻辑 =================

class DataManager:
    def __init__(self):
        self.today = datetime.datetime.now().strftime("%Y%m%d")
        self.today_dt = datetime.datetime.now()
        self.session = requests.Session()
        self.session.verify = False
        self.session.headers.update({
            "User-Agent": random.choice(USER_AGENTS),
            "Referer": "https://finance.sina.com.cn/"
        })

    def _fetch_from_sina_api(self, code: str) -> pd.DataFrame:
        """
        【B计划】直连新浪 API
        Sina 接口通常比东财更耐抗（不那么容易封IP）
        """
        # 1. 构造 URL
        # sh000001 -> sh000001
        # scale=240 代表日线
        # datalen=2000 获取最近2000个交易日 (约8年)
        url = f"https://quotes.sina.cn/cn/api/json_v2.php/CN_MarketData.getKLineData?symbol={code}&scale=240&ma=no&datalen=2000"

        try:
            # print(f"   [直连新浪] 请求 {code} ...")
            resp = self.session.get(url, timeout=15)
            data = resp.json()
            
            # 新浪返回格式: [{'day': '2023-01-01', 'open': '...', 'high': '...', 'low': '...', 'close': '...', 'volume': '...', 'amount': '...'}]
            if isinstance(data, list) and len(data) > 0:
                df = pd.DataFrame(data)
                
                # 必须包含 amount 字段
                if 'amount' not in df.columns:
                    print(f"   [新浪异常] 返回数据缺少 amount 字段")
                    return pd.DataFrame()

                out = pd.DataFrame()
                out['date'] = pd.to_datetime(df['day'])
                out['close'] = pd.to_numeric(df['close'], errors='coerce')
                # 新浪的 amount 肯定是元
                out['amount'] = pd.to_numeric(df['amount'], errors='coerce')
                
                out['date'] = out['date'].dt.strftime('%Y-%m-%d')
                return out.dropna()
            else:
                print(f"   [直连新浪] 返回为空或格式错误")
                
        except Exception as e:
            print(f"   [直连新浪] 请求异常: {e}")
        
        return pd.DataFrame()

    def _fetch_hk_from_tencent(self, code: str) -> pd.DataFrame:
        """
        港股降级方案：使用腾讯接口
        注意：腾讯港股通常只返回成交量（Volume），不返回成交额（Amount）。
        但为了让你能看到图，我们这里只能接受这个现实。
        """
        # code 格式: hkHSI -> hkHSI
        url = f"http://web.ifzq.gtimg.cn/appstock/app/hkfqkline/get?_var=kline_dayqfq&param={code},day,,,3000,qfq"
        
        try:
            resp = self.session.get(url, timeout=10)
            content = resp.text
            # 腾讯返回的是 JS 变量，需要提取 JSON
            json_str = content.split('=', 1)[1]
            data = json.loads(json_str)
            
            # 解析路径: data -> qfqday -> [list]
            if "data" in data and code in data["data"] and "day" in data["data"][code]:
                klines = data["data"][code]["day"]
                rows = []
                for k in klines:
                    # [日期, 开盘, 收盘, 最高, 最低, 成交量, ...]
                    # 腾讯港股数据的 index 5 是成交量 (Shares)
                    # 某些指数可能 index 8 是成交额，但不稳定
                    rows.append({
                        "date": k[0],
                        "close": float(k[2]),
                        "amount": float(k[5]) # 这里实际上是量，但为了画图先存入
                    })
                
                df = pd.DataFrame(rows)
                # 格式化日期 20230101 -> 2023-01-01
                df['date'] = pd.to_datetime(df['date']).dt.strftime('%Y-%m-%d')
                return df
                
        except Exception as e:
            print(f"   [腾讯港股] 异常: {e}")
            
        return pd.DataFrame()

    def update(self):
        if DATA_FILE.exists():
            print(f"读取本地数据: {DATA_FILE}")
            try:
                local_df = pd.read_csv(DATA_FILE)
            except Exception:
                local_df = pd.DataFrame(columns=['code', 'name', 'date', 'close', 'amount'])
        else:
            print("本地无数据，初始化...")
            local_df = pd.DataFrame(columns=['code', 'name', 'date', 'close', 'amount'])

        new_records = []
        for item in INDICES:
            code = item['code']
            name = item['name']
            
            # 简单去重逻辑，这里为了确保数据正确，建议每次覆盖最新的一段
            # 实际上由于我们换了接口，建议全量覆盖
            print(f"[{name}] 正在下载数据...")
            
            time.sleep(random.uniform(1.0, 2.0)) # 增加延时，防止封锁
            
            df = pd.DataFrame()
            if item['type'] == 'A':
                df = self._fetch_from_sina_api(code)
            else:
                df = self._fetch_hk_from_tencent(code)

            if not df.empty:
                df['code'] = code
                df['name'] = name
                new_records.append(df)
                
                val = df.iloc[-1]['amount']
                if item['type'] == 'A':
                    if val > 1e9:
                        print(f"   -> 成功 (最新额: {val/1e8:.2f} 亿)")
                    else:
                        print(f"   -> [警告] 数值偏小 ({val:,.0f})，可能是成交量或已被截断")
                else:
                    print(f"   -> 成功 (港股仅获取成交量: {val:,.0f})")
            else:
                print(f"   -> [失败] 未获取到数据")

        if new_records:
            # 全量替换模式，确保数据源统一
            final_df = pd.concat(new_records)
            final_df = final_df.sort_values(by=['code', 'date'])
            final_df.to_csv(DATA_FILE, index=False, encoding="utf_8_sig")
            print(f"数据已更新至 {DATA_FILE}")
            return final_df
        else:
            return local_df

# ================= 可视化逻辑 =================

class ChartGenerator:
    def _calc_percentile(self, current, h_min, h_max):
        if h_max == h_min: return 0
        return (current - h_min) / (h_max - h_min) * 100

    def generate(self, df: pd.DataFrame):
        if df.empty: return

        print(f"正在生成图表 -> {HTML_FILE} ...")
        tab = Tab(page_title="指数成交额资金分析")

        unique_codes = df['code'].unique()

        for code in unique_codes:
            sub_df = df[df['code'] == code].copy()
            if sub_df.empty: continue
            
            name = sub_df.iloc[0]['name']
            # 判断是 A 股还是港股
            is_ashare = code.startswith("sh") or code.startswith("sz")
            
            dates = sub_df['date'].tolist()
            closes = sub_df['close'].tolist()
            amounts = sub_df['amount'].tolist()
            
            if not closes: continue

            # --- 单位自动判断 ---
            max_val = max(amounts)
            
            if is_ashare:
                # A股逻辑
                if max_val > 1e11: 
                    div = 1e8
                    unit = "亿"
                elif max_val > 1e8:
                    div = 1e8
                    unit = "亿"
                else:
                    div = 1e4
                    unit = "万(疑为量)"
            else:
                # 港股逻辑 (大概率是量)
                if max_val > 1e8:
                    div = 1e8
                    unit = "亿股(量)"
                else:
                    div = 1e4
                    unit = "万股(量)"
                
            amounts_scaled = [x / div for x in amounts]

            # 统计
            curr_price = closes[-1]
            price_pct = self._calc_percentile(curr_price, min(closes), max(closes))
            
            curr_amt = amounts_scaled[-1]
            valid_amts = [x for x in amounts_scaled if x > 0]
            if valid_amts:
                amt_pct = self._calc_percentile(curr_amt, min(valid_amts), max(valid_amts))
                max_hist = max(valid_amts)
            else:
                amt_pct = 0
                max_hist = 0
            
            subtitle = (
                f"收盘: {curr_price:.2f} (分位:{price_pct:.0f}%) | "
                f"数值: {curr_amt:.2f}{unit} (分位:{amt_pct:.0f}%) | "
                f"历史最大: {max_hist:.2f}{unit}"
            )

            # K线
            line = (
                Line()
                .add_xaxis(dates)
                .add_yaxis(
                    "收盘价", 
                    closes, 
                    is_symbol_show=False,
                    is_smooth=True,
                    label_opts=opts.LabelOpts(is_show=False),
                    markpoint_opts=opts.MarkPointOpts(data=[
                        opts.MarkPointItem(type_="max", name="最高"),
                        opts.MarkPointItem(type_="min", name="最低"),
                        opts.MarkPointItem(coord=[dates[-1], closes[-1]], value=closes[-1], name="当前")
                    ]),
                    markline_opts=opts.MarkLineOpts(data=[opts.MarkLineItem(type_="average", name="均线")])
                )
                .set_global_opts(
                    title_opts=opts.TitleOpts(title=name, subtitle=subtitle),
                    xaxis_opts=opts.AxisOpts(type_="category", boundary_gap=False),
                    yaxis_opts=opts.AxisOpts(is_scale=True, splitarea_opts=opts.SplitAreaOpts(is_show=True, areastyle_opts=opts.AreaStyleOpts(opacity=0.3))),
                    tooltip_opts=opts.TooltipOpts(trigger="axis", axis_pointer_type="cross"),
                    datazoom_opts=[opts.DataZoomOpts(type_="slider", range_start=0, range_end=100, xaxis_index=[0, 1])]
                )
            )

            # 成交额
            bar = (
                Line()
                .add_xaxis(dates)
                .add_yaxis(
                    f"数值({unit})", 
                    amounts_scaled, 
                    is_symbol_show=False, 
                    label_opts=opts.LabelOpts(is_show=False),
                    areastyle_opts=opts.AreaStyleOpts(opacity=0.2, color="#FFA726"),
                    itemstyle_opts=opts.ItemStyleOpts(color="#EF6C00"),
                    markline_opts=opts.MarkLineOpts(data=[opts.MarkLineItem(type_="average", name="平均")])
                )
                .set_global_opts(
                    xaxis_opts=opts.AxisOpts(is_show=False),
                    legend_opts=opts.LegendOpts(is_show=False),
                    tooltip_opts=opts.TooltipOpts(trigger="axis", axis_pointer_type="cross"),
                    yaxis_opts=opts.AxisOpts(name=f"单位:{unit}")
                )
            )

            grid = Grid(init_opts=opts.InitOpts(width="100%", height="600px"))
            grid.add(line, grid_opts=opts.GridOpts(pos_left="60px", pos_right="60px", pos_top="80px", height="55%"))
            grid.add(bar, grid_opts=opts.GridOpts(pos_left="60px", pos_right="60px", pos_top="68%", height="20%"))

            tab.add(grid, name)

        tab.render(str(HTML_FILE))
        print(f"生成完毕: {HTML_FILE}")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="此版本默认全量刷新")
    args = parser.parse_args()

    configure_network_security()

    if DATA_FILE.exists():
        print(">>> 清理旧数据，重新全量抓取...")
        os.remove(DATA_FILE)

    manager = DataManager()
    df = manager.update()

    chart_gen = ChartGenerator()
    chart_gen.generate(df)

if __name__ == "__main__":
    main()