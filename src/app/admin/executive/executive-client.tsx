'use client';

import { useEffect, useState } from 'react';

import type { ExecutiveTicket } from '@/lib/executive/query';
import { inferTicketOrigin, formatDuration } from '@/lib/executive/analytics';

import styles from './executive-parity.module.css';

function csvEscape(value: unknown) {
  const text = String(value ?? '').replace(/\r?\n/g, ' ');
  return `"${text.replace(/"/g, '""')}"`;
}

export function ExecutiveCsvButton({ tickets }: { tickets: ExecutiveTicket[] }) {
  function download() {
    const header = ['Ticket','Data abertura','Data resolução','Chamado','Status','Prioridade','Tipo','Categoria','Solicitante','E-mail','Responsável','Tags','Causa raiz','Chamado fornecedor','Link fornecedor','Tempo TI','Tempo aberto','Origem'];
    const rows = tickets.map((ticket) => [
      ticket.reference,
      ticket.openedAt || '',
      ticket.resolvedAt || '',
      ticket.title,
      ticket.status,
      ticket.priorityRaw,
      ticket.requestType,
      ticket.category,
      ticket.requesterName,
      ticket.requesterEmail,
      ticket.responsibleName,
      ticket.tags.join(' | '),
      ticket.rootCause,
      ticket.supplierTicket,
      ticket.supplierLink,
      ticket.workTimeSeconds,
      ticket.openTimeSeconds,
      inferTicketOrigin(ticket).origin,
    ]);
    const csv = '\uFEFF' + [header, ...rows].map((row) => row.map(csvEscape).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `painel-executivo-tickets-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return <>
    <button className={styles.actionButton} type="button" onClick={download}>Exportar CSV</button>
    <ExecutivePrintButton />
  </>;
}

export function ExecutivePrintButton() {
  return <button className={styles.actionButton} type="button" onClick={() => window.print()}>Relatório PDF</button>;
}

export function TicketDetailButton({ ticket }: { ticket: ExecutiveTicket }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const origin = inferTicketOrigin(ticket);
  return <>
    <button className={styles.detailButton} type="button" onClick={() => setOpen(true)}>{ticket.reference}</button>
    {open && <div className={styles.drawerBack} role="presentation" onMouseDown={() => setOpen(false)}>
      <aside className={styles.drawer} role="dialog" aria-modal="true" aria-label={`Detalhes do ticket ${ticket.reference}`} onMouseDown={(event) => event.stopPropagation()}>
        <div className={styles.drawerHead}>
          <div><small>{ticket.reference}</small><h2>{ticket.title}</h2></div>
          <button className={styles.close} type="button" aria-label="Fechar" onClick={() => setOpen(false)}>×</button>
        </div>
        <div className={styles.facts}>
          <Fact label="Status" value={ticket.status} /><Fact label="Prioridade" value={ticket.priorityRaw} />
          <Fact label="Tipo" value={ticket.requestType} /><Fact label="Categoria" value={ticket.category} />
          <Fact label="Solicitante" value={ticket.requesterName} /><Fact label="E-mail" value={ticket.requesterEmail} />
          <Fact label="Responsável" value={ticket.responsibleName} /><Fact label="Origem inferida" value={origin.origin} />
          <Fact label="Abertura" value={ticket.openedAt || '—'} /><Fact label="Resolução" value={ticket.resolvedAt || '—'} />
          <Fact label="Time Tracking TI" value={formatDuration(ticket.workTimeSeconds)} /><Fact label="Tempo aberto" value={formatDuration(ticket.openTimeSeconds)} />
          <Fact label="Chamado fornecedor" value={ticket.supplierTicket} /><Fact label="Sistema de origem" value={ticket.sourceSystem} />
        </div>
        <TextBlock title="Descrição" value={ticket.description} />
        <TextBlock title="Justificativa da prioridade" value={ticket.priorityJustification} />
        <TextBlock title="Causa raiz" value={ticket.rootCause} />
        <TextBlock title="Tags" value={ticket.tags.join(', ')} />
        <TextBlock title="Hardware" value={ticket.hardwareIssue} />
        <TextBlock title="Software" value={ticket.softwareIssue} />
        <TextBlock title="Classificação de origem" value={origin.reason} />
        {ticket.supplierLink && <div className={styles.block}><strong>Link do fornecedor</strong><br /><a href={ticket.supplierLink} target="_blank" rel="noreferrer">Abrir link</a></div>}
      </aside>
    </div>}
  </>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div className={styles.fact}><small>{label}</small><strong>{value || '—'}</strong></div>;
}

function TextBlock({ title, value }: { title: string; value: string }) {
  return <div className={styles.block}><strong>{title}</strong><br />{value || '—'}</div>;
}
