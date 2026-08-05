import assert from 'node:assert/strict';
import test from 'node:test';

import {
  emailBelongsToAllowedDomain,
  normalizeAllowedEmailDomains,
  sanitizePostLoginPath,
} from './microsoft-auth.ts';

test('normalizes configured Microsoft email domains', () => {
  assert.deepEqual(
    normalizeAllowedEmailDomains(' CAFMAQUINAS.COM.BR,  caf.local ,cafmaquinas.com.br '),
    ['cafmaquinas.com.br', 'caf.local'],
  );
});

test('allows only exact corporate email domains', () => {
  const allowed = ['cafmaquinas.com.br'];

  assert.equal(
    emailBelongsToAllowedDomain('gabriel@cafmaquinas.com.br', allowed),
    true,
  );
  assert.equal(
    emailBelongsToAllowedDomain('gabriel@sub.cafmaquinas.com.br', allowed),
    false,
  );
  assert.equal(
    emailBelongsToAllowedDomain('gabriel@cafmaquinas.com.br.evil.test', allowed),
    false,
  );
  assert.equal(emailBelongsToAllowedDomain('', allowed), false);
});

test('keeps only safe relative post-login paths', () => {
  assert.equal(sanitizePostLoginPath('/app/tickets'), '/app/tickets');
  assert.equal(sanitizePostLoginPath('/admin?tab=users'), '/admin?tab=users');
  assert.equal(sanitizePostLoginPath('https://evil.test'), '/app');
  assert.equal(sanitizePostLoginPath('//evil.test/path'), '/app');
  assert.equal(sanitizePostLoginPath('javascript:alert(1)'), '/app');
  assert.equal(sanitizePostLoginPath(null), '/app');
});
