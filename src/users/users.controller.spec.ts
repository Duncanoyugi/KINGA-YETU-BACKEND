import { UsersController } from './users.controller';
import { ForbiddenException } from '@nestjs/common';

/**
 * PUT /users/:id/password previously had no @Roles() and never checked
 * that the caller was the target user. The handler does verify the
 * *target* user's current password before allowing the change, so this
 * isn't a blind reset — but without this check, anyone logged in as any
 * account could reset a *different* user's password just by supplying
 * that other account's current password (e.g. one obtained from an
 * unrelated data breach), without ever needing to log into the target
 * account, bypassing whatever protections exist on the real login flow.
 */
describe('UsersController.changePassword — ownership check', () => {
  function makeController(changePasswordSpy: jest.Mock) {
    const usersService = { changePassword: changePasswordSpy } as any;
    return new UsersController(usersService);
  }

  const dto = { currentPassword: 'old', newPassword: 'new', confirmNewPassword: 'new' } as any;

  it('allows a user to change their own password', async () => {
    const spy = jest.fn().mockResolvedValue(undefined);
    const controller = makeController(spy);

    await controller.changePassword('u1', dto, { user: { id: 'u1', role: 'PARENT' } });

    expect(spy).toHaveBeenCalledWith('u1', dto);
  });

  it('blocks a user from changing a different user\'s password', async () => {
    const spy = jest.fn();
    const controller = makeController(spy);

    await expect(
      controller.changePassword('u2', dto, { user: { id: 'u1', role: 'PARENT' } }),
    ).rejects.toThrow(ForbiddenException);
    expect(spy).not.toHaveBeenCalled();
  });

  it('gives HEALTH_WORKER no special access to another user\'s password', async () => {
    const spy = jest.fn();
    const controller = makeController(spy);

    await expect(
      controller.changePassword('u2', dto, { user: { id: 'hw1', role: 'HEALTH_WORKER' } }),
    ).rejects.toThrow(ForbiddenException);
    expect(spy).not.toHaveBeenCalled();
  });

  it('allows ADMIN to change another user\'s password', async () => {
    const spy = jest.fn().mockResolvedValue(undefined);
    const controller = makeController(spy);

    await controller.changePassword('u2', dto, { user: { id: 'admin1', role: 'ADMIN' } });

    expect(spy).toHaveBeenCalledWith('u2', dto);
  });

  it('allows SUPER_ADMIN to change another user\'s password', async () => {
    const spy = jest.fn().mockResolvedValue(undefined);
    const controller = makeController(spy);

    await controller.changePassword('u2', dto, { user: { id: 'sa1', role: 'SUPER_ADMIN' } });

    expect(spy).toHaveBeenCalledWith('u2', dto);
  });
});
