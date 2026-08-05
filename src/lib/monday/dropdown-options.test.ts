import assert from 'node:assert/strict';
import test from 'node:test';

import {
  findExactResponsibleMatch,
  normalizeResponsibleLabel,
  parseDropdownSettings,
} from './dropdown-options-domain.ts';

test('normalizes accents, spacing and case', () => {
  assert.equal(normalizeResponsibleLabel('  João   da SILVA '), 'joao da silva');
});

test('parses and de-duplicates legacy dropdown labels', () => {
  const options = parseDropdownSettings(JSON.stringify({
    labels: {
      '1': 'Ana Souza',
      '2': ' João da Silva ',
      '3': 'joão  da  silva',
      '4': '',
    },
  }));

  assert.deepEqual(
    options.map((option) => ({ id: option.id, label: option.label })),
    [
      { id: '1', label: 'Ana Souza' },
      { id: '2', label: 'João da Silva' },
    ],
  );
});

test('parses current typed dropdown settings and ignores deactivated labels', () => {
  const options = parseDropdownSettings({
    labels: [
      { id: 1, label: 'Ana Souza', is_deactivated: false },
      { id: 2, label: ' João da Silva ', is_deactivated: false },
      { id: 3, label: 'Nome antigo', is_deactivated: true },
      { id: 4, label: '' },
    ],
  });

  assert.deepEqual(
    options.map((option) => ({ id: option.id, label: option.label })),
    [
      { id: '1', label: 'Ana Souza' },
      { id: '2', label: 'João da Silva' },
    ],
  );
});

test('de-duplicates current dropdown options by id and normalized label', () => {
  const options = parseDropdownSettings({
    labels: [
      { id: 1, label: 'Ana Souza', is_deactivated: false },
      { id: 1, label: 'Ana S. Souza', is_deactivated: false },
      { id: 2, label: ' João   da Silva ', is_deactivated: false },
      { id: 3, label: 'joão da silva', is_deactivated: false },
    ],
  });

  assert.deepEqual(
    options.map((option) => ({ id: option.id, label: option.label })),
    [
      { id: '1', label: 'Ana Souza' },
      { id: '2', label: 'João da Silva' },
    ],
  );
});

test('only auto-selects an exact normalized name', () => {
  const options = parseDropdownSettings(JSON.stringify({
    labels: { '1': 'Gabriel Menezes', '2': 'Gabriela Menezes' },
  }));

  assert.equal(findExactResponsibleMatch('GABRIEL MENEZES', options)?.id, '1');
  assert.equal(findExactResponsibleMatch('Gabriel', options), null);
});
