import { ImmunizationsService } from './immunizations.service';
import { ForbiddenException } from '@nestjs/common';

function makePrisma(overrides: any = {}) {
  const capturedWheres: any[] = [];
  return {
    capturedWheres,
    healthWorker: {
      findUnique: async ({ where }: any) =>
        overrides.healthWorkers?.[where.userId] ?? null,
    },
    user: {
      findUnique: async ({ where }: any) => overrides.users?.[where.id] ?? null,
    },
    immunization: {
      count: async ({ where }: any) => {
        capturedWheres.push(where);
        return 0;
      },
      findMany: async ({ where }: any) => {
        capturedWheres.push(where);
        return [];
      },
    },
    ...overrides.prisma,
  } as any;
}

function makeService(prisma: any) {
  return new ImmunizationsService(prisma, {} as any, {} as any, {} as any);
}

describe('ImmunizationsService.assertCanAccessImmunization', () => {
  it('allows the owning parent', async () => {
    const svc = makeService(makePrisma());
    const record = { child: { parent: { user: { id: 'owner' } } } };
    await expect(
      (svc as any).assertCanAccessImmunization(record, 'owner'),
    ).resolves.toBeUndefined();
  });

  it('blocks a different parent', async () => {
    const svc = makeService(
      makePrisma({ users: { stranger: { id: 'stranger', role: 'PARENT' } } }),
    );
    const record = { child: { parent: { user: { id: 'owner' } } } };
    await expect(
      (svc as any).assertCanAccessImmunization(record, 'stranger'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows HEALTH_WORKER/ADMIN/SUPER_ADMIN regardless of ownership', async () => {
    for (const role of ['HEALTH_WORKER', 'ADMIN', 'SUPER_ADMIN']) {
      const svc = makeService(makePrisma({ users: { staff: { id: 'staff', role } } }));
      const record = { child: { parent: { user: { id: 'owner' } } } };
      await expect(
        (svc as any).assertCanAccessImmunization(record, 'staff'),
      ).resolves.toBeUndefined();
    }
  });
});

/**
 * Regression tests for the bulk-enumeration fix: GET /immunizations
 * previously started from an unfiltered `where: {}` when no query
 * parameters were supplied — any authenticated PARENT could page through
 * every immunization record in the system. HEALTH_WORKER is now confined
 * server-side to their own facility.
 */
describe('ImmunizationsService.findAll facility scoping', () => {
  it("scopes a HEALTH_WORKER's query to their own facility", async () => {
    const prisma = makePrisma({ healthWorkers: { hw1: { facilityId: 'facility-A' } } });
    const svc = makeService(prisma);

    await svc.findAll(1, 10, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, {
      id: 'hw1',
      role: 'HEALTH_WORKER',
    });

    expect(prisma.capturedWheres[0]).toMatchObject({ facilityId: 'facility-A' });
  });

  it('rejects a HEALTH_WORKER requesting a different facility', async () => {
    const prisma = makePrisma({ healthWorkers: { hw1: { facilityId: 'facility-A' } } });
    const svc = makeService(prisma);

    await expect(
      svc.findAll(1, 10, undefined, undefined, 'facility-B', undefined, undefined, undefined, undefined, undefined, {
        id: 'hw1',
        role: 'HEALTH_WORKER',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('returns an empty page for a health worker with no facility assigned, without querying', async () => {
    const prisma = makePrisma();
    const svc = makeService(prisma);

    const result = await svc.findAll(1, 10, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, {
      id: 'hw-unassigned',
      role: 'HEALTH_WORKER',
    });

    expect(result).toEqual({ data: [], total: 0, page: 1, limit: 10, totalPages: 0 });
    expect(prisma.capturedWheres).toHaveLength(0);
  });

  it('leaves internal calls with no requester unfiltered (pre-existing behaviour)', async () => {
    const prisma = makePrisma();
    const svc = makeService(prisma);

    await svc.findAll(1, 10);

    expect(prisma.capturedWheres[0]).toEqual({});
  });
});
