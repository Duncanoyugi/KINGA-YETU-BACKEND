import { ChildrenController } from './children.controller';
import { ForbiddenException } from '@nestjs/common';

/**
 * Regression tests for the bulk-enumeration fix on GET /children:
 * previously a HEALTH_WORKER could pass any facilityId (or none at all)
 * and see every child in the system, since findAll() started from an
 * unfiltered Prisma query. The controller now resolves the caller's own
 * facility server-side and never trusts a client-supplied facilityId
 * outright.
 */
describe('ChildrenController.findAll — facility scoping', () => {
  function makeController(opts: {
    healthWorkerFacilityId?: string | null;
    findAllSpy: jest.Mock;
  }) {
    const prisma = {
      healthWorker: {
        findUnique: async () =>
          opts.healthWorkerFacilityId === undefined
            ? null
            : { facilityId: opts.healthWorkerFacilityId },
      },
      user: { findUnique: async () => null },
      parent: { findUnique: async () => null },
    } as any;
    const childrenService = { findAll: opts.findAllSpy } as any;
    return new ChildrenController(childrenService, {} as any, prisma);
  }

  it("scopes a HEALTH_WORKER's query to their own facility, ignoring any facilityId they pass", async () => {
    const findAllSpy = jest.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 10, totalPages: 0 });
    const controller = makeController({ healthWorkerFacilityId: 'facility-A', findAllSpy });

    await controller.findAll(1, 10, undefined, undefined, undefined, {
      user: { id: 'hw-1', role: 'HEALTH_WORKER' },
    });

    expect(findAllSpy).toHaveBeenCalledWith(1, 10, undefined, undefined, 'facility-A');
  });

  it('rejects a HEALTH_WORKER who explicitly requests a different facility', async () => {
    const findAllSpy = jest.fn();
    const controller = makeController({ healthWorkerFacilityId: 'facility-A', findAllSpy });

    await expect(
      controller.findAll(1, 10, undefined, undefined, 'facility-B', {
        user: { id: 'hw-1', role: 'HEALTH_WORKER' },
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(findAllSpy).not.toHaveBeenCalled();
  });

  it('returns an empty page (not an unfiltered query) for a health worker with no facility assigned', async () => {
    const findAllSpy = jest.fn();
    const controller = makeController({ healthWorkerFacilityId: null, findAllSpy });

    const result = await controller.findAll(1, 10, undefined, undefined, undefined, {
      user: { id: 'hw-2', role: 'HEALTH_WORKER' },
    });

    expect(result).toEqual({ data: [], total: 0, page: 1, limit: 10, totalPages: 0 });
    expect(findAllSpy).not.toHaveBeenCalled();
  });

  it('leaves ADMIN/SUPER_ADMIN queries unscoped', async () => {
    const findAllSpy = jest.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 10, totalPages: 0 });
    const controller = makeController({ findAllSpy });

    await controller.findAll(1, 10, undefined, undefined, 'any-facility', {
      user: { id: 'admin-1', role: 'ADMIN' },
    });

    expect(findAllSpy).toHaveBeenCalledWith(1, 10, undefined, undefined, 'any-facility');
  });
});
