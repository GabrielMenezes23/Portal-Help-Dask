'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type RefreshResponse = {
  ok: boolean;
  error?: string;
  summary?: {
    workspaces: number;
    boards: number;
    groups: number;
    columns: number;
    relations: number;
  };
};

export function MondaySchemaRefreshButton({ canRefresh }: { canRefresh: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RefreshResponse | null>(null);

  if (!canRefresh) return null;

  async function refresh() {
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch('/api/admin/integrations/monday/schema/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const payload = (await response.json()) as RefreshResponse;
      setResult(payload);
      if (payload.ok) router.refresh();
    } catch {
      setResult({ ok: false, error: 'Não foi possível alcançar o servidor.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="sync-action">
      <button className="button button--primary" type="button" onClick={refresh} disabled={loading}>
        {loading ? 'Atualizando estrutura…' : 'Atualizar estrutura agora'}
      </button>
      {result && (
        <div className={`sync-result ${result.ok ? 'sync-result--success' : 'sync-result--error'}`} role="status">
          {result.ok && result.summary ? (
            <>
              <strong>Inventário atualizado.</strong>
              <span>{result.summary.boards} boards, {result.summary.columns} colunas e {result.summary.relations} relações.</span>
            </>
          ) : (
            <>
              <strong>Inventário não concluído.</strong>
              <span>{result.error || 'Consulte o histórico da integração.'}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
