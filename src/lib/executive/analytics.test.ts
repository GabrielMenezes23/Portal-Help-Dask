import assert from 'node:assert/strict';
import test from 'node:test';

import {
  agingBucket,
  buildWeeklyOriginSeries,
  calculateResolutionStats,
  cycleBucket,
  inferTicketOrigin,
  isDependencyStatus,
  ticketAgeDays,
  type ExecutiveTicketInput,
} from './analytics.ts';

function ticket(partial: Partial<ExecutiveTicketInput> = {}): ExecutiveTicketInput {
  return {
    id: partial.id || '1',
    openedAt: partial.openedAt ?? '2026-08-03T12:00:00.000Z',
    resolvedAt: partial.resolvedAt ?? null,
    requesterName: partial.requesterName ?? 'USUÁRIO TESTE',
    requesterEmail: partial.requesterEmail ?? 'usuario@cafmaquinas.com.br',
    description: partial.description ?? 'Descrição preenchida',
    priorityKey: partial.priorityKey ?? 'medium',
    priorityRaw: partial.priorityRaw ?? 'Média',
    requestType: partial.requestType ?? 'Incidente',
    priorityJustification: partial.priorityJustification ?? '',
  };
}

test('replica a regra histórica de origem usuário do portal executivo', () => {
  assert.equal(inferTicketOrigin(ticket()).origin, 'Usuário');
  assert.equal(inferTicketOrigin(ticket({ requesterEmail: '' })).origin, 'TI');
  assert.equal(inferTicketOrigin(ticket({ description: '' })).origin, 'TI');
  assert.equal(inferTicketOrigin(ticket({ requesterName: 'Não informado' })).origin, 'TI');
  assert.equal(inferTicketOrigin(ticket({ priorityKey: 'unknown', priorityRaw: '' })).origin, 'TI');
  assert.equal(inferTicketOrigin(ticket({ requestType: '' })).origin, 'TI');
});

test('alta e crítica exigem justificativa para origem usuário', () => {
  assert.equal(
    inferTicketOrigin(ticket({ priorityKey: 'high', priorityRaw: 'Alta', priorityJustification: '' })).origin,
    'TI',
  );
  assert.equal(
    inferTicketOrigin(ticket({ priorityKey: 'high', priorityRaw: 'Alta', priorityJustification: 'Impacto operacional' })).origin,
    'Usuário',
  );
  assert.equal(
    inferTicketOrigin(ticket({ priorityKey: 'critical', priorityRaw: 'Crítica', priorityJustification: 'Parada total' })).origin,
    'Usuário',
  );
});

test('calcula média, mediana, p90 e percentuais de resolução', () => {
  const stats = calculateResolutionStats([
    ticket({ id: '1', openedAt: '2026-08-01T10:00:00Z', resolvedAt: '2026-08-01T12:00:00Z' }),
    ticket({ id: '2', openedAt: '2026-08-01T10:00:00Z', resolvedAt: '2026-08-02T10:00:00Z' }),
    ticket({ id: '3', openedAt: '2026-08-01T10:00:00Z', resolvedAt: '2026-08-04T10:00:00Z' }),
    ticket({ id: '4', openedAt: '2026-08-01T10:00:00Z', resolvedAt: '2026-08-11T10:00:00Z' }),
    ticket({ id: '5', openedAt: '2026-08-01T10:00:00Z', resolvedAt: null }),
  ]);

  assert.equal(stats.resolvedWithDuration, 4);
  assert.equal(stats.medianSeconds, 172800);
  assert.equal(stats.sameDayPct, 25);
  assert.equal(stats.within3DaysPct, 75);
  assert.equal(stats.p90Seconds, 864000);
  assert.equal(stats.averageSeconds, 304200);
});

test('classifica aging de backlog em faixas estáveis', () => {
  const now = new Date('2026-08-10T12:00:00Z');
  assert.equal(agingBucket('2026-08-10T11:00:00Z', now), '0-1 dia');
  assert.equal(agingBucket('2026-08-08T12:00:00Z', now), '2-3 dias');
  assert.equal(agingBucket('2026-08-05T12:00:00Z', now), '4-7 dias');
  assert.equal(agingBucket('2026-07-30T12:00:00Z', now), '8-14 dias');
  assert.equal(agingBucket('2026-07-20T12:00:00Z', now), '15-30 dias');
  assert.equal(agingBucket('2026-06-01T12:00:00Z', now), '>30 dias');
});

test('calcula idade inteira e identifica estados de dependência', () => {
  const now = new Date('2026-08-10T12:00:00Z');
  assert.equal(ticketAgeDays('2026-08-01T13:00:00Z', now), 8);
  assert.equal(ticketAgeDays(null, now), null);
  assert.equal(isDependencyStatus('Bloqueado'), true);
  assert.equal(isDependencyStatus('Aguardando fornecedor'), true);
  assert.equal(isDependencyStatus('Pendente usuário'), true);
  assert.equal(isDependencyStatus('Em andamento'), false);
  assert.equal(isDependencyStatus('Resolvido'), false);
});

test('classifica distribuição de ciclo', () => {
  assert.equal(cycleBucket(3600), 'Mesmo dia');
  assert.equal(cycleBucket(86400), '1-3 dias');
  assert.equal(cycleBucket(4 * 86400), '4-7 dias');
  assert.equal(cycleBucket(10 * 86400), '8-14 dias');
  assert.equal(cycleBucket(20 * 86400), '>14 dias');
  assert.equal(cycleBucket(null), 'Sem duração');
});

test('agrupa participação semanal de usuários versus TI de segunda a domingo', () => {
  const rows = buildWeeklyOriginSeries([
    ticket({ id: 'u1', openedAt: '2026-08-03T10:00:00Z' }),
    ticket({ id: 'u2', openedAt: '2026-08-09T10:00:00Z' }),
    ticket({ id: 'ti1', openedAt: '2026-08-09T10:00:00Z', requesterEmail: '' }),
    ticket({ id: 'u3', openedAt: '2026-08-10T10:00:00Z' }),
  ]);

  assert.deepEqual(rows, [
    { start: '2026-08-03', users: 2, ti: 1, total: 3, userPct: 66.7, tiPct: 33.3 },
    { start: '2026-08-10', users: 1, ti: 0, total: 1, userPct: 100, tiPct: 0 },
  ]);
});
