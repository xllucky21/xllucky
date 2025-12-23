import akshare as ak
import pandas as pd
from scipy import stats
import datetime
import numpy as np
import warnings
import ssl
import os
import json
import requests
import urllib3

# ==========================================
# ⚙️ 配置常量
# ==========================================
class Config:
    """量化策略配置参数"""
    # 数据时间范围
    DATA_YEARS = 10  # 历史数据年数
    
    # 技术指标参数
    MA_PERIOD = 60  # 均线周期
    MACD_FAST = 12  # MACD 快线
    MACD_SLOW = 26  # MACD 慢线
    MACD_SIGNAL = 9  # MACD 信号线
    RSI_PERIOD = 14  # RSI 周期
    BB_PERIOD = 20  # 布林带周期
    BB_STD = 2  # 布林带标准差倍数
    
    # 评分阈值
    PERCENTILE_CHEAP = 80  # 便宜阈值
    PERCENTILE_EXPENSIVE = 20  # 昂贵阈值
    RSI_OVERSOLD = 30  # RSI 超卖
    RSI_OVERBOUGHT = 70  # RSI 超买
    
    # 流动性变化阈值（看趋势，不看绝对值）
    # Shibor上升 → 资金收紧 → 利空债市
    # Shibor下降 → 资金宽松 → 利好债市
    SHIBOR_LOOKBACK = 20  # 回看天数（约1个月）
    SHIBOR_MAX_CHANGE = 0.5  # Shibor变化超过50bp视为极端（用于归一化）
    
    # ERP 阈值（用于连续评分）
    ERP_NEUTRAL = 3.75  # ERP中性值（股债平衡点）
    ERP_MAX_DEVIATION = 1.75  # 最大偏离（用于归一化，即2.0-5.5范围）
    
    # 中美利差变化阈值（看趋势，不看绝对值）
    # 利差收窄（变好）→ 降息空间变大 → 利好债市
    # 利差走阔（变差）→ 降息空间变小 → 利空债市
    SPREAD_LOOKBACK = 60  # 回看天数（约3个月）
    SPREAD_MAX_CHANGE = 0.5  # 利差变化超过50bp视为极端（用于归一化）
    
    # 评分权重
    SCORE_BASE = 50
    SCORE_PERCENTILE_WEIGHT = 0.6  # 估值权重提高，让评分更有区分度
    SCORE_TREND_BONUS = 8   # 趋势权重（震荡市场时使用）
    SCORE_RSI_BONUS = 6     # RSI 权重（震荡市场时使用）
    SCORE_LIQUIDITY_PENALTY = 8
    SCORE_MACRO_PENALTY = 10
    
    # 市场状态判断参数
    TREND_CONSECUTIVE_DAYS = 40  # 连续N天在MA同一侧视为单边市场
    MA_CROSS_LOOKBACK = 120      # 回看天数，用于计算穿越频率
    
    # 天气评分区间
    WEATHER_SUNNY = 80
    WEATHER_CLEAR = 60
    WEATHER_CLOUDY = 40
    WEATHER_RAINY = 20

# ==========================================
# 🛡️ 系统底层配置
# ==========================================
warnings.filterwarnings("ignore")
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# 【优化】不再全局 patch SSL 和 requests
# 改为在需要时创建专用 session，避免影响其他库
def create_akshare_session():
    """创建用于 akshare 的专用 session，禁用 SSL 验证"""
    session = requests.Session()
    session.verify = False
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    })
    return session

# 临时禁用 SSL 验证（仅用于 akshare 调用）
# 注意：这是为了兼容某些网络环境，生产环境应配置正确的证书
import contextlib

@contextlib.contextmanager
def disable_ssl_verification():
    """临时禁用 SSL 验证的上下文管理器"""
    old_request = requests.Session.request
    def patched_request(self, method, url, *args, **kwargs):
        kwargs['verify'] = False
        if 'headers' not in kwargs:
            kwargs['headers'] = {}
        kwargs['headers'].update({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        })
        return old_request(self, method, url, *args, **kwargs)
    
    requests.Session.request = patched_request
    try:
        yield
    finally:
        requests.Session.request = old_request

# ==========================================
# 🧠 核心计算引擎
# ==========================================

def calculate_technical_indicators(df):
    """计算技术指标
    
    注意：MACD 相关指标（MACD, Signal_Line, MACD_Hist）仅用于展示和趋势解释，
    不参与评分计算。评分主要依赖估值（分位数）和趋势（MA60偏离）。
    """
    df['MA60'] = df['yield'].rolling(window=Config.MA_PERIOD).mean()
    
    # MACD 指标（仅用于展示，不参与评分）
    exp1 = df['yield'].ewm(span=Config.MACD_FAST, adjust=False).mean()
    exp2 = df['yield'].ewm(span=Config.MACD_SLOW, adjust=False).mean()
    df['MACD'] = exp1 - exp2
    df['Signal_Line'] = df['MACD'].ewm(span=Config.MACD_SIGNAL, adjust=False).mean()
    df['MACD_Hist'] = df['MACD'] - df['Signal_Line']
    
    delta = df['yield'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=Config.RSI_PERIOD).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=Config.RSI_PERIOD).mean()
    rs = gain / loss
    df['RSI'] = 100 - (100 / (1 + rs))
    
    df['BB_Mid'] = df['yield'].rolling(window=Config.BB_PERIOD).mean()
    df['BB_Std'] = df['yield'].rolling(window=Config.BB_PERIOD).std()
    df['BB_Up'] = df['BB_Mid'] + Config.BB_STD * df['BB_Std']
    df['BB_Low'] = df['BB_Mid'] - Config.BB_STD * df['BB_Std']
    return df

def detect_market_regime(df: pd.DataFrame, current_idx: int = -1) -> dict:
    """
    检测当前市场状态：持续偏离 vs 均值回归
    
    方法：计算收益率在MA60同一侧的连续天数
    - 连续天数 >= TREND_CONSECUTIVE_DAYS → 持续偏离（extended）
    - 连续天数 < TREND_CONSECUTIVE_DAYS → 均值回归（mean-reverting）
    
    【优化】命名更准确：
    - "extended": 收益率持续偏离均线，趋势可能延续
    - "mean-reverting": 收益率在均线附近震荡，更可能回归
    
    返回：
    - regime: "extended" (持续偏离) 或 "mean-reverting" (均值回归)
    - consecutive_days: 连续天数
    - trend_weight: 趋势因子权重 (0-1)
    - direction: "bull" (牛市，收益率<MA) 或 "bear" (熊市，收益率>MA)
    """
    if len(df) < Config.MA_PERIOD:
        return {"regime": "unknown", "consecutive_days": 0, "trend_weight": 0.5, "direction": None}
    
    # 获取到当前位置的数据
    if current_idx == -1:
        current_idx = len(df) - 1
    
    # 计算收益率与MA60的关系
    yield_col = df['yield'].values
    ma60_col = df['MA60'].values
    
    # 从当前位置往回数，看连续多少天在MA同一侧
    consecutive_days = 0
    current_above_ma = yield_col[current_idx] > ma60_col[current_idx]
    
    for i in range(current_idx, max(0, current_idx - Config.MA_CROSS_LOOKBACK), -1):
        if pd.isna(ma60_col[i]):
            break
        is_above = yield_col[i] > ma60_col[i]
        if is_above == current_above_ma:
            consecutive_days += 1
        else:
            break
    
    # 判断市场状态
    if consecutive_days >= Config.TREND_CONSECUTIVE_DAYS:
        regime = "extended"  # 持续偏离
        # 持续偏离：趋势因子权重降低，连续天数越长权重越低
        # 从1.0线性降到0，超过2倍阈值后完全为0
        weight_decay = min(1.0, (consecutive_days - Config.TREND_CONSECUTIVE_DAYS) / Config.TREND_CONSECUTIVE_DAYS)
        trend_weight = max(0, 1.0 - weight_decay)
    else:
        regime = "mean-reverting"  # 均值回归
        # 均值回归：趋势因子权重正常
        # 连续天数越少，权重越高（说明市场越震荡）
        trend_weight = 1.0 - (consecutive_days / Config.TREND_CONSECUTIVE_DAYS) * 0.3
    
    direction = "bear" if current_above_ma else "bull"  # 收益率<MA = 债券牛市
    
    return {
        "regime": regime,
        "consecutive_days": consecutive_days,
        "trend_weight": trend_weight,
        "direction": direction
    }


def calculate_composite_score(row, percentile, shibor_change=None, erp=None, spread_change=None, 
                              market_regime=None, shibor_change_std=None, spread_change_std=None):
    """
    计算买入价值评分（0-100）
    
    核心逻辑：高分 = 值得买入（债券便宜）
    
    主要因子（估值为王）：
    - 收益率分位数越高 = 债券越便宜 = 越值得买
    
    辅助因子（全部使用连续评分，避免突变）：
    - 趋势因子：基于收益率偏离MA60的程度，连续映射
    - RSI因子：基于RSI偏离中性值的程度，连续映射
    - 资金面：Shibor变化线性映射
    - 中美利差：利差变化线性映射
    - 宏观对冲：ERP线性映射
    """
    score = Config.SCORE_BASE
    
    # 获取市场状态权重
    trend_weight = 1.0
    if market_regime is not None:
        trend_weight = market_regime.get("trend_weight", 1.0)
    
    # 【核心】估值：收益率分位数越高 = 债券越便宜 = 越值得买
    score += (percentile - 50) * Config.SCORE_PERCENTILE_WEIGHT

    # 【动态】趋势因子：连续评分，基于偏离MA60的程度
    # 偏离越大，分数影响越大；在均线附近时影响很小
    # deviation > 0 表示收益率高于MA60（熊市），应该加分
    # deviation < 0 表示收益率低于MA60（牛市），应该减分
    # 【修复】在单边熊市时降低趋势因子权重，避免与估值重复计分
    if 'MA60' in row.index and pd.notna(row['MA60']) and row['MA60'] > 0:
        # 计算偏离程度：(yield - MA60) / MA60 * 100，得到百分比偏离
        deviation_pct = (row['yield'] - row['MA60']) / row['MA60'] * 100
        # 归一化：假设偏离超过5%为极端情况
        normalized = deviation_pct / 5.0
        normalized = max(-1, min(1, normalized))
        
        # 在持续偏离熊市（利率上行趋势）时，趋势因子与估值因子方向一致
        # 为避免重复计分，额外降低权重
        extra_weight = 1.0
        if market_regime is not None:
            if market_regime.get("regime") == "extended" and market_regime.get("direction") == "bear":
                extra_weight = 0.3  # 持续偏离熊市时趋势因子权重降至30%
        
        trend_bonus = normalized * Config.SCORE_TREND_BONUS * trend_weight * extra_weight
        score += trend_bonus

    # 【动态】RSI因子：连续评分，基于偏离中性值(50)的程度
    # RSI > 50 表示收益率可能下跌（债券上涨），应该加分
    # RSI < 50 表示收益率可能上涨（债券下跌），应该减分
    # 【优化3】在持续偏离牛市时削弱RSI，避免"越涨越加分"导致接飞刀
    if 'RSI' in row.index and pd.notna(row['RSI']):
        # 计算偏离中性值的程度
        rsi_deviation = (row['RSI'] - 50) / 50  # 归一化到 [-1, 1]
        rsi_bonus = rsi_deviation * Config.SCORE_RSI_BONUS * trend_weight
        
        # 在持续偏离牛市（利率下行趋势）时，RSI可能持续高位
        # 此时RSI信号不可靠，削弱其权重
        if market_regime is not None:
            if market_regime.get("regime") == "extended" and market_regime.get("direction") == "bull":
                rsi_bonus *= 0.5  # 持续偏离牛市时RSI权重降至50%
        
        score += rsi_bonus

    # 【辅助】流动性变化：使用历史波动率归一化
    # 【优化】同样的bp变化在不同年份意义不同，用z-score归一化
    if shibor_change is not None and not np.isnan(shibor_change):
        if shibor_change_std is not None and not np.isnan(shibor_change_std) and shibor_change_std > 0:
            # 使用历史波动率归一化（z-score / 2，使±2std映射到±1）
            z_score = shibor_change / shibor_change_std
            normalized = np.clip(z_score / 2, -1, 1)
        else:
            # 回退到固定阈值
            normalized = -shibor_change / Config.SHIBOR_MAX_CHANGE
            normalized = max(-1, min(1, normalized))
        # Shibor上升（资金收紧）利空债市，取负号
        score += -normalized * Config.SCORE_LIQUIDITY_PENALTY

    # 【辅助】宏观对冲：ERP 作为极端风险过滤器
    # 【修复】改为阶梯式评分，而非线性连续评分
    # ERP 极低（<1.5）：股市泡沫，债券有吸引力，不扣分
    # ERP 极高（>6）：股市极具性价比，债券吸引力下降，适度扣分
    # ERP 中性（1.5-6）：不影响评分
    if erp is not None and not np.isnan(erp):
        if erp < 1.5:
            # 股市泡沫，债券相对有吸引力，可以小幅加分
            score += 5
        elif erp > 6:
            # 股市极具性价比，债券吸引力下降
            score -= 10
        # 中间区域不影响评分

    # 【辅助】中美利差变化：使用历史波动率归一化
    # 【优化】同样的bp变化在不同年份意义不同，用z-score归一化
    if spread_change is not None and not np.isnan(spread_change):
        if spread_change_std is not None and not np.isnan(spread_change_std) and spread_change_std > 0:
            # 使用历史波动率归一化（z-score / 2，使±2std映射到±1）
            z_score = spread_change / spread_change_std
            normalized = np.clip(z_score / 2, -1, 1)
        else:
            # 回退到固定阈值
            normalized = spread_change / Config.SPREAD_MAX_CHANGE
            normalized = max(-1, min(1, normalized))
        # 利差收窄（变好）利好债市
        score += normalized * Config.SCORE_LIQUIDITY_PENALTY

    return max(0, min(100, score))


def compute_backtest(df: pd.DataFrame, horizon_days: int = 126) -> dict:
    """基于历史评分做一个简单回测

    horizon_days: 前瞻天数（交易日），默认约 6 个月
    返回按评分分桶后的平均未来收益（%）和单调性检验结果
    
    【优化1】回测目标从"利率变动"升级为"价格/收益"
    使用久期近似计算真实收益，而非仅看利率变动方向
    """
    bt_df = df.copy()

    # 【修复信息泄漏】使用 expanding percentile，只用"当时之前"的数据
    # 最少需要252天（约1年）数据才开始计算分位数
    bt_df["bt_percentile"] = (
        bt_df["yield"]
        .expanding(min_periods=252)
        .apply(lambda x: stats.percentileofscore(x, x.iloc[-1]), raw=False)
    )

    # 计算ERP用于评分
    def _calc_erp(row: pd.Series) -> float | None:
        pe_val = row.get("pe")
        if pd.isna(pe_val) or pe_val <= 0:
            return None
        stock_yield = 100 / float(pe_val)
        return stock_yield - float(row["yield"])

    bt_df["bt_erp"] = bt_df.apply(_calc_erp, axis=1)

    # 计算每日综合评分（忽略技术指标尚未就绪的早期样本）
    def _safe_score(idx: int, row: pd.Series) -> float | None:
        required_cols = ["yield", "MA60", "MACD", "Signal_Line", "RSI", "bt_percentile"]
        if any(pd.isna(row[c]) for c in required_cols):
            return None
        # 计算当前位置的市场状态
        market_regime = detect_market_regime(bt_df, idx)
        return float(
            calculate_composite_score(
                row,
                float(row["bt_percentile"]),
                shibor_change=row.get("shibor_change"),
                erp=row.get("bt_erp"),
                spread_change=row.get("spread_change"),
                market_regime=market_regime,
                shibor_change_std=row.get("shibor_change_std"),
                spread_change_std=row.get("spread_change_std"),
            )
        )

    bt_df["bt_score"] = [_safe_score(i, row) for i, row in bt_df.iterrows()]

    # 【优化1】计算真实收益而非仅利率变动
    # 使用久期近似：收益 ≈ 久期 × (利率变动)
    # 久期随利率水平变化：高利率时久期更长（约8年），低利率时久期较短（约6年）
    bt_df["yield_future"] = bt_df["yield"].shift(-horizon_days)
    bt_df["yield_change"] = bt_df["yield"] - bt_df["yield_future"]  # 正值=利率下降=债券涨
    
    # 动态久期：利率>3%时久期约8年，利率<2%时久期约6年，线性插值
    bt_df["duration"] = np.clip(6 + (bt_df["yield"] - 2) * 2, 5, 10)
    
    # 近似收益（%）= 久期 × 利率变动（%）+ 票息收益（按年化2%估算，horizon_days/252年）
    # 利率变动已经是百分点，直接乘以久期得到近似价格变动百分比
    coupon_return = 2.0 * (horizon_days / 252)  # 年化票息约2%
    bt_df["forward_return"] = bt_df["duration"] * bt_df["yield_change"] + coupon_return
    
    # 同时保留原始bp变动用于参考
    bt_df["forward_yield_change_bp"] = bt_df["yield_change"] * 100.0

    valid = bt_df.dropna(subset=["bt_score", "forward_return"]).copy()

    buckets_def = [(0, 20), (20, 40), (40, 60), (60, 80), (80, 101)]
    buckets: list[dict] = []
    for low, high in buckets_def:
        mask = (valid["bt_score"] >= low) & (valid["bt_score"] < high)
        sub = valid[mask]
        if sub.empty:
            avg_return = None
            avg_yield_change_bp = None
            count = 0
        else:
            avg_return = float(sub["forward_return"].mean())
            avg_yield_change_bp = float(sub["forward_yield_change_bp"].mean())
            count = int(sub.shape[0])
        buckets.append(
            {
                "min_score": low,
                "max_score": 100 if high == 101 else high,
                "count": count,
                "avg_forward_return": avg_return,  # 新增：真实收益（%）
                "avg_forward_yield_change_bp": avg_yield_change_bp,  # 保留：利率变动（bp）
            }
        )

    # 【优化2】单调性体检：检查分数是否真的有用
    # 高分桶的收益应该 >= 低分桶的收益
    valid_returns = [b["avg_forward_return"] for b in buckets if b["avg_forward_return"] is not None]
    is_monotonic = True
    if len(valid_returns) >= 2:
        is_monotonic = all(
            valid_returns[i] <= valid_returns[i + 1]
            for i in range(len(valid_returns) - 1)
        )
    
    # 计算单调性得分：有多少对相邻桶满足单调关系
    monotonic_pairs = 0
    total_pairs = 0
    for i in range(len(valid_returns) - 1):
        total_pairs += 1
        if valid_returns[i] <= valid_returns[i + 1]:
            monotonic_pairs += 1
    monotonic_score = monotonic_pairs / total_pairs if total_pairs > 0 else 1.0

    # 生成评分时间序列（用于折线图）
    score_series = bt_df[["date", "yield", "bt_score"]].dropna(subset=["bt_score"]).copy()
    score_series["date"] = score_series["date"].dt.strftime("%Y-%m-%d")
    score_series = score_series.rename(columns={"bt_score": "score"})
    # 每10天取一个点，减少数据量
    score_series_sampled = score_series.iloc[::10].to_dict(orient="records")

    return {
        "horizon_days": horizon_days,
        "buckets": buckets,
        "is_monotonic": is_monotonic,
        "monotonic_score": monotonic_score,
        "monotonic_msg": "✅ 单调成立，分数可信" if is_monotonic else f"⚠️ 单调性破坏 ({monotonic_pairs}/{total_pairs})，建议审视因子",
        "score_history": score_series_sampled  # 新增：评分历史时间序列
    }

# ==========================================
# 📥 数据获取
# ==========================================

def get_final_data():
    print("🚀 正在启动自动研报版...")
    start_date = (datetime.datetime.now() - datetime.timedelta(days=Config.DATA_YEARS*365)).strftime("%Y%m%d")
    
    # 使用上下文管理器临时禁用 SSL 验证（仅在 akshare 调用期间）
    with disable_ssl_verification():
        # 1. 国债（中美）
        print("📡 1/4 获取中美国债数据...")
        try:
            df_bond_raw = ak.bond_zh_us_rate(start_date=start_date)
            # 中国10年期国债
            df_bond = df_bond_raw[['日期', '中国国债收益率10年']].dropna()
            df_bond.columns = ['date', 'yield']
            df_bond['date'] = pd.to_datetime(df_bond['date'])
            df_bond['yield'] = pd.to_numeric(df_bond['yield'])
            df_bond.sort_values(by='date', inplace=True)
            
            # 美国10年期国债
            df_us_bond = df_bond_raw[['日期', '美国国债收益率10年']].dropna()
            df_us_bond.columns = ['date', 'us_yield']
            df_us_bond['date'] = pd.to_datetime(df_us_bond['date'])
            df_us_bond['us_yield'] = pd.to_numeric(df_us_bond['us_yield'])
            print(f"   ✅ 中美国债数据获取成功")
        except Exception as e:
            print(f"❌ 错误: 国债数据失败 {e}")
            return None

        # 2. 股市
        print("📡 2/4 获取股市估值...")
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
        print("📡 3/4 获取流动性数据...")
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

    # 4. 合并数据（不需要网络请求，在 with 块外执行）
    print("📡 4/4 合并数据...")
    df = pd.merge(df_bond, df_stock, on='date', how='left')
    df = pd.merge(df, df_shibor, on='date', how='left')
    df = pd.merge(df, df_us_bond, on='date', how='left')  # 添加美国国债
    df.ffill(inplace=True)
    
    # 计算中美利差
    df['cn_us_spread'] = df['yield'] - df['us_yield']
    # 计算利差变化（正值=收窄/变好，负值=走阔/变差）
    # 注意：利差变化 = 当前利差 - N天前利差
    # 如果利差从-2.5%变成-2.0%，变化=+0.5%，说明收窄（变好）
    df['spread_change'] = df['cn_us_spread'] - df['cn_us_spread'].shift(Config.SPREAD_LOOKBACK)
    # 【优化】计算利差变化的历史波动率，用于归一化
    df['spread_change_std'] = df['spread_change'].rolling(252).std()
    
    # 计算Shibor变化（正值=收紧，负值=宽松）
    df['shibor_change'] = df['shibor'] - df['shibor'].shift(Config.SHIBOR_LOOKBACK)
    # 【优化】计算Shibor变化的历史波动率，用于归一化
    df['shibor_change_std'] = df['shibor_change'].rolling(252).std()
    print(f"   ✅ 数据合并完成，共 {len(df)} 条记录")
    
    return df, df_bond, df_stock, df_shibor, df_us_bond

# ==========================================
# 📊 主程序逻辑
# ==========================================

def run_system():
    result = get_final_data()
    if result is None: return
    df, df_bond, df_stock, df_shibor, df_us_bond = result

    df = calculate_technical_indicators(df)
    # 先计算一遍全历史回测结果
    backtest = compute_backtest(df)
    last = df.iloc[-1]
    
    recent_df = df[df['date'] > (df.iloc[-1]['date'] - datetime.timedelta(days=Config.DATA_YEARS*365))]
    percentile = stats.percentileofscore(recent_df['yield'], last['yield'])
    
    # 状态判定
    val_status = "🔴 极贵" if percentile < Config.PERCENTILE_EXPENSIVE else ("🟢 便宜" if percentile > Config.PERCENTILE_CHEAP else "⚖️ 适中")
    
    # 计算ERP和宏观状态
    macro_msg = "⚪️ 缺失"
    pe_val_str = "N/A"
    erp = None
    pe_val = last.get('pe')
    if pd.notna(pe_val) and pe_val > 0:
        pe_val_str = f"PE={pe_val:.1f}"
        stock_yield = 100 / pe_val
        erp = stock_yield - last['yield']
        # 状态文字仍然保留，用于展示（但评分用连续值）
        if erp > 5.5: macro_msg = f"⚠️ 股市极具性价比 (ERP={erp:.1f})"
        elif erp < 2.0: macro_msg = f"✅ 股市泡沫 (ERP={erp:.1f})"
        else: macro_msg = f"⚖️ 股债平衡 (ERP={erp:.1f})"
        
    # 流动性变化判定
    liquidity_msg = "⚪️ 缺失"
    shibor_val_str = "N/A"
    shibor_change_str = "N/A"
    shibor_val = last.get('shibor')
    shibor_change = last.get('shibor_change')
    if pd.notna(shibor_val) and shibor_val > 0:
        shibor_val_str = f"{shibor_val:.2f}%"
        if pd.notna(shibor_change):
            shibor_change_str = f"{shibor_change:+.2f}%"
            # 状态文字用于展示，评分用连续值
            if shibor_change > 0.3:
                liquidity_msg = f"🔥 资金收紧 ({shibor_change:+.0f}bp)"
            elif shibor_change < -0.3:
                liquidity_msg = f"💧 资金宽松 ({shibor_change:+.0f}bp)"
            else:
                liquidity_msg = f"⚖️ 资金平稳 ({shibor_change:+.0f}bp)"

    # 中美利差变化判定
    spread_msg = "⚪️ 缺失"
    spread_val_str = "N/A"
    spread_change_str = "N/A"
    us_yield_str = "N/A"
    cn_us_spread = last.get('cn_us_spread')
    spread_change = last.get('spread_change')
    us_yield = last.get('us_yield')
    if pd.notna(cn_us_spread) and pd.notna(us_yield):
        spread_val_str = f"{cn_us_spread:.2f}%"
        us_yield_str = f"{us_yield:.2f}%"
        if pd.notna(spread_change):
            spread_change_str = f"{spread_change:+.2f}%"
            # 状态文字用于展示，评分用连续值
            if spread_change > 0.3:
                spread_msg = f"✅ 利差收窄 ({spread_change:+.0f}bp)"
            elif spread_change < -0.3:
                spread_msg = f"⚠️ 利差走阔 ({spread_change:+.0f}bp)"
            else:
                spread_msg = f"⚖️ 利差平稳 ({spread_change:+.0f}bp)"

    # 检测市场状态
    market_regime = detect_market_regime(df)
    regime_str = "持续偏离" if market_regime["regime"] == "extended" else "均值回归"
    direction_str = "牛市" if market_regime["direction"] == "bull" else "熊市"
    regime_msg = f"{regime_str}({direction_str}, 连续{market_regime['consecutive_days']}天)"
    
    # 使用连续值计算评分
    shibor_change_std = last.get('shibor_change_std')
    spread_change_std = last.get('spread_change_std')
    score = calculate_composite_score(
        last, 
        percentile, 
        shibor_change=shibor_change if pd.notna(shibor_change) else None,
        erp=erp,
        spread_change=spread_change if pd.notna(spread_change) else None,
        market_regime=market_regime,
        shibor_change_std=shibor_change_std if pd.notna(shibor_change_std) else None,
        spread_change_std=spread_change_std if pd.notna(spread_change_std) else None
    )
    
    # 建议：高分 = 值得买入，低分 = 不值得买
    suggestion_con = "" 
    suggestion_agg = "" 
    weather = ""
    if score >= Config.WEATHER_SUNNY:
        weather = "☀️ 烈日 (极好)"
        suggestion_con = "【值得买入】债券便宜，当前是较好的买点，可以大胆建仓。"
        suggestion_agg = "【重仓出击】估值极低，可考虑长久期债基或杠杆债基。"
    elif score >= Config.WEATHER_CLEAR:
        weather = "🌤️ 晴朗 (较好)"
        suggestion_con = "【可以买入】估值合理偏低，适合定投或分批建仓。"
        suggestion_agg = "【逢低加仓】如遇回调，可大胆加仓。"
    elif score >= Config.WEATHER_CLOUDY:
        weather = "☁️ 多云 (震荡)"
        suggestion_con = "【持有观望】估值中性，已持仓可继续持有，新资金暂缓。"
        suggestion_agg = "【小仓试探】可小仓位参与，等待更好机会。"
    elif score >= Config.WEATHER_RAINY:
        weather = "🌧️ 小雨 (较差)"
        suggestion_con = "【暂不建议买入】估值偏贵，建议等待更好的入场时机。"
        suggestion_agg = "【减仓观望】已有持仓可逐步止盈，锁定利润。"
    else:
        weather = "⛈️ 暴雨 (极差)"
        suggestion_con = "【不建议买入】估值过高，风险大于收益，建议回避。"
        suggestion_agg = "【清仓回避】极度高估，转入货币基金等待机会。"

    # 获取脚本所在的绝对根目录
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # 数据目录
    data_dir = os.path.join(script_dir, "data")
    if not os.path.exists(data_dir):
        os.makedirs(data_dir)
        print(f"\n📂 已创建数据文件夹: data")

    # 终端打印
    print("\n" + "█"*60)
    print(f"   🏆 债基晴雨表(Auto-Report)")
    print(f"   日期: {last['date'].strftime('%Y-%m-%d')} | 10年国债收益率: {last['yield']:.4f}%")
    print("█"*60)
    print(f"\n🔮 【综合评分】: {score:.1f} 分  --->  {weather}")
    print(f"📊 【市场状态】: {regime_msg} (趋势因子权重: {market_regime['trend_weight']:.0%})")
    print("-" * 60)
    print(f"💡 操作建议:")
    print(f"   🐢 [稳健型]: {suggestion_con}")
    print(f"   🐇 [激进型]: {suggestion_agg}")
    print("█"*60 + "\n")
    
    # 准备原始数据记录
    bond_records = df_bond[["date","yield"]].copy()
    bond_records["date"] = bond_records["date"].dt.strftime("%Y-%m-%d")
    stock_records = df_stock[["date","pe"]].copy() if set(["date","pe"]).issubset(df_stock.columns) else pd.DataFrame(columns=["date","pe"]) 
    if "date" in stock_records.columns:
        stock_records["date"] = pd.to_datetime(stock_records["date"]).dt.strftime("%Y-%m-%d")
    shibor_records = df_shibor[["date","shibor"]].copy() if set(["date","shibor"]).issubset(df_shibor.columns) else pd.DataFrame(columns=["date","shibor"]) 
    if "date" in shibor_records.columns:
        shibor_records["date"] = pd.to_datetime(shibor_records["date"]).dt.strftime("%Y-%m-%d")
    us_bond_records = df_us_bond[["date","us_yield"]].copy() if set(["date","us_yield"]).issubset(df_us_bond.columns) else pd.DataFrame(columns=["date","us_yield"])
    if "date" in us_bond_records.columns:
        us_bond_records["date"] = pd.to_datetime(us_bond_records["date"]).dt.strftime("%Y-%m-%d")
    
    # 构建导出数据
    data_export = {
        "generated_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
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
            "rsi": float(last['RSI']) if pd.notna(last['RSI']) else None,
            "pe_val": pe_val_str,
            "macro_msg": macro_msg,
            "shibor_val": shibor_val_str,
            "shibor_change": shibor_change_str,
            "liquidity_msg": liquidity_msg,
            "spread_val": spread_val_str,
            "spread_change": spread_change_str,
            "spread_msg": spread_msg,
            "us_yield": us_yield_str,
            "market_regime": {
                "regime": market_regime["regime"],
                "regime_msg": regime_msg,
                "consecutive_days": market_regime["consecutive_days"],
                "trend_weight": market_regime["trend_weight"],
                "direction": market_regime["direction"]
            },
            "suggestion_con": suggestion_con,
            "suggestion_agg": suggestion_agg
        },
        "backtest": backtest,
        "raw": {
            "bond_10y": bond_records.to_dict(orient="records"),
            "stock_pe": stock_records.to_dict(orient="records"),
            "shibor_on": shibor_records.to_dict(orient="records"),
            "us_bond_10y": us_bond_records.to_dict(orient="records")
        }
    }
    
    # 更新汇总文件（按 last_date 去重，同一天只保留最新一次运行）
    # 只有最新一条保留原始数据（用于图表），历史记录只保留结论
    all_ts_path = os.path.join(data_dir, "bondReports.ts")
    try:
        existing_reports = []
        if os.path.exists(all_ts_path):
            with open(all_ts_path, "r", encoding="utf-8") as f:
                content = f.read()
            begin = content.find("[")
            end = content.rfind("]")
            if begin != -1 and end != -1:
                array_str = content[begin:end+1]
                try:
                    existing_reports = json.loads(array_str)
                except json.JSONDecodeError:
                    print("⚠️ 解析现有数据失败，将重新创建")
                    existing_reports = []
        
        # 按 last_date 去重：移除与新数据同一天的旧记录
        new_last_date = data_export["conclusion"]["last_date"]
        filtered_reports = [r for r in existing_reports if r.get("conclusion", {}).get("last_date") != new_last_date]
        
        # 历史记录移除 raw 数据（减少文件大小）
        for report in filtered_reports:
            if "raw" in report:
                del report["raw"]
        
        # 将新数据（包含 raw）插入到最前面
        filtered_reports.insert(0, data_export)
        
        # 按 generated_at 降序排序
        filtered_reports.sort(key=lambda x: x.get("generated_at", ""), reverse=True)
        
        # 生成新的汇总文件
        aggregated = "export const bondReports = " + json.dumps(filtered_reports, ensure_ascii=False, indent=2) + ";\nexport default bondReports;\n"
        with open(all_ts_path, "w", encoding="utf-8") as f:
            f.write(aggregated)
        print(f"✅ 汇总数据已更新: {all_ts_path} (共 {len(filtered_reports)} 条记录)")
    except Exception as e:
        print(f"❌ 汇总数据更新失败: {e}")

if __name__ == "__main__":
    run_system()
