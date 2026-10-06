import { SchedulesService } from './schedules.service';
import { ForbiddenException } from '@nestjs/common';

function makePrisma(overrides: any = {}) {
  const capturedWheres: any[] = [];
  return {
    capturedWheres,
    healthWorker: {
      findUnique: async ({ where }: any) => overrides.healthWorkers?.[where.userId] ?? null,
    },
    user: {
      findUnique: async ({ where }: any) => overrides.users?.[where.id] ?? null,
    },
    vaccinationSchedule: {
      count: async ({ where }: any) => {
        capturedWheres.push(where);
        return 0;
      },
      findMany: async ({ where }: any) => {
        capturedWheres.push(where);
        return [];
      },
    },
  } as any;
}

function makeService(prisma: any) {
  return new SchedulesService(prisma, {} as any);
}

describe('SchedulesService.assertCanAccessSchedule', () => {
  it('allows the owning parent', async () => {
    const svc = makeService(makePrisma());
    const schedule = { child: { parent: { user: { id: 'owner' } } } };
    await expect(
      (svc as any).assertCanAccessSchedule(schedule, 'owner'),
    ).resolves.toBeUndefined();
  });

  it('blocks a different parent', async () => {
    const svc = makeService(makePrisma({ users: { stranger: { id: 'stranger', role: 'PARENT' } } }));
    const schedule = { child: { parent: { user: { id: 'owner' } } } };
    await expect(
      (svc as any).assertCanAccessSchedule(schedule, 'stranger'),
    ).rejects.toThrow(ForbiddenException);
  });
});

/**
 * Fixing the HEALTH_WORKER bulk-enumeration gap on GET /schedules
 * surfaced a second, independent pre-existing bug: `childFilter` (meant
 * to scope by birthFacilityId) was built but never actually merged into
 * the Prisma `where` clause sent to the database — so even the original
 * `facilityId` query parameter was silently a no-op. These tests assert
 * on the literal query Prisma receives, not just whether the right
 * exception is thrown, specifically because that bug would otherwise
 * pass a shallower test.
 */
describe('SchedulesService.findAll facility scoping', () => {
  it("scopes a HEALTH_WORKER's query to their own facility via where.child.birthFacilityId", async () => {
    const prisma = makePrisma({ healthWorkers: { hw1: { facilityId: 'facility-A' } } });
    const svc = makeService(prisma);

    await svc.findAll(
      1, 10, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
      { id: 'hw1', role: 'HEALTH_WORKER' },
    );

    expect(prisma.capturedWheres[0]).toMatchObject({ child: { birthFacilityId: 'facility-A' } });
  });

  it('rejects a HEALTH_WORKER requesting a different facility', async () => {
    const prisma = makePrisma({ healthWorkers: { hw1: { facilityId: 'facility-A' } } });
    const svc = makeService(prisma);

    await expect(
      svc.findAll(
        1, 10, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, 'facility-B',
        { id: 'hw1', role: 'HEALTH_WORKER' },
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('returns an empty page for a health worker with no facility assigned, without querying', async () => {
    const prisma = makePrisma();
    const svc = makeService(prisma);

    const result = await svc.findAll(
      1, 10, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
      { id: 'hw-unassigned', role: 'HEALTH_WORKER' },
    );

    expect(result).toEqual({ data: [], total: 0, page: 1, limit: 10, totalPages: 0 });
    expect(prisma.capturedWheres).toHaveLength(0);
  });

  it('leaves internal calls with no requester unfiltered (pre-existing behaviour)', async () => {
    const prisma = makePrisma();
    const svc = makeService(prisma);

    await svc.findAll(1, 10);

    expect(prisma.capturedWheres[0].child).toBeUndefined();
  });

  it('regression: a plain facilityId query parameter actually filters results (previously a no-op)', async () => {
    // No requester (e.g. an ADMIN call, or the pre-existing behaviour
    // before HEALTH_WORKER scoping existed) explicitly passing
    // facilityId — this must still reach Prisma as a real filter.
    const prisma = makePrisma();
    const svc = makeService(prisma);

    await svc.findAll(1, 10, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, 'facility-C');

    expect(prisma.capturedWheres[0]).toMatchObject({ child: { birthFacilityId: 'facility-C' } });
  });
});
