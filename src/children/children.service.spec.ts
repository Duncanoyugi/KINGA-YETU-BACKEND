import { ChildrenService } from './children.service';
import { ForbiddenException } from '@nestjs/common';

/**
 * Regression tests for the IDOR fix in ChildrenService: findOne(),
 * getChildDashboard(), update() and remove() must all verify that the
 * requester either owns the child (via Parent.userId) or holds an
 * explicitly allowed role — see assertCanAccessChild(). Before this fix,
 * findOne()/getChildDashboard() had no such check at all: any
 * authenticated user could view any child's full record by ID.
 */
describe('ChildrenService.assertCanAccessChild', () => {
  const child = { parentId: 'child-owner-parent-id' };

  function makePrisma(ownerUserId: string, requesterRole?: string) {
    return {
      parent: {
        findUnique: async ({ where }: any) =>
          where.id === 'child-owner-parent-id' ? { userId: ownerUserId } : null,
      },
      user: {
        findUnique: async ({ where }: any) =>
          where.id === 'requesting-user-id'
            ? { id: 'requesting-user-id', role: requesterRole }
            : null,
      },
    } as any;
  }

  it('allows the child\'s own parent', async () => {
    const svc = new ChildrenService({} as any, makePrisma('requesting-user-id'));
    await expect(
      svc.assertCanAccessChild(child, 'requesting-user-id', 'view'),
    ).resolves.toBeUndefined();
  });

  it('blocks a different parent', async () => {
    const svc = new ChildrenService({} as any, makePrisma('some-other-user-id', 'PARENT'));
    await expect(
      svc.assertCanAccessChild(child, 'requesting-user-id', 'view'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows ADMIN regardless of ownership', async () => {
    const svc = new ChildrenService({} as any, makePrisma('some-other-user-id', 'ADMIN'));
    await expect(
      svc.assertCanAccessChild(child, 'requesting-user-id', 'view'),
    ).resolves.toBeUndefined();
  });

  it('blocks HEALTH_WORKER from a delete when allowedRoles excludes it', async () => {
    const svc = new ChildrenService({} as any, makePrisma('some-other-user-id', 'HEALTH_WORKER'));
    await expect(
      svc.assertCanAccessChild(child, 'requesting-user-id', 'delete', ['ADMIN', 'SUPER_ADMIN']),
    ).rejects.toThrow(ForbiddenException);
  });

  it('skips the check entirely for internal/system calls (no userId)', async () => {
    const svc = new ChildrenService({} as any, makePrisma('some-other-user-id', 'PARENT'));
    await expect(
      svc.assertCanAccessChild(child, undefined, 'view'),
    ).resolves.toBeUndefined();
  });
});
