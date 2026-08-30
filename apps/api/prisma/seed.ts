import {
  PrismaClient, UserRole, RoomStatus, IdType, PaymentMethod,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function addDays(d: Date, n: number) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}

async function main() {
  console.log('🌱 Seeding database...\n');
  const h = (p: string) => bcrypt.hash(p, 10);

  // ── Users ──────────────────────────────────────────────────────────────────
  const adminPassword = await h('Admin@123');
  const managerPassword = await h('Manager@123');
  const receptionistPassword = await h('Staff@123');
  const admin = await prisma.user.upsert({
    where: { email: 'admin@opera.vn' },
    update: { password: adminPassword, fullName: 'Super Admin', role: UserRole.ADMIN, isActive: true, isLocked: false },
    create: { email: 'admin@opera.vn', password: adminPassword, fullName: 'Super Admin', role: UserRole.ADMIN, isActive: true, isLocked: false },
  });
  await prisma.user.upsert({
    where: { email: 'manager@opera.vn' },
    update: { password: managerPassword, fullName: 'Nguyễn Quản Lý', role: UserRole.MANAGER, isActive: true, isLocked: false },
    create: { email: 'manager@opera.vn', password: managerPassword, fullName: 'Nguyễn Quản Lý', role: UserRole.MANAGER, isActive: true, isLocked: false },
  });
  await prisma.user.upsert({
    where: { email: 'letan@opera.vn' },
    update: { password: receptionistPassword, fullName: 'Trần Lễ Tân', role: UserRole.RECEPTIONIST, isActive: true, isLocked: false },
    create: { email: 'letan@opera.vn', password: receptionistPassword, fullName: 'Trần Lễ Tân', role: UserRole.RECEPTIONIST, isActive: true, isLocked: false },
  });
  console.log('✅ Users: admin / manager / receptionist');

  // ── System Settings ────────────────────────────────────────────────────────
  await prisma.systemSetting.upsert({
    where: { key: 'business_name' }, update: {}, create: { key: 'business_name', value: 'The Opera Residences' },
  });
  await prisma.systemSetting.upsert({
    where: { key: 'business_address' }, update: {}, create: { key: 'business_address', value: '161 Hai Bà Trưng, Quận 1, TP. Hồ Chí Minh' },
  });
  await prisma.systemSetting.upsert({
    where: { key: 'business_phone' }, update: {}, create: { key: 'business_phone', value: '028 3820 1234' },
  });
  await prisma.systemSetting.upsert({
    where: { key: 'business_email' }, update: {}, create: { key: 'business_email', value: 'booking@operaresidences.vn' },
  });
  console.log('✅ System settings: business info');

  // ── Buildings ──────────────────────────────────────────────────────────────
  const [buildingOpera, buildingGalleria, buildingCrest] = await Promise.all([
    prisma.building.upsert({
      where: { code: 'OPERA' }, update: {},
      create: {
        code: 'OPERA', name: 'The Opera', isActive: true,
        address: '161 Hai Bà Trưng, Quận 1, TP.HCM',
        note: 'Toà nhà cao cấp trung tâm Q1',
      },
    }),
    prisma.building.upsert({
      where: { code: 'GALLERIA' }, update: {},
      create: {
        code: 'GALLERIA', name: 'The Galleria', isActive: true,
        address: '123 Lê Lợi, Quận 1, TP.HCM',
        note: 'Toà nhà liền kề trung tâm thương mại',
      },
    }),
    prisma.building.upsert({
      where: { code: 'CREST' }, update: {},
      create: {
        code: 'CREST', name: 'The Crest', isActive: true,
        address: '45 Nguyễn Huệ, Quận 1, TP.HCM',
        note: 'Toà nhà mới khai trương',
      },
    }),
  ]);
  console.log('✅ Buildings: The Opera / The Galleria / The Crest');

  // ── Room Types ─────────────────────────────────────────────────────────────
  const [studio, oneBed, twoBed, penthouse] = await Promise.all([
    prisma.roomType.upsert({
      where: { name: 'Studio' }, update: {},
      create: { name: 'Studio', description: 'Căn hộ studio tiêu chuẩn', basePrice: 2500000, maxGuests: 2, amenities: ['WiFi', 'TV', 'Bếp mini', 'Máy lạnh'] },
    }),
    prisma.roomType.upsert({
      where: { name: '1 Phòng Ngủ' }, update: {},
      create: { name: '1 Phòng Ngủ', description: 'Căn hộ 1 phòng ngủ cao cấp', basePrice: 3500000, maxGuests: 2, amenities: ['WiFi', 'Smart TV', 'Bếp đầy đủ', 'Máy lạnh', 'Máy giặt'] },
    }),
    prisma.roomType.upsert({
      where: { name: '2 Phòng Ngủ' }, update: {},
      create: { name: '2 Phòng Ngủ', description: 'Căn hộ 2 phòng ngủ gia đình', basePrice: 5500000, maxGuests: 4, amenities: ['WiFi', 'Smart TV 65"', 'Bếp đầy đủ', '2 máy lạnh', 'Máy giặt', 'Bồn tắm'] },
    }),
    prisma.roomType.upsert({
      where: { name: 'Penthouse' }, update: {},
      create: { name: 'Penthouse', description: 'Căn hộ đỉnh hạng sang', basePrice: 12000000, maxGuests: 6, amenities: ['WiFi 1Gbps', 'Smart TV 75"', 'Bếp đảo', 'Jacuzzi', 'Sân thượng riêng', 'Butler service'] },
    }),
  ]);
  console.log('✅ Room types: Studio / 1PN / 2PN / Penthouse');

  // ── Rooms (Opera) ──────────────────────────────────────────────────────────
  const roomsData = [
    // The Opera – tầng 5-8
    { number: 'OP-501', floor: 5, buildingId: buildingOpera.id, roomTypeId: studio.id, status: RoomStatus.VACANT },
    { number: 'OP-502', floor: 5, buildingId: buildingOpera.id, roomTypeId: studio.id, status: RoomStatus.VACANT },
    { number: 'OP-601', floor: 6, buildingId: buildingOpera.id, roomTypeId: oneBed.id, status: RoomStatus.VACANT },
    { number: 'OP-602', floor: 6, buildingId: buildingOpera.id, roomTypeId: oneBed.id, status: RoomStatus.MAINTENANCE },
    { number: 'OP-701', floor: 7, buildingId: buildingOpera.id, roomTypeId: twoBed.id, status: RoomStatus.VACANT },
    { number: 'OP-PH1', floor: 8, buildingId: buildingOpera.id, roomTypeId: penthouse.id, status: RoomStatus.VACANT },
    // The Galleria – tầng 10-12
    { number: 'GL-1001', floor: 10, buildingId: buildingGalleria.id, roomTypeId: studio.id, status: RoomStatus.VACANT },
    { number: 'GL-1002', floor: 10, buildingId: buildingGalleria.id, roomTypeId: studio.id, status: RoomStatus.VACANT },
    { number: 'GL-1101', floor: 11, buildingId: buildingGalleria.id, roomTypeId: oneBed.id, status: RoomStatus.VACANT },
    { number: 'GL-1201', floor: 12, buildingId: buildingGalleria.id, roomTypeId: twoBed.id, status: RoomStatus.VACANT },
    // The Crest – tầng 3-5
    { number: 'CR-301', floor: 3, buildingId: buildingCrest.id, roomTypeId: studio.id, status: RoomStatus.VACANT },
    { number: 'CR-401', floor: 4, buildingId: buildingCrest.id, roomTypeId: oneBed.id, status: RoomStatus.VACANT },
  ];

  const rooms: Record<string, any> = {};
  for (const r of roomsData) {
    const room = await prisma.room.upsert({
      where: { buildingId_number: { buildingId: r.buildingId, number: r.number } },
      update: {},
      create: r,
    });
    rooms[r.number] = room;
  }
  console.log('✅ Rooms: 12 căn (Opera x6, Galleria x4, Crest x2)');

  // ── Guests ─────────────────────────────────────────────────────────────────
  const [g1, g2, g3, g4] = await Promise.all([
    prisma.guest.upsert({
      where: { idNumber: '079123456789' }, update: {},
      create: { fullName: 'Nguyễn Văn An', email: 'nvanan@gmail.com', phone: '0901234567', idType: IdType.NATIONAL_ID, idNumber: '079123456789', nationality: 'Vietnamese', isVip: true },
    }),
    prisma.guest.upsert({
      where: { idNumber: '050234567890' }, update: {},
      create: { fullName: 'Trần Thị Bình', email: 'ttbinh@gmail.com', phone: '0912345678', idType: IdType.NATIONAL_ID, idNumber: '050234567890', nationality: 'Vietnamese' },
    }),
    prisma.guest.upsert({
      where: { idNumber: 'A12345678' }, update: {},
      create: { fullName: 'John Smith', email: 'john@globalcorp.com', phone: '+1-555-0101', idType: IdType.PASSPORT, idNumber: 'A12345678', nationality: 'American', company: 'Global Corp Inc.', isVip: true },
    }),
    prisma.guest.upsert({
      where: { idNumber: '031987654321' }, update: {},
      create: { fullName: 'Lê Minh Tuấn', phone: '0934567890', idType: IdType.NATIONAL_ID, idNumber: '031987654321', nationality: 'Vietnamese', company: 'Tech Việt TNHH' },
    }),
  ]);
  console.log('✅ Guests: 4 khách hàng');

  // ── Reservations ───────────────────────────────────────────────────────────
  const today = new Date(); today.setHours(0, 0, 0, 0);

  // 1. IN_HOUSE: John Smith – OP-701 (checked in yesterday)
  const res1 = await prisma.reservation.upsert({
    where: { reservationCode: 'OPR-2026-001' }, update: {},
    create: {
      reservationCode: 'OPR-2026-001', roomId: rooms['OP-701'].id,
      primaryGuestName: g3.fullName, company: g3.company,
      checkInDate: addDays(today, -1), checkOutDate: addDays(today, 3),
      adults: 2, children: 0, ratePlanName: 'Corporate Rate',
      pricePerNight: 5500000, totalNights: 4, totalAmount: 22000000,
      depositAmount: 10000000, status: 'IN_HOUSE',
      actualCheckIn: addDays(today, -1), source: 'direct',
      notes: 'VIP – fruit basket on arrival', createdBy: admin.id,
      guests: { create: { guestId: g3.id, isPrimary: true } },
      payments: { create: { amount: 10000000, method: PaymentMethod.BANK_TRANSFER, notes: 'Tiền cọc' } },
      logs: { create: [{ action: 'CREATED', userId: admin.id }, { action: 'CHECKED_IN', userId: admin.id }] },
    },
  });
  await prisma.room.update({ where: { id: rooms['OP-701'].id }, data: { status: RoomStatus.OCCUPIED } });

  // 2. BOOKED: Nguyễn Văn An – OP-601 (check-in in 2 days)
  await prisma.reservation.upsert({
    where: { reservationCode: 'OPR-2026-002' }, update: {},
    create: {
      reservationCode: 'OPR-2026-002', roomId: rooms['OP-601'].id,
      primaryGuestName: g1.fullName,
      checkInDate: addDays(today, 2), checkOutDate: addDays(today, 9),
      adults: 2, children: 0, ratePlanName: 'Monthly Rate',
      pricePerNight: 3500000, totalNights: 7, totalAmount: 24500000,
      status: 'BOOKED', source: 'booking.com',
      notes: 'Yêu cầu căn tầng cao, view sông', createdBy: admin.id,
      guests: { create: { guestId: g1.id, isPrimary: true } },
      logs: { create: [{ action: 'CREATED', userId: admin.id }] },
    },
  });
  await prisma.room.update({ where: { id: rooms['OP-601'].id }, data: { status: RoomStatus.RESERVED } });

  // 3. CHECKED_OUT: Trần Thị Bình – GL-1001 (past stay)
  await prisma.reservation.upsert({
    where: { reservationCode: 'GLR-2026-001' }, update: {},
    create: {
      reservationCode: 'GLR-2026-001', roomId: rooms['GL-1001'].id,
      primaryGuestName: g2.fullName,
      checkInDate: addDays(today, -5), checkOutDate: addDays(today, -2),
      adults: 1, children: 0, ratePlanName: 'Walk-in Rate',
      pricePerNight: 2500000, totalNights: 3, totalAmount: 7500000,
      depositAmount: 2500000, status: 'CHECKED_OUT',
      actualCheckIn: addDays(today, -5), actualCheckOut: addDays(today, -2),
      source: 'walk-in', createdBy: admin.id,
      guests: { create: { guestId: g2.id, isPrimary: true } },
      payments: { create: { amount: 7500000, method: PaymentMethod.CASH, notes: 'Thanh toán đủ' } },
      logs: { create: [{ action: 'CREATED', userId: admin.id }, { action: 'CHECKED_OUT', userId: admin.id }] },
    },
  });

  // 4. PENDING: Lê Minh Tuấn – CR-401 (upcoming)
  await prisma.reservation.upsert({
    where: { reservationCode: 'CRR-2026-001' }, update: {},
    create: {
      reservationCode: 'CRR-2026-001', roomId: rooms['CR-401'].id,
      primaryGuestName: g4.fullName, company: g4.company,
      checkInDate: addDays(today, 5), checkOutDate: addDays(today, 12),
      adults: 2, children: 1, ratePlanName: 'Weekly Rate',
      pricePerNight: 3500000, totalNights: 7, totalAmount: 24500000,
      status: 'PENDING', source: 'agoda',
      notes: 'Có 1 trẻ em 5 tuổi', createdBy: admin.id,
      guests: { create: { guestId: g4.id, isPrimary: true } },
      logs: { create: { action: 'CREATED', userId: admin.id } },
    },
  });
  console.log('✅ Reservations: IN_HOUSE / BOOKED / CHECKED_OUT / PENDING');

  // ── Webhook ────────────────────────────────────────────────────────────────
  await prisma.webhookIntegration.upsert({
    where: { id: 'webhook-n8n-default' },
    update: {},
    create: {
      id: 'webhook-n8n-default',
      name: 'n8n Workflow Automation',
      url: 'http://localhost:5678/webhook/opera-events',
      secret: 'opera-webhook-secret-2026',
      events: [
        'reservation.created', 'reservation.updated', 'reservation.cancelled',
        'reservation.checked_in', 'reservation.checked_out', 'reservation.room_changed',
        'payment.deposit_recorded', 'room.status_changed',
      ],
      isActive: true,
    },
  });
  console.log('✅ Webhook: n8n integration configured');

  console.log('\n─────────────────────────────────────────');
  console.log('🎉 Seed hoàn tất!');
  console.log('  admin@opera.vn     / Admin@123   (ADMIN)');
  console.log('  manager@opera.vn   / Manager@123 (MANAGER)');
  console.log('  letan@opera.vn     / Staff@123   (RECEPTIONIST)');
  console.log('─────────────────────────────────────────\n');
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
