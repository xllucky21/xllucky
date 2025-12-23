/**
 * 红利股票工具箱 - 数据导入（合并版）
 */

import { dividendData } from '../data/dividendData';

// 导出合并后的数据
export { dividendData };

// 兼容旧接口：从合并数据中提取
export const dividendReports = dividendData.map(item => ({
  generated_at: item.generated_at,
  conclusion: item.index?.conclusion,
  score_history: item.index?.score_history,
  raw: item.index?.raw,
})).filter(item => item.conclusion);

export const stocksData = dividendData[0] ? {
  generated_at: dividendData[0].generated_at,
  bond_yield: dividendData[0].bond_yield,
  stocks: dividendData[0].stocks,
} : null;
