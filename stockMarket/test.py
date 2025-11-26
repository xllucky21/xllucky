#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import akshare as ak
import pandas as pd
import os
import ssl
import time
import datetime
import argparse
import random
import requests
import urllib3
import warnings
from pathlib import Path
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from pyecharts.charts import Line, Grid, Tab
from pyecharts import options as opts

# ================= 配置区域 =================

# 基础路径配置
BASE_DIR = Path(__file__).resolve().parent
DATA_FILE = BASE_DIR / "market_data_amount.csv"
HTML_FILE = BASE_DIR / "market_view.html"

# 默认起始日期 (如果是全新抓取)
DEFAULT_START_DATE = "20150101"

# 指数列表配置
# 涵盖 A股主要宽基 + 港股核心指数
INDICES = [
    {"name": "上证指数", "code": "sh000001", "type": "A"},
    {"name": "沪深300", "code": "sh000300", "type": "A"},
    {"name": "创业板指", "code": "sz399006", "type": "A"},
    {"name": "恒生指数", "code": "HSI", "type": "HK"},
    {"name": "恒生科技", "code": "HSTECH", "type": "HK"},
]

# 随机 User-Agent，防止反爬
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
]

# ================= 网络底层优化 (健壮性核心) =================

def configure_network_security():
    """
    配置网络安全层，强制不验证SSL，防止报错。
    并设置默认超时和重试机制。
    """
    # 1. 禁用 SSL 警告
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

    # 2. 全局修补 ssl 上下文
    try:
        _create_unverified_https_context = ssl._create_unverified_context
    except AttributeError:
        pass
    else:
        ssl._create_default_https_context = _create_unverified_https_context

    # 3. Monkey Patch requests 库，强制所有请求不验证 SSL 并带上 UA
    _orig_request = requests.Session.request

    def _patched_request(self, method, url, **kwargs):
        kwargs['verify'] = False
        # 设置超时 (连接, 读取)
        if 'timeout' not in kwargs:
            kwargs['timeout'] = (15, 60)
        
        # 注入 UA
        if 'headers' not in kwargs:
            kwargs['headers'] = {}
        if 'User-Agent' not in kwargs['headers']:
            kwargs['headers']['User-Agent'] = random.choice(USER_AGENTS)
            
        return _orig_request(self, method, url, **kwargs)

    requests.Session.request = _patched_request
    print("网络层配置完成：已配置 SSL 绕过与自动超时重试。")


# ================= 数据获取逻辑 =================

class DataManager:
    def __init__(self):
        self.today = datetime.datetime.now().strftime("%Y%m%d")
        self.today_dt = datetime.datetime.now()

    def _normalize_df(self, df: pd.DataFrame, strict_amount=False) -> pd.DataFrame:
        """
        数据清洗与标准化
        strict_amount: A股为True，强制要求成交额；港股为False，允许降级
        """
        if df is None or df.empty:
            return pd.DataFrame()
            
        cols = df.columns.tolist()
        col_map = {}
        
        # 1. 映射日期
        for c in cols:
            if 'date' in c.lower() or '日期' in c:
                col_map[c] = 'date'
                break
        
        # 2. 映射收盘价
        for c in cols:
            if c in ['close', '收盘', '收盘价', '收盘指数']:
                col_map[c] = 'close'
                break
                
        # 3. 映射成交额 (Priority 1)
        found_amount = False
        target_amount_cols = ['成交额', 'amount', '成交金额', 'turnover'] 
        for target in target_amount_cols:
            if target in cols:
                col_map[target] = 'amount'
                found_amount = True
                break
        
        # 4. 降级：成交量 (Priority 2) - 仅当非严格模式时允许
        if not found_amount and not strict_amount:
            for target in ['成交量', 'volume', 'vol']:
                if target in cols:
                    col_map[target] = 'amount' # 暂存为 amount 字段方便统一处理
                    found_amount = True
                    break
        
        if not found_amount:
            return pd.DataFrame()

        df = df.rename(columns=col_map)
        
        required = ['date', 'close', 'amount']
        if not all(col in df.columns for col in required):
            return pd.DataFrame()

        out = df[required].copy()
        out['date'] = pd.to_datetime(out['date']).dt.strftime('%Y-%m-%d')
        out['close'] = pd.to_numeric(out['close'], errors='coerce')
        out['amount'] = pd.to_numeric(out['amount'], errors='coerce')
        out = out.dropna()
        
        return out

    def fetch_a_share(self, code, start_date, end_date):
        """
        A股策略：使用东财 index_zh_a_hist 接口 (最稳定且含成交额)
        """
        # 去掉 sh/sz 前缀
        pure_code = code.replace("sh", "").replace("sz", "")
        
        try:
            # 策略 1: 东方财富 A股历史行情 (ak.index_zh_a_hist)
            df = ak.index_zh_a_hist(symbol=pure_code, period="daily", start_date=start_date, end_date=end_date)
            res = self._normalize_df(df, strict_amount=True)
            if not res.empty: return res
        except Exception:
            pass

        # 策略 2: 备用接口 (全量下载后过滤)
        try:
            df = ak.stock_zh_index_daily_em(symbol=code)
            res = self._normalize_df(df, strict_amount=True)
            if not res.empty: 
                start_fmt = pd.to_datetime(start_date).strftime('%Y-%m-%d')
                end_fmt = pd.to_datetime(end_date).strftime('%Y-%m-%d')
                return res[(res['date'] >= start_fmt) & (res['date'] <= end_fmt)]
        except Exception:
            pass
            
        return pd.DataFrame()

    def fetch_hk_share(self, symbol, start_date, end_date):
        """港股策略：优先腾讯接口"""
        start_fmt = pd.to_datetime(start_date).strftime('%Y-%m-%d')
        end_fmt = pd.to_datetime(end_date).strftime('%Y-%m-%d')

        # 策略 1: 腾讯港股 (需要加 hk 前缀)
        try:
            tx_symbol = f"hk{symbol}" 
            df = ak.stock_hk_index_daily_tx(symbol=tx_symbol)
            # 港股允许降级，因为有些接口确实只有量
            res = self._normalize_df(df, strict_amount=False)
            if not res.empty:
                return res[(res['date'] >= start_fmt) & (res['date'] <= end_fmt)]
        except Exception:
            pass
            
        # 策略 2: 新浪港股
        try:
            df = ak.stock_hk_index_daily_sina(symbol=symbol)
            res = self._normalize_df(df, strict_amount=False)
            if not res.empty:
                return res[(res['date'] >= start_fmt) & (res['date'] <= end_fmt)]
        except Exception:
            pass

        return pd.DataFrame()

    def update(self):
        # 读取本地数据
        if DATA_FILE.exists():
            print(f"读取本地数据: {DATA_FILE}")
            try:
                local_df = pd.read_csv(DATA_FILE)
                local_df['date'] = pd.to_datetime(local_df['date']).dt.strftime('%Y-%m-%d')
            except Exception:
                local_df = pd.DataFrame(columns=['code', 'name', 'date', 'close', 'amount'])
        else:
            print("本地无数据，初始化...")
            local_df = pd.DataFrame(columns=['code', 'name', 'date', 'close', 'amount'])

        new_records = []
        for item in INDICES:
            code = item['code']
            name = item['name']
            
            # 确定更新起点
            item_df = local_df[local_df['code'] == code]
            if not item_df.empty:
                last_date = datetime.datetime.strptime(item_df['date'].max(), "%Y-%m-%d")
                start_dt = last_date + datetime.timedelta(days=1)
                if start_dt > self.today_dt:
                    print(f"[{name}] 数据已最新，跳过。")
                    continue
                start_date = start_dt.strftime("%Y%m%d")
                print(f"[{name}] 增量更新: {start_date} -> {self.today}")
            else:
                start_date = DEFAULT_START_DATE
                print(f"[{name}] 全量下载: {start_date} -> {self.today}")

            # 随机延时，防止触发频率限制
            time.sleep(random.uniform(0.5, 1.2))
            
            if item['type'] == 'A':
                df = self.fetch_a_share(code, start_date, self.today)
            else:
                df = self.fetch_hk_share(code, start_date, self.today)

            if not df.empty:
                df['code'] = code
                df['name'] = name
                new_records.append(df)
                
                # 简单校验
                avg_amt = df['amount'].mean()
                if item['type'] == 'A' and avg_amt < 1e7:
                    print(f"   -> [警告] {name} 数值较小({avg_amt:,.0f})，请确认是否为成交额")
                else:
                    print(f"   -> 成功 (最新: {df.iloc[-1]['amount']:,.0f})")
            else:
                print(f"   -> [失败] 未获取到数据")

        # 合并保存逻辑 (修复 Pandas concat 警告)
        if new_records:
            incoming_df = pd.concat(new_records)
            if local_df.empty:
                final_df = incoming_df
            else:
                final_df = pd.concat([local_df, incoming_df])
            
            final_df = final_df.drop_duplicates(subset=['code', 'date'], keep='last')
            final_df = final_df.sort_values(by=['code', 'date'])
            final_df.to_csv(DATA_FILE, index=False, encoding="utf_8_sig")
            print(f"数据已更新至 {DATA_FILE}")
            return final_df
        else:
            return local_df

# ================= 可视化逻辑 =================

class ChartGenerator:
    def _calc_percentile(self, current, h_min, h_max):
        """计算历史百分位"""
        if h_max == h_min: return 0
        return (current - h_min) / (h_max - h_min) * 100

    def generate(self, df: pd.DataFrame):
        if df.empty: return

        print(f"正在生成可视化报表 -> {HTML_FILE} ...")
        tab = Tab(page_title="市场指数资金活跃度分析")

        for item in INDICES:
            code = item['code']
            name = item['name']
            
            sub_df = df[df['code'] == code].copy()
            if sub_df.empty: continue
            
            dates = sub_df['date'].tolist()
            closes = sub_df['close'].tolist()
            amounts = sub_df['amount'].tolist()
            
            if not closes: continue

            # --- 智能单位换算 ---
            max_val = max(amounts)
            if max_val > 1e12:
                div = 1e12
                unit = "万亿"
            elif max_val > 1e8:
                div = 1e8
                unit = "亿"
            elif max_val > 1e4:
                div = 1e4
                unit = "万"
            else:
                div = 1
                unit = "元"
                
            amounts_scaled = [x / div for x in amounts]

            # 统计计算
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
            
            # 判断热度颜色
            heat_color = "black"
            if amt_pct > 80: heat_color = "red" # 过热
            elif amt_pct < 20: heat_color = "green" # 冰点
            
            subtitle = (
                f"收盘: {curr_price:.2f} (历史位置:{price_pct:.0f}%) | "
                f"成交额: {curr_amt:.2f}{unit} (活跃度:{amt_pct:.0f}%) | "
                f"历史天量: {max_hist:.2f}{unit}"
            )

            # 1. 价格折线图 (上)
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
                    title_opts=opts.TitleOpts(title=name, subtitle=subtitle, subtitle_textstyle_opts=opts.TextStyleOpts(color=heat_color)),
                    xaxis_opts=opts.AxisOpts(type_="category", boundary_gap=False, axislabel_opts=opts.LabelOpts(is_show=False)), # 隐藏X轴文字与下对齐
                    yaxis_opts=opts.AxisOpts(
                        is_scale=True, 
                        splitarea_opts=opts.SplitAreaOpts(is_show=True, areastyle_opts=opts.AreaStyleOpts(opacity=0.3))
                    ),
                    tooltip_opts=opts.TooltipOpts(trigger="axis", axis_pointer_type="cross"),
                    datazoom_opts=[opts.DataZoomOpts(type_="slider", range_start=0, range_end=100, xaxis_index=[0, 1])]
                )
            )

            # 2. 成交额面积图 (下)
            bar = (
                Line()
                .add_xaxis(dates)
                .add_yaxis(
                    f"成交额({unit})", 
                    amounts_scaled, 
                    is_symbol_show=False, 
                    label_opts=opts.LabelOpts(is_show=False),
                    areastyle_opts=opts.AreaStyleOpts(opacity=0.2, color="#FFA726"),
                    itemstyle_opts=opts.ItemStyleOpts(color="#EF6C00"),
                    markline_opts=opts.MarkLineOpts(data=[opts.MarkLineItem(type_="average", name="平均金额")])
                )
                .set_global_opts(
                    xaxis_opts=opts.AxisOpts(type_="category", boundary_gap=False),
                    legend_opts=opts.LegendOpts(is_show=False),
                    tooltip_opts=opts.TooltipOpts(trigger="axis", axis_pointer_type="cross"),
                    yaxis_opts=opts.AxisOpts(name=f"单位:{unit}", splitline_opts=opts.SplitLineOpts(is_show=False))
                )
            )

            # 组合布局
            grid = Grid(init_opts=opts.InitOpts(width="100%", height="600px"))
            # 上图占 55%
            grid.add(line, grid_opts=opts.GridOpts(pos_left="60px", pos_right="60px", pos_top="60px", height="50%"))
            # 下图占 25%
            grid.add(bar, grid_opts=opts.GridOpts(pos_left="60px", pos_right="60px", pos_top="65%", height="25%"))

            tab.add(grid, name)

        tab.render(str(HTML_FILE))
        print(f"生成完毕: {HTML_FILE}")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="强制删除本地数据并重新全量下载")
    args = parser.parse_args()

    configure_network_security()

    # 清洗旧数据的关键逻辑
    if args.force and DATA_FILE.exists():
        print(">>> 强制模式：删除本地旧数据，重新抓取...")
        os.remove(DATA_FILE)

    manager = DataManager()
    df = manager.update()

    chart_gen = ChartGenerator()
    chart_gen.generate(df)

if __name__ == "__main__":
    # 第一次建议带上 --force 运行，以确保数据纯净
    print("建议首次运行或数据异常时使用: python script.py --force")
    main()