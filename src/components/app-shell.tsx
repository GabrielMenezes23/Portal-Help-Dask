import Link from 'next/link';
import type { ReactNode } from 'react';

import { logout } from '@/app/login/actions';
import type { AppRole } from '@/lib/auth/roles';

import { BrandMark } from './brand-mark';

type ActivePage = 'overview' | 'tickets' | 'new' | 'admin' | 'executive' | 'adminTickets' | 'users' | 'sla' | 'audit' | 'integration';

type AppShellProps = {
  children: ReactNode;
  active: ActivePage;
  user: { email: string; fullName: string | null; role: AppRole };
};

const roleLabels: Record<AppRole, string> = {
  requester: 'Solicitante',
  ti_agent: 'Equipe de TI',
  admin: 'Administrador',
};

export function AppShell({ children, active, user }: AppShellProps) {
  const initials = (user.fullName || user.email)
    .split(/[\s.@_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  const support = user.role === 'ti_agent' || user.role === 'admin';
  const admin = user.role === 'admin';

  const link = (href: string, key: ActivePage, icon: string, label: string) => (
    <Link href={href} className={`nav-item ${active === key ? 'nav-item--active' : ''}`}>
      <span className="nav-item__icon" aria-hidden="true">{icon}</span>{label}
    </Link>
  );

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar__top">
          <BrandMark />
          <span className="phase-label">Sistema oficial · Supabase</span>
        </div>
        <nav className="sidebar__nav" aria-label="Navegação principal">
          {link('/app', 'overview', '⌂', 'Visão geral')}
          {link('/app/tickets', 'tickets', '◎', support ? 'Chamados' : 'Meus chamados')}
          {link('/app/tickets/new', 'new', '＋', 'Novo chamado')}
          {support && (
            <>
              <span className="nav-section-label">Operação TI</span>
              {link('/admin', 'admin', '◇', 'Dashboard TI')}
              {link('/admin/executive', 'executive', '◈', 'Painel Executivo')}
              {link('/admin/tickets', 'adminTickets', '▤', 'Gerenciar chamados')}
            </>
          )}
          {admin && (
            <>
              <span className="nav-section-label">Administração</span>
              {link('/admin/users', 'users', '♙', 'Usuários e acessos')}
              {link('/admin/settings/sla', 'sla', '◷', 'SLA e calendário')}
              {link('/admin/audit', 'audit', '≡', 'Auditoria')}
              {link('/admin/integrations/monday', 'integration', '⇄', 'Integração Monday')}
            </>
          )}
        </nav>
        <div className="sidebar__footer">
          <div className="user-card">
            <span className="avatar" aria-hidden="true">{initials || 'TI'}</span>
            <span className="user-card__copy"><strong>{user.fullName || user.email.split('@')[0]}</strong><small>{roleLabels[user.role]}</small></span>
          </div>
          <form action={logout}><button className="button button--ghost button--full" type="submit">Sair com segurança</button></form>
        </div>
      </aside>
      <main className="app-main">
        <header className="mobile-header">
          <BrandMark compact />
          <details className="mobile-menu">
            <summary>Menu</summary>
            <div className="mobile-menu__panel">
              <Link href="/app">Visão geral</Link><Link href="/app/tickets">Chamados</Link><Link href="/app/tickets/new">Novo chamado</Link>
              {support && <><Link href="/admin">Dashboard TI</Link><Link href="/admin/executive">Painel Executivo</Link><Link href="/admin/tickets">Gerenciar</Link></>}
              {admin && <><Link href="/admin/users">Usuários</Link><Link href="/admin/audit">Auditoria</Link><Link href="/admin/integrations/monday">Monday</Link></>}
              <form action={logout}><button type="submit">Sair</button></form>
            </div>
          </details>
        </header>
        {children}
      </main>
    </div>
  );
}
