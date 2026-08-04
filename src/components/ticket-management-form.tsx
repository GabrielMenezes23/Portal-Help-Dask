'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

export function TicketManagementForm({ ticketId, status, rootCause, currentUpdate }: { ticketId: string; status: string; rootCause: string; currentUpdate: string }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('');
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/admin/tickets/${ticketId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: form.get('status'), rootCause: form.get('rootCause'), currentUpdate: form.get('currentUpdate') }) });
    const data = await response.json(); setBusy(false);
    setMessage(response.ok ? (data.syncError ? 'Salvo no Supabase; a sincronização com o Monday ficou pendente.' : 'Chamado atualizado com sucesso.') : data.error || 'Falha ao atualizar.');
    if (response.ok) router.refresh();
  }
  return <form className="management-form" onSubmit={submit}><h2>Atualização da TI</h2><label>Status<select name="status" defaultValue={status}><option value="open">Aberto</option><option value="in_progress">Em andamento</option><option value="resolved">Resolvido</option><option value="cancelled">Cancelado</option></select></label><label>Atualização para o solicitante<textarea name="currentUpdate" rows={4} defaultValue={currentUpdate} /></label><label>Causa raiz<textarea name="rootCause" rows={4} defaultValue={rootCause} /></label><button className="button button--primary" disabled={busy}>{busy ? 'Salvando…' : 'Salvar atualização'}</button>{message && <small>{message}</small>}</form>;
}
