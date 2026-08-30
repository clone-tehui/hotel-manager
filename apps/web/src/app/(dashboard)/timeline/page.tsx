'use client';
import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import {
  Box, Button, Typography, FormControl, InputLabel, Select, MenuItem,
  ToggleButton, ToggleButtonGroup, ButtonGroup, Chip, Stack, TextField, Paper, InputAdornment, IconButton,
  Divider, useMediaQuery,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DownloadIcon from '@mui/icons-material/Download';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import TodayIcon from '@mui/icons-material/Today';
import SearchIcon from '@mui/icons-material/Search';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import dayjs from 'dayjs';
import 'dayjs/locale/vi';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import { EZCloudTimeline } from '@/components/timeline/TimelineGrid';
import { ReservationDrawer } from '@/components/reservation/ReservationDrawer';
import { ReservationForm } from '@/components/reservation/ReservationForm';
import { useBuildings, useRoomTypes } from '@/hooks/api';
import { apiClient } from '@/lib/api';
import { useToast } from '@/providers/ToastProvider';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useSearchParams } from 'next/navigation';

dayjs.locale('vi');
dayjs.extend(weekOfYear);

type ViewMode = 'week' | 'twoWeek' | 'month';
type TimelineDensity = 'compact' | 'comfortable' | 'spacious';
type TimelineContrast = 'soft' | 'balanced' | 'strong';

const LEAD_DAYS = 1;
const TIMELINE_PREFS_KEY = 'timeline_ui_prefs';
const DEFAULT_CHECKIN_TIME = '14:00';
const DEFAULT_CHECKOUT_TIME = '12:00';
const VIEW_DAYS: Record<ViewMode, number> = { week: 7, twoWeek: 14, month: 31 };
const DAY_W:    Record<ViewMode, number>  = { week: 88, twoWeek: 58, month: 38 };
const VIEW_LABEL: Record<ViewMode, string> = { week: '7 ngày', twoWeek: '2 tuần', month: 'Monthly View' };

const STATUS_OPTIONS = [
  { key: 'BOOKED',          label: 'Đã đặt',    color: '#2563EB' },
  { key: 'PENDING_CHECKIN', label: 'Sắp đến',   color: '#2563EB' },
  { key: 'IN_HOUSE',        label: 'Đang ở',    color: '#DC2626' },
  { key: 'CHECKED_OUT',     label: 'Đã trả',    color: '#EAB308' },
];

function buildQuickSearchDefaults(baseDate = dayjs()) {
  return {
    checkIn: `${baseDate.format('YYYY-MM-DD')}T${DEFAULT_CHECKIN_TIME}`,
    checkOut: `${baseDate.add(1, 'day').format('YYYY-MM-DD')}T${DEFAULT_CHECKOUT_TIME}`,
  };
}

function TimelinePageContent() {
  const searchParams = useSearchParams();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [viewMode, setViewMode]         = useState<ViewMode>('month');
  const [anchorDate, setAnchorDate]     = useState(dayjs().startOf('day'));
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [buildingFilter, setBuildingFilter] = useState('');
  const [selectedId, setSelectedId]     = useState<string | null>(null);
  const [formOpen, setFormOpen]         = useState(false);
  const [quickRoom, setQuickRoom]       = useState<string | undefined>();
  const [quickDate, setQuickDate]       = useState<string | undefined>();
  const [quickCheckInDate, setQuickCheckInDate] = useState<string | undefined>();
  const [quickCheckOutDate, setQuickCheckOutDate] = useState<string | undefined>();
  const [exporting, setExporting]       = useState(false);
  const [density, setDensity] = useState<TimelineDensity>('comfortable');
  const [contrast, setContrast] = useState<TimelineContrast>('balanced');
  const [showWeekendTint, setShowWeekendTint] = useState(true);
  const [showCurrentTime, setShowCurrentTime] = useState(true);
  const [roomTypeSearchInput, setRoomTypeSearchInput] = useState('');
  const [searchCheckInInput, setSearchCheckInInput] = useState(() => buildQuickSearchDefaults().checkIn);
  const [searchCheckOutInput, setSearchCheckOutInput] = useState(() => buildQuickSearchDefaults().checkOut);
  const [appliedQuickSearch, setAppliedQuickSearch] = useState<{ roomTypeId: string; checkIn: string; checkOut: string } | null>(null);
  const { toast } = useToast();
  const anchorDateRef = useRef<HTMLInputElement | null>(null);
  const quickCheckInRef = useRef<HTMLInputElement | null>(null);
  const quickCheckOutRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const statusParam = searchParams.get('status');
    const buildingParam = searchParams.get('buildingId');
    const nextStatuses = statusParam
      ? statusParam.split(',').map((s) => s.trim()).filter((s) => !!s && s !== 'CANCELLED')
      : [];
    setStatusFilter(nextStatuses);
    setBuildingFilter(buildingParam ?? '');
  }, [searchParams]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(TIMELINE_PREFS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.density) setDensity(parsed.density);
      if (parsed?.contrast) setContrast(parsed.contrast);
      if (typeof parsed?.showWeekendTint === 'boolean') setShowWeekendTint(parsed.showWeekendTint);
      if (typeof parsed?.showCurrentTime === 'boolean') setShowCurrentTime(parsed.showCurrentTime);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(TIMELINE_PREFS_KEY, JSON.stringify({ density, contrast, showWeekendTint, showCurrentTime }));
    } catch {}
  }, [density, contrast, showWeekendTint, showCurrentTime]);

  // Buildings
  const { data: buildingsData } = useBuildings();
  const buildings: any[] = buildingsData?.data ?? [];

  // Visible date range: include one leading day so bookings from yesterday remain visible
  const days = useMemo(() => {
    const count = VIEW_DAYS[viewMode] + LEAD_DAYS;
    const start = anchorDate.subtract(LEAD_DAYS, 'day');
    return Array.from({ length: count }, (_, i) => start.add(i, 'day').toDate());
  }, [anchorDate, viewMode]);

  const dayWidth = DAY_W[viewMode];

  const navigate = (dir: -1 | 1) => {
    const unit = viewMode === 'month' ? 14 : viewMode === 'twoWeek' ? 7 : 7;
    setAnchorDate(anchorDate.add(dir * unit, 'day'));
  };

  const goToday = () => {
    const today = dayjs().startOf('day');
    setAnchorDate(today);
    const defaults = buildQuickSearchDefaults(today);
    setSearchCheckInInput(defaults.checkIn);
    setSearchCheckOutInput(defaults.checkOut);
  };
  const handlePickDate = (value: string) => {
    if (!value) return;
    setAnchorDate(dayjs(value).startOf('day'));
  };
  const openNativePicker = (ref: React.RefObject<HTMLInputElement | null>) => {
    const input = ref.current;
    if (!input) return;
    input.focus();
    (input as any).showPicker?.();
  };

  // Rooms — load all (filtered by building)
  const roomsParams: any = { limit: 200, includeInactive: false };
  if (buildingFilter) roomsParams.buildingId = buildingFilter;
  const { data: roomsData, isLoading: roomsLoading } = useQuery({
    queryKey: ['rooms-timeline', roomsParams],
    queryFn: () => api.get('/rooms', roomsParams),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });
  const rooms = roomsData?.data?.data ?? [];
  const { data: roomTypesData } = useRoomTypes();
  const roomTypeOptions: any[] = roomTypesData?.data ?? [];

  // Timeline data — fetch wider than visible window for smooth navigation
  const visibleStart = dayjs(days[0]);
  const visibleEnd = dayjs(days[days.length - 1]);
  const searchCheckInDate = appliedQuickSearch?.checkIn ? dayjs(appliedQuickSearch.checkIn) : null;
  const searchCheckOutDate = appliedQuickSearch?.checkOut ? dayjs(appliedQuickSearch.checkOut) : null;
  const defaultFetchStart = visibleStart.subtract(7, 'day');
  const defaultFetchEnd = visibleEnd.add(14, 'day');
  const searchFetchStart = searchCheckInDate?.isValid() ? searchCheckInDate.subtract(2, 'day') : null;
  const searchFetchEnd = searchCheckOutDate?.isValid() ? searchCheckOutDate.add(2, 'day') : null;
  const fetchStartBase = searchFetchStart && searchFetchStart.isBefore(defaultFetchStart) ? searchFetchStart : defaultFetchStart;
  const fetchEndBase = searchFetchEnd && searchFetchEnd.isAfter(defaultFetchEnd) ? searchFetchEnd : defaultFetchEnd;
  const fetchFrom = fetchStartBase.format('YYYY-MM-DD');
  const fetchTo   = fetchEndBase.format('YYYY-MM-DD');

  const timelineParams: any = { from: fetchFrom, to: fetchTo };
  if (statusFilter.length)  timelineParams.status     = statusFilter.join(',');
  if (buildingFilter)       timelineParams.buildingId = buildingFilter;

  const { data: timelineData, isLoading: resLoading } = useQuery({
    queryKey: ['timeline', timelineParams],
    queryFn: () => api.get('/timeline', timelineParams),
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });
  // API returns {ok, data:[...]} → extract array
  const reservations: any[] = useMemo(() => {
    const raw = timelineData;
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw?.data)) return raw.data;
    return [];
  }, [timelineData]);

  // Filter by status locally
  const filteredReservations = useMemo(() => {
    const visibleReservations = reservations.filter((r) => r.status !== 'CANCELLED');
    return statusFilter.length === 0
      ? visibleReservations
      : visibleReservations.filter((r) => statusFilter.includes(r.status));
  }, [reservations, statusFilter]);

  const toggleStatus = (key: string) => {
    setStatusFilter((prev) => prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]);
  };

  const handleQuickCreate = (roomId: string, date: string) => {
    setQuickRoom(roomId);
    setQuickDate(date);
    setQuickCheckInDate(undefined);
    setQuickCheckOutDate(undefined);
    setFormOpen(true);
  };

  const handleQuickRoomSearch = () => {
    const normalizedRoomType = roomTypeSearchInput.trim();
    const hasCheckIn = !!searchCheckInInput;
    const hasCheckOut = !!searchCheckOutInput;

    if (!normalizedRoomType && !hasCheckIn && !hasCheckOut) {
      toast('Chọn loại phòng hoặc chọn khoảng ngày giờ để tìm', 'warning');
      return;
    }
    if (hasCheckIn !== hasCheckOut) {
      toast('Nếu tìm theo thời gian thì cần nhập đủ check-in và check-out', 'warning');
      return;
    }
    if (hasCheckIn && dayjs(searchCheckOutInput).valueOf() <= dayjs(searchCheckInInput).valueOf()) {
      toast('Giờ check-out phải sau giờ check-in', 'warning');
      return;
    }

    setAppliedQuickSearch({
      roomTypeId: normalizedRoomType,
      checkIn: searchCheckInInput,
      checkOut: searchCheckOutInput,
    });
  };

  const quickSearchParams = useMemo(() => {
    if (!appliedQuickSearch) return null;
    return {
      ...(appliedQuickSearch.roomTypeId ? { roomTypeId: appliedQuickSearch.roomTypeId } : {}),
      ...(appliedQuickSearch.checkIn ? { checkInDate: appliedQuickSearch.checkIn } : {}),
      ...(appliedQuickSearch.checkOut ? { checkOutDate: appliedQuickSearch.checkOut } : {}),
      ...(buildingFilter ? { buildingId: buildingFilter } : {}),
    };
  }, [appliedQuickSearch, buildingFilter]);

  const { data: quickSearchData, isFetching: quickSearchLoading } = useQuery({
    queryKey: ['quick-room-search', quickSearchParams],
    queryFn: () => api.get('/reservations/quick-room-search', quickSearchParams),
    enabled: !!quickSearchParams,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });

  const quickSearchResults: any[] = useMemo(() => {
    const raw = quickSearchData;
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw?.data)) return raw.data;
    return [];
  }, [quickSearchData]);

  const handleQuickSearchPick = (room: any) => {
    const targetDate = appliedQuickSearch?.checkIn ? dayjs(appliedQuickSearch.checkIn).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD');
    setAnchorDate(dayjs(targetDate).startOf('day'));
    setQuickRoom(room.roomId);
    setQuickDate(targetDate);
    setQuickCheckInDate(appliedQuickSearch?.checkIn);
    setQuickCheckOutDate(appliedQuickSearch?.checkOut);
    setFormOpen(true);
  };

  const handleExport = async (format: 'xlsx' | 'csv') => {
    try {
      setExporting(true);
      const params: Record<string, string> = {
        from: fetchFrom,
        to: fetchTo,
        format,
      };
      if (statusFilter.length) params.status = statusFilter.join(',');
      if (buildingFilter) params.buildingId = buildingFilter;

      const res: any = await apiClient.get('/timeline/export', {
        params,
        responseType: 'blob',
      });
      const blob = new Blob([res], {
        type: format === 'xlsx'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'text/csv',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `timeline_${dayjs().format('YYYYMMDD_HHmmss')}.${format}`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast(`Xuất ${format.toUpperCase()} thành công`);
    } catch {
      toast('Lỗi khi xuất file', 'error');
    } finally {
      setExporting(false);
    }
  };

  const dateLabel = `${dayjs(days[0]).format('DD/MM')} – ${dayjs(days[days.length - 1]).format('DD/MM/YYYY')}`;
  const leadDateLabel = dayjs(days[0]).format('DD/MM');

  return (
    <Box sx={{ minHeight: '100%', display: 'flex', flexDirection: 'column', overflow: 'visible', position: 'relative', gap: { xs: 1, md: 0.8 } }}>
      <Paper variant="outlined" sx={{ p: { xs: 1, md: 0.8 }, borderRadius: { xs: 0, md: 2 }, flexShrink: 0, mx: { xs: 0, md: 1 } }}>
        <Stack spacing={{ xs: 1, md: 0.8 }}>
          <Stack direction={{ xs: 'column', xl: 'row' }} spacing={{ xs: 1, md: 0.75 }} alignItems={{ xs: 'stretch', xl: 'center' }} justifyContent="space-between">
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={{ xs: 0.75, md: 0.6 }} alignItems={{ xs: 'stretch', md: 'center' }}>
              <ButtonGroup size="small" variant="outlined" sx={{ '& .MuiButton-root': { py: isMobile ? 0.55 : 0.35, px: isMobile ? 0.85 : 0.8, minHeight: isMobile ? 34 : 30, fontSize: isMobile ? 12 : 11.5 } }}>
                <Button onClick={() => navigate(-1)}><ChevronLeftIcon fontSize="small" /></Button>
                <Button onClick={goToday} startIcon={<TodayIcon />}>Hôm nay</Button>
                <Button onClick={() => navigate(1)}><ChevronRightIcon fontSize="small" /></Button>
              </ButtonGroup>
              <TextField
                size="small"
                type="date"
                label="Chọn ngày"
                value={anchorDate.format('YYYY-MM-DD')}
                onChange={(e) => handlePickDate(e.target.value)}
                inputRef={anchorDateRef}
                InputLabelProps={{ shrink: true }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton edge="end" size="small" onClick={() => openNativePicker(anchorDateRef)} aria-label="Mở lịch chọn ngày">
                        <CalendarMonthIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{ minWidth: { xs: '100%', md: 160 }, '& .MuiInputBase-root': { minHeight: isMobile ? 36 : 30, fontSize: isMobile ? undefined : 12 }, '& .MuiInputLabel-root': { fontSize: isMobile ? undefined : 11.5 } }}
              />
            </Stack>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={{ xs: 1, md: 0.75 }} alignItems={{ xs: 'stretch', md: 'center' }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography fontWeight={800} sx={{ fontSize: { xs: 15, md: 13.5 }, lineHeight: 1.1 }}>Timeline vận hành</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: 11, md: 10.5 }, lineHeight: 1.1 }}>{dateLabel} · có thêm hôm qua ({leadDateLabel})</Typography>
              </Box>
              <ToggleButtonGroup size="small" exclusive value={viewMode} onChange={(_, v) => v && setViewMode(v)} sx={{ width: { xs: '100%', md: 'auto' }, '& .MuiToggleButton-root': { flex: { xs: 1, md: 'unset' }, px: { xs: 0.75, md: 1 }, minHeight: isMobile ? 34 : 30, fontSize: { xs: 11.5, md: 11.5 } } }}>
                {(Object.keys(VIEW_LABEL) as ViewMode[]).map((v) => (
                  <ToggleButton key={v} value={v}>{VIEW_LABEL[v]}</ToggleButton>
                ))}
              </ToggleButtonGroup>
              <Button variant="contained" fullWidth={isMobile} startIcon={<AddIcon />} onClick={() => { setQuickRoom(undefined); setQuickDate(undefined); setQuickCheckInDate(undefined); setQuickCheckOutDate(undefined); setFormOpen(true); }} sx={{ minHeight: { xs: 36, md: 30 }, fontSize: { xs: 13, md: 11.5 }, px: { md: 1.2 } }}>
                Đặt phòng
              </Button>
            </Stack>
          </Stack>

          <Divider />

          <Stack direction={{ xs: 'column', xl: 'row' }} spacing={{ xs: 1, md: 0.9 }} alignItems={{ xs: 'stretch', xl: 'flex-start' }}>
            <Stack spacing={{ xs: 1, md: 0.65 }} sx={{ flex: 1.15 }}>
              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ fontSize: { md: 10.5 } }}>TÌM PHÒNG NHANH</Typography>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={{ xs: 1, md: 0.6 }} alignItems={{ xs: 'stretch', md: 'flex-start' }}>
                <FormControl size="small" sx={{ flex: { xs: '1 1 auto', md: '1.2 1 0' }, minWidth: { md: 170 }, '& .MuiInputBase-root': { minHeight: { md: 30 }, fontSize: { md: 12 } }, '& .MuiInputLabel-root': { fontSize: { md: 11.5 } } }}>
                  <InputLabel>Loại phòng</InputLabel>
                  <Select value={roomTypeSearchInput} label="Loại phòng" onChange={(e) => setRoomTypeSearchInput(e.target.value)}>
                    <MenuItem value="">Tất cả</MenuItem>
                    {roomTypeOptions.map((option: any) => (
                      <MenuItem key={option.id} value={option.id}>{option.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField size="small" type="datetime-local" label="Check-in" value={searchCheckInInput} onChange={(e) => setSearchCheckInInput(e.target.value)} inputRef={quickCheckInRef} InputLabelProps={{ shrink: true }} sx={{ flex: { xs: '1 1 auto', md: '0.92 1 0' }, minWidth: { md: 150 }, '& .MuiInputBase-root': { minHeight: { md: 30 }, fontSize: { md: 12 } }, '& .MuiInputLabel-root': { fontSize: { md: 11.5 } } }} />
                <TextField size="small" type="datetime-local" label="Check-out" value={searchCheckOutInput} onChange={(e) => setSearchCheckOutInput(e.target.value)} inputRef={quickCheckOutRef} InputLabelProps={{ shrink: true }} sx={{ flex: { xs: '1 1 auto', md: '0.92 1 0' }, minWidth: { md: 150 }, '& .MuiInputBase-root': { minHeight: { md: 30 }, fontSize: { md: 12 } }, '& .MuiInputLabel-root': { fontSize: { md: 11.5 } } }} />
                <Button variant="contained" startIcon={<SearchIcon />} onClick={handleQuickRoomSearch} sx={{ minWidth: { md: 105 }, whiteSpace: 'nowrap', alignSelf: { xs: 'stretch', md: 'auto' }, minHeight: { md: 30 }, fontSize: { md: 11.5 }, px: { md: 1 } }}>Tìm phòng</Button>
              </Stack>
              <Stack direction="row" flexWrap={isMobile ? 'nowrap' : 'wrap'} gap={0.5} sx={{ overflowX: isMobile ? 'auto' : 'visible', pb: isMobile ? 0.25 : 0, '&::-webkit-scrollbar': { display: 'none' } }}>
                {quickSearchLoading && <Chip label="Đang tìm phòng phù hợp..." color="info" variant="outlined" />}
                {appliedQuickSearch && !quickSearchLoading && quickSearchResults.length === 0 && <Chip label="Không có phòng phù hợp" color="warning" variant="outlined" />}
                {quickSearchResults.map((room: any) => (
                  <Chip
                    key={room.roomId}
                    clickable
                    color="primary"
                    variant="outlined"
                    onClick={() => handleQuickSearchPick(room)}
                    label={`${room.roomNumber} · ${room.building?.code ?? '—'}${room.roomType?.name ? ` · ${room.roomType.name}` : ''}`}
                    sx={{ maxWidth: '100%', height: { md: 24 }, fontSize: { md: 11 }, '& .MuiChip-label': { display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' } }}
                  />
                ))}
              </Stack>
            </Stack>

            <Stack spacing={{ xs: 1, md: 0.65 }} sx={{ flex: 0.95 }}>
              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ fontSize: { md: 10.5 } }}>BỘ LỌC HIỂN THỊ</Typography>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={{ xs: 1, md: 0.6 }}>
                <FormControl size="small" sx={{ flex: 1, '& .MuiInputBase-root': { minHeight: { md: 30 }, fontSize: { md: 12 } }, '& .MuiInputLabel-root': { fontSize: { md: 11.5 } } }}>
                  <InputLabel>Toà nhà</InputLabel>
                  <Select value={buildingFilter} label="Toà nhà" onChange={(e) => setBuildingFilter(e.target.value)}>
                    <MenuItem value="">Tất cả</MenuItem>
                    {buildings.map((b: any) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ flex: 1, '& .MuiInputBase-root': { minHeight: { md: 30 }, fontSize: { md: 12 } }, '& .MuiInputLabel-root': { fontSize: { md: 11.5 } } }}>
                  <InputLabel>Mật độ</InputLabel>
                  <Select value={density} label="Mật độ" onChange={(e) => setDensity(e.target.value as TimelineDensity)}>
                    <MenuItem value="compact">Gọn</MenuItem>
                    <MenuItem value="comfortable">Chuẩn</MenuItem>
                    <MenuItem value="spacious">Thoáng</MenuItem>
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ flex: 1, '& .MuiInputBase-root': { minHeight: { md: 30 }, fontSize: { md: 12 } }, '& .MuiInputLabel-root': { fontSize: { md: 11.5 } } }}>
                  <InputLabel>Tương phản</InputLabel>
                  <Select value={contrast} label="Tương phản" onChange={(e) => setContrast(e.target.value as TimelineContrast)}>
                    <MenuItem value="soft">Mềm</MenuItem>
                    <MenuItem value="balanced">Cân bằng</MenuItem>
                    <MenuItem value="strong">Rõ nét</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
              <Stack direction="row" spacing={0.5} useFlexGap flexWrap={isMobile ? 'nowrap' : 'wrap'} sx={{ overflowX: isMobile ? 'auto' : 'visible', pb: isMobile ? 0.25 : 0, '&::-webkit-scrollbar': { display: 'none' } }}>
                {STATUS_OPTIONS.map((s) => (
                  <Chip
                    key={s.key}
                    label={s.label}
                    size="small"
                    onClick={() => toggleStatus(s.key)}
                    sx={{
                      borderRadius: 1.5,
                      fontWeight: 600,
                      fontSize: { xs: 10.5, md: 10.5 },
                      height: { xs: 26, md: 22 },
                      bgcolor: statusFilter.includes(s.key) ? s.color + '30' : 'transparent',
                      color: statusFilter.includes(s.key) ? s.color : 'text.secondary',
                      border: `1px solid ${statusFilter.includes(s.key) ? s.color : 'rgba(255,255,255,0.1)'}`,
                    }}
                  />
                ))}
                <Chip size="small" label="Cuối tuần" onClick={() => setShowWeekendTint((v) => !v)} variant={showWeekendTint ? 'filled' : 'outlined'} sx={{ height: { md: 22 }, fontSize: { md: 10.5 } }} />
                <Chip size="small" label="Vạch giờ" onClick={() => setShowCurrentTime((v) => !v)} variant={showCurrentTime ? 'filled' : 'outlined'} sx={{ height: { md: 22 }, fontSize: { md: 10.5 } }} />
                <Button variant="outlined" startIcon={<DownloadIcon />} disabled={exporting} onClick={() => handleExport('xlsx')} sx={{ minHeight: { md: 22 }, fontSize: { md: 10.5 }, px: { md: 0.9 } }}>
                  Xuất Excel
                </Button>
              </Stack>
            </Stack>
          </Stack>
        </Stack>
      </Paper>

      <Box sx={{ overflow: 'hidden', minHeight: 0, pt: 0, height: { xs: '72dvh', md: '78dvh', lg: '82dvh' }, mx: { xs: 0, md: 1 }, borderRadius: { xs: 0, md: 2 } }}>
        {rooms.length === 0 && !roomsLoading ? (
          <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography color="text.secondary">Không có căn hộ nào. Vui lòng chọn toà nhà hoặc thêm căn hộ.</Typography>
          </Box>
        ) : (
          <EZCloudTimeline
            rooms={rooms}
            reservations={filteredReservations}
            loading={roomsLoading || resLoading}
            days={days}
            dayWidth={dayWidth}
            density={density}
            contrast={contrast}
            showWeekendTint={showWeekendTint}
            showCurrentTime={showCurrentTime}
            onSelectReservation={setSelectedId}
            onQuickCreate={handleQuickCreate}
          />
        )}
      </Box>

      <Box sx={{ px: { xs: 1, md: 1.25 }, py: 0.35, borderTop: '1px solid', borderColor: 'divider', display: 'flex', gap: 0.45, bgcolor: 'background.paper', flexWrap: isMobile ? 'nowrap' : 'wrap', overflowX: isMobile ? 'auto' : 'visible', flexShrink: 0, mx: { xs: 0, md: 1 }, borderBottomLeftRadius: { md: 10 }, borderBottomRightRadius: { md: 10 }, '&::-webkit-scrollbar': { display: 'none' } }}>
        <Chip size="small" label={`${rooms.length} căn`} variant="outlined" sx={{ height: 22, fontSize: 10 }} />
        <Chip size="small" label={`${filteredReservations.filter(r => r.status === 'BOOKED' || r.status === 'PENDING_CHECKIN').length} sắp đến`} sx={{ bgcolor: 'rgba(108,142,255,0.12)', height: 22, fontSize: 10 }} />
        <Chip size="small" label={`${filteredReservations.filter(r => r.status === 'IN_HOUSE').length} đang ở`} sx={{ bgcolor: 'rgba(76,175,130,0.12)', height: 22, fontSize: 10 }} />
        <Chip size="small" label={`${filteredReservations.length} booking`} sx={{ bgcolor: 'action.hover', height: 22, fontSize: 10 }} />
        <Chip size="small" label={`Từ ${leadDateLabel}`} sx={{ bgcolor: 'rgba(108,142,255,0.10)', height: 22, fontSize: 10 }} />
      </Box>

      <Box sx={{ px: { xs: 1, md: 1.25 }, py: 0.5, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 0.5, bgcolor: 'background.paper', flexWrap: isMobile ? 'nowrap' : 'wrap', overflowX: isMobile ? 'auto' : 'visible', flexShrink: 0, mx: { xs: 0, md: 1 }, '&::-webkit-scrollbar': { display: 'none' } }}>
        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ fontSize: 10.5, mr: 0.25 }}>
          Chú thích màu:
        </Typography>
        {STATUS_OPTIONS.map((status) => (
          <Chip
            key={`legend-${status.key}`}
            size="small"
            label={status.label}
            sx={{
              height: 20,
              fontSize: 10,
              fontWeight: 700,
              bgcolor: `${status.color}22`,
              color: status.color,
              border: `1px solid ${status.color}55`,
              '& .MuiChip-label': { px: 0.9 },
            }}
          />
        ))}
      </Box>

      <ReservationDrawer reservationId={selectedId} onClose={() => { setSelectedId(null); }} />
      <ReservationForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        initialRoomId={quickRoom}
        initialDate={quickDate}
        initialCheckInDate={quickCheckInDate}
        initialCheckOutDate={quickCheckOutDate}
      />
    </Box>
  );
}

export default function TimelinePage() {
  return (
    <Suspense>
      <TimelinePageContent />
    </Suspense>
  );
}
