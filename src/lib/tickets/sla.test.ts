import assert from 'node:assert/strict';
import test from 'node:test';

import { addBusinessMinutes, classifySla } from './sla.ts';

test('SLA pula o almoço e continua no mesmo dia', () => {
  const opened = new Date('2026-08-03T15:30:00.000Z'); // 12:30 em São Paulo
  const deadline = addBusinessMinutes(opened, 60);
  assert.equal(deadline.toISOString(), '2026-08-03T17:30:00.000Z'); // 14:30 local
});

test('SLA pula o fim de semana', () => {
  const opened = new Date('2026-08-07T19:30:00.000Z'); // sexta 16:30 local
  const deadline = addBusinessMinutes(opened, 60);
  assert.equal(deadline.toISOString(), '2026-08-10T11:12:00.000Z'); // segunda 08:12 local
});

test('classifica resolvido dentro do SLA', () => {
  const result = classifySla({
    deadline: new Date('2026-08-04T15:00:00.000Z'),
    resolvedAt: new Date('2026-08-04T14:30:00.000Z'),
    now: new Date('2026-08-04T16:00:00.000Z'),
  });
  assert.equal(result, 'resolved_ok');
});

test('SLA pula feriado configurado no calendário', () => {
  const start = new Date('2026-08-07T19:00:00.000Z'); // sexta 16:00 em São Paulo
  const deadline = addBusinessMinutes(start, 120, {
    holidays: new Set(['2026-08-10']),
  });
  assert.equal(deadline.toISOString(), '2026-08-11T11:42:00.000Z');
});
