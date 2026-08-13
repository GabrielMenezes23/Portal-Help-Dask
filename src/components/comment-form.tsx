'use client';

import { useRouter } from 'next/navigation';
import { useState, type ChangeEvent, type FormEvent } from 'react';

export function CommentForm({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/tickets/${ticketId}/comments`, { method: 'POST', body: form });
    const result = await response.json(); setBusy(false);
    if (!response.ok) { setError(result.error || Object.values(result.errors || {}).join(' ') || 'Falha ao enviar.'); return; }
    setMessage(''); event.currentTarget.reset(); router.refresh();
  }

  return (
    <form className="comment-form" onSubmit={submit}>
      {error && <div className="form-alert" role="alert">{error}</div>}
      <textarea name="message" value={message} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setMessage(event.target.value)} rows={4} maxLength={6000} placeholder="Adicione uma informação, dúvida ou retorno para a TI." />
      <div className="comment-form__actions"><input name="file" type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip" /><button className="button button--primary" disabled={busy} type="submit">{busy ? 'Enviando…' : 'Enviar comentário'}</button></div>
    </form>
  );
}
