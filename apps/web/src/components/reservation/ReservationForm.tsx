'use client';
import { useState, useEffect, useMemo } from 'react';
import dayjs from 'dayjs';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Grid, MenuItem, CircularProgress, Typography, useMediaQuery, Autocomplete, Box,
  FormControl, ToggleButton, ToggleButtonGroup, Stack,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import MaleIcon from '@mui/icons-material/Male';
import FemaleIcon from '@mui/icons-material/Female';
import TransgenderIcon from '@mui/icons-material/Transgender';
import {
  useCreateReservation, useUpdateReservation, useReservation, useCreateGuest, useQuickRoomSearch, useRoom,
} from '@/hooks/api';
import { api } from '@/lib/api';
import {
  useBridgeCreateGuest,
  useBridgeCreateReservation,
  useBridgeQuickRoomSearch,
  useBridgeRoom,
} from '@/hooks/bookingBridge';
import type { BookingBridgeAuthParams } from '@/lib/booking-bridge';
import { useToast } from '@/providers/ToastProvider';
import { COUNTRY_OPTIONS } from '@/lib/countries';

interface Props {
  open: boolean;
  onClose: () => void;
  initialRoomId?: string;
  initialDate?: string;
  initialCheckInDate?: string;
  initialCheckOutDate?: string;
  reservationId?: string;
  mode?: 'default' | 'bridge';
  bridgeAuth?: BookingBridgeAuthParams;
  initialSource?: string;
  sourceLocked?: boolean;
  initialThreadId?: string;
  draftKey?: string;
  onSubmitted?: (result: any) => void;
}

const DEFAULT_CHECKIN_TIME = '14:00';
const DEFAULT_CHECKOUT_TIME = '12:00';
const SOURCE_OPTIONS = [
  { value: 'airbnb', label: 'Airbnb' },
  { value: 'zalo', label: 'Zalo' },
  { value: 'sale', label: 'Sale' },
  { value: 'khac', label: 'Khác' },
] as const;
const GENDER_OPTIONS = [
  { value: 'MALE', label: 'Nam', icon: <MaleIcon fontSize="small" /> },
  { value: 'FEMALE', label: 'Nữ', icon: <FemaleIcon fontSize="small" /> },
  { value: 'NON_BINARY', label: 'Khác', icon: <TransgenderIcon fontSize="small" /> },
] as const;

const formatCurrency = (value: any) => {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return '—';
  return `${num.toLocaleString('vi-VN')}đ`;
};

function toDateTimeValue(value?: string | Date | null, fallbackTime?: string) {
  if (!value) return '';
  const d = dayjs(value);
  if (!d.isValid()) return '';
  const hasTime = String(value).includes('T');
  if (hasTime) return d.format('YYYY-MM-DDTHH:mm');
  return `${d.format('YYYY-MM-DD')}T${fallbackTime ?? DEFAULT_CHECKIN_TIME}`;
}

function buildDefaultForm(initialDate?: string, initialRoomId?: string, initialCheckInDate?: string, initialCheckOutDate?: string, initialSource?: string, initialThreadId?: string) {
  const baseDate = initialDate ? dayjs(initialDate) : dayjs();
  const checkIn = initialCheckInDate ? toDateTimeValue(initialCheckInDate, DEFAULT_CHECKIN_TIME) : `${baseDate.format('YYYY-MM-DD')}T${DEFAULT_CHECKIN_TIME}`;
  const checkOut = initialCheckOutDate ? toDateTimeValue(initialCheckOutDate, DEFAULT_CHECKOUT_TIME) : `${baseDate.add(1, 'day').format('YYYY-MM-DD')}T${DEFAULT_CHECKOUT_TIME}`;
  return {
    fullName: '', phone: '', email: '', gender: '', company: '', source: initialSource || '', nationality: 'Việt Nam',
    threadId: initialThreadId || '',
    checkInDate: checkIn, checkOutDate: checkOut,
    buildingId: '', roomTypeId: '', roomId: initialRoomId ?? '',
    adults: 2, children: 0,
    pricePerNight: 0, depositAmount: 0, notes: '',
  };
}

export function ReservationForm({ open, onClose, initialRoomId, initialDate, initialCheckInDate, initialCheckOutDate, reservationId, mode = 'default', bridgeAuth, initialSource, sourceLocked = false, initialThreadId, draftKey, onSubmitted }: Props) {
  const { toast } = useToast();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('lg'));
  const isEdit = !!reservationId;
  const pickerSurfaceSx = {
    bgcolor: 'var(--bg-primary)',
    backgroundImage: 'none',
    backdropFilter: 'none',
    opacity: 1,
    boxShadow: theme.shadows[12],
    '& .MuiPickersLayout-root': {
      bgcolor: 'var(--bg-primary)',
    },
    '& .MuiPickersToolbar-root, & .MuiDateCalendar-root, & .MuiTimeClock-root, & .MuiMultiSectionDigitalClock-root, & .MuiPickersActionBar-root': {
      bgcolor: 'transparent',
    },
  };

  const bridgeMode = mode === 'bridge';
  const storageDraftKey = !bridgeMode && draftKey ? `reservation-form:${draftKey}` : '';
  const [form, setForm] = useState(() => buildDefaultForm(initialDate, initialRoomId, initialCheckInDate, initialCheckOutDate, initialSource, initialThreadId));
  const [bridgePrefillDone, setBridgePrefillDone] = useState(false);
  const [bridgePrefillHasReservation, setBridgePrefillHasReservation] = useState(false);
  const [priceTouched, setPriceTouched] = useState(false);

  const { data: editData, isLoading: editLoading } = useReservation(reservationId ?? '');
  const editRes = editData?.data;
  const primaryGuestProfile = editRes?.guests?.find((guest: any) => guest.isPrimary)?.guest ?? editRes?.guests?.[0]?.guest;

  useEffect(() => {
    if (isEdit && editRes) {
      setForm({
        fullName: editRes.primaryGuestName ?? '',
        phone: '', email: '', gender: primaryGuestProfile?.gender ?? '', company: editRes.company ?? '', source: editRes.source ?? '', nationality: '',
        threadId: editRes.threadId ?? '',
        checkInDate: toDateTimeValue(editRes.checkInDate, DEFAULT_CHECKIN_TIME),
        checkOutDate: toDateTimeValue(editRes.checkOutDate, DEFAULT_CHECKOUT_TIME),
        buildingId: editRes.room?.buildingId ?? '',
        roomTypeId: editRes.room?.roomTypeId ?? '',
        roomId: editRes.roomId ?? '',
        adults: editRes.adults ?? 2,
        children: editRes.children ?? 0,
        pricePerNight: Number(editRes.pricePerNight) ?? 0,
        depositAmount: Number(editRes.depositAmount) ?? 0,
        notes: editRes.notes ?? '',
      });
    }
  }, [isEdit, editRes, primaryGuestProfile?.gender]);

  useEffect(() => {
    if (!isEdit) {
      setForm((f) => ({
        ...f,
        roomId: initialRoomId ?? f.roomId,
        source: sourceLocked ? (initialSource || f.source || '') : f.source,
        threadId: sourceLocked ? (initialThreadId || f.threadId || '') : (f.threadId || initialThreadId || ''),
        checkInDate: initialCheckInDate
          ? toDateTimeValue(initialCheckInDate, DEFAULT_CHECKIN_TIME)
          : initialDate
            ? `${initialDate}T${DEFAULT_CHECKIN_TIME}`
            : f.checkInDate || `${dayjs().format('YYYY-MM-DD')}T${DEFAULT_CHECKIN_TIME}`,
        checkOutDate: initialCheckOutDate
          ? toDateTimeValue(initialCheckOutDate, DEFAULT_CHECKOUT_TIME)
          : initialDate
            ? `${dayjs(initialDate).add(1, 'day').format('YYYY-MM-DD')}T${DEFAULT_CHECKOUT_TIME}`
            : f.checkOutDate || `${dayjs().add(1, 'day').format('YYYY-MM-DD')}T${DEFAULT_CHECKOUT_TIME}`,
      }));
    }
  }, [initialRoomId, initialDate, initialCheckInDate, initialCheckOutDate, isEdit, initialSource, initialThreadId, sourceLocked]);

  useEffect(() => {
    if (!bridgeMode) return;
    setBridgePrefillDone(true);
    setBridgePrefillHasReservation(false);
    setPriceTouched(false);
    setForm(buildDefaultForm(initialDate, initialRoomId, initialCheckInDate, initialCheckOutDate, initialSource, initialThreadId));
  }, [bridgeMode, draftKey, initialDate, initialRoomId, initialCheckInDate, initialCheckOutDate, initialSource, initialThreadId]);

  useEffect(() => {
    if (isEdit || !storageDraftKey || typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(storageDraftKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setForm((prev) => ({
        ...prev,
        ...(parsed && typeof parsed === 'object' ? parsed : {}),
        source: sourceLocked ? (initialSource || 'zalo') : (parsed?.source || prev.source),
        threadId: sourceLocked ? (initialThreadId || '') : (parsed?.threadId || prev.threadId || ''),
      }));
    } catch {}
  }, [isEdit, storageDraftKey, initialSource, initialThreadId, sourceLocked]);

  useEffect(() => {
    if (isEdit || !storageDraftKey || typeof window === 'undefined') return;
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(storageDraftKey, JSON.stringify(form));
      } catch {}
    }, 180);
    return () => window.clearTimeout(timer);
  }, [form, isEdit, storageDraftKey]);

  const canSearchRooms = !isEdit && !!form.checkInDate && !!form.checkOutDate && dayjs(form.checkOutDate).valueOf() > dayjs(form.checkInDate).valueOf();
  const roomSearchParams = useMemo(() => (
    canSearchRooms
      ? {
          checkInDate: form.checkInDate,
          checkOutDate: form.checkOutDate,
        }
      : undefined
  ), [canSearchRooms, form.checkInDate, form.checkOutDate]);
  const standardRoomsQuery = useQuickRoomSearch(roomSearchParams, canSearchRooms && !bridgeMode);
  const bridgeRoomsQuery = useBridgeQuickRoomSearch(roomSearchParams, canSearchRooms && bridgeMode, bridgeAuth || null);
  const roomsData = bridgeMode ? bridgeRoomsQuery.data : standardRoomsQuery.data;
  const roomsLoading = bridgeMode ? bridgeRoomsQuery.isFetching : standardRoomsQuery.isFetching;
  const rooms: any[] = Array.isArray(roomsData?.data) ? roomsData.data : [];
  const standardRoomQuery = useRoom(!bridgeMode && !isEdit && form.roomId ? form.roomId : '');
  const bridgeRoomQuery = useBridgeRoom(bridgeMode && !isEdit && form.roomId ? form.roomId : '', bridgeAuth || null);
  const selectedRoomData = bridgeMode ? bridgeRoomQuery.data : standardRoomQuery.data;
  const selectedRoomFallback = selectedRoomData?.data;
  const selectedRoomOption = rooms.find((r: any) => r.roomId === form.roomId) ?? (selectedRoomFallback ? {
    roomId: selectedRoomFallback.id,
    roomNumber: selectedRoomFallback.number,
    price: selectedRoomFallback.price,
    discountablePrice: selectedRoomFallback.discountablePrice,
    building: selectedRoomFallback.building ? {
      id: selectedRoomFallback.building.id,
      code: selectedRoomFallback.building.code,
      name: selectedRoomFallback.building.name,
    } : undefined,
    roomType: selectedRoomFallback.roomType ? {
      id: selectedRoomFallback.roomType.id,
      name: selectedRoomFallback.roomType.name,
    } : undefined,
  } : null);

  useEffect(() => {
    if (isEdit || !form.roomId || !selectedRoomOption) return;
    setForm((f) => {
      const nextBuildingId = selectedRoomOption.building?.id ?? '';
      const nextRoomTypeId = selectedRoomOption.roomType?.id ?? '';
      const defaultRoomPrice = selectedRoomOption.discountablePrice != null
        ? Number(selectedRoomOption.discountablePrice)
        : selectedRoomOption.price != null
          ? Number(selectedRoomOption.price)
          : Number(f.pricePerNight || 0);
      const nextPrice = priceTouched && f.roomId === selectedRoomOption.roomId
        ? Number(f.pricePerNight)
        : defaultRoomPrice;
      if (f.buildingId === nextBuildingId && f.roomTypeId === nextRoomTypeId && Number(f.pricePerNight) === Number(nextPrice)) {
        return f;
      }
      return {
        ...f,
        buildingId: nextBuildingId,
        roomTypeId: nextRoomTypeId,
        pricePerNight: nextPrice,
      };
    });
  }, [form.roomId, isEdit, priceTouched, selectedRoomOption?.roomId, selectedRoomOption?.building?.id, selectedRoomOption?.roomType?.id, selectedRoomOption?.price, selectedRoomOption?.discountablePrice]);

  const standardCreateRes = useCreateReservation();
  const bridgeCreateRes = useBridgeCreateReservation(bridgeAuth || null);
  const createRes = bridgeMode ? bridgeCreateRes : standardCreateRes;
  const updateRes = useUpdateReservation();
  const standardCreateGuest = useCreateGuest();
  const bridgeCreateGuest = useBridgeCreateGuest(bridgeAuth || null);
  const createGuest = bridgeMode ? bridgeCreateGuest : standardCreateGuest;
  const [threadLookupLoading, setThreadLookupLoading] = useState(false);
  const [threadLookupHint, setThreadLookupHint] = useState('');
  const [autoResolvedThreadId, setAutoResolvedThreadId] = useState('');

  const set = (key: string) => (e: any) => {
    const value = e.target.value;
    if (key === 'roomId') setPriceTouched(false);
    if (key === 'pricePerNight') setPriceTouched(true);
    setForm((f) => ({ ...f, [key]: value }));
  };

  useEffect(() => {
    if (isEdit || bridgeMode || form.source !== 'zalo') {
      setThreadLookupLoading(false);
      setThreadLookupHint('');
      setAutoResolvedThreadId('');
      return;
    }

    const normalizedPhone = String(form.phone || '').replace(/\D+/g, '');
    if (normalizedPhone.length < 8) {
      setThreadLookupLoading(false);
      setThreadLookupHint('');
      setAutoResolvedThreadId('');
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setThreadLookupLoading(true);
        setThreadLookupHint('Đang tìm thread Zalo từ số điện thoại...');
        const payload = await api.get('/reservations/zalo-thread-lookup', { phone: normalizedPhone });
        const resolvedThreadId = String(payload?.item?.threadId || '').trim();
        if (resolvedThreadId) {
          setForm((prev) => ({
            ...prev,
            threadId: resolvedThreadId,
          }));
          setAutoResolvedThreadId(resolvedThreadId);
          setThreadLookupHint(payload?.item?.displayName
            ? `Đã tự điền thread ID của ${payload.item.displayName}.`
            : 'Đã tự điền thread ID Zalo.');
          return;
        }
        setThreadLookupHint('Không tìm thấy thread Zalo theo số điện thoại này.');
        setForm((prev) => ({
          ...prev,
          threadId: prev.threadId === autoResolvedThreadId ? '' : prev.threadId,
        }));
        setAutoResolvedThreadId('');
      } catch (error: any) {
        if (controller.signal.aborted) return;
        setThreadLookupHint(error?.message || 'Không tra được thread ID Zalo.');
      } finally {
        if (!controller.signal.aborted) setThreadLookupLoading(false);
      }
    }, 450);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [autoResolvedThreadId, bridgeMode, form.phone, form.source, isEdit]);

  const handleSubmit = async () => {
    if (!form.fullName || !form.checkInDate || !form.checkOutDate) {
      toast('Vui lòng điền tên khách và ngày giờ đến/đi', 'warning'); return;
    }
    if (!isEdit && !form.source) {
      toast('Vui lòng chọn nền tảng đặt phòng', 'warning'); return;
    }
    if (!isEdit && form.source === 'zalo' && !form.phone.trim()) {
      toast('Booking từ Zalo bắt buộc phải nhập số điện thoại', 'warning'); return;
    }
    if (dayjs(form.checkOutDate).valueOf() <= dayjs(form.checkInDate).valueOf()) {
      toast('Giờ trả phòng phải sau giờ nhận phòng', 'warning'); return;
    }
    if (!isEdit && !form.roomId) {
      toast('Vui lòng chọn căn hộ', 'warning'); return;
    }

    try {
      if (isEdit) {
        await updateRes.mutateAsync({
          id: reservationId,
          primaryGuestName: form.fullName,
          company: form.company || undefined,
          checkInDate: form.checkInDate,
          checkOutDate: form.checkOutDate,
          adults: Number(form.adults),
          children: Number(form.children),
          pricePerNight: Number(form.pricePerNight),
          depositAmount: Number(form.depositAmount),
          notes: form.notes || undefined,
        });
        toast('Cập nhật đặt phòng thành công!');
      } else {
        let guestIds: string[] = [];
        if (form.phone || form.email || form.nationality || form.gender) {
          try {
            const gRes = await createGuest.mutateAsync({
              fullName: form.fullName,
              phone: form.phone || undefined,
              email: form.email || undefined,
              gender: form.gender || undefined,
              nationality: form.nationality || undefined,
            });
            guestIds = [gRes?.data?.id ?? gRes?.id];
          } catch {}
        }
        const createResult = await createRes.mutateAsync({
          roomId: form.roomId,
          primaryGuestName: form.fullName,
          company: form.company || undefined,
          source: form.source,
          threadId: form.source === 'zalo' ? (form.threadId?.trim() || undefined) : undefined,
          checkInDate: form.checkInDate,
          checkOutDate: form.checkOutDate,
          adults: Number(form.adults),
          children: Number(form.children),
          pricePerNight: Number(form.pricePerNight),
          depositAmount: Number(form.depositAmount),
          notes: form.notes || undefined,
          guestIds: guestIds.filter(Boolean),
        });
        toast('Tạo đặt phòng thành công!');
        onSubmitted?.(createResult);
      }
      if (!isEdit && storageDraftKey && typeof window !== 'undefined') {
        localStorage.removeItem(storageDraftKey);
      }
      onClose();
      if (!isEdit) setForm(buildDefaultForm(initialDate, initialRoomId, initialCheckInDate, initialCheckOutDate, initialSource, initialThreadId));
    } catch (e: any) {
      toast(e?.message ?? 'Có lỗi xảy ra', 'error');
    }
  };

  const loading = createRes.isPending || updateRes.isPending;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth fullScreen={fullScreen}>
      <DialogTitle fontWeight={700}>{isEdit ? 'Sửa đặt phòng' : 'Đặt phòng mới'}</DialogTitle>
      <DialogContent dividers>
        {isEdit && editLoading ? (
          <CircularProgress />
        ) : (
          <Grid container spacing={{ xs: 1.5, md: 2 }} sx={{ pt: 1 }}>
            <Grid item xs={12}>
              <Typography variant="caption" fontWeight={700} color="primary.main">THÔNG TIN KHÁCH</Typography>
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Tên khách *" value={form.fullName} onChange={set('fullName')} />
            </Grid>
            {!isEdit && (
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>Giới tính</Typography>
                  <ToggleButtonGroup
                    exclusive
                    fullWidth
                    value={form.gender}
                    onChange={(_, value) => setForm((f) => ({ ...f, gender: value ?? '' }))}
                    color="primary"
                  >
                    {GENDER_OPTIONS.map((option) => (
                      <ToggleButton
                        key={option.value}
                        value={option.value}
                        sx={{ flex: 1, textTransform: 'none', py: 1.1, px: 1 }}
                      >
                        <Stack direction="row" spacing={0.75} alignItems="center" justifyContent="center" sx={{ minWidth: 0 }}>
                          {option.icon}
                          <Typography variant="body2" fontWeight={600} noWrap>{option.label}</Typography>
                        </Stack>
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                </FormControl>
              </Grid>
            )}
            {!isEdit && (
              <>
                <Grid item xs={12} sm={6}>
                  <TextField select fullWidth label="Nền tảng *" value={form.source} onChange={set('source')} disabled={sourceLocked}>
                    {SOURCE_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label={form.source === 'zalo' ? 'Số điện thoại *' : 'Số điện thoại'}
                    value={form.phone}
                    onChange={set('phone')}
                    helperText={form.source === 'zalo' ? (threadLookupHint || 'Nhập SĐT để hệ thống tự tìm thread ID nếu tra được.') : undefined}
                  />
                </Grid>
                {form.source === 'zalo' && (
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Thread ID Zalo"
                      value={form.threadId}
                      onChange={set('threadId')}
                      helperText={threadLookupLoading ? 'Đang tra cứu...' : 'Có thể tự điền từ số điện thoại nếu tìm được.'}
                    />
                  </Grid>
                )}
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Email" type="email" value={form.email} onChange={set('email')} />
                </Grid>
                <Grid item xs={12}>
                  <Autocomplete
                    options={COUNTRY_OPTIONS}
                    autoHighlight
                    value={COUNTRY_OPTIONS.find((country) => country.label === form.nationality) ?? null}
                    onChange={(_, value) => setForm((f) => ({ ...f, nationality: value?.label ?? '' }))}
                    getOptionLabel={(option) => option.label}
                    isOptionEqualToValue={(option, value) => option.code === value.code}
                    filterOptions={(options, state) => {
                      const query = state.inputValue.trim().toLowerCase();
                      if (!query) return options;
                      return options.filter((option) => option.searchText.includes(query));
                    }}
                    renderOption={(props, option) => (
                      <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <span style={{ fontSize: 20, lineHeight: 1 }}>{option.flag}</span>
                        <span>{option.label}</span>
                      </Box>
                    )}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Quốc tịch"
                        placeholder="Gõ để tìm quốc gia hoặc vùng lãnh thổ"
                      />
                    )}
                  />
                </Grid>
              </>
            )}
            <Grid item xs={12}>
              <TextField fullWidth label="Công ty" value={form.company} onChange={set('company')} />
            </Grid>

            <Grid item xs={12}>
              <Typography variant="caption" fontWeight={700} color="primary.main" sx={{ mt: 1, display: 'block' }}>
                THÔNG TIN ĐẶT PHÒNG
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="vi">
                <DateTimePicker
                  label="Nhận phòng *"
                  format="DD/MM/YYYY HH:mm"
                  ampm={false}
                  value={form.checkInDate ? dayjs(form.checkInDate) : null}
                  onChange={(value) => setForm((f) => ({ ...f, checkInDate: value?.isValid() ? value.format('YYYY-MM-DDTHH:mm') : '' }))}
                  slotProps={{
                    textField: { fullWidth: true },
                    desktopPaper: { sx: pickerSurfaceSx },
                    mobilePaper: { sx: pickerSurfaceSx },
                  }}
                />
              </LocalizationProvider>
            </Grid>
            <Grid item xs={12} sm={6}>
              <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="vi">
                <DateTimePicker
                  label="Trả phòng *"
                  format="DD/MM/YYYY HH:mm"
                  ampm={false}
                  value={form.checkOutDate ? dayjs(form.checkOutDate) : null}
                  onChange={(value) => setForm((f) => ({ ...f, checkOutDate: value?.isValid() ? value.format('YYYY-MM-DDTHH:mm') : '' }))}
                  slotProps={{
                    textField: { fullWidth: true },
                    desktopPaper: { sx: pickerSurfaceSx },
                    mobilePaper: { sx: pickerSurfaceSx },
                  }}
                />
              </LocalizationProvider>
            </Grid>

            {!isEdit && (
              <>
                <Grid item xs={12}>
                  <TextField
                    select
                    fullWidth
                    label="Mã phòng *"
                    value={form.roomId}
                    onChange={set('roomId')}
                  >
                    {!canSearchRooms && <MenuItem disabled value="">Nhập ngày giờ hợp lệ để tìm căn phù hợp</MenuItem>}
                    {canSearchRooms && rooms.length === 0 && <MenuItem disabled value="">Không có căn trống phù hợp trong khoảng thời gian này</MenuItem>}
                    {rooms.map((r: any) => (
                      <MenuItem key={r.roomId} value={r.roomId}>
                        {r.roomNumber} — {r.building?.code} — {r.roomType?.name} — {formatCurrency(r.price)}
                      </MenuItem>
                    ))}
                    {form.roomId && !rooms.find((r: any) => r.roomId === form.roomId) && selectedRoomOption && (
                      <MenuItem value={form.roomId}>
                        {selectedRoomOption.roomNumber ?? 'Phòng đã chọn'} — {selectedRoomOption.building?.code ?? '—'} — {selectedRoomOption.roomType?.name ?? 'Đã chọn từ timeline'}
                      </MenuItem>
                    )}
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth disabled label="Toà nhà" value={selectedRoomOption?.building?.name ?? ''} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth disabled label="Loại phòng" value={selectedRoomOption?.roomType?.name ?? ''} />
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth disabled label="Giá bán mặc định của căn" value={formatCurrency(selectedRoomOption?.discountablePrice ?? selectedRoomOption?.price)} helperText="Khi chọn căn, giá/đêm bên dưới sẽ tự nhảy theo giá mặc định của căn; vẫn có thể sửa tay khi chốt booking." />
                </Grid>
              </>
            )}
            {isEdit && editRes?.room && (
              <Grid item xs={12}>
                <TextField fullWidth disabled label="Căn hộ (không đổi ở đây — dùng Đổi phòng)" value={`${editRes.room.number} — ${editRes.room.building?.name ?? ''}`} />
              </Grid>
            )}

            <Grid item xs={6} md={3}>
              <TextField fullWidth type="number" label="Người lớn" value={form.adults} onChange={set('adults')} inputProps={{ min: 1 }} />
            </Grid>
            <Grid item xs={6} md={3}>
              <TextField fullWidth type="number" label="Trẻ em" value={form.children} onChange={set('children')} inputProps={{ min: 0 }} />
            </Grid>
            <Grid item xs={6} md={3}>
              <TextField fullWidth type="number" label="Giá/đêm (đ)" value={form.pricePerNight} onChange={set('pricePerNight')} inputProps={{ min: 0 }} />
            </Grid>
            <Grid item xs={6} md={3}>
              <TextField fullWidth type="number" label="Tiền cọc (đ)" value={form.depositAmount} onChange={set('depositAmount')} inputProps={{ min: 0 }} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth multiline rows={2} label="Ghi chú" value={form.notes} onChange={set('notes')} />
            </Grid>
          </Grid>
        )}
      </DialogContent>
      <DialogActions sx={{ p: { xs: 1.5, md: 2 }, gap: 1, flexWrap: 'wrap' }}>
        <Button onClick={onClose}>Huỷ</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={loading}>
          {loading ? <CircularProgress size={20} color="inherit" /> : isEdit ? 'Lưu thay đổi' : 'Tạo đặt phòng'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
