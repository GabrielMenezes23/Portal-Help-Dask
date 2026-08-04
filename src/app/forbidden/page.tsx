import Link from 'next/link';
import type { Metadata } from 'next';

import { logout } from '@/app/login/actions';
import { BrandMark } from '@/components/brand-mark';

export const metadata: Metadata = { title: 'Acesso negado' };

type ForbiddenPageProps = {
  searchParams: Promise<{ reason?: string }>;
};

export default async function ForbiddenPage({ searchParams }: ForbiddenPageProps) {
  const { reason } = await searchParams;
  const message = reason === 'inactive'
    ? 'Seu perfil está inativo. Procure a equipe de TI para revisar o acesso.'
    : reason === 'profile'
      ? 'Seu usuário existe no Auth, mas o perfil interno ainda não foi provisionado.'
      : 'Seu perfil não possui permissão para acessar esta área.';

  return (
    <main className="center-page">
      <div className="center-card">
        <BrandMark />
        <span className="center-card__icon" aria-hidden="true">!</span>
        <h1>Acesso não autorizado</h1>
        <p>{message}</p>
        <div className="center-card__actions">
          <Link className="button button--primary" href="/app">Voltar para o portal</Link>
          <form action={logout}>
            <button className="button button--ghost" type="submit">Sair</button>
          </form>
        </div>
      </div>
    </main>
  );
}
