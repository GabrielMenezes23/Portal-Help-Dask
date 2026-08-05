import assert from 'node:assert/strict';
import test from 'node:test';

import {
  findExactResponsibleMatch,
  normalizeResponsibleLabel,
  parseDropdownSettings,
} from './dropdown-options.ts';

test('normalizes accents, spacing and case', () => {
  assert.equal(normalizeResponsibleLabel('  João   da SILVA '), 'joao da silva');
});

test('parses and de-duplicates dropdown labels', () => {
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

test('only auto-selects an exact normalized name', () => {
  const options = parseDropdownSettings(JSON.stringify({
    labels: { '1': 'Gabriel Menezes', '2': 'Gabriela Menezes' },
  }));

  assert.equal(findExactResponsibleMatch('GABRIEL MENEZES', options)?.id, '1');
  assert.equal(findExactResponsibleMatch('Gabriel', options), null);
});
