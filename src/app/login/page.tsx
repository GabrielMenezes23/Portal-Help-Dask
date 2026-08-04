import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { BrandMark } from '@/components/brand-mark';
import { getConfigurationStatus } from '@/lib/env/env';
import { createClient } from '@/lib/supabase/server';

import { login } from './actions';

export const metadata: Metadata = { title: 'Entrar' };
export const dynamic = 'force-dynamic';

const errorMessages: Record<string, string> = {
  required: 'Preencha o e-mail e a senha.',
  invalid_credentials: 'E-mail ou senha inválidos.',
  configuration: 'O portal está temporariamente indisponível. Contate a TI.',
};

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const configuration = getConfigurationStatus();
  const isConfigured =
    configuration.supabaseUrlConfigured &&
    configuration.supabasePublishableKeyConfigured;

  if (isConfigured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) redirect('/app');
  }

  const params = await searchParams;
  const error = params.error ? errorMessages[params.error] : null;

  return (
    <main className="login-page">
      <section className="login-story">
        <BrandMark />
        <div className="login-story__content">
          <h1>Helpdesk, canal oficial para acompanhamento de tickets.</h1>
          <p>
            Chamados, comentários, anexos, SLA e auditoria, integrados ao Monday.
          </p>

          <div className="login-checks">
            <span><b>01</b> Abra e acompanhe chamados com mais organização</span>
            <span><b>02</b> Visualize comentários, anexos e atualizações em um só lugar</span>
            <span><b>03</b> Acompanhe status, histórico e SLA do atendimento</span>
          </div>
        </div>
        <small className="login-story__footer">
          CAF Máquinas · Tecnologia da Informação
        </small>
      </section>

      <section className="login-form-wrap">
        <div className="login-card">
          <div className="login-card__heading">
            <span className={`configuration-dot ${isConfigured ? '' : 'configuration-dot--warning'}`} />
            <div>
              <h2>Acesso ao Helpdesk</h2>
              <p>
                {isConfigured
                  ? 'Entre com seu e-mail corporativo e senha.'
                  : 'O portal está temporariamente indisponível.'}
              </p>
            </div>
          </div>

          {error && <div className="form-alert" role="alert">{error}</div>}

          <form action={login} className="auth-form">
            <label htmlFor="email">E-mail corporativo</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="nome@cafmaquinas.com.br"
              required
              disabled={!isConfigured}
            />

            <label htmlFor="password">Senha</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              required
              disabled={!isConfigured}
            />

            <button className="button button--primary button--full" type="submit" disabled={!isConfigured}>
              Entrar com segurança
            </button>
          </form>

          <div className="login-card__note">
            <strong>Cadastros são controlados pela TI.</strong>
            <span>Não existe auto cadastro público.</span>
          </div>
        </div>
      </section>
    </main>
  );
}
