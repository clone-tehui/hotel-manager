'use client';
import React, { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import { alpha, useTheme } from '@mui/material/styles';
import { Box, Typography, Tooltip, Chip, Stack, useMediaQuery } from '@mui/material';
import MaleIcon from '@mui/icons-material/Male';
import FemaleIcon from '@mui/icons-material/Female';
import TransgenderIcon from '@mui/icons-material/Transgender';
import dayjs from 'dayjs';
import { COUNTRY_OPTIONS } from '@/lib/countries';

type TimelineDensity = 'compact' | 'comfortable' | 'spacious';
type TimelineContrast = 'soft' | 'balanced' | 'strong';

interface Room {
  id: string;
  number: string;
  floor?: number;
  building?: { name: string; code: string };
  roomType?: { name: string };
  status?: string;
}

type TimelineRow =
  | { kind: 'separator'; key: string; label: string }
  | { kind: 'room'; key: string; room: Room };

interface Reservation {
  id: string;
  roomId: string;
  reservationCode: string;
  primaryGuestName: string;
  primaryGuestGender?: string | null;
  primaryGuestNationality?: string | null;
  company?: string;
  checkInDate: string;
  checkOutDate: string;
  status: string;
}

type VisualReservationState = 'BOOKED_PENDING' | 'IN_HOUSE' | 'CHECKED_OUT' | 'CANCELLED';

function getVisualReservationState(reservation: Reservation, now: dayjs.Dayjs): VisualReservationState {
  if (reservation.status === 'CANCELLED') return 'CANCELLED';
  if (reservation.status === 'CHECKED_OUT') return 'CHECKED_OUT';

  const checkIn = dayjs(reservation.checkInDate);
  const checkOut = dayjs(reservation.checkOutDate);

  if (now.isSame(checkOut) || now.isAfter(checkOut)) return 'CHECKED_OUT';
  if (reservation.status === 'IN_HOUSE') return 'IN_HOUSE';
  if (now.isSame(checkIn) || now.isAfter(checkIn)) return 'IN_HOUSE';

  return 'BOOKED_PENDING';
}

interface Props {
  rooms: Room[];
  reservations: Reservation[];
  loading: boolean;
  days: Date[];
  dayWidth: number;
  density: TimelineDensity;
  contrast: TimelineContrast;
  showWeekendTint: boolean;
  showCurrentTime: boolean;
  onSelectReservation: (id: string) => void;
  onQuickCreate: (roomId: string, date: string) => void;
}

const STATUS_BASE = {
  BOOKED_PENDING: '#2563EB',
  IN_HOUSE: '#DC2626',
  CHECKED_OUT: '#EAB308',
  CANCELLED: '#F97316',
  DEFAULT: '#64748B',
} as const;

const GENDER_ICON_MAP: Record<string, typeof MaleIcon> = {
  MALE: MaleIcon,
  FEMALE: FemaleIcon,
  NON_BINARY: TransgenderIcon,
};

const NATIONALITY_FLAG_ALIASES: Record<string, string> = {
  'việt nam': '🇻🇳',
  vietnam: '🇻🇳',
  vietnamese: '🇻🇳',
  'hàn quốc': '🇰🇷',
  korea: '🇰🇷',
  'south korea': '🇰🇷',
  korean: '🇰🇷',
  'trung quốc': '🇨🇳',
  china: '🇨🇳',
  chinese: '🇨🇳',
  nhật: '🇯🇵',
  'nhật bản': '🇯🇵',
  japan: '🇯🇵',
  japanese: '🇯🇵',
  mỹ: '🇺🇸',
  'hoa kỳ': '🇺🇸',
  usa: '🇺🇸',
  'united states': '🇺🇸',
  american: '🇺🇸',
};

const BUILDING_GROUP_ORDER = ['OPERA', 'GALLERIA', 'CREST', 'LANCASTER', 'VILLA'] as const;
type BuildingGroupKey = typeof BUILDING_GROUP_ORDER[number];

function resolveBuildingGroup(room: Room): BuildingGroupKey {
  const roomType = room.roomType?.name?.trim().toUpperCase() ?? '';
  const buildingCode = room.building?.code?.trim().toUpperCase() ?? '';
  const buildingName = room.building?.name?.trim().toUpperCase() ?? '';

  if (roomType.includes('BIỆT THỰ') || buildingName.includes('BIỆT THỰ') || buildingCode.startsWith('VIC')) return 'VILLA';
  if (buildingCode.includes('OPERA') || buildingName.includes('OPERA')) return 'OPERA';
  if (buildingCode.includes('GALLERIA') || buildingName.includes('GALLERIA')) return 'GALLERIA';
  if (buildingCode.includes('CREST') || buildingName.includes('CREST')) return 'CREST';
  if (buildingCode.includes('LANCASTER') || buildingName.includes('LANCASTER')) return 'LANCASTER';
  return 'OPERA';
}

function resolveBuildingLabel(group: BuildingGroupKey) {
  if (group === 'VILLA') return 'Biệt thự';
  if (group === 'OPERA') return 'The Opera';
  if (group === 'GALLERIA') return 'The Galleria';
  if (group === 'CREST') return 'The Crest';
  return 'Lancaster Legacy';
}

function compareRoomNumber(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

export function EZCloudTimeline({ rooms, reservations, loading, days, dayWidth, density, contrast, showWeekendTint, showCurrentTime, onSelectReservation, onQuickCreate }: Props) {
  const theme = useTheme();
  const mode = theme.palette.mode;
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'lg'));
  const rootRef = useRef<HTMLDivElement | null>(null);
  const bodyScrollRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [now, setNow] = useState(() => dayjs());
  const today = now.startOf('day');

  const densityMap = {
    compact: { roomCol: 236, cellH: 48, headerH: 72, monthH: 28, bookingH: 30, minDay: 38 },
    comfortable: { roomCol: 260, cellH: 56, headerH: 78, monthH: 30, bookingH: 36, minDay: 40 },
    spacious: { roomCol: 284, cellH: 64, headerH: 84, monthH: 32, bookingH: 40, minDay: 44 },
  } as const;
  const metrics = densityMap[density];
  const roomColumnWidth = isMobile ? 92 : isTablet ? 156 : Math.max(232, metrics.roomCol - 22);

  const contrastMap = {
    soft: { grid: mode === 'light' ? 0.12 : 0.12, surface: mode === 'light' ? 0.02 : 0.02, weekend: mode === 'light' ? 0.05 : 0.07, today: mode === 'light' ? 0.08 : 0.16 },
    balanced: { grid: mode === 'light' ? 0.18 : 0.16, surface: mode === 'light' ? 0.04 : 0.04, weekend: mode === 'light' ? 0.07 : 0.10, today: mode === 'light' ? 0.12 : 0.20 },
    strong: { grid: mode === 'light' ? 0.26 : 0.22, surface: mode === 'light' ? 0.07 : 0.06, weekend: mode === 'light' ? 0.10 : 0.14, today: mode === 'light' ? 0.16 : 0.24 },
  } as const;
  const tone = contrastMap[contrast];

  const gridBorder = alpha(theme.palette.text.primary, tone.grid);
  const weekendBg = showWeekendTint ? alpha(mode === 'light' ? '#64748B' : '#CBD5E1', tone.weekend) : 'transparent';
  const todayBg = alpha(theme.palette.primary.main, tone.today);
  const currentTimeColor = mode === 'light' ? '#EA580C' : '#FB923C';
  const stickyShadow = 'none';
  const stickyColumnBg = mode === 'light' ? '#FFFFFF' : '#111827';
  const stickyHeaderBg = mode === 'light' ? '#F8FAFC' : '#0F172A';
  const stickyMonthBg = mode === 'light' ? '#EEF2F7' : '#162033';
  const stickyWeekendBg = mode === 'light' ? '#E9EEF5' : '#182334';
  const stickyTodayBg = mode === 'light' ? '#DCEBFF' : '#1D3557';
  const separatorBg = mode === 'light' ? '#DCEBFF' : '#1E3A5F';
  const separatorText = mode === 'light' ? '#0F172A' : '#F8FAFC';
  const separatorHeight = isMobile ? 28 : 36;

  const roomStatusColor: Record<string, string> = {
    VACANT: '#5F9B86',
    RESERVED: '#5F84D6',
    OCCUPIED: '#C98B63',
    DIRTY: '#7E8AA0',
    MAINTENANCE: '#A56C74',
  };

  useEffect(() => {
    if (!rootRef.current) return;
    const node = rootRef.current;
    const update = () => setContainerWidth(node.clientWidth);
    update();
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(node);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(dayjs()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const adaptiveDayWidth = useMemo(() => {
    if (!containerWidth) return dayWidth;
    const availableGridWidth = Math.max(0, containerWidth - roomColumnWidth);
    const ideal = Math.floor(availableGridWidth / Math.max(1, days.length));
    return Math.max(metrics.minDay, ideal || dayWidth);
  }, [containerWidth, dayWidth, days.length, metrics, roomColumnWidth]);

  const totalW = days.length * adaptiveDayWidth;

  const todayIdx = useMemo(() => days.findIndex((d) => dayjs(d).isSame(today, 'day')), [days, today]);

  const currentTimeLeft = useMemo(() => {
    if (!showCurrentTime || todayIdx < 0) return null;
    const minutes = now.diff(today, 'minute');
    const fraction = Math.max(0, Math.min(1, minutes / (24 * 60)));
    return todayIdx * adaptiveDayWidth + fraction * adaptiveDayWidth;
  }, [showCurrentTime, todayIdx, adaptiveDayWidth, now, today]);

  const monthGroups = useMemo(() => {
    const groups: { key: string; label: string; count: number }[] = [];
    days.forEach((day) => {
      const key = dayjs(day).format('YYYY-MM');
      const label = dayjs(day).format('MM/YYYY');
      const last = groups[groups.length - 1];
      if (last?.key === key) last.count += 1;
      else groups.push({ key, label, count: 1 });
    });
    return groups;
  }, [days]);

  const countryFlagMap = useMemo(() => {
    const map = new Map<string, string>();
    COUNTRY_OPTIONS.forEach((country) => {
      map.set(country.label.trim().toLowerCase(), country.flag);
      map.set(country.code.trim().toLowerCase(), country.flag);
    });
    Object.entries(NATIONALITY_FLAG_ALIASES).forEach(([key, value]) => map.set(key, value));
    return map;
  }, []);

  const resolveCountryFlag = useCallback((nationality?: string | null) => {
    if (!nationality) return null;
    const normalized = nationality.trim().toLowerCase();
    return countryFlagMap.get(normalized) ?? null;
  }, [countryFlagMap]);

  const resByRoom = useMemo(() => {
    const map = new Map<string, Reservation[]>();
    for (const reservation of reservations) {
      if (reservation.status === 'CANCELLED') continue;
      if (!map.has(reservation.roomId)) map.set(reservation.roomId, []);
      map.get(reservation.roomId)!.push(reservation);
    }
    return map;
  }, [reservations]);

  const timelineRows = useMemo<TimelineRow[]>(() => {
    const grouped = new Map<BuildingGroupKey, Room[]>();
    BUILDING_GROUP_ORDER.forEach((group) => grouped.set(group, []));

    rooms.forEach((room) => {
      const group = resolveBuildingGroup(room);
      grouped.get(group)?.push(room);
    });

    const rows: TimelineRow[] = [];
    BUILDING_GROUP_ORDER.forEach((group) => {
      const groupRooms = (grouped.get(group) ?? []).slice().sort((a, b) => {
        const floorDiff = (a.floor ?? 0) - (b.floor ?? 0);
        if (floorDiff !== 0) return floorDiff;
        return compareRoomNumber(a.number, b.number);
      });
      if (groupRooms.length === 0) return;
      rows.push({ kind: 'separator', key: `sep-${group}`, label: resolveBuildingLabel(group) });
      groupRooms.forEach((room) => rows.push({ kind: 'room', key: room.id, room }));
    });
    return rows;
  }, [rooms]);

  const rangeStart = useMemo(() => dayjs(days[0]).startOf('day'), [days]);
  const rangeEnd = useMemo(() => rangeStart.add(days.length, 'day'), [rangeStart, days.length]);

  const getBarStyle = useCallback((res: Reservation) => {
    if (res.status === 'CANCELLED') return null;

    const cin = dayjs(res.checkInDate);
    const cout = dayjs(res.checkOutDate);
    const visibleStart = cin.isAfter(rangeStart) ? cin : rangeStart;
    const visibleEnd = cout.isBefore(rangeEnd) ? cout : rangeEnd;

    if (!visibleEnd.isAfter(rangeStart) || !visibleStart.isBefore(rangeEnd) || !visibleEnd.isAfter(visibleStart)) return null;

    const leftMinutes = visibleStart.diff(rangeStart, 'minute', true);
    const rightMinutes = visibleEnd.diff(rangeStart, 'minute', true);
    const left = Math.max(0, (leftMinutes / (24 * 60)) * adaptiveDayWidth) + 6;
    const right = Math.min(days.length * adaptiveDayWidth, (rightMinutes / (24 * 60)) * adaptiveDayWidth) - 6;
    const width = right - left;
    if (width <= 0) return null;

    const visualState = getVisualReservationState(res, now);
    const base = STATUS_BASE[visualState] ?? STATUS_BASE.DEFAULT;
    return {
      left,
      width,
      bg: mode === 'light' ? base : alpha(base, 0.92),
      border: mode === 'light' ? alpha(base, 0.95) : alpha(base, 0.98),
      label: visualState,
    };
  }, [rangeStart, rangeEnd, days.length, adaptiveDayWidth, mode, now]);

  return (
    <Box ref={rootRef} sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', bgcolor: 'background.default', position: 'relative' }}>
      <Box
        ref={bodyScrollRef}
        sx={{
          flex: 1,
          minHeight: 0,
          height: 0,
          overflow: 'auto',
          overflowX: 'auto',
          overflowY: 'auto',
          position: 'relative',
          bgcolor: 'background.default',
          overscrollBehavior: 'contain',
          overscrollBehaviorX: 'contain',
          overscrollBehaviorY: 'contain',
          WebkitOverflowScrolling: 'touch',
          touchAction: 'auto',
          scrollbarWidth: 'thin',
        }}
      >
        <Box sx={{ display: 'flex', minWidth: roomColumnWidth + totalW }}>
          <Box sx={{ position: 'sticky', left: 0, zIndex: 40, flexShrink: 0, bgcolor: stickyColumnBg }}>
            <Box
              sx={{
                height: metrics.headerH,
                width: roomColumnWidth,
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                px: 1.5,
                borderRight: `1px solid ${gridBorder}`,
                borderBottom: `1px solid ${gridBorder}`,
                bgcolor: stickyHeaderBg,
                boxShadow: stickyShadow,
                position: 'sticky',
                top: 0,
                zIndex: 45,
              }}
            >
              <Typography variant="caption" fontWeight={800} color="text.secondary" textTransform="uppercase" letterSpacing={isMobile ? 0.5 : 1} sx={{ fontSize: isMobile ? '0.66rem' : '0.66rem' }}>
                {isMobile ? 'Căn' : 'Danh sách căn hộ'}
              </Typography>
              {!isMobile && (
                <Typography variant="caption" color="text.secondary">
                  Tối ưu cho {mode === 'light' ? 'nền sáng' : 'nền tối'} · có thể chỉnh mật độ và tương phản
                </Typography>
              )}
            </Box>

            {timelineRows.map((row) => {
              if (row.kind === 'separator') {
                return (
                  <Box
                    key={row.key}
                    sx={{
                      height: separatorHeight,
                      width: roomColumnWidth,
                      display: 'flex',
                      alignItems: 'center',
                      px: 1.5,
                      borderRight: `1px solid ${gridBorder}`,
                      borderBottom: `1px solid ${gridBorder}`,
                      bgcolor: separatorBg,
                      position: 'relative',
                      zIndex: 2,
                    }}
                  >
                    <Typography variant="body2" fontWeight={900} sx={{ color: separatorText, letterSpacing: '0.02em', fontSize: isMobile ? '0.74rem' : '0.8rem' }}>
                      {row.label}
                    </Typography>
                  </Box>
                );
              }

              const room = row.room;
              const roomReservations = resByRoom.get(room.id) ?? [];
              const activeCount = roomReservations.filter((r) => ['BOOKED', 'PENDING_CHECKIN', 'IN_HOUSE'].includes(r.status)).length;
              return (
                <Box
                  key={row.key}
                  sx={{
                    height: metrics.cellH,
                    width: roomColumnWidth,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    px: isMobile ? '7px' : '10px',
                    borderRight: `1px solid ${gridBorder}`,
                    borderBottom: `1px solid ${gridBorder}`,
                    bgcolor: stickyColumnBg,
                    gap: isMobile ? 0.75 : 1,
                    boxSizing: 'border-box',
                    overflow: 'hidden',
                    position: 'relative',
                    zIndex: 1,
                  }}
                >
                  <Box sx={{ width: isMobile ? 8 : 9, height: isMobile ? 8 : 9, borderRadius: '50%', flexShrink: 0, bgcolor: roomStatusColor[room.status ?? 'VACANT'] ?? '#7E8AA0' }} />
                  <Box sx={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
                    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0, flexWrap: 'nowrap', overflow: 'hidden' }}>
                      <Typography variant="body2" fontWeight={800} lineHeight={1.1} color="text.primary" noWrap sx={{ fontSize: isMobile ? '0.78rem' : '0.8rem' }}>{room.number}</Typography>
                      {!isMobile && room.floor ? <Chip size="small" label={`T${room.floor}`} sx={{ height: 17, fontSize: 9, bgcolor: alpha(theme.palette.text.primary, mode === 'light' ? 0.08 : 0.12), color: 'text.primary', flexShrink: 0 }} /> : null}
                      {!isMobile && activeCount > 0 ? <Chip size="small" label={`${activeCount} booking`} sx={{ height: 17, fontSize: 9, bgcolor: alpha(theme.palette.primary.main, mode === 'light' ? 0.14 : 0.18), color: mode === 'light' ? theme.palette.primary.dark : theme.palette.primary.light, flexShrink: 0 }} /> : null}
                    </Stack>
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', fontSize: isMobile ? '0.63rem' : '0.66rem' }}>
                      {isMobile ? (room.building?.code || '—') : `${room.building?.code} · ${room.roomType?.name || 'Chưa phân loại'}`}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>

          <Box sx={{ position: 'relative', flexShrink: 0, width: totalW }}>
            <Box sx={{ position: 'sticky', top: 0, zIndex: 30, bgcolor: theme.palette.background.paper, boxShadow: stickyShadow }}>
              <Box sx={{ display: 'flex', height: metrics.monthH, borderBottom: `1px solid ${gridBorder}` }}>
                {monthGroups.map((group) => (
                  <Box
                    key={group.key}
                    sx={{
                      width: group.count * adaptiveDayWidth,
                      minWidth: group.count * adaptiveDayWidth,
                      borderRight: `1px solid ${gridBorder}`,
                      px: 1.5,
                      display: 'flex',
                      alignItems: 'center',
                      bgcolor: stickyMonthBg,
                    }}
                  >
                    <Typography variant="caption" fontWeight={800} color="text.secondary" sx={{ fontSize: isMobile ? '0.66rem' : '0.7rem' }}>Tháng {group.label}</Typography>
                  </Box>
                ))}
              </Box>

              <Box sx={{ display: 'flex', height: metrics.headerH - metrics.monthH }}>
                {days.map((day, i) => {
                  const d = dayjs(day);
                  const isToday = i === todayIdx;
                  const isWeekend = d.day() === 0 || d.day() === 6;
                  return (
                    <Box
                      key={i}
                      sx={{
                        width: adaptiveDayWidth,
                        minWidth: adaptiveDayWidth,
                        flexShrink: 0,
                        borderRight: `1px solid ${gridBorder}`,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: isToday ? stickyTodayBg : isWeekend ? stickyWeekendBg : stickyHeaderBg,
                      }}
                    >
                      <Typography variant="caption" fontWeight={700} color={isToday ? 'primary.main' : 'text.secondary'} lineHeight={1} sx={{ fontSize: isMobile ? '0.6rem' : '0.66rem' }}>{d.format('dd').toUpperCase()}</Typography>
                      <Typography variant="body2" fontWeight={800} color={isToday ? 'primary.main' : 'text.primary'} sx={{ fontSize: isMobile ? '0.84rem' : '0.88rem' }}>{d.format('DD')}</Typography>
                    </Box>
                  );
                })}
              </Box>
            </Box>

            <Box sx={{ position: 'relative' }}>
              {currentTimeLeft !== null && (
                <Box sx={{ position: 'absolute', top: 0, bottom: 0, left: currentTimeLeft, borderLeft: `2px dashed ${currentTimeColor}`, pointerEvents: 'none', zIndex: 4, opacity: 0.92 }} />
              )}

              {timelineRows.map((row) => {
                if (row.kind === 'separator') {
                  return (
                    <Box key={row.key} sx={{ position: 'relative', height: separatorHeight, display: 'flex', borderBottom: `1px solid ${gridBorder}`, boxSizing: 'border-box' }}>
                      {days.map((_, i) => (
                        <Box
                          key={i}
                          sx={{
                            width: adaptiveDayWidth,
                            minWidth: adaptiveDayWidth,
                            height: separatorHeight,
                            flexShrink: 0,
                            borderRight: `1px solid ${gridBorder}`,
                            bgcolor: 'transparent',
                          }}
                        />
                      ))}
                    </Box>
                  );
                }

                const room = row.room;
                const roomRes = resByRoom.get(room.id) ?? [];
                return (
                  <Box key={row.key} sx={{ position: 'relative', height: metrics.cellH, display: 'flex', borderBottom: `1px solid ${gridBorder}`, boxSizing: 'border-box' }}>
                    {days.map((day, i) => {
                      const isToday = i === todayIdx;
                      const isWeekend = dayjs(day).day() === 0 || dayjs(day).day() === 6;
                      return (
                        <Box
                          key={i}
                          onClick={() => onQuickCreate(room.id, dayjs(day).format('YYYY-MM-DD'))}
                          sx={{
                            width: adaptiveDayWidth,
                            minWidth: adaptiveDayWidth,
                            height: metrics.cellH,
                            flexShrink: 0,
                            borderRight: `1px solid ${gridBorder}`,
                            cursor: 'cell',
                            touchAction: 'manipulation',
                            bgcolor: isToday ? todayBg : isWeekend ? weekendBg : 'transparent',
                            '&:hover': { bgcolor: alpha(theme.palette.primary.main, mode === 'light' ? 0.08 : 0.12) },
                          }}
                        />
                      );
                    })}

                    {roomRes.map((res) => {
                      const geo = getBarStyle(res);
                      if (!geo) return null;
                      const { left, width, bg, border } = geo;
                      const showCode = width > 170;
                      const showDates = width > 265;
                      const GenderIcon = res.primaryGuestGender ? GENDER_ICON_MAP[res.primaryGuestGender] : null;
                      const nationalityFlag = resolveCountryFlag(res.primaryGuestNationality);
                      return (
                        <Tooltip
                          key={res.id}
                          placement="top"
                          arrow
                          title={
                            <Box>
                              <Typography variant="caption" fontWeight={700} display="block">{res.primaryGuestName}</Typography>
                              <Typography variant="caption" color="text.secondary" display="block">{res.reservationCode} · {geo.label}</Typography>
                              <Typography variant="caption" display="block">{dayjs(res.checkInDate).format('DD/MM/YYYY HH:mm')} → {dayjs(res.checkOutDate).format('DD/MM/YYYY HH:mm')}</Typography>
                              {res.primaryGuestNationality && (
                                <Typography variant="caption" display="block">
                                  Quốc tịch: {nationalityFlag ? `${nationalityFlag} ` : ''}{res.primaryGuestNationality}
                                </Typography>
                              )}
                              {res.company && <Typography variant="caption" color="text.secondary" display="block">{res.company}</Typography>}
                            </Box>
                          }
                        >
                          <Box
                            onClick={(e) => { e.stopPropagation(); onSelectReservation(res.id); }}
                            sx={{
                              position: 'absolute',
                              left,
                              width,
                              top: '50%',
                              transform: 'translateY(-50%)',
                              height: metrics.bookingH,
                              bgcolor: bg,
                              color: '#FFFFFF',
                              border: `1px solid ${border}`,
                              borderRadius: '9999px',
                              px: isMobile ? 0.35 : 0.5,
                              display: 'flex',
                              alignItems: 'center',
                              gap: isMobile ? 0.35 : 0.5,
                              cursor: 'pointer',
                              zIndex: 5,
                              overflow: 'hidden',
                              boxSizing: 'border-box',
                              boxShadow: 'none',
                              '&:hover': { filter: 'brightness(0.98)' },
                            }}
                          >
                            {GenderIcon ? <GenderIcon sx={{ fontSize: isMobile ? 14 : 15, flexShrink: 0, color: '#FFFFFF' }} /> : null}
                            <Typography
                              variant="body2"
                              sx={{
                                color: '#FFFFFF',
                                fontWeight: 700,
                                minWidth: 0,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'clip',
                                flex: showDates ? '0 1 46%' : 1,
                                fontSize: isMobile ? '0.72rem' : '0.72rem',
                                lineHeight: 1,
                              }}
                            >
                              {res.primaryGuestName}
                            </Typography>
                            {nationalityFlag ? (
                              <Typography component="span" sx={{ fontSize: '0.95rem', lineHeight: 1, flexShrink: 0 }}>
                                {nationalityFlag}
                              </Typography>
                            ) : null}
                            {!isMobile && showCode && <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.96)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'monospace', flexShrink: 0 }}>{res.reservationCode}</Typography>}
                            {!isMobile && showDates && <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.92)', fontWeight: 500, marginLeft: 'auto', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 0 }}>{dayjs(res.checkInDate).format('DD/MM HH:mm')} - {dayjs(res.checkOutDate).format('DD/MM HH:mm')}</Typography>}
                          </Box>
                        </Tooltip>
                      );
                    })}
                  </Box>
                );
              })}
            </Box>

            {loading && (
              <Box sx={{ position: 'absolute', inset: 0, bgcolor: alpha(theme.palette.background.default, mode === 'light' ? 0.56 : 0.42), display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 30 }}>
                <Typography color="text.secondary">Đang tải timeline...</Typography>
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
