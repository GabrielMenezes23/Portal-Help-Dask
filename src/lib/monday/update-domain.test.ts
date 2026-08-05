import assert from 'node:assert/strict';
import test from 'node:test';

import {
  flattenMondayUpdates,
  mondayUpdateText,
  portalCommentMarkerId,
} from './update-domain.ts';

test('uses plain text and strips HTML as a fallback', () => {
  assert.equal(
    mondayUpdateText({ id: '1', text_body: 'Texto simples', body: '<p>Ignorado</p>' }),
    'Texto simples',
  );
  assert.equal(
    mondayUpdateText({ id: '2', body: '<p>Primeira linha<br>Segunda &amp; terceira</p>' }),
    'Primeira linha\nSegunda & terceira',
  );
});

test('extracts portal comment dedupe marker', () => {
  assert.equal(
    portalCommentMarkerId('Resposta\n[CAF-COMMENT:123e4567-e89b-12d3-a456-426614174000]'),
    '123e4567-e89b-12d3-a456-426614174000',
  );
  assert.equal(portalCommentMarkerId('Comentário normal'), null);
});

test('flattens updates and replies without duplicates', () => {
  const comments = flattenMondayUpdates([
    {
      id: '10',
      text_body: 'Atualização principal',
      creator: { id: '1', name: 'Equipe TI' },
      assets: [{ id: '100', name: 'print.png' }],
      replies: [
        {
          id: '11',
          text_body: 'Resposta',
          creator: { id: '2', name: 'Solicitante' },
        },
      ],
    },
    { id: '10', text_body: 'Duplicado' },
  ]);

  assert.equal(comments.length, 2);
  assert.equal(comments[0]?.updateId, '10');
  assert.equal(comments[0]?.assets.length, 1);
  assert.equal(comments[1]?.parentUpdateId, '10');
  assert.equal(comments[1]?.authorName, 'Solicitante');
});
