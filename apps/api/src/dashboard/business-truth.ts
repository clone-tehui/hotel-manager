export const VN_TIME_ZONE = 'Asia/Ho_Chi_Minh';
export const VN_TZ_OFFSET_HOURS = 7;
export const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type BusinessPeriodKey = 'thisWeek' | 'nextWeek' | 'thisMonth' | 'nextMonth';
export type BusinessPeriod = {
  key: BusinessPeriodKey;
  title: string;
  from: string;
  to: string;
  kind: 'week' | 'month';
};

export function vnDate(year: number, month: number, day: number, hour = 0, minute = 0, second = 0) {
  return new Date(Date.UTC(year, month - 1, day, hour - VN_TZ_OFFSET_HOURS, minute, second, 0));
}

export function getVnParts(date = new Date()) {
  const vn = new Date(date.getTime() + VN_TZ_OFFSET_HOURS * 60 * 60 * 1000);
  return { year: vn.getUTCFullYear(), month: vn.getUTCMonth() + 1, day: vn.getUTCDate(), weekday: vn.getUTCDay() };
}

export function dateKey(parts: { year: number; month: number; day: number }) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function addCalendarDays(parts: { year: number; month: number; day: number }, days: number) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

export function endOfCalendarMonth(parts: { year: number; month: number }) {
  const date = new Date(Date.UTC(parts.year, parts.month, 0));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

export function businessPeriods(now = new Date()): BusinessPeriod[] {
  const current = getVnParts(now);
  const mondayOffset = current.weekday === 0 ? -6 : 1 - current.weekday;
  const monday = addCalendarDays(current, mondayOffset);
  const nextMonthStart = current.month === 12
    ? { year: current.year + 1, month: 1, day: 1 }
    : { year: current.year, month: current.month + 1, day: 1 };
  const periods: BusinessPeriod[] = [
    { key: 'thisWeek', title: 'Tuần này', from: dateKey(monday), to: dateKey(addCalendarDays(monday, 6)), kind: 'week' },
    { key: 'nextWeek', title: 'Tuần sau', from: dateKey(addCalendarDays(monday, 7)), to: dateKey(addCalendarDays(monday, 13)), kind: 'week' },
    { key: 'thisMonth', title: 'Tháng này', from: dateKey({ year: current.year, month: current.month, day: 1 }), to: dateKey(endOfCalendarMonth(current)), kind: 'month' },
  ];
  if (current.day >= 15) periods.push({ key: 'nextMonth', title: 'Tháng sau', from: dateKey(nextMonthStart), to: dateKey(endOfCalendarMonth(nextMonthStart)), kind: 'month' });
  return periods;
}

export function startOfVnDay(date: Date) {
  const parts = getVnParts(date);
  return vnDate(parts.year, parts.month, parts.day);
}

export function overlapNights(rangeStart: Date, rangeEnd: Date, checkIn: Date, checkOut: Date) {
  const start = Math.max(rangeStart.getTime(), startOfVnDay(checkIn).getTime());
  const end = Math.min(rangeEnd.getTime(), startOfVnDay(checkOut).getTime());
  if (end <= start) return 0;
  return Math.round((end - start) / MS_PER_DAY);
}

export function occupancyRate(bookedSellableNights: number, availableSellableNights: number) {
  if (availableSellableNights <= 0) return null;
  return Number(((bookedSellableNights / availableSellableNights) * 100).toFixed(1));
}

export function bookedNightRevenue(pricePerNight: unknown, overlappingBookedNights: number) {
  return Number(pricePerNight ?? 0) * Math.max(0, overlappingBookedNights);
}

export function breakEvenMetrics(monthlyCost: unknown, bookedRevenue: number, bookedNights: number, remainingSellableNights: number) {
  if (monthlyCost == null) return { monthlyCost: null, bookedRevenue, profit: null, revenueGap: null, breakEvenRevenue: null, breakEvenNights: null, bookedNights, remainingSellableNights, requiredADRToBreakEven: null, breakEvenReached: null, margin: null };
  const cost = Number(monthlyCost);
  const profit = bookedRevenue - cost;
  const revenueGap = Math.max(0, cost - bookedRevenue);
  const achievedAdr = bookedNights > 0 ? bookedRevenue / bookedNights : null;
  const breakEvenNights = achievedAdr && achievedAdr > 0 ? Math.ceil(cost / achievedAdr) : null;
  const requiredADRToBreakEven = revenueGap > 0 && remainingSellableNights > 0 ? revenueGap / remainingSellableNights : revenueGap === 0 ? 0 : null;
  return { monthlyCost: cost, bookedRevenue, profit, revenueGap, breakEvenRevenue: cost, breakEvenNights, bookedNights, remainingSellableNights, requiredADRToBreakEven, breakEvenReached: bookedRevenue >= cost, margin: cost > 0 ? profit / cost : null };
}
