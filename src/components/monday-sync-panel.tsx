'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type SyncResponse = {
  ok: boolean;
  error?: string;
  runId?: string;
  summary?: {
    itemsReceived: number;
    ticketsUpserted: number;
    attachmentsUpserted: number;
    ticketsDeactivated: number;
    attachmentsDeactivated: number;
  };
};

export function MondaySyncPanel({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SyncResponse | null>(null);

  async function synchronize() {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/admin/integrations/monday/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const payload = (await response.json()) as SyncResponse;
      setResult(payload);
      if (payload.ok) router.refresh();
    } catch {
      setResult({
        ok: false,
        error: 'Não foi possível alcançar o servidor.',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="sync-action">
      <button
        className="button button--primary"
        type="button"
        onClick={synchronize}
        disabled={disabled || loading}
      >
        {loading ? 'Sincronizando…' : 'Sincronizar Monday agora'}
      </button>

      {result && (
        <div
          className={`sync-result ${result.ok ? 'sync-result--success' : 'sync-result--error'}`}
          role="status"
        >
          {result.ok && result.summary ? (
            <>
              <strong>Sincronização concluída.</strong>
              <span>
                {result.summary.ticketsUpserted} tickets e{' '}
                {result.summary.attachmentsUpserted} anexos processados.
              </span>
            </>
          ) : (
            <>
              <strong>Sincronização não concluída.</strong>
              <span>{result.error || 'Consulte os logs da integração.'}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
