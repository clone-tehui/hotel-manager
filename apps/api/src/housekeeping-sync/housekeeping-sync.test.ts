import 'reflect-metadata';
import * as assert from 'node:assert/strict';
import { RoomStatus } from '@prisma/client';
import { HousekeepingSyncService } from './housekeeping-sync.service';

type Scenario = {
  room: any;
  inHouse?: any;
  nextReservation?: any;
  newerCheckout?: any;
};

function createHarness(scenario: Scenario) {
  const emitted: Array<{ event: string; payload: any }> = [];
  const updates: any[] = [];

  const prisma: any = {
    room: {
      findFirst: async () => scenario.room,
      update: async ({ data }: any) => {
        updates.push(data);
        scenario.room = { ...scenario.room, ...data, updatedAt: new Date('2026-10-03T09:00:00.000Z') };
        return scenario.room;
      },
    },
    reservation: {
      findFirst: async ({ where }: any) => {
        if (where.status === 'IN_HOUSE') return scenario.inHouse ?? null;
        if (where.status === 'CHECKED_OUT') return scenario.newerCheckout ?? null;
        if (where.status?.in) return scenario.nextReservation ?? null;
        return null;
      },
    },
    $transaction: async (items: Promise<any>[]) => Promise.all(items),
  };

  const emitter: any = {
    emit(event: string, payload: any) {
      emitted.push({ event, payload });
    },
  };

  return {
    service: new HousekeepingSyncService(prisma, emitter),
    updates,
    emitted,
  };
}

function room(status: RoomStatus) {
  return {
    id: 'room-1',
    number: 'C16.12',
    floor: 16,
    status,
    isActive: true,
    deletedAt: null,
    updatedAt: new Date('2026-10-03T08:00:00.000Z'),
    building: { id: 'building-1', code: 'CREST', name: 'The Crest' },
  };
}

async function main() {
  {
    const h = createHarness({ room: room(RoomStatus.DIRTY) });
    const result = await h.service.cleaningApproved('room-1', {
      taskId: 'task-1',
      taskCode: 'CLN-1',
      approvedAt: '2026-10-03T08:30:00.000Z',
    });
    assert.equal(result.data.room.status, RoomStatus.VACANT);
    assert.equal(h.updates.length, 1);
    assert.equal(h.updates[0].status, RoomStatus.VACANT);
    assert.equal(h.emitted.length, 1);
    assert.equal(h.emitted[0].event, 'room.status_changed');
    assert.equal(h.emitted[0].payload.housekeeping.taskId, 'task-1');
  }

  {
    const h = createHarness({
      room: room(RoomStatus.DIRTY),
      nextReservation: { id: 'reservation-next', checkInDate: new Date('2026-10-03T14:00:00.000Z') },
    });
    const result = await h.service.cleaningApproved('room-1', {
      taskId: 'task-2',
      taskCode: 'CLN-2',
      approvedAt: '2026-10-03T08:30:00.000Z',
    });
    assert.equal(result.data.room.status, RoomStatus.RESERVED);
    assert.equal(h.updates[0].status, RoomStatus.RESERVED);
  }

  {
    const h = createHarness({
      room: room(RoomStatus.DIRTY),
      newerCheckout: { id: 'reservation-newer', actualCheckOut: new Date('2026-10-03T08:45:00.000Z') },
    });
    await assert.rejects(
      () => h.service.cleaningApproved('room-1', {
        taskId: 'task-stale',
        taskCode: 'CLN-STALE',
        approvedAt: '2026-10-03T08:30:00.000Z',
      }),
      /STALE_CLEANING_APPROVAL/,
    );
    assert.equal(h.updates.length, 0);
  }

  {
    const h = createHarness({
      room: room(RoomStatus.DIRTY),
      inHouse: { id: 'reservation-current' },
    });
    await assert.rejects(
      () => h.service.cleaningApproved('room-1', {
        taskId: 'task-occupied',
        taskCode: 'CLN-OCCUPIED',
        approvedAt: '2026-10-03T08:30:00.000Z',
      }),
      /ROOM_ALREADY_OCCUPIED/,
    );
    assert.equal(h.updates.length, 0);
  }

  {
    const alreadyVacant = room(RoomStatus.VACANT);
    const h = createHarness({ room: alreadyVacant });
    const result = await h.service.cleaningApproved('room-1', {
      taskId: 'task-retry',
      taskCode: 'CLN-RETRY',
      approvedAt: '2026-10-03T08:30:00.000Z',
    });
    assert.equal(result.data.room.status, RoomStatus.VACANT);
    assert.equal(h.updates.length, 0);
    assert.equal(h.emitted.length, 0);
  }

  console.log('Housekeeping sync contract tests PASS: VACANT/RESERVED writeback, stale/occupied guards, retry-safe idempotence.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
