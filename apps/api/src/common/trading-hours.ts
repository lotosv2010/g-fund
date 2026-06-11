/**
 * A 股交易时间判断
 * 上午 9:30~11:30，下午 13:00~15:00，周一至周五
 */
export function isTradingHours(now: Date = new Date()): boolean {
  const day = now.getDay();
  if (day === 0 || day === 6) return false;

  const hhmm = now.getHours() * 100 + now.getMinutes();
  return (hhmm >= 930 && hhmm <= 1130) || (hhmm >= 1300 && hhmm <= 1500);
}
