import { NotificationsService } from './notifications.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

function make(notifs: Record<string, string> = {}) {
  const calls = { delete: 0, queueRead: 0 };
  const prisma: any = {
    notification: {
      findUnique: async ({ where }: any) => (notifs[where.id] ? { userId: notifs[where.id] } : null),
      delete: async () => {
        calls.delete++;
      },
    },
  };
  const queue: any = {
    markAsRead: async () => {
      calls.queueRead++;
    },
  };
  const svc = new NotificationsService(prisma, queue, {} as any, {} as any, {} as any);
  return { svc, calls };
}

const owner = { id: 'u-owner', role: 'PARENT' };
const stranger = { id: 'u-other', role: 'PARENT' };
const worker = { id: 'u-hw', role: 'HEALTH_WORKER' };
const admin = { id: 'u-admin', role: 'ADMIN' };

/**
 * Previously no route in NotificationsController consulted req.user at
 * all — any logged-in account could read, clear, or delete another
 * user's notifications, or change their preferences.
 */
describe('NotificationsService.assertOwnerOrAdmin', () => {
  it('allows a user to access their own notifications', () => {
    const { svc } = make();
    expect(() => svc.assertOwnerOrAdmin('u-owner', owner)).not.toThrow();
  });

  it("blocks a different user from another's notifications", () => {
    const { svc } = make();
    expect(() => svc.assertOwnerOrAdmin('u-owner', stranger)).toThrow(ForbiddenException);
  });

  it('gives HEALTH_WORKER no special access to another user\'s notifications', () => {
    const { svc } = make();
    expect(() => svc.assertOwnerOrAdmin('u-owner', worker)).toThrow(ForbiddenException);
  });

  it('allows ADMIN to access any user\'s notifications', () => {
    const { svc } = make();
    expect(() => svc.assertOwnerOrAdmin('u-owner', admin)).not.toThrow();
  });
});

/**
 * deleteNotification previously called `new PrismaClient()` directly in
 * the controller instead of using the injected PrismaService — under this
 * project's Prisma 7 + driver-adapter setup, a bare PrismaClient throws
 * at construction, so the endpoint was already fully broken (every call
 * would 500) independent of the missing auth check. It now uses the
 * injected PrismaService and enforces ownership.
 */
describe('NotificationsService.deleteNotification', () => {
  it('lets the owner delete their own notification', async () => {
    const { svc, calls } = make({ n1: 'u-owner' });
    const result = await svc.deleteNotification('n1', owner);
    expect(result).toEqual({ success: true });
    expect(calls.delete).toBe(1);
  });

  it('blocks a stranger and never touches the database', async () => {
    const { svc, calls } = make({ n1: 'u-owner' });
    await expect(svc.deleteNotification('n1', stranger)).rejects.toThrow(ForbiddenException);
    expect(calls.delete).toBe(0);
  });

  it('returns 404 (not a 500) for a nonexistent notification', async () => {
    const { svc, calls } = make();
    await expect(svc.deleteNotification('missing', owner)).rejects.toThrow(NotFoundException);
    expect(calls.delete).toBe(0);
  });
});

describe('NotificationsService.markAsRead', () => {
  it('blocks a stranger before the queue is ever touched', async () => {
    const { svc, calls } = make({ n1: 'u-owner' });
    await expect(svc.markAsRead('n1', stranger)).rejects.toThrow(ForbiddenException);
    expect(calls.queueRead).toBe(0);
  });

  it('still works for internal calls with no requester (pre-existing behaviour)', async () => {
    const { svc, calls } = make({ n1: 'u-owner' });
    await svc.markAsRead('n1');
    expect(calls.queueRead).toBe(1);
  });
});
