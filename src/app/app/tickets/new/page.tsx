import type { Metadata } from 'next';

import { AppShell } from '@/components/app-shell';
import { NewTicketForm } from '@/components/new-ticket-form';
import { requireActiveUser } from '@/lib/auth/current-user';

export const metadata: Metadata = { title: 'Novo chamado' };
export const dynamic = 'force-dynamic';

export default async function NewTicketPage() {
  const { profile } = await requireActiveUser();
  const requesterName = profile.fullName || profile.email.split('@')[0];

  return (
    <AppShell
      active="new"
      user={{
        email: profile.email,
        fullName: profile.fullName,
        role: profile.role,
      }}
    >
      <section className="page-heading">
        <div>
          <p className="page-heading__context">Atendimento de TI</p>
          <h1>Abrir novo chamado</h1>
          <p>
            Preencha as informações abaixo. Após o envio, você receberá um protocolo e poderá acompanhar todo o atendimento pelo portal.
          </p>
        </div>
      </section>

      <section className="panel form-panel">
        <NewTicketForm
          requesterEmail={profile.email}
          requesterName={requesterName}
        />
      </section>
    </AppShell>
  );
}
