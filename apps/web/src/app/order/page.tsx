'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Alert, AppBar, Badge, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog,
  DialogActions, DialogContent, DialogTitle, Divider, IconButton, Stack, TextField, Toolbar,
  MenuItem, Typography,
} from '@mui/material';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';
import RoomServiceIcon from '@mui/icons-material/RoomService';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import { api } from '@/lib/api';

const COLORS = {
  mahogany: '#2c2c2c',
  parchment: '#d8cbb8',
  amber: '#d49653',
  linen: '#dfdad5',
  stone: '#b6ab9c',
};

const serif = 'Georgia, "Times New Roman", serif';
const sans = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

type Lang = 'vi' | 'ko' | 'zh-CN' | 'zh-TW' | 'en';

const LANGS: { code: Lang; flag: string; label: string }[] = [
  { code: 'vi', flag: '🇻🇳', label: 'Tiếng Việt' },
  { code: 'ko', flag: '🇰🇷', label: '한국어' },
  { code: 'zh-CN', flag: '🇨🇳', label: '简体中文' },
  { code: 'zh-TW', flag: '🇨🇳', label: '繁體中文' },
  { code: 'en', flag: '🇺🇸', label: 'English' },
];

const I18N: Record<Lang, Record<string, string>> = {
  vi: {
    loading: 'Đang mở menu phòng...', invalidLink: 'Link QR không hợp lệ.', brand: 'ChiHome Service', privateMenu: 'Private room menu', heroTitleA: 'Room', heroTitleB: 'Service',
    heroDesc: 'Chọn món tại phòng {room}. Giá và sản phẩm được hệ thống tính lại ở backend khi thanh toán.', roomCode: 'Mã phòng', products: 'sản phẩm', guest: 'Khách', stayInfo: 'Thông tin lưu trú', checkIn: 'Giờ in', checkOut: 'Giờ out', empty: 'Hiện chưa có sản phẩm đang bán cho phòng này.',
    viewCart: 'Xem giỏ hàng', items: 'món', cart: 'Giỏ hàng', note: 'Ghi chú cho bếp/lễ tân', total: 'Tổng cộng', close: 'Đóng', submit: 'Đặt hàng & Thanh toán', submitting: 'Đang tạo đơn...', payTitle: 'Thanh toán đơn hàng', paySuccess: 'Đơn {code} đã tạo, vui lòng chuyển khoản đúng nội dung.', paymentWaiting: 'Đang chờ thanh toán. Màn hình sẽ tự cập nhật khi Sepay báo giao dịch thành công.', paymentConfirmed: 'Thanh toán thành công. Đơn của bạn đã được ghi nhận.', paymentHistory: 'Lịch sử thanh toán', historyEmpty: 'Chưa có đơn đã thanh toán trong kỳ hiện tại.', historyReset: 'Tự làm mới lúc 12:00 trưa mỗi ngày', paid: 'Đã thanh toán', missingQr: 'Chưa cấu hình tài khoản VietQR trong backend.', amount: 'Tổng tiền', transferNote: 'Nội dung CK', ok: 'Đã hiểu', orderError: 'Không tạo được đơn hàng. Vui lòng thử lại hoặc liên hệ lễ tân.',
  },
  ko: {
    loading: '객실 메뉴를 여는 중...', invalidLink: 'QR 링크가 유효하지 않습니다.', brand: 'ChiHome Service', privateMenu: '객실 전용 메뉴', heroTitleA: 'Room', heroTitleB: 'Service',
    heroDesc: '{room}호에서 상품을 선택하세요. 가격과 상품 정보는 결제 시 서버에서 다시 확인됩니다.', roomCode: '객실 번호', products: '개 상품', guest: '고객', stayInfo: '투숙 정보', checkIn: '체크인', checkOut: '체크아웃', empty: '현재 이 객실에서 판매 중인 상품이 없습니다.',
    viewCart: '장바구니 보기', items: '개', cart: '장바구니', note: '주방/프런트 요청사항', total: '합계', close: '닫기', submit: '주문 및 결제', submitting: '주문 생성 중...', payTitle: '주문 결제', paySuccess: '{code} 주문이 생성되었습니다. 정확한 이체 내용을 입력해 주세요.', paymentWaiting: '결제를 기다리는 중입니다. SePay 확인 후 자동으로 업데이트됩니다.', paymentConfirmed: '결제가 완료되었습니다. 주문이 접수되었습니다.', paymentHistory: '결제 내역', historyEmpty: '현재 기간에 결제 완료된 주문이 없습니다.', historyReset: '매일 12:00에 초기화됩니다', paid: '결제 완료', missingQr: 'VietQR 계좌가 아직 설정되지 않았습니다.', amount: '총 금액', transferNote: '이체 내용', ok: '확인', orderError: '주문을 생성할 수 없습니다. 다시 시도하거나 프런트에 문의해 주세요.',
  },
  'zh-CN': {
    loading: '正在打开房间菜单...', invalidLink: 'QR 链接无效。', brand: 'ChiHome Service', privateMenu: '房间专属菜单', heroTitleA: 'Room', heroTitleB: 'Service',
    heroDesc: '请为 {room} 房选择商品。价格和商品信息会在付款时由后台重新校验。', roomCode: '房间号', products: '件商品', guest: '客人', stayInfo: '入住信息', checkIn: '入住时间', checkOut: '退房时间', empty: '此房间暂无可售商品。',
    viewCart: '查看购物车', items: '件', cart: '购物车', note: '给厨房/前台的备注', total: '合计', close: '关闭', submit: '下单并付款', submitting: '正在创建订单...', payTitle: '订单付款', paySuccess: '订单 {code} 已创建，请按正确备注转账。', paymentWaiting: '正在等待付款。SePay 确认成功后页面会自动更新。', paymentConfirmed: '付款成功，订单已确认。', paymentHistory: '付款记录', historyEmpty: '当前周期暂无已付款订单。', historyReset: '每天中午 12:00 自动刷新', paid: '已付款', missingQr: '后台尚未配置 VietQR 账户。', amount: '总金额', transferNote: '转账备注', ok: '知道了', orderError: '无法创建订单。请重试或联系前台。',
  },
  'zh-TW': {
    loading: '正在開啟房間菜單...', invalidLink: 'QR 連結無效。', brand: 'ChiHome Service', privateMenu: '房間專屬菜單', heroTitleA: 'Room', heroTitleB: 'Service',
    heroDesc: '請為 {room} 房選擇商品。價格和商品資訊會在付款時由後台重新校驗。', roomCode: '房號', products: '項商品', guest: '客人', stayInfo: '入住資訊', checkIn: '入住時間', checkOut: '退房時間', empty: '此房間暫無可售商品。',
    viewCart: '查看購物車', items: '項', cart: '購物車', note: '給廚房/櫃台的備註', total: '合計', close: '關閉', submit: '下單並付款', submitting: '正在建立訂單...', payTitle: '訂單付款', paySuccess: '訂單 {code} 已建立，請按正確備註轉帳。', paymentWaiting: '正在等待付款。SePay 確認成功後頁面會自動更新。', paymentConfirmed: '付款成功，訂單已確認。', paymentHistory: '付款紀錄', historyEmpty: '目前週期暫無已付款訂單。', historyReset: '每天中午 12:00 自動刷新', paid: '已付款', missingQr: '後台尚未設定 VietQR 帳戶。', amount: '總金額', transferNote: '轉帳備註', ok: '知道了', orderError: '無法建立訂單。請重試或聯絡櫃台。',
  },
  en: {
    loading: 'Opening room menu...', invalidLink: 'Invalid QR link.', brand: 'ChiHome Service', privateMenu: 'Private room menu', heroTitleA: 'Room', heroTitleB: 'Service',
    heroDesc: 'Choose items for room {room}. Prices and products are verified again by the backend at checkout.', roomCode: 'Room code', products: 'products', guest: 'Guest', stayInfo: 'Stay information', checkIn: 'Check-in', checkOut: 'Check-out', empty: 'No products are currently available for this room.',
    viewCart: 'View cart', items: 'items', cart: 'Cart', note: 'Note for kitchen/front desk', total: 'Total', close: 'Close', submit: 'Order & Pay', submitting: 'Creating order...', payTitle: 'Order payment', paySuccess: 'Order {code} has been created. Please transfer with the exact reference.', paymentWaiting: 'Waiting for payment. This screen will update automatically after SePay confirms the transfer.', paymentConfirmed: 'Payment successful. Your order has been confirmed.', paymentHistory: 'Payment history', historyEmpty: 'No paid orders in the current window.', historyReset: 'Resets at 12:00 noon every day', paid: 'Paid', missingQr: 'VietQR account is not configured in the backend.', amount: 'Amount', transferNote: 'Transfer reference', ok: 'Got it', orderError: 'Could not create the order. Please try again or contact the front desk.',
  },
};

const PRODUCT_I18N: Record<string, Partial<Record<Lang, { name: string; description: string }>>> = {
  'Bao cao su': { ko: { name: '콘돔', description: '개별 포장, 객실까지 discreet delivery.' }, 'zh-CN': { name: '安全套', description: '独立包装，私密送达房间。' }, 'zh-TW': { name: '保險套', description: '獨立包裝，私密送達房間。' }, en: { name: 'Condom', description: 'Discreet pack, delivered privately to your room.' } },
  'Gel bôi trơn': { ko: { name: '윤활젤', description: '개인용 윤활젤, discreet delivery.' }, 'zh-CN': { name: '润滑液', description: '个人润滑液，私密送达。' }, 'zh-TW': { name: '潤滑液', description: '個人潤滑液，私密送達。' }, en: { name: 'Lubricant gel', description: 'Personal lubricant gel, discreet delivery.' } },
  'Khăn ướt': { ko: { name: '물티슈', description: '간편하게 사용할 수 있는 물티슈.' }, 'zh-CN': { name: '湿巾', description: '方便使用的湿巾。' }, 'zh-TW': { name: '濕紙巾', description: '方便使用的濕紙巾。' }, en: { name: 'Wet wipes', description: 'Convenient wet wipes pack.' } },
  'Mì Shin': { ko: { name: '신라면', description: '객실에서 간편하게 즐기는 매운 라면.' }, 'zh-CN': { name: '辛拉面', description: '适合在房间快速享用的辣味拉面。' }, 'zh-TW': { name: '辛拉麵', description: '適合在房間快速享用的辣味拉麵。' }, en: { name: 'Shin Ramyun', description: 'Spicy instant noodles for a quick in-room meal.' } },
  'Nước suối': { ko: { name: '생수', description: '500ml 생수.' }, 'zh-CN': { name: '矿泉水', description: '500ml 瓶装水。' }, 'zh-TW': { name: '礦泉水', description: '500ml 瓶裝水。' }, en: { name: 'Bottled water', description: '500ml bottled water.' } },
  'Bia': { ko: { name: '맥주', description: '시원한 맥주.' }, 'zh-CN': { name: '啤酒', description: '冰镇啤酒。' }, 'zh-TW': { name: '啤酒', description: '冰鎮啤酒。' }, en: { name: 'Beer', description: 'Chilled beer.' } },
};

const CATEGORY_I18N: Record<string, Partial<Record<Lang, string>>> = {
  'Tiện ích cá nhân': { ko: '개인용품', 'zh-CN': '个人用品', 'zh-TW': '個人用品', en: 'Personal essentials' },
  'Đồ ăn nhanh': { ko: '간편식', 'zh-CN': '快餐', 'zh-TW': '快餐', en: 'Quick bites' },
  'Đồ uống': { ko: '음료', 'zh-CN': '饮品', 'zh-TW': '飲品', en: 'Drinks' },
};

const money = (value: any) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;
const unwrap = (res: any) => res?.data ?? res;
const normalizeBrowserLang = (value: string): Lang | null => {
  const raw = value.toLowerCase();
  if (raw.startsWith('vi')) return 'vi';
  if (raw.startsWith('ko')) return 'ko';
  if (raw.startsWith('en')) return 'en';
  if (raw.startsWith('zh')) {
    if (raw.includes('tw') || raw.includes('hk') || raw.includes('mo') || raw.includes('hant')) return 'zh-TW';
    return 'zh-CN';
  }
  return null;
};
const detectInitialLang = (): Lang => {
  if (typeof window === 'undefined') return 'en';
  try {
    const saved = window.localStorage.getItem('chihome_order_lang') as Lang | null;
    if (saved && LANGS.some((item) => item.code === saved)) return saved;
  } catch {}
  const browserLangs = typeof navigator === 'undefined' ? [] : [navigator.language, ...(navigator.languages || [])].filter(Boolean);
  for (const browserLang of browserLangs) {
    const matched = normalizeBrowserLang(browserLang);
    if (matched) return matched;
  }
  return 'en';
};
const nextSaigonNoonMs = () => {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false,
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || '';
  const noonMs = Date.UTC(Number(get('year')), Number(get('month')) - 1, Number(get('day')), 5, 0, 0, 0);
  return now.getTime() >= noonMs ? noonMs + 24 * 60 * 60 * 1000 : noonMs;
};
const cartStorageKey = (roomId: string) => `chihome_order_cart_${roomId}`;
const formatDateTime = (value: any) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(date);
};

function OrderPageInner() {
  const search = useSearchParams();
  const queryRoomId = search.get('room_id') || search.get('roomId') || '';
  const queryToken = search.get('token') || '';
  const [roomId, setRoomId] = useState(() => {
    if (queryRoomId) return queryRoomId;
    if (typeof window === 'undefined') return '';
    try { return sessionStorage.getItem('chihome_order_room_id') || ''; } catch { return ''; }
  });
  const [token, setToken] = useState(() => {
    if (queryToken) return queryToken;
    if (typeof window === 'undefined') return '';
    const storedRoomId = queryRoomId || sessionStorage.getItem('chihome_order_room_id') || '';
    if (!storedRoomId) return '';
    try { return sessionStorage.getItem(`chihome_order_token_${storedRoomId}`) || ''; } catch { return ''; }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [session, setSession] = useState<any>(null);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [note, setNote] = useState('');
  const [cartOpen, setCartOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [orderResult, setOrderResult] = useState<any>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<string>('');
  const [paymentHistory, setPaymentHistory] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lang, setLang] = useState<Lang>('en');
  const t = (key: string, vars?: Record<string, any>) => {
    let text = I18N[lang]?.[key] ?? I18N.vi[key] ?? key;
    Object.entries(vars ?? {}).forEach(([name, value]) => { text = text.replace(`{${name}}`, String(value ?? '')); });
    return text;
  };
  const currentLang = LANGS.find((item) => item.code === lang) ?? LANGS[0];
  const localizeProductName = (name: string) => PRODUCT_I18N[name]?.[lang]?.name ?? name;
  const localizeProduct = (product: any) => PRODUCT_I18N[product.name]?.[lang] ?? { name: product.name, description: product.description };
  const localizeCategory = (name: string) => CATEGORY_I18N[name]?.[lang] ?? name;

  useEffect(() => {
    if (!roomId || typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(cartStorageKey(roomId));
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (!saved?.expiresAt || Date.now() >= Number(saved.expiresAt)) {
        localStorage.removeItem(cartStorageKey(roomId));
        return;
      }
      if (saved.cart && typeof saved.cart === 'object') setCart(saved.cart);
      if (typeof saved.note === 'string') setNote(saved.note);
    } catch {}
  }, [roomId]);

  useEffect(() => {
    if (!roomId || typeof window === 'undefined') return;
    try {
      localStorage.setItem(cartStorageKey(roomId), JSON.stringify({ cart, note, expiresAt: nextSaigonNoonMs() }));
    } catch {}
  }, [roomId, cart, note]);

  useEffect(() => {
    setLang(detectInitialLang());
  }, []);

  useEffect(() => {
    const nextRoomId = queryRoomId || roomId;
    if (!nextRoomId) return;
    const storageKey = `chihome_order_token_${nextRoomId}`;
    let nextToken = queryToken || token;
    try {
      sessionStorage.setItem('chihome_order_room_id', nextRoomId);
      if (queryToken) sessionStorage.setItem(storageKey, queryToken);
      else nextToken = sessionStorage.getItem(storageKey) || '';
    } catch {}
    setRoomId(nextRoomId);
    setToken(nextToken);

    if ((queryRoomId || queryToken) && typeof window !== 'undefined') {
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete('room_id');
      cleanUrl.searchParams.delete('roomId');
      cleanUrl.searchParams.delete('token');
      window.history.replaceState(null, '', `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
    }
  }, [queryRoomId, queryToken]);

  useEffect(() => {
    async function run() {
      setLoading(true);
      setError('');
      try {
        const res = await api.get('/public/addons/session', { room_id: roomId, token });
        setSession(unwrap(res));
      } catch (e: any) {
        setError(e?.message || t('invalidLink'));
      } finally {
        setLoading(false);
      }
    }
    if (roomId && token) run();
    else { setLoading(false); setError(t('invalidLink')); }
  }, [roomId, token]);

  const products = session?.menu?.products ?? [];
  const appearance = session?.appearance ?? {};
  const overlayOpacity = Math.min(Math.max(Number(appearance.overlayOpacity ?? 78), 0), 100) / 100;
  const cardOpacity = Math.min(Math.max(Number(appearance.cardOpacity ?? 54), 0), 100) / 100;
  const cartLines = useMemo(() => products.filter((p: any) => cart[p.id] > 0).map((p: any) => ({ ...p, quantity: cart[p.id], lineTotal: cart[p.id] * Number(p.price || 0) })), [products, cart]);
  const totalQuantity = cartLines.reduce((sum: number, item: any) => sum + item.quantity, 0);
  const totalAmount = cartLines.reduce((sum: number, item: any) => sum + item.lineTotal, 0);

  const add = (id: string) => setCart((current) => ({ ...current, [id]: Math.min((current[id] || 0) + 1, 99) }));
  const remove = (id: string) => setCart((current) => ({ ...current, [id]: Math.max((current[id] || 0) - 1, 0) }));

  const loadPaymentHistory = async () => {
    if (!roomId || !token) return;
    try {
      const res = await api.get('/public/addons/payment-history', { room_id: roomId, token });
      setPaymentHistory(unwrap(res));
    } catch {}
  };

  const loadActiveOrder = async () => {
    if (!roomId || !token) return;
    try {
      const res = await api.get('/public/addons/active-order', { room_id: roomId, token });
      const data = unwrap(res);
      if (data?.order?.status === 'PENDING_PAYMENT') {
        setOrderResult({ order: data.order, payment: data.payment });
        setPaymentStatus(data.order.status);
        restoreCartFromOrder(data.order);
        setPaymentOpen(false);
      }
    } catch {}
  };

  const restoreCartFromOrder = (order: any) => {
    const restoredCart: Record<string, number> = {};
    (order?.items || []).forEach((item: any) => {
      if (item.productId) restoredCart[item.productId] = item.quantity;
    });
    setCart(restoredCart);
  };

  const clearSavedCart = () => {
    setCart({});
    setNote('');
    try { if (roomId) localStorage.removeItem(cartStorageKey(roomId)); } catch {}
  };

  const submitOrder = async () => {
    setSubmitting(true);
    try {
      const res = await api.post('/public/addons/orders', {
        room_id: roomId,
        token,
        note,
        items: cartLines.map((item: any) => ({ product_id: item.id, quantity: item.quantity })),
      });
      const data = unwrap(res);
      setOrderResult(data);
      setPaymentStatus(data?.order?.status || 'PENDING_PAYMENT');
      if (data?.order?.status === 'PAID') clearSavedCart();
      setPaymentOpen(true);
      setCartOpen(false);
    } catch (e: any) {
      setError(e?.message || t('orderError'));
    } finally {
      setSubmitting(false);
    }
  };

  const closePaymentDialog = async () => {
    const order = orderResult?.order;
    setPaymentOpen(false);
    if (order?.status === 'PENDING_PAYMENT' && paymentStatus !== 'PAID') {
      restoreCartFromOrder(order);
      setOrderResult(null);
      setPaymentStatus('');
      try {
        await api.post(`/public/addons/orders/${encodeURIComponent(order.orderCode)}/cancel`, { room_id: roomId, token });
      } catch {}
    }
  };

  useEffect(() => {
    if (session) {
      void loadPaymentHistory();
      void loadActiveOrder();
    }
  }, [session, roomId, token]);

  useEffect(() => {
    const code = orderResult?.order?.orderCode;
    if (!code || paymentStatus !== 'PENDING_PAYMENT') return;

    let stopped = false;
    const check = async () => {
      try {
        const res = await api.get(`/public/addons/orders/${encodeURIComponent(code)}/status`, { room_id: roomId, token });
        const data = unwrap(res);
        if (!stopped) {
          setPaymentStatus(data?.order?.status || '');
          if (data?.order?.status === 'PAID') {
            clearSavedCart();
            void loadPaymentHistory();
          }
        }
      } catch {}
    };

    void check();
    const timer = window.setInterval(check, 3000);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [orderResult?.order?.orderCode, paymentStatus, roomId, token]);

  if (loading) return <Centered><CircularProgress sx={{ color: COLORS.parchment }} /><Typography>{t('loading')}</Typography></Centered>;
  if (error && !session) return <Centered><Alert severity="error" sx={{ maxWidth: 520 }}>{error}</Alert></Centered>;

  return (
    <Box sx={{ minHeight: '100svh', bgcolor: COLORS.mahogany, color: COLORS.parchment, pb: 13, fontFamily: sans, overflowX: 'hidden' }}>
      <Box sx={{ position: 'fixed', inset: 0, pointerEvents: 'none', backgroundImage: { xs: `url(${appearance.backgroundUrl || '/order/bg-mobile.jpg'})`, md: `url(${appearance.backgroundUrl || '/order/bg-tablet.jpg'})` }, backgroundSize: 'cover', backgroundPosition: { xs: 'center top', md: 'center center' }, backgroundRepeat: 'no-repeat', transform: 'translateZ(0)' }} />
      <Box sx={{ position: 'fixed', inset: 0, pointerEvents: 'none', background: { xs: `linear-gradient(180deg, rgba(20,18,16,${Math.min(overlayOpacity, .88)}), rgba(44,44,44,${overlayOpacity}) 42%, rgba(44,44,44,.96) 100%)`, md: `radial-gradient(circle at 18% 12%, rgba(212,150,83,.26), transparent 28%), linear-gradient(90deg, rgba(20,18,16,${Math.max(overlayOpacity - .18, .25)}), rgba(44,44,44,${overlayOpacity}) 58%, rgba(44,44,44,.96))` } }} />

      <AppBar position="sticky" elevation={0} sx={{ bgcolor: { xs: 'rgba(44,44,44,0.72)', md: 'rgba(44,44,44,0.82)' }, color: COLORS.parchment, backdropFilter: 'blur(18px)', borderBottom: `1px solid ${COLORS.stone}55` }}>
        <Toolbar sx={{ gap: { xs: 1, sm: 1.5 }, minHeight: { xs: 62, sm: 66 }, px: { xs: 1.25, sm: 2 } }}>
          <Box sx={{ width: 40, height: 40, border: `1px solid ${COLORS.parchment}`, color: COLORS.parchment, display: 'grid', placeItems: 'center', borderRadius: '3px' }}><RestaurantMenuIcon /></Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontFamily: serif, fontSize: 22, fontWeight: 300, letterSpacing: '-0.02em' }} noWrap>{t('brand')}</Typography>
            <Typography sx={{ fontSize: 12, color: COLORS.stone, letterSpacing: '.08em', textTransform: 'uppercase' }} noWrap>{session?.room?.buildingName || 'Private Room'} · {t('roomCode')} {session?.room?.number}</Typography>
          </Box>
          <TextField
            select
            size="small"
            value={lang}
            onChange={(e) => { const next = e.target.value as Lang; setLang(next); try { localStorage.setItem('chihome_order_lang', next); } catch {} }}
            SelectProps={{ renderValue: () => `${currentLang.flag} ${currentLang.label}` }}
            sx={languageSelectSx}
          >
            {LANGS.map((item) => <MenuItem key={item.code} value={item.code}>{item.flag} {item.label}</MenuItem>)}
          </TextField>
          <IconButton onClick={() => setHistoryOpen(true)} sx={{ color: COLORS.parchment, border: `1px solid ${COLORS.parchment}66`, borderRadius: '3px' }} aria-label={t('paymentHistory')}><Badge badgeContent={paymentHistory?.orders?.length ?? 0} sx={{ '& .MuiBadge-badge': { bgcolor: COLORS.amber, color: COLORS.mahogany, fontWeight: 900 } }}><ReceiptLongIcon /></Badge></IconButton>
          <IconButton onClick={() => setCartOpen(true)} sx={{ color: COLORS.parchment, border: `1px solid ${COLORS.parchment}66`, borderRadius: '3px' }} aria-label={t('cart')}><Badge badgeContent={totalQuantity} sx={{ '& .MuiBadge-badge': { bgcolor: COLORS.amber, color: COLORS.mahogany, fontWeight: 900 } }}><ShoppingCartIcon /></Badge></IconButton>
        </Toolbar>
      </AppBar>

      <Box sx={{ position: 'relative', maxWidth: 1120, mx: 'auto', px: { xs: 1.35, sm: 2, md: 3 }, pt: { xs: 2, sm: 3, md: 5 } }}>
        {error && <Alert severity="warning" sx={{ mb: 2, borderRadius: 0 }}>{error}</Alert>}

        <Box sx={{ minHeight: { xs: 'calc(100svh - 220px)', sm: 380, md: 460 }, display: 'grid', alignItems: 'end', mb: { xs: 2.5, md: 4 }, p: { xs: 2, sm: 2.5, md: 4 }, border: `1px solid ${COLORS.parchment}55`, backgroundImage: { xs: `linear-gradient(180deg, rgba(44,44,44,.08), rgba(44,44,44,.86)), url(${appearance.heroUrl || '/order/hero-mobile.jpg'})`, md: `linear-gradient(180deg, rgba(44,44,44,.10), rgba(44,44,44,.80)), url(${appearance.heroUrl || '/order/hero-tablet.jpg'})` }, backgroundSize: 'cover', backgroundPosition: { xs: 'center center', md: 'center center' }, backgroundRepeat: 'no-repeat', boxShadow: 'none' }}>
          <Stack gap={1.5} sx={{ maxWidth: 760 }}>
            <Typography sx={{ color: COLORS.amber, fontSize: 12, letterSpacing: '.18em', textTransform: 'uppercase', fontWeight: 700 }}>{t('privateMenu')}</Typography>
            <Typography component="h1" sx={{ fontFamily: serif, fontWeight: 300, fontSize: { xs: 52, sm: 76, md: 112 }, lineHeight: .86, letterSpacing: '-0.045em', color: COLORS.parchment, textShadow: '0 2px 22px rgba(0,0,0,.48)' }}>
              {t('heroTitleA')}<br />{t('heroTitleB')}
            </Typography>
            <Stack direction="row" gap={1} flexWrap="wrap" sx={{ pt: 1 }}>
              <Chip label={`${t('roomCode')} ${session?.room?.number ?? '—'}`} sx={chipSx(true)} />
              <Chip label={`${products.length} ${t('products')}`} sx={chipSx()} />
              {session?.display?.showGuestInfo && <Chip label={`${t('guest')}: ${session?.guest?.displayName ?? '—'}`} sx={chipSx()} />}
            </Stack>
          </Stack>
        </Box>

        {session?.display?.showGuestInfo && (
          <Card sx={parchmentCardSx({ mb: 3 })}>
            <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
              <Typography sx={eyebrowSx}>{t('stayInfo')}</Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} flexWrap="wrap" sx={{ mt: 1.5 }}>
                <Chip label={`${t('roomCode')}: ${session?.room?.number ?? '—'}`} sx={darkChipSx} />
                <Chip label={`${t('guest')}: ${session?.guest?.displayName ?? '—'}`} sx={darkChipSx} />
                <Chip label={`${t('checkIn')}: ${formatDateTime(session?.reservation?.actualCheckIn || session?.reservation?.checkInDate)}`} sx={darkChipSx} />
                <Chip label={`${t('checkOut')}: ${formatDateTime(session?.reservation?.actualCheckOut || session?.reservation?.checkOutDate)}`} sx={darkChipSx} />
              </Stack>
            </CardContent>
          </Card>
        )}

        {!products.length && <Alert severity="info" sx={{ borderRadius: 0 }}>{t('empty')}</Alert>}

        <Stack gap={5}>
          {(session?.menu?.categories ?? []).map((category: any) => (
            <Box key={category.id}>
              <Stack direction="row" alignItems="end" justifyContent="space-between" gap={2} sx={{ mb: 1.5 }}>
                <Typography sx={{ fontFamily: serif, fontWeight: 300, fontSize: { xs: 38, md: 58 }, lineHeight: .95, letterSpacing: '-0.035em', color: COLORS.parchment }}>{localizeCategory(category.name)}</Typography>
                <Divider sx={{ flex: 1, borderColor: COLORS.amber, opacity: .55, mb: 1 }} />
              </Stack>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: { xs: 1.5, md: 2 } }}>
                {category.products.map((product: any) => {
                  const localized = localizeProduct(product);
                  return (
                  <Card key={product.id} sx={{ ...menuCardSx, bgcolor: `rgba(44,44,44,${cardOpacity})`, '&:hover': { borderColor: COLORS.amber, bgcolor: `rgba(44,44,44,${Math.min(cardOpacity + .18, .9)})` } }}>
                    <CardContent sx={{ display: 'grid', gridTemplateColumns: { xs: '112px 1fr', sm: '146px 1fr' }, gap: { xs: 1.5, sm: 2 }, p: { xs: 1.25, sm: 1.5 } }}>
                      <Box sx={{ height: { xs: 132, sm: 154 }, bgcolor: `${COLORS.parchment}22`, overflow: 'hidden', border: `1px solid ${COLORS.parchment}33` }}>
                        {product.imageUrl ? <Box component="img" src={product.imageUrl} alt={localized.name} sx={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'saturate(.9) contrast(1.02)' }} /> : <Box sx={{ height: '100%', display: 'grid', placeItems: 'center', color: COLORS.amber }}><RoomServiceIcon /></Box>}
                      </Box>
                      <Stack minWidth={0} justifyContent="space-between" gap={1}>
                        <Box>
                          <Typography sx={{ fontFamily: serif, fontWeight: 300, fontSize: { xs: 26, sm: 32 }, lineHeight: 1, letterSpacing: '-0.02em', color: COLORS.linen }}>{localized.name}</Typography>
                        </Box>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                          <Typography sx={{ color: COLORS.amber, fontWeight: 800, letterSpacing: '-0.01em' }}>{money(product.price)}</Typography>
                          <Stack direction="row" alignItems="center" gap={0.8}>
                            {cart[product.id] > 0 && <IconButton size="small" onClick={() => remove(product.id)} sx={stepButtonSx}><RemoveIcon fontSize="small" /></IconButton>}
                            {cart[product.id] > 0 && <Typography sx={{ minWidth: 18, textAlign: 'center', fontWeight: 900, color: COLORS.linen }}>{cart[product.id]}</Typography>}
                            <IconButton size="small" onClick={() => add(product.id)} sx={{ ...stepButtonSx, bgcolor: COLORS.amber, color: COLORS.mahogany, borderColor: COLORS.amber, '&:hover': { bgcolor: COLORS.parchment } }}><AddIcon fontSize="small" /></IconButton>
                          </Stack>
                        </Stack>
                      </Stack>
                    </CardContent>
                  </Card>
                  );
                })}
              </Box>
            </Box>
          ))}
        </Stack>
      </Box>

      {totalQuantity > 0 && <Box sx={{ position: 'fixed', left: 0, right: 0, bottom: 0, p: 2, bgcolor: 'rgba(44,44,44,0.88)', backdropFilter: 'blur(18px)', borderTop: `1px solid ${COLORS.parchment}55`, zIndex: 10 }}>
        <Button fullWidth size="large" variant="outlined" onClick={() => setCartOpen(true)} sx={primaryButtonSx}>
          {t('viewCart')} · {totalQuantity} {t('items')} · {money(totalAmount)}
        </Button>
      </Box>}

      <Dialog open={cartOpen} onClose={() => setCartOpen(false)} fullWidth maxWidth="sm" PaperProps={{ sx: dialogPaperSx }}>
        <DialogTitle sx={dialogTitleSx}>{t('cart')}</DialogTitle>
        <DialogContent><Stack gap={1.5}>
          {cartLines.map((item: any) => <Stack key={item.id} direction="row" justifyContent="space-between" gap={1}><Box><Typography sx={{ color: COLORS.linen, fontWeight: 800 }}>{localizeProduct(item).name}</Typography><Typography sx={{ color: COLORS.stone, fontSize: 13 }}>{item.quantity} × {money(item.price)}</Typography></Box><Typography sx={{ color: COLORS.amber, fontWeight: 900 }}>{money(item.lineTotal)}</Typography></Stack>)}
          <Divider sx={{ borderColor: `${COLORS.parchment}33` }} />
          <TextField label={t('note')} value={note} onChange={(e) => setNote(e.target.value)} multiline minRows={2} sx={textFieldSx} />
          <Stack direction="row" justifyContent="space-between"><Typography sx={{ color: COLORS.linen, fontWeight: 900 }}>{t('total')}</Typography><Typography sx={{ color: COLORS.amber, fontWeight: 950 }}>{money(totalAmount)}</Typography></Stack>
        </Stack></DialogContent>
        <DialogActions sx={{ p: 2 }}><Button onClick={() => setCartOpen(false)} sx={{ color: COLORS.parchment }}>{t('close')}</Button><Button disabled={!cartLines.length || submitting} variant="outlined" onClick={submitOrder} sx={primaryButtonSx}>{submitting ? t('submitting') : t('submit')}</Button></DialogActions>
      </Dialog>

      <Dialog open={historyOpen} onClose={() => setHistoryOpen(false)} fullWidth maxWidth="sm" PaperProps={{ sx: dialogPaperSx }}>
        <DialogTitle sx={dialogTitleSx}>{t('paymentHistory')}</DialogTitle>
        <DialogContent>
          <Stack gap={1.5}>
            {paymentHistory?.orders?.length ? paymentHistory.orders.map((order: any) => (
              <Box key={order.id} sx={{ p: 1.5, border: `1px solid ${COLORS.parchment}44`, bgcolor: 'rgba(216,203,184,.08)' }}>
                <Stack direction="row" justifyContent="space-between" gap={1} alignItems="flex-start">
                  <Box>
                    <Typography sx={{ color: COLORS.parchment, fontWeight: 950, letterSpacing: '.02em' }}>{order.orderCode}</Typography>
                    <Typography sx={{ color: COLORS.stone, fontSize: 12 }}>{t('paid')}: {formatDateTime(order.paidAt)}</Typography>
                  </Box>
                  <Typography sx={{ color: COLORS.amber, fontWeight: 950, whiteSpace: 'nowrap' }}>{money(order.totalAmount)}</Typography>
                </Stack>
                <Stack gap={0.35} sx={{ mt: 1 }}>
                  {order.items?.map((item: any, index: number) => <Typography key={`${order.id}-${index}`} sx={{ color: COLORS.linen, fontSize: 13 }}>• {localizeProductName(item.productName)} x{item.quantity} — {money(item.lineTotal)}</Typography>)}
                </Stack>
              </Box>
            )) : <Alert severity="info" sx={{ borderRadius: 0 }}>{t('historyEmpty')}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}><Button onClick={() => setHistoryOpen(false)} sx={{ color: COLORS.parchment }}>{t('close')}</Button></DialogActions>
      </Dialog>

      <Dialog open={paymentOpen && Boolean(orderResult)} onClose={closePaymentDialog} fullWidth maxWidth="xs" PaperProps={{ sx: dialogPaperSx }}>
        <DialogTitle sx={dialogTitleSx}>{t('payTitle')}</DialogTitle>
        <DialogContent><Stack gap={2} alignItems="center">
          <Alert severity={paymentStatus === 'PAID' ? 'success' : 'info'} sx={{ borderRadius: 0 }}>
            {paymentStatus === 'PAID' ? t('paymentConfirmed') : t('paySuccess', { code: orderResult?.order?.orderCode })}
          </Alert>
          {paymentStatus === 'PAID' ? null : (orderResult?.payment?.qrImageUrl ? <Box component="img" src={orderResult.payment.qrImageUrl} alt="SePay QR" sx={{ width: 280, maxWidth: '100%', bgcolor: '#fff', p: 1 }} /> : <Alert severity="warning">{t('missingQr')}</Alert>)}
          {paymentStatus !== 'PAID' && <Typography sx={{ color: COLORS.stone, textAlign: 'center', fontSize: 13 }}>{t('paymentWaiting')}</Typography>}
          <Typography sx={{ color: COLORS.linen }}>{t('amount')}: <b>{money(orderResult?.payment?.amount)}</b></Typography>
          <Typography sx={{ color: COLORS.parchment }}>{t('transferNote')}: <b>{orderResult?.payment?.reference}</b></Typography>
        </Stack></DialogContent>
        <DialogActions><Button onClick={closePaymentDialog} sx={{ color: COLORS.parchment }}>{t('ok')}</Button></DialogActions>
      </Dialog>
    </Box>
  );
}

const chipSx = (strong = false) => ({
  borderRadius: '3px',
  border: `1px solid ${strong ? COLORS.amber : COLORS.parchment}aa`,
  bgcolor: strong ? `${COLORS.amber}22` : 'transparent',
  color: COLORS.parchment,
  fontWeight: 800,
  letterSpacing: '.02em',
});

const darkChipSx = { borderRadius: '3px', bgcolor: COLORS.mahogany, color: COLORS.parchment, fontWeight: 800 };
const eyebrowSx = { color: COLORS.mahogany, fontSize: 12, letterSpacing: '.16em', textTransform: 'uppercase', fontWeight: 900 };
const parchmentCardSx = (extra = {}) => ({ bgcolor: COLORS.parchment, color: COLORS.mahogany, borderRadius: 0, boxShadow: 'none', border: `1px solid ${COLORS.stone}`, ...extra });
const menuCardSx = { bgcolor: 'rgba(44,44,44,.54)', color: COLORS.parchment, borderRadius: 0, boxShadow: 'none', border: `1px solid ${COLORS.parchment}55`, transition: 'border-color .18s ease, background .18s ease', '&:hover': { borderColor: COLORS.amber, bgcolor: 'rgba(44,44,44,.72)' } };
const stepButtonSx = { width: 32, height: 32, borderRadius: '3px', border: `1px solid ${COLORS.parchment}77`, color: COLORS.parchment, '&:hover': { borderColor: COLORS.amber, bgcolor: `${COLORS.amber}22` } };
const primaryButtonSx = { borderRadius: 0, py: 1.45, px: 2, borderColor: COLORS.parchment, color: COLORS.parchment, fontWeight: 800, letterSpacing: '-0.01em', '&:hover': { borderColor: COLORS.amber, bgcolor: COLORS.amber, color: COLORS.mahogany } };
const dialogPaperSx = { bgcolor: COLORS.mahogany, color: COLORS.parchment, borderRadius: 0, border: `1px solid ${COLORS.parchment}88` };
const dialogTitleSx = { fontFamily: serif, fontWeight: 300, fontSize: 38, letterSpacing: '-0.03em', color: COLORS.parchment };
const languageSelectSx = { minWidth: { xs: 104, sm: 160 }, '& .MuiInputBase-root': { color: COLORS.parchment, borderRadius: '3px', fontSize: 13 }, '& .MuiOutlinedInput-notchedOutline': { borderColor: `${COLORS.parchment}66` }, '& .MuiSvgIcon-root': { color: COLORS.parchment } };
const textFieldSx = { '& label': { color: COLORS.stone }, '& label.Mui-focused': { color: COLORS.amber }, '& .MuiInputBase-root': { color: COLORS.linen, borderRadius: 0 }, '& .MuiOutlinedInput-notchedOutline': { borderColor: `${COLORS.parchment}66` }, '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': { borderColor: COLORS.parchment }, '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: COLORS.amber } };

function Centered({ children }: { children: React.ReactNode }) {
  return <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 3, bgcolor: COLORS.mahogany, color: COLORS.parchment }}><Stack alignItems="center" gap={2}>{children}</Stack></Box>;
}

export default function OrderPage() {
  return <Suspense fallback={<Centered><CircularProgress sx={{ color: COLORS.parchment }} /></Centered>}><OrderPageInner /></Suspense>;
}
