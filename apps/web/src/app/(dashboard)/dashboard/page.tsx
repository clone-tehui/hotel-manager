'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import HotelIcon from '@mui/icons-material/Hotel';
import LogoutIcon from '@mui/icons-material/Logout';
import LoginIcon from '@mui/icons-material/Login';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import PeopleIcon from '@mui/icons-material/People';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import ApartmentIcon from '@mui/icons-material/Apartment';
import PublicIcon from '@mui/icons-material/Public';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import QueryStatsIcon from '@mui/icons-material/QueryStats';
import PieChartOutlineIcon from '@mui/icons-material/PieChartOutline';
import BarChartIcon from '@mui/icons-material/BarChart';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import dayjs from 'dayjs';
import quarterOfYear from 'dayjs/plugin/quarterOfYear';
import 'dayjs/locale/vi';
import { useAiCeoCampaigns, useDashboardReport, useDashboardSummary } from '@/hooks/api';
import { StatusChip } from '@/components/common/StatusChip';
import { ReservationDrawer } from '@/components/reservation/ReservationDrawer';

dayjs.locale('vi');
dayjs.extend(quarterOfYear);

type ChartMode = 'pie' | 'bar';
type SourcePeriodMode = 'week' | 'month' | 'quarter' | 'year';

function formatCurrency(value?: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value ?? 0);
}

function formatCompactCurrency(value?: number) {
  return new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 }).format(value ?? 0);
}

type OccupancyStrategyPeriod = 'thisWeek' | 'nextWeek' | 'thisMonth' | 'nextMonth';

type StrategyPeriodConfig = {
  key: OccupancyStrategyPeriod;
  title: string;
  subtitle: string;
  from: string;
  to: string;
  kind: 'week' | 'month';
};

function getMonday(date: dayjs.Dayjs) {
  return date.day() === 0 ? date.subtract(6, 'day').startOf('day') : date.subtract(date.day() - 1, 'day').startOf('day');
}

function getOccupancyStrategyPeriods(now = dayjs()): StrategyPeriodConfig[] {
  const monday = getMonday(now);
  const thisMonth = now.startOf('month');
  const nextMonth = now.add(1, 'month').startOf('month');
  const periods: StrategyPeriodConfig[] = [
    { key: 'thisWeek', title: 'Tuần này', subtitle: 'Kỳ được chốt từ Thứ Hai đầu tuần', from: monday.format('YYYY-MM-DD'), to: monday.add(6, 'day').format('YYYY-MM-DD'), kind: 'week' },
    { key: 'nextWeek', title: 'Tuần sau', subtitle: 'Kỳ kế tiếp, bắt đầu từ Thứ Hai', from: monday.add(7, 'day').format('YYYY-MM-DD'), to: monday.add(13, 'day').format('YYYY-MM-DD'), kind: 'week' },
    { key: 'thisMonth', title: 'Tháng này', subtitle: 'Kỳ được chốt từ ngày 01 hằng tháng', from: thisMonth.format('YYYY-MM-DD'), to: thisMonth.endOf('month').format('YYYY-MM-DD'), kind: 'month' },
  ];
  // Tháng sau chỉ được theo dõi từ ngày 15 của tháng hiện tại.
  if (now.date() >= 15) {
    periods.push({ key: 'nextMonth', title: 'Tháng sau', subtitle: 'Kỳ được kích hoạt từ ngày 15 hằng tháng', from: nextMonth.format('YYYY-MM-DD'), to: nextMonth.endOf('month').format('YYYY-MM-DD'), kind: 'month' });
  }
  return periods;
}

type RoomPricingStrategy = {
  level: 'Đỏ' | 'Vàng' | 'Xanh' | 'Chờ giá vốn';
  color: 'error' | 'warning' | 'success' | 'default';
  text: string;
  action: string;
  review: string;
};

function getRoomPricingStrategy(room: any, currentMonthRoom: any, kind: 'week' | 'month'): RoomPricingStrategy {
  const total = Number(room.totalNightsInPeriod ?? 0);
  const occupied = Number(room.occupiedNights ?? 0);
  const vacant = Math.max(0, total - occupied);
  const rate = Number(room.occupancyRate ?? 0);
  const currentRevenue = Number(currentMonthRoom?.bookedNightRevenue ?? 0);
  const monthlyCost = currentMonthRoom?.monthlyCost;
  const hasCost = monthlyCost !== null && monthlyCost !== undefined && Number(monthlyCost) > 0;
  const brokeEven = hasCost && currentRevenue >= Number(monthlyCost);
  const reachedHalf = total > 0 && occupied / total >= 0.5;
  const periodIsRisky = kind === 'week' ? vacant >= 2 : rate < 70;

  if (occupied === 0) {
    return { level: 'Đỏ', color: 'error', action: 'Lấy booking đầu tiên', text: 'Căn chưa có booking trong kỳ; ưu tiên thử nhu cầu/kênh/ưu đãi trước, chưa dùng hoàn vốn làm điều kiện.', review: 'Chạy một thử nghiệm có thời hạn 3 ngày; nếu vẫn 0 booking thì đổi một biến chiến dịch và kiểm lại.' };
  }
  if (!hasCost) {
    return { level: 'Chờ giá vốn', color: 'default', action: 'Tiếp tục tăng tín hiệu booking', text: 'Căn đã có booking nhưng chưa đủ dữ liệu giá vốn để tối ưu hòa vốn tháng.', review: 'Tiếp tục chiến dịch theo booked-night pace; bổ sung giá vốn trước pha phục hồi giá.' };
  }
  if (brokeEven && vacant > 0) {
    return { level: 'Xanh', color: 'success', action: 'Đề xuất giảm 30–40% cho các đêm trống', text: 'Căn đã hoàn vốn trong tháng hiện tại; ưu tiên lấp đầy để tối đa lợi nhuận.', review: 'Đánh giá lại sau 3 ngày; chỉ áp dụng khi người quản lý duyệt.' };
  }
  if (!brokeEven && reachedHalf) {
    return { level: 'Vàng', color: 'warning', action: 'Dừng giảm sâu, tăng giá dần về giá chuẩn', text: `Đã book ${occupied}/${total} đêm của kỳ (≥50%) nhưng tháng hiện tại còn thiếu ${Math.max(0, Number(monthlyCost) - currentRevenue).toLocaleString('vi-VN')}đ để hoàn vốn.`, review: 'Đánh giá lại sau 3 ngày; ưu tiên giá giúp bù phần còn thiếu.' };
  }
  if (!brokeEven && periodIsRisky) {
    return { level: 'Đỏ', color: 'error', action: 'Đề xuất giảm 30–40% cho các đêm trống', text: `Chưa hoàn vốn tháng hiện tại, còn thiếu ${Math.max(0, Number(monthlyCost) - currentRevenue).toLocaleString('vi-VN')}đ; kỳ này còn ${vacant}/${total} đêm trống.`, review: 'Chạy thử 3 ngày sau khi duyệt; đo số đêm book mới của chính căn này.' };
  }
  return { level: 'Vàng', color: 'warning', action: 'Giữ giá, ưu đãi theo gói 3–7 đêm', text: 'Chưa hoàn vốn nhưng mức trống chưa cần giảm sâu; ưu tiên booking dài hơn để bảo vệ doanh thu.', review: 'Đánh giá lại sau 3 ngày hoặc khi có booking/hủy mới.' };
}


function DeltaChip({ value }: { value?: number }) {
  const numeric = Number(value ?? 0);
  const positive = numeric >= 0;
  return (
    <Chip
      size="small"
      color={positive ? 'success' : 'error'}
      icon={positive ? <TrendingUpIcon /> : <TrendingDownIcon />}
      label={`${positive ? '+' : ''}${numeric}%`}
      variant="outlined"
      sx={{ fontWeight: 700 }}
    />
  );
}

const GENDER_COLORS: Record<string, string> = {
  MALE: '#2563EB',
  FEMALE: '#EC4899',
  NON_BINARY: '#8B5CF6',
};

function StatCard({ label, value, sub, icon, color = '#2563EB', onClick }: any) {
  return (
    <Paper
      variant="outlined"
      onClick={onClick}
      sx={{
        p: 2,
        borderRadius: 2,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        '&:hover': onClick ? { transform: 'translateY(-1px)', boxShadow: 3 } : undefined,
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Box sx={{ width: 46, height: 46, borderRadius: 2, bgcolor: color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h5" fontWeight={800} lineHeight={1.1}>{value}</Typography>
          <Typography variant="body2" fontWeight={700}>{label}</Typography>
          {sub ? <Typography variant="caption" color="text.secondary">{sub}</Typography> : null}
        </Box>
      </Stack>
    </Paper>
  );
}

function SectionCard({ title, sub, children, icon, action }: any) {
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, height: '100%' }}>
      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" mb={1.5}>
        <Stack direction="row" spacing={1} alignItems="center">
          {icon}
          <Box>
            <Typography variant="subtitle1" fontWeight={800}>{title}</Typography>
            {sub ? <Typography variant="caption" color="text.secondary">{sub}</Typography> : null}
          </Box>
        </Stack>
        {action}
      </Stack>
      {children}
    </Paper>
  );
}

function SimpleBarChart({ items, valueKey, labelKey, color = '#2563EB', suffix = '', formatter }: any) {
  const max = useMemo(() => Math.max(...items.map((item: any) => Number(item[valueKey] ?? 0)), 0), [items, valueKey]);
  if (!items.length) return <Typography variant="body2" color="text.secondary">Chưa có dữ liệu</Typography>;
  return (
    <Stack spacing={1.2}>
      {items.map((item: any) => {
        const raw = Number(item[valueKey] ?? 0);
        const width = max > 0 ? Math.max(6, (raw / max) * 100) : 0;
        return (
          <Box key={`${item[labelKey]}-${raw}`}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.4} gap={1}>
              <Typography variant="body2" fontWeight={600} noWrap>{item[labelKey]}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                {formatter ? formatter(raw, item) : `${raw}${suffix}`}
              </Typography>
            </Stack>
            <Box sx={{ height: 10, borderRadius: 99, bgcolor: 'action.hover', overflow: 'hidden' }}>
              <Box sx={{ width: `${width}%`, height: '100%', bgcolor: color, borderRadius: 99 }} />
            </Box>
          </Box>
        );
      })}
    </Stack>
  );
}

function MonthlyTrendChart({ items }: any) {
  const max = useMemo(() => Math.max(...items.map((item: any) => Number(item.revenue ?? 0)), 0), [items]);
  if (!items.length) return <Typography variant="body2" color="text.secondary">Chưa có dữ liệu doanh thu</Typography>;
  return (
    <Stack direction="row" alignItems="flex-end" spacing={1} sx={{ minHeight: 220, overflowX: 'auto', pt: 1 }}>
      {items.map((item: any) => {
        const height = max > 0 ? Math.max(18, (Number(item.revenue ?? 0) / max) * 170) : 18;
        return (
          <Stack key={item.label} spacing={0.75} alignItems="center" sx={{ minWidth: 56 }}>
            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
              {formatCompactCurrency(item.revenue)}
            </Typography>
            <Box sx={{ width: 30, height, borderRadius: '10px 10px 0 0', bgcolor: '#2563EB' }} />
            <Typography variant="caption" fontWeight={700}>{item.label}</Typography>
            <Typography variant="caption" color="text.secondary">{item.bookings} booking</Typography>
          </Stack>
        );
      })}
    </Stack>
  );
}

function OccupancyGauge({ occupied, total, percentage }: { occupied?: number; total?: number; percentage?: number }) {
  const pct = Math.max(0, Math.min(100, Number(percentage ?? 0)));
  const color = pct >= 80 ? '#DC2626' : pct >= 60 ? '#D97706' : pct >= 40 ? '#2563EB' : '#16A34A';
  const size = 180;
  const stroke = 16;
  const radius = (size - stroke) / 2;
  const circumference = Math.PI * radius;
  const dashOffset = circumference * (1 - pct / 100);

  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.5} alignItems="center">
      <Box sx={{ position: 'relative', width: size, height: size / 2 + 18, flexShrink: 0 }}>
        <svg width={size} height={size / 2 + 18} viewBox={`0 0 ${size} ${size / 2 + 18}`}>
          <path d={`M ${stroke / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - stroke / 2} ${size / 2}`} fill="none" stroke="#E5E7EB" strokeWidth={stroke} strokeLinecap="round" />
          <path d={`M ${stroke / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - stroke / 2} ${size / 2}`} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={dashOffset} />
        </svg>
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pt: 3 }}>
          <Typography variant="h4" fontWeight={900} lineHeight={1}>{pct}%</Typography>
          <Typography variant="body2" color="text.secondary" fontWeight={700}>{occupied ?? 0} / {total ?? 0}</Typography>
        </Box>
      </Box>
      <Stack spacing={1} sx={{ width: '100%' }}>
        <Chip label={pct >= 80 ? 'Công suất rất cao' : pct >= 60 ? 'Công suất cao' : pct >= 40 ? 'Công suất ổn' : 'Công suất thấp'} sx={{ bgcolor: color, color: '#fff', fontWeight: 800, width: 'fit-content' }} />
        <Typography variant="body2" color="text.secondary">Đang có khách / tổng căn đang hoạt động</Typography>
        <Typography variant="h6" fontWeight={800}>{occupied ?? 0} / {total ?? 0} căn</Typography>
        <Typography variant="caption" color="text.secondary">Màu sẽ đổi theo mức độ lấp đầy để nhìn nhanh tình hình vận hành.</Typography>
      </Stack>
    </Stack>
  );
}

function PieChartBlock({ items, labelKey, valueKey, formatter }: any) {
  const total = items.reduce((sum: number, item: any) => sum + Number(item[valueKey] ?? 0), 0);
  const colors = ['#2563EB', '#7C3AED', '#EA580C', '#16A34A', '#DC2626', '#0891B2', '#9333EA', '#CA8A04'];
  let currentAngle = -90;
  if (!items.length || !total) return <Typography variant="body2" color="text.secondary">Chưa có dữ liệu</Typography>;

  const segments = items.slice(0, 8).map((item: any, index: number) => {
    const value = Number(item[valueKey] ?? 0);
    const angle = (value / total) * 360;
    const startAngle = currentAngle;
    currentAngle += angle;
    const largeArc = angle > 180 ? 1 : 0;
    const startX = 50 + 40 * Math.cos((Math.PI / 180) * startAngle);
    const startY = 50 + 40 * Math.sin((Math.PI / 180) * startAngle);
    const endX = 50 + 40 * Math.cos((Math.PI / 180) * currentAngle);
    const endY = 50 + 40 * Math.sin((Math.PI / 180) * currentAngle);
    const path = `M 50 50 L ${startX} ${startY} A 40 40 0 ${largeArc} 1 ${endX} ${endY} Z`;
    return { path, color: colors[index % colors.length], item, value };
  });

  return (
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', md: 'center' }}>
      <Box sx={{ width: 220, height: 220, flexShrink: 0 }}>
        <svg viewBox="0 0 100 100" width="220" height="220">
          {segments.map((segment, index) => (
            <path key={index} d={segment.path} fill={segment.color} stroke="#fff" strokeWidth="1" />
          ))}
          <circle cx="50" cy="50" r="20" fill="#fff" />
          <text x="50" y="47" textAnchor="middle" fontSize="7" fill="#111827">Tổng</text>
          <text x="50" y="55" textAnchor="middle" fontSize="7" fill="#111827">{total}</text>
        </svg>
      </Box>
      <Stack spacing={1.2} sx={{ width: '100%' }}>
        {segments.map((segment, index) => (
          <Stack key={index} direction="row" spacing={1} alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
              <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: segment.color, flexShrink: 0 }} />
              <Typography variant="body2" noWrap>{segment.item[labelKey]}</Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary">{formatter ? formatter(segment.value, segment.item) : segment.value}</Typography>
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
}

function RevenueReportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const today = dayjs();
  const [from, setFrom] = useState(today.startOf('month').format('YYYY-MM-DD'));
  const [to, setTo] = useState(today.format('YYYY-MM-DD'));
  const [applied, setApplied] = useState({ from: today.startOf('month').format('YYYY-MM-DD'), to: today.format('YYYY-MM-DD') });
  const [chartMode, setChartMode] = useState<ChartMode>('bar');
  const { data, isLoading, isFetching } = useDashboardReport(applied, open);
  const report = data?.data;
  const chartItems = report?.revenue?.bySource ?? [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>Báo cáo doanh thu chi tiết</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField label="Từ ngày" type="date" value={from} onChange={(e) => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
            <TextField label="Đến ngày" type="date" value={to} onChange={(e) => setTo(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
            <Button variant="contained" onClick={() => setApplied({ from, to })} sx={{ minWidth: 140 }}>Tạo báo cáo</Button>
          </Stack>

          <ToggleButtonGroup value={chartMode} exclusive onChange={(_, value) => value && setChartMode(value)} size="small">
            <ToggleButton value="bar"><BarChartIcon fontSize="small" sx={{ mr: 1 }} />Biểu đồ cột</ToggleButton>
            <ToggleButton value="pie"><PieChartOutlineIcon fontSize="small" sx={{ mr: 1 }} />Biểu đồ tròn</ToggleButton>
          </ToggleButtonGroup>

          {isLoading || isFetching ? (
            <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box>
          ) : report ? (
            <Stack spacing={3}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}><StatCard label="Tổng doanh thu" value={formatCurrency(report.revenue.total)} sub={`${report.revenue.bookings} booking`} icon={<TrendingUpIcon />} color="#2563EB" /></Grid>
                <Grid item xs={12} md={4}><StatCard label="TB / booking" value={formatCurrency(report.revenue.avgBookingValue)} sub="Giá trị trung bình" icon={<QueryStatsIcon />} color="#7C3AED" /></Grid>
                <Grid item xs={12} md={4}><StatCard label="TB số đêm" value={`${report.revenue.avgStayNights} đêm`} sub="Theo booking" icon={<HotelIcon />} color="#D97706" /></Grid>
              </Grid>

              <SectionCard title="Cơ cấu doanh thu / booking theo nguồn" sub="Chuyển đổi giữa biểu đồ cột và biểu đồ tròn" icon={<TravelExploreIcon color="primary" fontSize="small" />}>
                {chartMode === 'bar' ? (
                  <SimpleBarChart items={chartItems} valueKey="bookings" labelKey="label" color="#2563EB" formatter={(raw: number, item: any) => `${raw} booking · ${item.percentage}%`} />
                ) : (
                  <PieChartBlock items={chartItems} valueKey="bookings" labelKey="label" formatter={(raw: number, item: any) => `${raw} booking · ${item.percentage}%`} />
                )}
              </SectionCard>

              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <SectionCard title="Doanh thu theo ngày check-in" sub="Dùng để xem ngày nào tạo doanh thu tốt" icon={<BarChartIcon color="primary" fontSize="small" />}>
                    <SimpleBarChart items={report.revenue.byDay} valueKey="revenue" labelKey="date" color="#EA580C" formatter={(raw: number) => formatCompactCurrency(raw)} />
                  </SectionCard>
                </Grid>
                <Grid item xs={12} md={6}>
                  <SectionCard title="Đặc điểm booking nổi bật" sub="Giúp nhìn nhanh căn nào dễ bán do yếu tố nào" icon={<QueryStatsIcon color="primary" fontSize="small" />}>
                    <Stack spacing={1.5}>
                      <Typography variant="body2">Nguồn booking mạnh nhất: <strong>{report.insights.topSource?.label ?? '—'}</strong></Typography>
                      <Typography variant="body2">Toà nhà mạnh nhất: <strong>{report.insights.topBuilding?.label ?? '—'}</strong></Typography>
                      <Typography variant="body2">Loại phòng mạnh nhất: <strong>{report.insights.topRoomType?.label ?? '—'}</strong></Typography>
                      <Typography variant="body2">Căn được booking nhiều nhất: <strong>{report.insights.topRoom?.roomNumber ?? '—'}</strong> ({report.insights.topRoom?.building ?? '—'})</Typography>
                    </Stack>
                  </SectionCard>
                </Grid>
              </Grid>            </Stack>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Đóng</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [revenueExpanded, setRevenueExpanded] = useState(false);
  const [occupancyExpanded, setOccupancyExpanded] = useState(false);
  // AI strategy output must be visible immediately; detailed campaign state is not hidden behind a collapsed panel.
  const [strategyExpanded, setStrategyExpanded] = useState<Record<string, boolean>>({ thisWeek: true });
  const [sourcePeriod, setSourcePeriod] = useState<SourcePeriodMode>('month');
  const [occupancyPeriod, setOccupancyPeriod] = useState<SourcePeriodMode>('month');
  const { data, isLoading } = useDashboardSummary();
  const occupancyRange = useMemo(() => {
    const now = dayjs();
    if (occupancyPeriod === 'week') {
      const monday = now.day() === 0 ? now.subtract(6, 'day') : now.day() === 1 ? now : now.subtract(now.day() - 1, 'day');
      const sunday = monday.add(6, 'day');
      return { from: monday.format('YYYY-MM-DD'), to: sunday.format('YYYY-MM-DD') };
    }
    if (occupancyPeriod === 'month') {
      return { from: now.startOf('month').format('YYYY-MM-DD'), to: now.endOf('month').format('YYYY-MM-DD') };
    }
    if (occupancyPeriod === 'quarter') {
      return { from: now.startOf('quarter').format('YYYY-MM-DD'), to: now.endOf('quarter').format('YYYY-MM-DD') };
    }
    return { from: now.startOf('year').format('YYYY-MM-DD'), to: now.endOf('year').format('YYYY-MM-DD') };
  }, [occupancyPeriod]);
  const { data: occupancyReportData, isLoading: isOccupancyLoading, isFetching: isOccupancyFetching } = useDashboardReport(occupancyRange);
  const strategyPeriods = useMemo(() => getOccupancyStrategyPeriods(), []);
  const thisWeekStrategy = strategyPeriods.find((period) => period.key === 'thisWeek')!;
  const nextWeekStrategy = strategyPeriods.find((period) => period.key === 'nextWeek')!;
  const thisMonthStrategy = strategyPeriods.find((period) => period.key === 'thisMonth')!;
  const nextMonthStrategy = strategyPeriods.find((period) => period.key === 'nextMonth');
  const { data: thisWeekStrategyData, isLoading: isThisWeekStrategyLoading } = useDashboardReport({ from: thisWeekStrategy.from, to: thisWeekStrategy.to });
  const { data: nextWeekStrategyData, isLoading: isNextWeekStrategyLoading } = useDashboardReport({ from: nextWeekStrategy.from, to: nextWeekStrategy.to });
  const { data: thisMonthStrategyData, isLoading: isThisMonthStrategyLoading } = useDashboardReport({ from: thisMonthStrategy.from, to: thisMonthStrategy.to });
  const { data: aiCampaignData } = useAiCeoCampaigns();
  const { data: nextMonthStrategyData, isLoading: isNextMonthStrategyLoading } = useDashboardReport(nextMonthStrategy ? { from: nextMonthStrategy.from, to: nextMonthStrategy.to } : undefined, !!nextMonthStrategy);
  const sourceRange = useMemo(() => {
    const now = dayjs();
    if (sourcePeriod === 'week') {
      const monday = now.day() === 0 ? now.subtract(6, 'day') : now.day() === 1 ? now : now.subtract(now.day() - 1, 'day');
      const sunday = monday.add(6, 'day');
      return { from: monday.format('YYYY-MM-DD'), to: sunday.format('YYYY-MM-DD') };
    }
    if (sourcePeriod === 'month') {
      return { from: now.startOf('month').format('YYYY-MM-DD'), to: now.endOf('month').format('YYYY-MM-DD') };
    }
    if (sourcePeriod === 'quarter') {
      return { from: now.startOf('quarter').format('YYYY-MM-DD'), to: now.endOf('quarter').format('YYYY-MM-DD') };
    }
    return { from: now.startOf('year').format('YYYY-MM-DD'), to: now.endOf('year').format('YYYY-MM-DD') };
  }, [sourcePeriod]);
  const { data: sourceReportData, isLoading: isSourceReportLoading, isFetching: isSourceReportFetching } = useDashboardReport(sourceRange);
  const summary = data?.data;

  if (isLoading && !summary) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  const rooms = summary?.rooms ?? {};
  const reservations = summary?.reservations ?? {};
  const guests = summary?.guests ?? {};
  const revenue = summary?.revenue ?? {};
  const analytics = summary?.analytics ?? {};
  const recent: any[] = summary?.recent ?? [];
  const occupancyReport = occupancyReportData?.data;
  const genderBreakdown: any[] = analytics.genderBreakdown ?? [];
  const trackedGenderTotal = genderBreakdown.reduce((sum: number, item: any) => sum + Number(item.count ?? 0), 0);
  const filteredSourceBreakdown = sourceReportData?.data?.revenue?.bySource ?? [];
  const occupancyRooms: any[] = occupancyReport?.occupancy?.byRoom ?? [];
  const occupancyRoomCount = occupancyRooms.length;
  const occupancyBands = {
    above50: occupancyRooms.filter((room: any) => Number(room.occupancyRate ?? 0) >= 50).length,
    above60: occupancyRooms.filter((room: any) => Number(room.occupancyRate ?? 0) >= 60).length,
    above70: occupancyRooms.filter((room: any) => Number(room.occupancyRate ?? 0) >= 70).length,
    below50: occupancyRooms.filter((room: any) => Number(room.occupancyRate ?? 0) < 50).length,
  };
  const aiCampaigns: any[] = aiCampaignData?.data ?? aiCampaignData ?? [];
  // The API order is not a UI contract. Select the newest assessment explicitly so
  // a completed fresh run replaces an older campaign for the same room-period.
  const latestAiCampaign = new Map<string, any>();
  aiCampaigns.forEach((campaign: any) => {
    const key = `${campaign.roomId}:${campaign.periodKey}`;
    const prior = latestAiCampaign.get(key);
    const candidateAt = new Date(campaign.outputGeneratedAt ?? campaign.createdAt ?? 0).getTime();
    const priorAt = new Date(prior?.outputGeneratedAt ?? prior?.createdAt ?? 0).getTime();
    if (!prior || candidateAt >= priorAt) latestAiCampaign.set(key, campaign);
  });
  const latestAiCampaignValues = Array.from(latestAiCampaign.values());
  const currentAiCampaignCount = latestAiCampaignValues.filter((campaign: any) => campaign.periodKey === 'thisWeek').length;
  const latestAiAssessmentAt = latestAiCampaignValues.reduce((latest: string | null, campaign: any) => { const candidate = campaign.outputGeneratedAt || campaign.createdAt || campaign.updatedAt; return candidate && (!latest || new Date(candidate) > new Date(latest)) ? candidate : latest; }, null);
  const strategyReports = [
    { period: thisWeekStrategy, report: thisWeekStrategyData?.data, loading: isThisWeekStrategyLoading },
    { period: nextWeekStrategy, report: nextWeekStrategyData?.data, loading: isNextWeekStrategyLoading },
    { period: thisMonthStrategy, report: thisMonthStrategyData?.data, loading: isThisMonthStrategyLoading },
    ...(nextMonthStrategy ? [{ period: nextMonthStrategy, report: nextMonthStrategyData?.data, loading: isNextMonthStrategyLoading }] : []),
  ];

  return (
    <Box sx={{ p: { xs: 2, md: 3, lg: 4 } }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} mb={3} gap={1}>
        <Box>
          <Typography variant="h5" fontWeight={800}>Dashboard nội bộ</Typography>
          <Typography variant="body2" color="text.secondary">
            {dayjs().format('dddd, DD/MM/YYYY HH:mm')} · cập nhật {summary?.generatedAt ? dayjs(summary.generatedAt).format('HH:mm:ss') : '—'}
          </Typography>
        </Box>
        <Chip label={`Công suất hiện tại ${rooms.occupancyRate ?? 0}%`} color="primary" variant="outlined" />
      </Stack>

      <Grid container spacing={2} mb={3}>
        <Grid item xs={12}>
          <SectionCard title="Tình trạng vận hành" sub="Ảnh chụp nhanh nội bộ" icon={<ApartmentIcon color="primary" fontSize="small" />}>
            <Stack spacing={1.6}>
              <OccupancyGauge occupied={rooms.occupied} total={rooms.total} percentage={rooms.occupancyRate} />
              <Divider />
              <Grid container spacing={1.5}>
                <Grid item xs={12} sm={6} md={3}><Stack direction="row" justifyContent="space-between"><Typography variant="body2">Căn đang giữ chỗ</Typography><Typography fontWeight={700}>{rooms.reserved ?? 0}</Typography></Stack></Grid>
                <Grid item xs={12} sm={6} md={3}><Stack direction="row" justifyContent="space-between"><Typography variant="body2">Căn trống sẵn</Typography><Typography fontWeight={700}>{rooms.available ?? 0}</Typography></Stack></Grid>
                <Grid item xs={12} sm={6} md={3}><Stack direction="row" justifyContent="space-between"><Typography variant="body2">Căn bảo trì</Typography><Typography fontWeight={700}>{rooms.maintenance ?? 0}</Typography></Stack></Grid>
                <Grid item xs={12} sm={6} md={3}><Stack direction="row" justifyContent="space-between"><Typography variant="body2">Tổng hồ sơ khách</Typography><Typography fontWeight={700}>{guests.total ?? 0}</Typography></Stack></Grid>
                <Grid item xs={12} sm={6} md={3}><Stack direction="row" justifyContent="space-between"><Typography variant="body2">Số quốc tịch đã ghi nhận</Typography><Typography fontWeight={700}>{guests.nationalitiesTracked ?? 0}</Typography></Stack></Grid>
                <Grid item xs={12} sm={6} md={3}><Stack direction="row" justifyContent="space-between"><Typography variant="body2">Hồ sơ có giới tính</Typography><Typography fontWeight={700}>{guests.genderProfilesTracked ?? 0}</Typography></Stack></Grid>
                <Grid item xs={12} sm={6} md={3}><Stack direction="row" justifyContent="space-between"><Typography variant="body2">Số đêm lưu trú TB</Typography><Typography fontWeight={700}>{analytics.averageStayNights ?? 0} đêm</Typography></Stack></Grid>
                <Grid item xs={12} sm={6} md={3}><Stack direction="row" justifyContent="space-between"><Typography variant="body2">Giá trị booking TB</Typography><Typography fontWeight={700}>{formatCompactCurrency(analytics.averageBookingValue)}</Typography></Stack></Grid>
              </Grid>
            </Stack>
          </SectionCard>
        </Grid>
      </Grid>

      <Grid container spacing={2} mb={3}>
        <Grid item xs={12}>
          <SectionCard
            title="Bảng tỉ lệ lấp đầy"
            sub={`Tính theo số đêm đã lấp đầy trong kỳ đã chọn · ${dayjs(occupancyRange.from).format('DD/MM/YYYY')} → ${dayjs(occupancyRange.to).format('DD/MM/YYYY')}`}
            icon={<ApartmentIcon color="primary" fontSize="small" />}
            action={
              <ToggleButtonGroup value={occupancyPeriod} exclusive size="small" onChange={(_, value) => value && setOccupancyPeriod(value)}>
                <ToggleButton value="week">Tuần</ToggleButton>
                <ToggleButton value="month">Tháng</ToggleButton>
                <ToggleButton value="quarter">Quý</ToggleButton>
                <ToggleButton value="year">Năm</ToggleButton>
              </ToggleButtonGroup>
            }
          >
            {isOccupancyLoading || isOccupancyFetching ? (
              <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress size={26} /></Box>
            ) : occupancyReport ? (
              <Stack spacing={2}>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}><StatCard label="Lấp đầy theo số đêm" value={`${Number(occupancyReport.occupancy.overallRate ?? 0).toFixed(1)}%`} sub={`${occupancyReport.occupancy.occupiedNights} / ${occupancyReport.occupancy.totalRoomNights} đêm khả dụng`} icon={<ApartmentIcon />} color="#16A34A" /></Grid>
                  <Grid item xs={12} md={4}><StatCard label="Căn có tỉ lệ lấp đầy cao nhất" value={occupancyReport.insights.topRoom?.roomNumber ?? '—'} sub={occupancyReport.insights.topRoom ? `${occupancyReport.insights.topRoom.building} · ${Number(occupancyReport.insights.topRoom.occupancyRate ?? 0).toFixed(1)}%` : 'Chưa có dữ liệu'} icon={<HotelIcon />} color="#2563EB" /></Grid>
                  <Grid item xs={12} md={4}><StatCard label="Loại phòng mạnh nhất" value={occupancyReport.insights.topRoomType?.label ?? '—'} sub={occupancyReport.insights.topRoomType ? `${occupancyReport.insights.topRoomType.bookings} booking` : 'Chưa có dữ liệu'} icon={<QueryStatsIcon />} color="#D97706" /></Grid>
                  <Grid item xs={12} sm={6} md={3}><StatCard label="Phòng ≥ 50%" value={`${occupancyRoomCount ? Number((occupancyBands.above50 / occupancyRoomCount) * 100).toFixed(1) : '0.0'}%`} sub={`${occupancyBands.above50}/${occupancyRoomCount} căn`} icon={<ApartmentIcon />} color="#0F766E" /></Grid>
                  <Grid item xs={12} sm={6} md={3}><StatCard label="Phòng ≥ 60%" value={`${occupancyRoomCount ? Number((occupancyBands.above60 / occupancyRoomCount) * 100).toFixed(1) : '0.0'}%`} sub={`${occupancyBands.above60}/${occupancyRoomCount} căn`} icon={<ApartmentIcon />} color="#2563EB" /></Grid>
                  <Grid item xs={12} sm={6} md={3}><StatCard label="Phòng ≥ 70%" value={`${occupancyRoomCount ? Number((occupancyBands.above70 / occupancyRoomCount) * 100).toFixed(1) : '0.0'}%`} sub={`${occupancyBands.above70}/${occupancyRoomCount} căn`} icon={<ApartmentIcon />} color="#D97706" /></Grid>
                  <Grid item xs={12} sm={6} md={3}><StatCard label="Phòng < 50%" value={`${occupancyRoomCount ? Number((occupancyBands.below50 / occupancyRoomCount) * 100).toFixed(1) : '0.0'}%`} sub={`${occupancyBands.below50}/${occupancyRoomCount} căn`} icon={<ApartmentIcon />} color="#DC2626" /></Grid>
                </Grid>

                <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
                  <Box sx={{ px: 1.5, py: 1.1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setOccupancyExpanded((prev) => !prev)}>
                    <Box>
                      <Typography variant="subtitle2" fontWeight={800}>Danh sách tỉ lệ lấp đầy theo căn</Typography>
                      <Typography variant="caption" color="text.secondary">Mặc định thu gọn, bấm để xem toàn bộ {occupancyRoomCount} căn</Typography>
                    </Box>
                    <Box sx={{ transform: occupancyExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease', color: 'text.secondary', display: 'flex', alignItems: 'center' }}>
                      <ExpandMoreIcon />
                    </Box>
                  </Box>
                  <Collapse in={occupancyExpanded} timeout="auto">
                    <TableContainer sx={{ maxHeight: 560 }}>
                      <Table size="small" stickyHeader>
                        <TableHead sx={{ backgroundColor: 'var(--bg-primary)', opacity: 1, zIndex: 3, '& .MuiTableCell-root': { backgroundColor: 'var(--bg-primary) !important', opacity: '1 !important', zIndex: 3 } }}>
                          <TableRow sx={{ backgroundColor: 'var(--bg-primary)', opacity: 1 }}>
                            <TableCell>Căn</TableCell>
                            <TableCell>Toà nhà</TableCell>
                            <TableCell>Loại phòng</TableCell>
                            <TableCell align="right">Doanh thu tháng</TableCell>
                            <TableCell align="right">Giá vốn tháng</TableCell>
                            <TableCell>Hoàn vốn / Lãi</TableCell>
                            <TableCell align="right">Lấp đầy</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {occupancyRooms.map((room: any) => (
                            <TableRow key={room.roomId} hover>
                              <TableCell><Typography fontWeight={700}>{room.roomNumber}</Typography></TableCell>
                              <TableCell>{room.building}</TableCell>
                              <TableCell>{room.roomType}</TableCell>
                              <TableCell align="right">
                                <Typography variant="body2" fontWeight={700} sx={{ whiteSpace: 'nowrap' }}>
                                  {`${Number(room.bookedNightRevenue ?? 0).toLocaleString('vi-VN')}đ`}
                                </Typography>
                              </TableCell>
                              <TableCell align="right">
                                <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                                  {room.monthlyCost == null ? 'Chưa nhập' : `${Number(room.monthlyCost).toLocaleString('vi-VN')}đ`}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                {room.monthlyCost == null ? (
                                  <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>Chờ giá vốn</Typography>
                                ) : Number(room.bookedNightRevenue ?? 0) < Number(room.monthlyCost) ? (
                                  <Typography variant="caption" color="warning.main" sx={{ whiteSpace: 'nowrap' }}>Chưa hoàn vốn {`${(Number(room.monthlyCost) - Number(room.bookedNightRevenue ?? 0)).toLocaleString('vi-VN')}đ`}</Typography>
                                ) : Number(room.bookedNightRevenue ?? 0) === Number(room.monthlyCost) ? (
                                  <Typography variant="caption" color="success.main" fontWeight={700} sx={{ whiteSpace: 'nowrap' }}>Hoàn vốn</Typography>
                                ) : (
                                  <Typography variant="caption" color="success.main" fontWeight={700} sx={{ whiteSpace: 'nowrap' }}>Đang lãi {`${(Number(room.bookedNightRevenue ?? 0) - Number(room.monthlyCost)).toLocaleString('vi-VN')}đ`}</Typography>
                                )}
                              </TableCell>
                              <TableCell align="right">{Number(room.occupancyRate ?? 0).toFixed(1)}% ({Number(room.occupiedNights ?? 0).toFixed(0)}/{Number(room.totalNightsInPeriod ?? 0).toFixed(0)} đêm)</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Collapse>
                </Paper>
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">Chưa có dữ liệu lấp đầy</Typography>
            )}
          </SectionCard>
        </Grid>
      </Grid>

      <Grid container spacing={2} mb={3}>
        <Grid item xs={12}>
          <SectionCard
            title="Báo cáo lấp đầy & chiến lược theo căn"
            sub={`AI đã đánh giá ${currentAiCampaignCount} căn cho Tuần này${latestAiAssessmentAt ? ` · lần gần nhất ${dayjs(latestAiAssessmentAt).format('DD/MM/YYYY HH:mm')}` : ''} · Tự cập nhật theo booking hiện có`}
            icon={<TravelExploreIcon color="primary" fontSize="small" />}
          >
            <Stack spacing={1.25}>
              {strategyReports.map(({ period, report, loading }: any) => {
                const reportRooms: any[] = [...(report?.occupancy?.byRoom ?? [])].sort((a, b) => Number(a.occupancyRate ?? 0) - Number(b.occupancyRate ?? 0) || Number(a.occupiedNights ?? 0) - Number(b.occupiedNights ?? 0));
                const currentMonthRooms = thisMonthStrategyData?.data?.occupancy?.byRoom ?? [];
                const currentMonthByRoom = new Map<string, any>(currentMonthRooms.map((room: any) => [room.roomId, room]));
                const redCount = reportRooms.filter((room) => getRoomPricingStrategy(room, currentMonthByRoom.get(room.roomId), period.kind).level === 'Đỏ').length;
                const expanded = Boolean(strategyExpanded[period.key]);
                return (
                  <Paper key={period.key} variant="outlined" sx={{ overflow: 'hidden', borderRadius: 2 }}>
                    <Box onClick={() => setStrategyExpanded((current) => ({ ...current, [period.key]: !current[period.key] }))} sx={{ px: 1.5, py: 1.25, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                      <Box>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="subtitle2" fontWeight={800}>{period.title}</Typography>
                          {report && <Chip size="small" color={redCount ? 'error' : 'success'} label={redCount ? `${redCount} căn cần ưu tiên` : 'Không có căn cảnh báo đỏ'} />}
                        </Stack>
                        <Typography variant="caption" color="text.secondary">{dayjs(period.from).format('DD/MM/YYYY')} → {dayjs(period.to).format('DD/MM/YYYY')} · {period.subtitle}{period.key === 'thisWeek' && latestAiAssessmentAt ? ` · AI đánh giá ${dayjs(latestAiAssessmentAt).format('DD/MM/YYYY HH:mm')}` : ''}</Typography>
                      </Box>
                      <ExpandMoreIcon sx={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .2s ease' }} />
                    </Box>
                    <Collapse in={expanded} timeout="auto">
                      {loading ? <Box sx={{ py: 3, display: 'flex', justifyContent: 'center' }}><CircularProgress size={24} /></Box> : (
                        <TableContainer sx={{ maxHeight: 520 }}>
                          <Table size="small" stickyHeader>
                            <TableHead sx={{ backgroundColor: 'var(--bg-primary)', opacity: 1, zIndex: 3, '& .MuiTableCell-root': { backgroundColor: 'var(--bg-primary) !important', opacity: '1 !important', zIndex: 3 } }}>
                              <TableRow sx={{ backgroundColor: 'var(--bg-primary)', opacity: 1 }}>
                                <TableCell>Căn</TableCell><TableCell>Toà nhà</TableCell><TableCell>Loại phòng</TableCell><TableCell align="right">Đã book / Trống</TableCell><TableCell align="right">Lấp đầy</TableCell><TableCell>Hoàn vốn tháng hiện tại</TableCell><TableCell>Đề xuất giá & đánh giá</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {reportRooms.map((room) => {
                                const total = Number(room.totalNightsInPeriod ?? 0);
                                const occupied = Number(room.occupiedNights ?? 0);
                                const currentMonthRoom = currentMonthByRoom.get(room.roomId);
                                const strategy = getRoomPricingStrategy(room, currentMonthRoom, period.kind);
                                const aiCampaign = latestAiCampaign.get(`${room.roomId}:${period.key}`);
                                const aiStrategy = aiCampaign?.strategy;
                                const currentRevenue = Number(currentMonthRoom?.bookedNightRevenue ?? 0);
                                const monthlyCost = currentMonthRoom?.monthlyCost;
                                const hasCost = monthlyCost !== null && monthlyCost !== undefined && Number(monthlyCost) > 0;
                                const difference = hasCost ? currentRevenue - Number(monthlyCost) : null;
                                return <TableRow key={room.roomId} hover>
                                  <TableCell><Typography fontWeight={800}>{room.roomNumber}</Typography></TableCell>
                                  <TableCell>{room.building}</TableCell><TableCell>{room.roomType}</TableCell>
                                  <TableCell align="right">{occupied}/{Math.max(0, total - occupied)} đêm</TableCell>
                                  <TableCell align="right"><Chip size="small" color={strategy.color} label={`${Number(room.occupancyRate ?? 0).toFixed(1)}%`} /></TableCell>
                                  <TableCell sx={{ minWidth: 180 }}>
                                    {hasCost ? <><Typography variant="caption" display="block">DT: {currentRevenue.toLocaleString('vi-VN')}đ</Typography><Typography variant="caption" display="block">GV: {Number(monthlyCost).toLocaleString('vi-VN')}đ</Typography><Typography variant="caption" fontWeight={800} color={difference! >= 0 ? 'success.main' : 'error.main'}>{difference! >= 0 ? `Đã hoàn vốn +${difference!.toLocaleString('vi-VN')}đ` : `Còn thiếu ${Math.abs(difference!).toLocaleString('vi-VN')}đ`}</Typography></> : <Typography variant="caption" color="text.secondary">Chưa nhập giá vốn</Typography>}
                                  </TableCell>
                                  <TableCell sx={{ minWidth: 350 }}><Stack spacing={0.4}><Stack direction="row" spacing={0.75} alignItems="center"><Chip size="small" color={strategy.color} label={`Cảnh báo · ${strategy.level}`} /><Typography variant="caption" fontWeight={800}>{strategy.action}</Typography></Stack><Typography variant="caption" color="text.secondary">{strategy.text}</Typography>{aiStrategy && aiCampaign.outputSource === 'AI_MODEL' ? <><Stack direction="row" spacing={0.75} alignItems="center"><Chip size="small" color="info" label={`AI đánh giá · ${aiStrategy.phase ?? aiCampaign.status}`} /><Typography variant="caption" fontWeight={800}>{aiStrategy.objective}</Typography></Stack><Typography variant="caption">{aiStrategy.strategy}</Typography><Typography variant="caption" color="info.main">AI đánh giá lúc {dayjs(aiCampaign.outputGeneratedAt ?? aiCampaign.createdAt).format('DD/MM/YYYY HH:mm')} · đánh giá lại sau {aiCampaign.reviewAfterDays} ngày · {aiCampaign.status}</Typography></> : aiCampaign ? <Typography variant="caption" color="warning.main">AI chưa hoàn tất đánh giá cho căn/kỳ này — hệ thống chỉ chạy lại riêng căn này; nội dung mẫu cũ không được dùng là đánh giá AI.</Typography> : <Typography variant="caption" color="text.secondary">Chưa có đánh giá AI cho căn/kỳ này.</Typography>}<Typography variant="caption" color="text.secondary">Chỉ là đề xuất — chưa thay đổi giá trên OTA.</Typography></Stack></TableCell>
                                </TableRow>;
                              })}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      )}
                    </Collapse>
                  </Paper>
                );
              })}
              {dayjs().date() < 15 && <Typography variant="caption" color="text.secondary">Báo cáo Tháng sau sẽ tự kích hoạt từ 00:00 ngày 15 của tháng này.</Typography>}
            </Stack>
          </SectionCard>
        </Grid>
      </Grid>

      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard label="Khách đang ở" value={reservations.inHouse ?? 0} sub="booking IN_HOUSE" icon={<HotelIcon />} color="#16A34A" onClick={() => router.push('/timeline?status=IN_HOUSE')} />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard label="Khách đến hôm nay" value={reservations.arrivalsToday ?? 0} sub="theo ngày check-in" icon={<LoginIcon />} color="#D97706" onClick={() => router.push('/timeline?status=BOOKED,PENDING_CHECKIN,IN_HOUSE')} />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard label="Trả phòng hôm nay" value={reservations.checkoutsToday ?? 0} sub="theo ngày check-out" icon={<LogoutIcon />} color="#7C3AED" onClick={() => router.push('/timeline?status=IN_HOUSE,CHECKED_OUT')} />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard label="Booking sắp tới" value={reservations.futureActive ?? 0} sub="BOOKED / PENDING_CHECKIN" icon={<EventAvailableIcon />} color="#2563EB" onClick={() => router.push('/timeline?status=BOOKED,PENDING_CHECKIN')} />
        </Grid>
      </Grid>

      <Grid container spacing={2} mb={3}>
        <Grid item xs={12}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between">
              <Stack
                direction="row"
                spacing={1.25}
                alignItems="center"
                sx={{ cursor: 'pointer', minWidth: 0, flex: 1 }}
                onClick={() => setRevenueExpanded((prev) => !prev)}
              >
                <Box sx={{ width: 42, height: 42, borderRadius: 2, bgcolor: 'success.main', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <TrendingUpIcon fontSize="small" />
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 0.5, sm: 1 }} alignItems={{ xs: 'flex-start', sm: 'center' }}>
                    <Typography variant="subtitle1" fontWeight={800}>Doanh thu</Typography>
                    <DeltaChip value={revenue?.month?.pctChange} />
                  </Stack>
                  <Typography variant="body2" color="text.secondary">Bấm để xem doanh thu theo tháng / quý / năm</Typography>
                </Box>
                <Box sx={{ transform: revenueExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease', color: 'text.secondary', display: 'flex', alignItems: 'center' }}>
                  <ExpandMoreIcon />
                </Box>
              </Stack>
              <Stack direction={{ xs: 'row', sm: 'column' }} spacing={{ xs: 1, sm: 0.25 }} alignItems={{ xs: 'center', sm: 'flex-end' }} sx={{ flexShrink: 0 }}>
                <Typography variant="h5" fontWeight={800}>{formatCurrency(revenue?.month?.current)}</Typography>
                <Typography variant="caption" color="text.secondary">Doanh thu tháng hiện tại</Typography>
              </Stack>
              <Button size="small" variant="outlined" onClick={() => setReportOpen(true)}>Xem báo cáo</Button>
            </Stack>

            <Collapse in={revenueExpanded} timeout="auto" unmountOnExit>
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={12} md={4}>
                  <SectionCard title="Doanh thu tháng này" sub="So với tháng trước" icon={<TrendingUpIcon color="success" fontSize="small" />}>
                    <Stack spacing={1.25}>
                      <Typography variant="h5" fontWeight={800}>{formatCurrency(revenue?.month?.current)}</Typography>
                      <DeltaChip value={revenue?.month?.pctChange} />
                      <Typography variant="caption" color="text.secondary">Tháng trước: {formatCurrency(revenue?.month?.previous)}</Typography>
                    </Stack>
                  </SectionCard>
                </Grid>
                <Grid item xs={12} md={4}>
                  <SectionCard title="Doanh thu quý này" sub="So với quý trước" icon={<TrendingUpIcon color="primary" fontSize="small" />}>
                    <Stack spacing={1.25}>
                      <Typography variant="h5" fontWeight={800}>{formatCurrency(revenue?.quarter?.current)}</Typography>
                      <DeltaChip value={revenue?.quarter?.pctChange} />
                      <Typography variant="caption" color="text.secondary">Quý trước: {formatCurrency(revenue?.quarter?.previous)}</Typography>
                    </Stack>
                  </SectionCard>
                </Grid>
                <Grid item xs={12} md={4}>
                  <SectionCard title="Doanh thu năm nay" sub="So với năm trước" icon={<TrendingUpIcon color="warning" fontSize="small" />}>
                    <Stack spacing={1.25}>
                      <Typography variant="h5" fontWeight={800}>{formatCurrency(revenue?.year?.current)}</Typography>
                      <DeltaChip value={revenue?.year?.pctChange} />
                      <Typography variant="caption" color="text.secondary">Năm trước: {formatCurrency(revenue?.year?.previous)}</Typography>
                    </Stack>
                  </SectionCard>
                </Grid>
                <Grid item xs={12}>
                  <SectionCard title="Doanh thu 12 tháng gần nhất" sub="Tính theo tháng check-in của booking không huỷ" icon={<TrendingUpIcon color="primary" fontSize="small" />}>
                    <MonthlyTrendChart items={analytics?.monthlyRevenueTrend ?? []} />
                  </SectionCard>
                </Grid>
              </Grid>
            </Collapse>
          </Paper>
        </Grid>
      </Grid>

      <Grid container spacing={2} mb={3}>
        <Grid item xs={12}>
          <SectionCard title="Báo cáo giới tính khách hàng" sub="Tổng hợp từ hồ sơ khách đã khai báo giới tính" icon={<PeopleIcon color="primary" fontSize="small" />}>
            {genderBreakdown.length === 0 ? (
              <Typography variant="body2" color="text.secondary">Chưa có dữ liệu giới tính để tổng hợp.</Typography>
            ) : (
              <Stack spacing={2}>
                <Grid container spacing={2}>
                  {genderBreakdown.map((item: any) => (
                    <Grid item xs={12} md={4} key={item.gender}>
                      <StatCard
                        label={item.label}
                        value={item.count}
                        sub={`${item.percentage}% trên ${trackedGenderTotal} hồ sơ đã khai báo`}
                        icon={<PeopleIcon />}
                        color={GENDER_COLORS[item.gender] ?? '#64748B'}
                      />
                    </Grid>
                  ))}
                </Grid>
                <SimpleBarChart
                  items={genderBreakdown}
                  valueKey="count"
                  labelKey="label"
                  color="#8B5CF6"
                  formatter={(raw: number, item: any) => `${raw} khách · ${item.percentage}%`}
                />
              </Stack>
            )}
          </SectionCard>
        </Grid>
      </Grid>

      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} md={6}>
          <SectionCard title="Khách đến từ quốc gia / vùng lãnh thổ" sub="Top quốc tịch trong dữ liệu khách hàng" icon={<PublicIcon color="primary" fontSize="small" />}>
            <SimpleBarChart items={analytics?.nationalityBreakdown ?? []} valueKey="count" labelKey="nationality" color="#0F766E" suffix=" khách" />
          </SectionCard>
        </Grid>
        <Grid item xs={12} md={6}>
          <SectionCard
            title="Tỷ trọng nền tảng đặt phòng"
            sub="Loại trừ booking import Excel, chỉ tính nguồn chọn trong form đặt phòng"
            icon={<TravelExploreIcon color="primary" fontSize="small" />}
            action={
              <ToggleButtonGroup value={sourcePeriod} exclusive size="small" onChange={(_, value) => value && setSourcePeriod(value)}>
                <ToggleButton value="week">Tuần</ToggleButton>
                <ToggleButton value="month">Tháng</ToggleButton>
                <ToggleButton value="quarter">Quý</ToggleButton>
                <ToggleButton value="year">Năm</ToggleButton>
              </ToggleButtonGroup>
            }
          >
            {isSourceReportLoading || isSourceReportFetching ? (
              <Box sx={{ py: 3, display: 'flex', justifyContent: 'center' }}><CircularProgress size={24} /></Box>
            ) : (
              <SimpleBarChart items={filteredSourceBreakdown} valueKey="bookings" labelKey="label" color="#7C3AED" formatter={(raw: number, item: any) => `${raw} booking · ${item.percentage}%`} />
            )}
          </SectionCard>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} lg={7}>
          <SectionCard title="Hiệu suất theo toà nhà" sub="Xếp theo doanh thu" icon={<ApartmentIcon color="primary" fontSize="small" />}>
            <SimpleBarChart items={analytics?.buildingPerformance ?? []} valueKey="revenue" labelKey="building" color="#EA580C" formatter={(raw: number, item: any) => `${formatCompactCurrency(raw)} · ${item.bookings} booking`} />
          </SectionCard>
        </Grid>
        <Grid item xs={12} lg={5}>
          <SectionCard title="Đặt phòng gần đây" sub="Mở để xem chi tiết booking" icon={<PeopleIcon color="primary" fontSize="small" />}>
            {recent.length === 0 ? (
              <Typography variant="body2" color="text.secondary">Chưa có đặt phòng nào</Typography>
            ) : (
              <Stack divider={<Divider />}>
                {recent.map((r: any) => (
                  <Box key={r.id} onClick={() => setSelectedId(r.id)} sx={{ py: 1.1, cursor: 'pointer', borderRadius: 1, '&:hover': { bgcolor: 'action.hover' } }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={700}>{r.primaryGuestName}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{r.reservationCode} · {r.room?.building?.code} {r.room?.number}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{dayjs(r.checkInDate).format('DD/MM HH:mm')} – {dayjs(r.checkOutDate).format('DD/MM HH:mm')}</Typography>
                      </Box>
                      <StatusChip status={r.status} />
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}
          </SectionCard>
        </Grid>
      </Grid>

      <RevenueReportDialog open={reportOpen} onClose={() => setReportOpen(false)} />
      <ReservationDrawer reservationId={selectedId} onClose={() => setSelectedId(null)} />
    </Box>
  );
}
