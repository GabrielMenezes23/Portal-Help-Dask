import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canAccessAdmin,
  canChangeOwnAdminAccess,
  isAppRole,
  normalizeRole,
} from './roles.ts';

test('recognizes only supported application roles', () => {
  assert.equal(isAppRole('requester'), true);
  assert.equal(isAppRole('ti_agent'), true);
  assert.equal(isAppRole('admin'), true);
  assert.equal(isAppRole('owner'), false);
  assert.equal(isAppRole(null), false);
});

test('normalizes unknown roles to requester', () => {
  assert.equal(normalizeRole('ADMIN'), 'admin');
  assert.equal(normalizeRole(' ti_agent '), 'ti_agent');
  assert.equal(normalizeRole('owner'), 'requester');
  assert.equal(normalizeRole(undefined), 'requester');
});

test('allows admin area only for active admins', () => {
  assert.equal(canAccessAdmin({ role: 'admin', active: true }), true);
  assert.equal(canAccessAdmin({ role: 'admin', active: false }), false);
  assert.equal(canAccessAdmin({ role: 'ti_agent', active: true }), false);
  assert.equal(canAccessAdmin(null), false);
});

test('impede administrador de remover o próprio acesso', () => {
  assert.equal(canChangeOwnAdminAccess({ active: false, role: 'admin' }), false);
  assert.equal(canChangeOwnAdminAccess({ active: true, role: 'ti_agent' }), false);
  assert.equal(canChangeOwnAdminAccess({ active: true, role: 'admin' }), true);
});
