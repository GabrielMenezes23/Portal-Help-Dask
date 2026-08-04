'use client';

import { useRouter } from 'next/navigation';
import { useState, type ChangeEvent, type FormEvent } from 'react';

const requestTypes = ['Acesso e permissões', 'Computador', 'E-mail e Microsoft 365', 'Impressora', 'Infraestrutura e rede', 'SAP', 'Sistema interno', 'Telefonia', 'Outro'];

export function NewTicketForm() {
  const router = useRouter();
  const [priority, setPriority] = useState('medium');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/tickets', { method: 'POST', body: form });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) {
      const messages = result.errors ? Object.values(result.errors).join(' ') : result.error;
      setError(messages || 'Não foi possível abrir o chamado.'); return;
    }
    router.push(`/app/tickets/${result.id}?created=1`); router.refresh();
  }

  return (
    <form className="professional-form" onSubmit={submit}>
      {error && <div className="form-alert" role="alert">{error}</div>}
      <label>Título do chamado<input name="title" required minLength={5} maxLength={160} placeholder="Ex.: Não consigo acessar o SAP" /></label>
      <label>Tipo de solicitação<select name="requestType" required defaultValue=""><option value="" disabled>Selecione</option>{requestTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
      <label>Prioridade<select name="priority" value={priority} onChange={(event: ChangeEvent<HTMLSelectElement>) => setPriority(event.target.value)}><option value="critical">Crítica</option><option value="high">Alta</option><option value="medium">Média</option><option value="low">Baixa</option></select></label>
      {(priority === 'critical' || priority === 'high') && <label>Justificativa obrigatória<textarea name="justification" required rows={3} maxLength={1200} placeholder="Explique o impacto e por que precisa dessa prioridade." /></label>}
      <label>Descrição detalhada<textarea name="description" required minLength={10} maxLength={6000} rows={7} placeholder="Informe o que aconteceu, mensagem de erro, equipamento e tentativas já realizadas." /></label>
      <label>Anexo opcional<input name="file" type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip" /><small>Máximo de 8 MB.</small></label>
      <button className="button button--primary" disabled={busy} type="submit">{busy ? 'Registrando…' : 'Abrir chamado'}</button>
    </form>
  );
}
