'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function RetryPendingButton() {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  async function retry() {
    setBusy(true); setMessage('');
    const response = await fetch('/api/admin/integrations/monday/retry-pending', { method: 'POST' });
    const data = await response.json(); setBusy(false);
    setMessage(response.ok ? `Reprocessado: ${data.result.tickets} chamados, ${data.result.comments} comentários e ${data.result.attachments} anexos.` : data.error || 'Falha ao reprocessar.');
    router.refresh();
  }
  return <div className="retry-box"><button className="button button--secondary" disabled={busy} onClick={retry} type="button">{busy ? 'Reprocessando…' : 'Reprocessar pendências'}</button>{message && <small>{message}</small>}</div>;
}
