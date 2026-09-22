// 全站计数格式化：≥10亿 用 B，≥100万 用 M，其余千分位。
// 接近 10 亿（≥999.5M）直接进 B 档，避免出现 1000M。
export function fmtCount(value) {
  const n = Number(value || 0);
  if (n / 1e9 >= 0.9995) return `${Number((n / 1e9).toFixed(2))}B`;
  if (n >= 1e6) return `${Number((n / 1e6).toFixed(2))}M`;
  return n.toLocaleString();
}
