const http = require('http');
const { URL } = require('url');

const buildings = [
  { id: 'b1', name: 'The Opera', code: 'OPERA' },
  { id: 'b2', name: 'The Galleria', code: 'GALLERIA' },
];

const roomTypes = [
  { id: 'rt1', name: 'Studio Deluxe' },
  { id: 'rt2', name: '1 Bedroom' },
  { id: 'rt3', name: '2 Bedroom' },
];

const baseRooms = [
  { id: 'r1', number: 'A1.01', floor: 1, building: buildings[0], roomType: roomTypes[0], status: 'VACANT' },
  { id: 'r2', number: 'A1.02', floor: 1, building: buildings[0], roomType: roomTypes[1], status: 'OCCUPIED' },
  { id: 'r3', number: 'A2.03', floor: 2, building: buildings[0], roomType: roomTypes[2], status: 'VACANT' },
  { id: 'r4', number: 'G3.08', floor: 3, building: buildings[1], roomType: roomTypes[1], status: 'DIRTY' },
  { id: 'r5', number: 'G5.12', floor: 5, building: buildings[1], roomType: roomTypes[0], status: 'VACANT' },
];

const virtualRooms = Array.from({ length: 20 }, (_, index) => {
  const idx = index + 1;
  const building = idx % 2 === 0 ? buildings[0] : buildings[1];
  const roomType = roomTypes[idx % roomTypes.length];
  const floor = (idx % 10) + 2;
  const roomNo = building.code === 'OPERA'
    ? `A${floor}.${String(idx + 10).padStart(2, '0')}`
    : `G${floor}.${String(idx + 20).padStart(2, '0')}`;
  const statusCycle = ['VACANT', 'OCCUPIED', 'DIRTY', 'VACANT', 'VACANT'];
  return {
    id: `vr${idx}`,
    number: roomNo,
    floor,
    building,
    roomType,
    status: statusCycle[idx % statusCycle.length],
  };
});

const rooms = [...baseRooms, ...virtualRooms];

const baseReservations = [
  {
    id: 'res1',
    roomId: 'r1',
    reservationCode: 'DM001',
    primaryGuestName: 'Nguyễn An',
    primaryGuestGender: 'MALE',
    primaryGuestNationality: 'Vietnam',
    company: 'Demo Travel',
    checkInDate: '2026-05-05T14:00:00.000Z',
    checkOutDate: '2026-05-08T12:00:00.000Z',
    status: 'IN_HOUSE',
  },
  {
    id: 'res2',
    roomId: 'r2',
    reservationCode: 'DM002',
    primaryGuestName: 'Trần Ly',
    primaryGuestGender: 'FEMALE',
    primaryGuestNationality: 'Korea',
    company: 'Demo Travel',
    checkInDate: '2026-05-07T14:00:00.000Z',
    checkOutDate: '2026-05-10T12:00:00.000Z',
    status: 'BOOKED',
  },
  {
    id: 'res3',
    roomId: 'r4',
    reservationCode: 'DM003',
    primaryGuestName: 'Lê Minh',
    primaryGuestGender: 'MALE',
    primaryGuestNationality: 'Japan',
    company: '',
    checkInDate: '2026-05-04T14:00:00.000Z',
    checkOutDate: '2026-05-06T12:00:00.000Z',
    status: 'IN_HOUSE',
  },
  {
    id: 'res4',
    roomId: 'r5',
    reservationCode: 'DM004',
    primaryGuestName: 'Anna Demo',
    primaryGuestGender: 'FEMALE',
    primaryGuestNationality: 'United States',
    company: 'UI Testing',
    checkInDate: '2026-05-09T14:00:00.000Z',
    checkOutDate: '2026-05-12T12:00:00.000Z',
    status: 'PENDING_CHECKIN',
  },
];

const virtualReservations = virtualRooms
  .filter((_, index) => index % 2 === 0)
  .map((room, index) => {
    const checkInDay = 4 + (index % 8);
    const stay = 2 + (index % 3);
    const statuses = ['BOOKED', 'PENDING_CHECKIN', 'IN_HOUSE'];
    const nationality = ['Vietnam', 'Korea', 'Japan', 'United States'][index % 4];
    const names = ['Hoàng Vy', 'Minh Khoa', 'Bảo Trâm', 'David Demo', 'Linh Chi'];
    return {
      id: `vres${index + 1}`,
      roomId: room.id,
      reservationCode: `DM${String(index + 10).padStart(3, '0')}`,
      primaryGuestName: names[index % names.length],
      primaryGuestGender: index % 2 === 0 ? 'FEMALE' : 'MALE',
      primaryGuestNationality: nationality,
      company: index % 3 === 0 ? 'Demo Travel' : '',
      checkInDate: `2026-05-${String(checkInDay).padStart(2, '0')}T14:00:00.000Z`,
      checkOutDate: `2026-05-${String(checkInDay + stay).padStart(2, '0')}T12:00:00.000Z`,
      status: statuses[index % statuses.length],
    };
  });

const reservations = [...baseReservations, ...virtualReservations];

function send(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(json);
}

function ok(res, data, meta) {
  send(res, 200, meta ? { ok: true, data, meta } : { ok: true, data });
}

function withRoom(reservation) {
  return {
    ...reservation,
    room: rooms.find((room) => room.id === reservation.roomId) || null,
  };
}

function filterRooms(searchParams) {
  const buildingId = searchParams.get('buildingId');
  const filtered = buildingId ? rooms.filter((room) => room.building.id === buildingId) : rooms;
  return filtered;
}

const server = http.createServer((req, res) => {
  if (!req.url) return send(res, 400, { ok: false, error: 'Missing URL' });
  if (req.method === 'OPTIONS') return send(res, 204, {});

  const url = new URL(req.url, 'http://localhost');
  const { pathname, searchParams } = url;

  if (pathname === '/api/health') {
    return ok(res, { status: 'ok', mode: 'demo-ui-only' });
  }

  if (pathname === '/api/buildings') {
    return ok(res, buildings);
  }

  if (pathname === '/api/room-types') {
    return ok(res, roomTypes);
  }

  if (pathname === '/api/rooms') {
    const filtered = filterRooms(searchParams);
    return ok(res, { data: filtered, meta: { total: filtered.length, page: 1, limit: filtered.length, totalPages: 1 } });
  }

  if (pathname === '/api/timeline') {
    const statusParam = searchParams.get('status');
    const buildingId = searchParams.get('buildingId');
    const statuses = statusParam ? statusParam.split(',').filter(Boolean) : null;
    let data = reservations;
    if (statuses) data = data.filter((item) => statuses.includes(item.status));
    if (buildingId) {
      const roomIds = rooms.filter((room) => room.building.id === buildingId).map((room) => room.id);
      data = data.filter((item) => roomIds.includes(item.roomId));
    }
    return ok(res, data);
  }

  if (pathname === '/api/reservations/quick-room-search') {
    const roomTypeId = searchParams.get('roomTypeId');
    const buildingId = searchParams.get('buildingId');
    let data = rooms;
    if (roomTypeId) data = data.filter((room) => room.roomType.id === roomTypeId);
    if (buildingId) data = data.filter((room) => room.building.id === buildingId);
    return ok(res, data.map((room) => ({
      roomId: room.id,
      roomNumber: room.number,
      building: room.building,
      roomType: room.roomType,
      images: [],
    })));
  }

  if (pathname.startsWith('/api/reservations/')) {
    const id = pathname.split('/').pop();
    const reservation = reservations.find((item) => item.id === id);
    if (!reservation) return send(res, 404, { ok: false, error: 'Not found' });
    return ok(res, withRoom(reservation));
  }

  if (pathname === '/api/dashboard/summary') {
    return ok(res, {
      occupancyRate: 64,
      todayCheckIns: 2,
      todayCheckOuts: 1,
      inHouse: reservations.filter((item) => item.status === 'IN_HOUSE').length,
      upcoming: reservations.filter((item) => item.status === 'BOOKED' || item.status === 'PENDING_CHECKIN').length,
      availableRooms: rooms.filter((room) => room.status === 'VACANT').length,
    });
  }

  return send(res, 404, { ok: false, error: 'Demo endpoint not found' });
});

const port = process.env.PORT || 3004;
server.listen(port, () => {
  console.log(`Demo mock API listening on ${port}`);
});
