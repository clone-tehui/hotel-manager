'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { api } from '@/lib/api';
import catalog from '../../kiem-tra-phong/catalog.json';

type Listing = { key: string; nightlyPrice: number | null; area: string; features: string; note: string; coverImage: string | null };
type CatalogEntry = typeof catalog.rooms[number];

function defaults(room: CatalogEntry): Listing {
  const text = room.description || '';
  const area = text.match(/\d+(?:[.,]\d+)?\s*m[²2](?:\s*\+\s*\d+\s*m[²2]\s*sân vườn)?/i)?.[0] || '';
  const features = text.replace(/giá[\s\S]*$/i, '').replace(/^.*?\b[ABC]\d+[A-Z]?\.\d+[A-Z]?\b\s*,?\s*/i, '').replace(/\d+(?:[.,]\d+)?\s*m[²2](?:\s*\+\s*\d+\s*m[²2]\s*sân vườn)?/gi, '').replace(/\b\d+PN\b/gi, '').replace(/\\/g, '').split(',').map((part) => part.trim()).filter(Boolean).join(', ');
  return { key: room.key, nightlyPrice: room.nightlyPrice, area, features: /giá|12tr/i.test(features) ? '' : features, note: '', coverImage: null };
}

export default function ManagePublicListings() {
  const { isAdmin } = useAuth();
  const [overrides, setOverrides] = useState<Record<string, Listing>>({});
  const [selectedKey, setSelectedKey] = useState(catalog.rooms[0]?.key || '');
  const [draft, setDraft] = useState<Listing | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    api.get('/public/listings').then((response) => setOverrides(Object.fromEntries((response.data as Listing[]).map((entry) => [entry.key, entry])))).catch(() => setStatus('Không tải được dữ liệu quản lý.'));
  }, [isAdmin]);

  const room = catalog.rooms.find((entry) => entry.key === selectedKey);
  useEffect(() => {
    if (room) setDraft(overrides[selectedKey] ?? defaults(room));
  }, [selectedKey, overrides]);

  useEffect(() => {
    setPhotos([]);
    const selectedRoom = catalog.rooms.find((entry) => entry.key === selectedKey);
    if (!selectedRoom?.galleryUrl) return;
    const controller = new AbortController();
    setPhotosLoading(true);
    fetch(selectedRoom.galleryUrl, { signal: controller.signal }).then((response) => {
      if (!response.ok) throw new Error('Không tải được album');
      return response.json();
    }).then((images: string[]) => setPhotos(images)).catch(() => {}).finally(() => setPhotosLoading(false));
    return () => controller.abort();
  }, [selectedKey]);

  const rooms = useMemo(() => catalog.rooms.filter((entry) => `${entry.roomCode} ${entry.buildingCode}`.toLowerCase().includes(query.toLowerCase())), [query]);

  async function save() {
    if (!draft || !room) return;
    setSaving(true);
    setStatus('');
    try {
      const response = await api.patch(`/public/listings/${encodeURIComponent(room.key)}`, {
        nightlyPrice: draft.nightlyPrice, area: draft.area.trim(), features: draft.features.trim(), note: draft.note.trim(), coverImage: draft.coverImage,
      });
      setOverrides((current) => ({ ...current, [room.key]: response.data as Listing }));
      setStatus('Đã lưu. Trang kiểm tra phòng sẽ hiển thị thông tin mới khi tải lại.');
    } catch (error: any) {
      setStatus(Array.isArray(error?.message) ? error.message.join(', ') : error?.message || 'Không lưu được.');
    } finally { setSaving(false); }
  }

  if (!isAdmin) return <main style={{ padding: 24 }}>Chỉ quản trị viên được chỉnh sửa trang kiểm tra phòng.</main>;
  return <main style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px 60px' }}>
    <h1 style={{ margin: '0 0 8px' }}>Quản lý trang kiểm tra phòng</h1>
    <p>Chỉnh nội dung công khai của từng căn. Giá ở đây chỉ dùng cho trang khách xem, không đổi giá hoặc booking nội bộ.</p>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 350px), 1fr))', gap: 20, alignItems: 'start' }}>
      <section style={{ background: '#242525', padding: 16, borderRadius: 16 }}>
        <label htmlFor="listing-search">Tìm mã căn</label>
        <input id="listing-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ví dụ B08.03A" style={{ display: 'block', width: '100%', padding: 10, margin: '8px 0 12px' }} />
        <div style={{ maxHeight: 520, overflowY: 'auto' }}>{rooms.map((entry) => <button key={entry.key} type="button" onClick={() => { setSelectedKey(entry.key); setStatus(''); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: 10, marginBottom: 4, cursor: 'pointer', borderRadius: 8, border: entry.key === selectedKey ? '1px solid #d7ba79' : '1px solid #555', background: entry.key === selectedKey ? '#4b4130' : '#303030', color: '#fff' }}>{entry.roomCode} · {entry.buildingCode}{overrides[entry.key] ? ' · Đã sửa' : ''}</button>)}</div>
      </section>
      {room && draft && <section style={{ background: '#242525', padding: 20, borderRadius: 16 }}>
        <h2 style={{ marginTop: 0 }}>{room.roomCode} · {room.buildingCode}</h2>
        <p>Loại căn: {room.roomType}</p>
        <label style={{ display: 'block', marginBottom: 16 }}>Giá bán mỗi đêm (đồng)
          <input type="number" min="0" step="1" value={draft.nightlyPrice ?? ''} onChange={(event) => setDraft({ ...draft, nightlyPrice: event.target.value === '' ? null : Number(event.target.value) })} style={{ display: 'block', width: '100%', padding: 10, marginTop: 5 }} />
        </label>
        <label style={{ display: 'block', marginBottom: 16 }}>Diện tích
          <input value={draft.area} onChange={(event) => setDraft({ ...draft, area: event.target.value })} placeholder="180m²" style={{ display: 'block', width: '100%', padding: 10, marginTop: 5 }} />
        </label>
        <label style={{ display: 'block', marginBottom: 16 }}>View, đặc điểm
          <textarea value={draft.features} onChange={(event) => setDraft({ ...draft, features: event.target.value })} rows={4} style={{ display: 'block', width: '100%', padding: 10, marginTop: 5 }} />
        </label>
        <label style={{ display: 'block', marginBottom: 16 }}>Thông tin & lưu ý về căn
          <textarea value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} rows={5} placeholder="Để trống nếu chưa có ghi chú" style={{ display: 'block', width: '100%', padding: 10, marginTop: 5 }} />
        </label>
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 8 }}>Ảnh đại diện từ album</h3>
          <p>Chọn một ảnh trong album rồi bấm “Lưu thay đổi”.</p>
          {draft.coverImage || room.coverImage ? <img src={draft.coverImage || room.coverImage || ''} alt={`Ảnh đại diện đang chọn cho căn ${room.roomCode}`} style={{ display: 'block', width: 'min(100%, 320px)', aspectRatio: '16 / 10', objectFit: 'cover', borderRadius: 12, marginBottom: 12 }} /> : null}
          {draft.coverImage && <button type="button" onClick={() => setDraft({ ...draft, coverImage: null })} style={{ marginBottom: 12, padding: '7px 12px', cursor: 'pointer' }}>Dùng ảnh đại diện mặc định</button>}
          {photosLoading ? <p>Đang tải album…</p> : photos.length ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10, maxHeight: 380, overflowY: 'auto' }}>
            {photos.map((photo, index) => <button key={photo} type="button" onClick={() => setDraft({ ...draft, coverImage: photo })} aria-label={`Chọn ảnh ${index + 1} làm ảnh đại diện`} aria-pressed={draft.coverImage === photo} style={{ padding: 3, borderRadius: 9, border: draft.coverImage === photo ? '3px solid #d7ba79' : '3px solid transparent', cursor: 'pointer', background: '#363636', color: '#fff' }}><img src={photo.replace(/=w\d+$/, '=w320')} alt={`Ảnh ${index + 1} của căn ${room.roomCode}`} loading="lazy" referrerPolicy="no-referrer" style={{ display: 'block', width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 5 }} /><span>Ảnh {index + 1}</span></button>)}
          </div> : <p>Căn này chưa có album ảnh để chọn.</p>}
        </div>
        <button type="button" onClick={save} disabled={saving} style={{ background: '#c5a86b', color: '#181818', border: 0, borderRadius: 9, padding: '11px 22px', cursor: 'pointer', fontWeight: 700 }}>{saving ? 'Đang lưu…' : 'Lưu thay đổi'}</button>
        <a href="/kiem-tra-phong" target="_blank" rel="noopener noreferrer" style={{ marginLeft: 16, color: '#dec48b' }}>Xem trang khách ↗</a>
        {status && <p role="status">{status}</p>}
      </section>}
    </div>
  </main>;
}
