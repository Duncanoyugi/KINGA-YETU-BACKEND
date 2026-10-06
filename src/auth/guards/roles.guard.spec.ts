import { RolesGuard } from './roles.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';

/**
 * This guard's own logic was never actually broken — the bug found in
 * this pass was that `children.controller.ts`, `reports.controller.ts`
 * and others had `@Roles()` decorators without ever applying RolesGuard
 * via @UseGuards(), so the restrictions silently did nothing. These tests
 * exist to pin down that the guard itself behaves correctly, as a
 * baseline for anyone auditing whether a given controller actually wires
 * it in (that part has to be checked per-controller — see the note in
 * CHANGES.md about a recurring "does every @Roles() controller also have
 * RolesGuard in @UseGuards()" check).
 */
describe('RolesGuard', () => {
  function makeContext(userRole: string | undefined): ExecutionContext {
    const request = { user: userRole ? { role: userRole } : undefined };
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => request }),
    } as any as ExecutionContext;
  }

  function makeGuard(requiredRoles: string[] | undefined) {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(requiredRoles);
    return new RolesGuard(reflector);
  }

  it('blocks a role not in the required list', () => {
    const guard = makeGuard(['ADMIN', 'SUPER_ADMIN', 'HEALTH_WORKER']);
    expect(() => guard.canActivate(makeContext('PARENT'))).toThrow();
  });

  it('allows a role that is in the required list', () => {
    const guard = makeGuard(['ADMIN', 'SUPER_ADMIN', 'HEALTH_WORKER']);
    expect(guard.canActivate(makeContext('ADMIN'))).toBe(true);
  });

  it('allows any authenticated role when the route has no @Roles() at all', () => {
    const guard = makeGuard(undefined);
    expect(guard.canActivate(makeContext('PARENT'))).toBe(true);
  });
});
