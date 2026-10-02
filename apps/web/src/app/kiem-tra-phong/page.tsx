'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '@/lib/api';
import styles from './page.module.css';
import catalog from './catalog.json';

type CatalogRoom = {
  key: string; roomCode: string; nightlyPrice: number | null;
  description: string; view: string | null; albumUrl: string | null;
  imageCount: number; galleryUrl: string | null; coverImage: string | null; albumMismatch?: boolean; albumUnavailable?: boolean;
};
type ListingOverride = { key: string; nightlyPrice: number | null; area: string; features: string; note: string; coverImage: string | null };

function roomKey(buildingCode: string, code: string) {
  if (buildingCode === 'VIC29') return 'VIC29:VIC29';
  const normalized = code.toUpperCase().replace(/^([ABC])0+(\d)/, '$1$2');
  return `${buildingCode.toUpperCase()}:${normalized === 'C5.03A' && buildingCode === 'GALLERIA' ? 'C5.03' : normalized}`;
}

const catalogByRoom = new Map<string, CatalogRoom>(catalog.rooms.map((room) => [room.key, room]));
const currency = (value: number) => new Intl.NumberFormat('vi-VN').format(value) + 'đ';

function apartmentFacts(room?: CatalogRoom) {
  const text = room?.description || '';
  const area = text.match(/\d+(?:[.,]\d+)?\s*m[²2](?:\s*\+\s*\d+\s*m[²2]\s*sân vườn)?/i)?.[0];
  // Keep only apartment features, without repeating its code, area or price.
  const features = text
    .replace(/giá[\s\S]*$/i, '')
    .replace(/^.*?\b[ABC]\d+[A-Z]?\.\d+[A-Z]?\b\s*,?\s*/i, '')
    .replace(/\d+(?:[.,]\d+)?\s*m[²2](?:\s*\+\s*\d+\s*m[²2]\s*sân vườn)?/gi, '')
    .replace(/\b\d+PN\b/gi, '')
    .replace(/\\/g, '')
    .split(',').map((part) => part.trim()).filter(Boolean).join(', ');
  return { area, features: /giá|12tr/i.test(features) ? '' : features };
}

function ApartmentGallery({ room, close }: { room: CatalogRoom; close: () => void }) {
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [images, setImages] = useState<string[]>(room.coverImage ? [room.coverImage] : []);
  useEffect(() => {
    if (!room.galleryUrl) return;
    const controller = new AbortController();
    fetch(room.galleryUrl, { signal: controller.signal }).then((response) => {
      if (!response.ok) throw new Error('Không tải được danh sách ảnh');
      return response.json();
    }).then((photos: string[]) => setImages(room.coverImage ? [room.coverImage, ...(photos.includes(room.coverImage) ? photos.filter((photo) => photo !== room.coverImage) : photos.slice(1))] : photos)).catch(() => {});
    return () => controller.abort();
  }, [room]);
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    document.addEventListener('keydown', escape);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', escape);
      previousFocus?.focus();
    };
  }, [close]);
  function move(delta: number) {
    setIndex((current) => (current + delta + images.length) % images.length);
    setFailed(false);
  }
  return <div className={styles.modalBackdrop} onClick={close}>
    <section className={styles.galleryModal} role="dialog" aria-modal="true" aria-label={`Ảnh căn ${room.roomCode}`} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => {
      if (event.key === 'Tab') {
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button, a[href]'));
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }}>
      <div className={styles.galleryHeader}><div><small>HÌNH ẢNH CĂN HỘ</small><h2>{room.roomCode}</h2></div><button ref={closeRef} onClick={close} aria-label="Đóng bộ ảnh">✕</button></div>
      <div className={styles.galleryStage}>
        {!failed && images[index] ? <img key={images[index]} src={images[index]} alt={`Căn ${room.roomCode} - ảnh ${index + 1}`} referrerPolicy="no-referrer" onError={() => setFailed(true)} /> : <p>Ảnh này chưa tải được. Bạn có thể xem trong album Google Photos bên dưới.</p>}
        {images.length > 1 && <><button className={styles.photoPrev} onClick={() => move(-1)} aria-label="Ảnh trước">‹</button><button className={styles.photoNext} onClick={() => move(1)} aria-label="Ảnh tiếp theo">›</button><span className={styles.photoCount}>{index + 1} / {images.length}</span></>}
      </div>
      <p className={styles.galleryDescription}>{room.description || 'Chưa có mô tả cho căn này.'}</p>
      {room.albumUrl && !room.albumMismatch && <a className={styles.albumLink} href={room.albumUrl} target="_blank" rel="noopener noreferrer">Mở toàn bộ album Google Photos ↗</a>}
    </section>
  </div>;
}

type AvailableRoom = {
  roomCode: string;
  floor: number | null;
  building: string;
  buildingCode: string;
  roomType: string;
};

type Availability = {
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  total: number;
  rooms: AvailableRoom[];
};

function localDateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dateWithOffset(days: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return localDateString(date);
}

function formatDate(date: string) {
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}

function buildingName(code: string, name: string) {
  const label = `${code} ${name}`.toUpperCase();
  if (label.includes('OPERA')) return 'The Opera';
  if (label.includes('GALLERIA')) return 'The Galleria';
  if (label.includes('CREST')) return 'The Crest';
  return name || code;
}

export default function PublicAvailabilityPage() {
  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [building, setBuilding] = useState('all');
  const [roomType, setRoomType] = useState('all');
  const [priceSort, setPriceSort] = useState('default');
  const [galleryRoom, setGalleryRoom] = useState<CatalogRoom | null>(null);
  const [listingOverrides, setListingOverrides] = useState<Record<string, ListingOverride>>({});
  const [zaloNotice, setZaloNotice] = useState('');
  const requestId = useRef(0);
  const today = dateWithOffset(0);

  async function search(arrival: string, departure: string) {
    if (!arrival || !departure || departure <= arrival) {
      setError('Ngày trả phòng phải sau ngày nhận phòng ít nhất 1 đêm.');
      return;
    }
    if (arrival < dateWithOffset(0)) {
      setError('Vui lòng chọn ngày nhận phòng từ hôm nay trở đi.');
      return;
    }

    const currentRequest = ++requestId.current;
    setLoading(true);
    setError('');
    setAvailability(null);
    setBuilding('all');
    setRoomType('all');
    setPriceSort('default');
    try {
      const response = await api.get('/public/availability', { checkInDate: arrival, checkOutDate: departure });
      if (currentRequest === requestId.current) setAvailability(response.data as Availability);
    } catch (cause: any) {
      if (currentRequest === requestId.current) {
        const message = cause?.message;
        setError(Array.isArray(message) ? message.join(', ') : message || 'Chưa thể kiểm tra phòng lúc này. Vui lòng thử lại.');
      }
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }

  useEffect(() => {
    const arrival = dateWithOffset(0);
    const departure = dateWithOffset(1);
    setCheckInDate(arrival);
    setCheckOutDate(departure);
    void search(arrival, departure);
    api.get('/public/listings').then((response) => {
      setListingOverrides(Object.fromEntries((response.data as ListingOverride[]).map((item) => [item.key, item])));
    }).catch(() => {});
  }, []);

  const buildings = useMemo(() => Array.from(new Set((availability?.rooms ?? []).map((room) => room.buildingCode))), [availability]);
  const roomTypes = useMemo(() => Array.from(new Set((availability?.rooms ?? []).map((room) => room.roomType))).sort((a, b) => a.localeCompare(b, 'vi', { numeric: true })), [availability]);
  const visibleRooms = useMemo(() => {
    const rooms = (availability?.rooms ?? []).filter((room) =>
      (building === 'all' || room.buildingCode === building) &&
      (roomType === 'all' || room.roomType === roomType)
    );
    if (priceSort === 'default') return rooms;
    return [...rooms].sort((left, right) => {
      const leftKey = roomKey(left.buildingCode, left.roomCode);
      const rightKey = roomKey(right.buildingCode, right.roomCode);
      const leftListing = listingOverrides[leftKey];
      const rightListing = listingOverrides[rightKey];
      const leftPrice = leftListing ? leftListing.nightlyPrice : catalogByRoom.get(leftKey)?.nightlyPrice ?? null;
      const rightPrice = rightListing ? rightListing.nightlyPrice : catalogByRoom.get(rightKey)?.nightlyPrice ?? null;
      // Rooms without an entered public price stay at the end in either direction.
      if (leftPrice === null) return rightPrice === null ? 0 : 1;
      if (rightPrice === null) return -1;
      return priceSort === 'asc' ? leftPrice - rightPrice : rightPrice - leftPrice;
    });
  }, [availability, building, roomType, priceSort, listingOverrides]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void search(checkInDate, checkOutDate);
  }

  async function bookViaZalo(room: AvailableRoom, nightlyPrice: number | null) {
    if (!availability) return;
    // Open synchronously so browser popup protection does not block the Zalo handoff.
    window.open('https://zalo.me/84909078910', '_blank', 'noopener,noreferrer');
    const message = [
      'YÊU CẦU ĐẶT PHÒNG – CHIHOME',
      `Căn: ${room.roomCode} · ${buildingName(room.buildingCode, room.building)} · ${room.roomType}`,
      `Nhận phòng: ${formatDate(availability.checkInDate)} (14:00)`,
      `Trả phòng: ${formatDate(availability.checkOutDate)} (12:00)`,
      `Số đêm: ${availability.nights}`,
      nightlyPrice ? `Giá tham khảo: ${currency(nightlyPrice)} / đêm${availability.nights > 1 ? ` · ${currency(nightlyPrice * availability.nights)} / ${availability.nights} đêm` : ''}` : 'Giá: vui lòng tư vấn',
      '',
      'Tên khách:',
      'Số điện thoại:',
      'Ghi chú:',
    ].join('\n');

    try {
      await navigator.clipboard.writeText(message);
      setZaloNotice(`Đã sao chép thông tin căn ${room.roomCode}. Hãy dán vào Zalo để gửi yêu cầu đặt phòng.`);
    } catch {
      setZaloNotice(`Zalo đã được mở cho căn ${room.roomCode}. Vui lòng cung cấp ngày nhận/trả phòng cho tư vấn viên.`);
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <a className={styles.brand} href="/kiem-tra-phong" aria-label="ChiHome - trang kiểm tra phòng">
          <span className={styles.brandMark}>C<span>✦</span></span>
          <span>CHI<span className={styles.brandAccent}>HOME</span><small>RESIDENCES</small></span>
        </a>
        <span className={styles.headerNote}>KHÔNG CẦN TÀI KHOẢN</span>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroTexture} aria-hidden="true" />
        <div className={styles.heroContent}>
          <h1>HỆ THỐNG BOOKING CHIHOME</h1>
          <p className={styles.heroTagline}><em>Tra cứu phòng trống Realtime &amp; đặt phòng dành riêng cho CTV và Sales</em></p>
          <p>Chọn ngày lưu trú, sau đó nhấn <strong>“XEM PHÒNG TRỐNG”</strong> để kiểm tra các căn đang còn trống.<br />Tình trạng phòng được cập nhật <strong>theo thời gian thực (Realtime)</strong> từ hệ thống đặt phòng của <strong>ChiHome</strong>.</p>
        </div>
        <div className={styles.heroArt} aria-hidden="true">
          <div className={styles.sun} />
          <div className={`${styles.tower} ${styles.towerBack}`} />
          <div className={`${styles.tower} ${styles.towerMiddle}`} />
          <div className={`${styles.tower} ${styles.towerFront}`} />
          <div className={styles.artCaption}>SAIGON · VIETNAM</div>
        </div>
      </section>

      <div className={styles.content}>
        <form className={styles.searchPanel} onSubmit={handleSubmit}>
          <div className={styles.searchIntro}>
            <span className={styles.searchIcon} aria-hidden="true">⌕</span>
            <div><strong>Kiểm tra phòng trống</strong><span>Chọn ngày của chuyến đi</span></div>
          </div>
          <label className={styles.dateField}>
            <span>NGÀY NHẬN PHÒNG</span>
            <input type="date" value={checkInDate} min={today} required onChange={(event) => {
              const next = event.target.value;
              setCheckInDate(next);
              if (next && checkOutDate <= next) {
                const nextDay = new Date(`${next}T12:00:00`);
                nextDay.setDate(nextDay.getDate() + 1);
                setCheckOutDate(localDateString(nextDay));
              }
            }} />
            <small>Từ 14:00</small>
          </label>
          <label className={styles.dateField}>
            <span>NGÀY TRẢ PHÒNG</span>
            <input type="date" value={checkOutDate} min={checkInDate || today} required onChange={(event) => setCheckOutDate(event.target.value)} />
            <small>Trước 12:00</small>
          </label>
          <button className={styles.searchButton} type="submit" disabled={loading}>
            {loading ? 'Đang kiểm tra…' : 'XEM PHÒNG TRỐNG'} <span aria-hidden="true">↗</span>
          </button>
        </form>

        {error && <div className={styles.error} role="alert">{error}</div>}
        {zaloNotice && <div className={styles.zaloNotice} role="status">{zaloNotice}</div>}

        <section className={styles.results} aria-live="polite">
          <div className={styles.resultsHeading}>
            <div>
              <div className={styles.sectionEyebrow}>DANH SÁCH CĂN HỘ</div>
              <h2>{loading ? 'Đang tìm căn phù hợp…' : availability ? `${availability.total} căn còn trống` : 'Căn hộ còn trống'}</h2>
              {availability && <p>{formatDate(availability.checkInDate)} → {formatDate(availability.checkOutDate)} · {availability.nights} đêm</p>}
            </div>
            {availability && <div className={styles.liveBadge}><span /> LỊCH TRỐNG HIỆN TẠI</div>}
          </div>

          {availability && availability.total > 0 && (
            <div className={styles.filters}>
              <label>TOÀ NHÀ
                <select value={building} onChange={(event) => setBuilding(event.target.value)}>
                  <option value="all">Tất cả toà nhà</option>
                  {buildings.map((code) => {
                    const room = availability.rooms.find((item) => item.buildingCode === code)!;
                    return <option key={code} value={code}>{buildingName(code, room.building)}</option>;
                  })}
                </select>
              </label>
              <label>LOẠI CĂN
                <select value={roomType} onChange={(event) => setRoomType(event.target.value)}>
                  <option value="all">Tất cả loại căn</option>
                  {roomTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </label>
              <label>GIÁ TIỀN
                <select value={priceSort} onChange={(event) => setPriceSort(event.target.value)}>
                  <option value="default">Mặc định</option>
                  <option value="asc">Thấp đến cao</option>
                  <option value="desc">Cao xuống thấp</option>
                </select>
              </label>
              <span>{visibleRooms.length} kết quả</span>
            </div>
          )}

          {loading ? (
            <div className={styles.grid}>{[0, 1, 2, 3, 4, 5].map((index) => <div className={styles.skeleton} key={index} />)}</div>
          ) : availability && visibleRooms.length > 0 ? (
            <div className={styles.grid}>
              {visibleRooms.map((room, index) => {
                const details = catalogByRoom.get(roomKey(room.buildingCode, room.roomCode));
                const listing = listingOverrides[roomKey(room.buildingCode, room.roomCode)];
                const displayDetails = details ? { ...details, coverImage: listing?.coverImage || details.coverImage } : undefined;
                return (
                <article className={styles.roomCard} key={`${room.buildingCode}-${room.roomCode}`}>
                  <div className={`${styles.cardVisual} ${styles[`visual${index % 3}`]}`}>
                    {displayDetails?.coverImage && <img className={styles.coverImage} src={displayDetails.coverImage.replace(/=w\d+$/, '=w800')} alt={`Căn ${room.roomCode} tại ${buildingName(room.buildingCode, room.building)}`} loading="lazy" referrerPolicy="no-referrer" />}
                    <span className={styles.cardBuilding}>{buildingName(room.buildingCode, room.building)}</span>
                    {!displayDetails?.coverImage && <div className={styles.cardArchitecture} aria-hidden="true"><i /><i /><i /><i /></div>}
                    <span className={styles.availabilityBadge}><span /> CÒN TRỐNG</span>
                    {displayDetails?.coverImage && <button type="button" className={styles.coverButton} aria-label={`Xem hình ảnh căn ${room.roomCode}`} onClick={() => setGalleryRoom(displayDetails)} />}
                  </div>
                  <div className={styles.cardBody}>
                    <div className={styles.cardTop}><span>CĂN HỘ</span><span>{room.roomType}</span></div>
                    <h3>{room.roomCode}</h3>
                    <div className={styles.roomPrice}>{(listing ? listing.nightlyPrice : details?.nightlyPrice) ? <><strong>{currency((listing ? listing.nightlyPrice : details?.nightlyPrice)!)}</strong><span> / đêm</span></> : <strong>Liên hệ để báo giá</strong>}</div>
                    <p className={styles.viewNote}>Diện tích: {(listing?.area ?? apartmentFacts(details).area)?.replace(/m2/g, 'm²') || 'Đang cập nhật'}</p>
                    <p className={styles.viewNote}>Đặc điểm: {(listing?.features ?? apartmentFacts(details).features) || 'Đang cập nhật'}</p>
                    <details className={styles.description}><summary>Thông tin & lưu ý về căn</summary><p>{listing?.note || '\u00a0'}</p></details>
                    <div className={styles.cardDetails}>
                      <span>⌂ {buildingName(room.buildingCode, room.building)}</span>
                      {room.floor !== null && <span>↥ Tầng {room.floor}</span>}
                    </div>
                    <button className={styles.bookButton} type="button" onClick={() => bookViaZalo(room, listing ? listing.nightlyPrice : details?.nightlyPrice ?? null)}>ĐẶT PHÒNG QUA ZALO <span aria-hidden="true">↗</span></button>
                    {displayDetails?.coverImage ? <button className={styles.photoButton} onClick={() => setGalleryRoom(displayDetails)}>Xem hình ảnh{displayDetails.imageCount ? ` (${displayDetails.imageCount})` : ''} <span>↗</span></button> : details?.albumUrl && !details.albumMismatch && !details.albumUnavailable ? <a className={styles.photoButton} href={details.albumUrl} target="_blank" rel="noopener noreferrer">Xem album Google Photos ↗</a> : <span className={styles.noPhoto}>Ảnh căn hộ đang được bổ sung</span>}
                  </div>
                </article>
              ); })}
            </div>
          ) : availability ? (
            <div className={styles.emptyState}>
              <span aria-hidden="true">◇</span>
              <h3>Chưa có căn phù hợp</h3>
              <p>{availability.total === 0 ? 'Không còn căn trống trong khoảng ngày đã chọn. Hãy thử ngày lưu trú khác.' : 'Hãy thử đổi bộ lọc toà nhà hoặc loại căn.'}</p>
            </div>
          ) : null}
        </section>
        {catalog.hourlyRates.length > 0 && <details className={styles.hourlyRates}>
          <summary>Bảng giá thuê theo giờ</summary>
          <p>Giá theo giờ được niêm yết riêng, không dùng để tính tổng tiền lưu trú theo đêm ở trên.</p>
          <div>{catalog.hourlyRates.map((rate) => <article key={rate.sourceRow}><strong>{currency(rate.hourlyPrice)} / giờ</strong><p>{rate.description}</p></article>)}</div>
        </details>}
      </div>

      <footer className={styles.footer}><span>CHIHOME RESIDENCES</span><span>Thông tin phòng trống có thể thay đổi khi có đặt phòng mới.</span></footer>
      {galleryRoom && <ApartmentGallery room={galleryRoom} close={() => setGalleryRoom(null)} />}
    </main>
  );
}
