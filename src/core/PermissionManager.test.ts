import { expect, test } from 'vitest';

import { PermissionManager } from './PermissionManager';

test('tracks permission requests and resolves them explicitly', () => {
  const manager = new PermissionManager();
  const created: string[] = [];
  const resolved: string[] = [];

  manager.on('requestCreated', (permission) => {
    created.push(permission.requestId);
  });
  manager.on('requestResolved', (event) => {
    resolved.push(`${event.action}:${event.permission.requestId}`);
  });

  manager.requestPermission('session-1', {
    requestId: 'perm-1',
    toolName: 'Bash',
    toolInput: { command: 'ls' },
  });

  expect(manager.getPendingRequests('session-1')).toHaveLength(1);
  expect(
    manager.approvePermission('perm-1', {
      behavior: 'allow',
      updatedInput: { command: 'ls' },
    }),
  ).toBe(true);
  expect(manager.getPendingRequests()).toHaveLength(0);
  expect(created).toEqual(['perm-1']);
  expect(resolved).toEqual(['approve:perm-1']);
});

test('dismisses all pending permissions for a session', () => {
  const manager = new PermissionManager();
  const dismissed: string[] = [];

  manager.on('requestDismissed', (event) => {
    dismissed.push(`${event.reason}:${event.permission.requestId}`);
  });

  manager.requestPermission('session-1', {
    requestId: 'perm-1',
    toolName: 'Bash',
    toolInput: { command: 'rm -rf tmp' },
  });
  manager.requestPermission('session-1', {
    requestId: 'perm-2',
    toolName: 'Bash',
    toolInput: { command: 'git push' },
  });
  manager.requestPermission('session-2', {
    requestId: 'perm-3',
    toolName: 'Bash',
    toolInput: { command: 'pwd' },
  });

  expect(
    manager.dismissSessionPermissions('session-1', 'session-error'),
  ).toBe(2);
  expect(manager.getPendingRequests('session-1')).toEqual([]);
  expect(manager.getPendingRequests('session-2')).toHaveLength(1);
  expect(dismissed).toEqual([
    'session-error:perm-1',
    'session-error:perm-2',
  ]);
});
