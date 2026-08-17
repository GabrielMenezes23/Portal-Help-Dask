'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';

import styles from './new-ticket-form.module.css';

const requestTypes = [
  'Dúvida',
  'Incidente',
  'Pedido de licença',
  'Requisição de serviço',
];

const serviceTypes = [
  'Criação de sistemas personalizados',
  'Criação de Dashboards',
  'Melhorias sistêmicas',
  'Infraestrutura',
  'Outros',
];

type ResponsibleOption = { id: string; label: string };

type NewTicketFormProps = {
  requesterEmail: string;
  requesterName: string;
  responsibleOptions: ResponsibleOption[];
};

function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function NewTicketForm({
  requesterEmail,
  requesterName,
  responsibleOptions,
}: NewTicketFormProps) {
  const router = useRouter();
  const automaticResponsible = useMemo(
    () =>
      responsibleOptions.find(
        (option) => normalizeName(option.label) === normalizeName(requesterName),
      ) || null,
    [requesterName, responsibleOptions],
  );
  const [responsibleId, setResponsibleId] = useState(automaticResponsible?.id || '');
  const [priority, setPriority] = useState('medium');
  const [requestType, setRequestType] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submissionId = useRef<string | null>(null);

  const selectedResponsible = responsibleOptions.find(
    (option) => option.id === responsibleId,
  );

  const normalizedRequestType = useMemo(() => {
    if (requestType !== 'Requisição de serviço') return requestType;
    return serviceType ? `${requestType} · ${serviceType}` : requestType;
  }, [requestType, serviceType]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');

    const form = new FormData(event.currentTarget);
    submissionId.current ||= crypto.randomUUID();
    form.set('submissionId', submissionId.current);
    form.set('requestType', normalizedRequestType);
    form.set('openingResponsibleOptionId', responsibleId);
    form.set('openingResponsibleName', selectedResponsible?.label || '');

    const response = await fetch('/api/tickets', { method: 'POST', body: form });
    const result = await response.json();
    setBusy(false);

    if (!response.ok) {
      const messages = result.errors
        ? Object.values(result.errors).join(' ')
        : result.error;
      setError(messages || 'Não foi possível abrir o chamado.');
      return;
    }

    router.push(`/app/tickets/${result.id}?created=1`);
    router.refresh();
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      {error && <div className="form-alert" role="alert">{error}</div>}

      <div className={styles.grid}>
        <div className={styles.field}>
          <label htmlFor="openedAt">Data</label>
          <input
            id="openedAt"
            className={styles.input}
            value={new Intl.DateTimeFormat('pt-BR', {
              dateStyle: 'short',
              timeStyle: 'short',
              timeZone: 'America/Sao_Paulo',
            }).format(new Date())}
            readOnly
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="requesterEmail">E-mail</label>
          <input id="requesterEmail" className={styles.input} value={requesterEmail} readOnly />
        </div>

        <div className={`${styles.field} ${styles.fieldFull}`}>
          <label htmlFor="title">Breve resumo <span className={styles.required}>*</span></label>
          <input
            id="title"
            className={styles.input}
            name="title"
            required
            minLength={5}
            maxLength={255}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Resuma o que você precisa"
          />
          <span className={styles.counter}>{title.length}/255</span>
        </div>

        <div className={`${styles.field} ${styles.fieldFull}`}>
          <label htmlFor="description">Descreva detalhadamente o problema <span className={styles.required}>*</span></label>
          <textarea
            id="description"
            className={styles.textarea}
            name="description"
            required
            minLength={10}
            maxLength={2000}
            rows={6}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Informe o que aconteceu, mensagens de erro, equipamento afetado e tentativas já realizadas."
          />
          <span className={styles.counter}>{description.length}/2000</span>
        </div>

        <div className={`${styles.field} ${styles.fieldFull}`}>
          <label htmlFor="openingResponsible">Responsável pela abertura <span className={styles.required}>*</span></label>
          <select
            id="openingResponsible"
            className={styles.select}
            value={responsibleId}
            onChange={(event) => setResponsibleId(event.target.value)}
            required
          >
            <option value="" disabled>Selecione o responsável</option>
            {responsibleOptions.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
          <small>
            A lista é sincronizada com o Monday. O nome da sua conta é selecionado automaticamente quando houver correspondência exata.
          </small>
        </div>

        <div className={`${styles.field} ${styles.fieldFull}`}>
          <span className={styles.fieldLabel}>Prioridade <span className={styles.required}>*</span></span>
          <div className={styles.helpBox}>
            <strong>Resumo rápido</strong>
            <ul>
              <li><strong>Crítica:</strong> falha ou parada total que afeta diretamente Faturamento ou Produção.</li>
              <li><strong>Alta:</strong> parada parcial ou situação que exige contingência.</li>
              <li><strong>Média/Baixa:</strong> chamado planejado que pode aguardar.</li>
            </ul>
          </div>
          <select
            className={styles.select}
            name="priority"
            value={priority}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => setPriority(event.target.value)}
          >
            <option value="critical">Crítica</option>
            <option value="high">Alta</option>
            <option value="medium">Média</option>
            <option value="low">Baixa</option>
          </select>
        </div>

        {(priority === 'critical' || priority === 'high') && (
          <div className={`${styles.field} ${styles.fieldFull}`}>
            <label htmlFor="justification">Justifique a criticidade <span className={styles.required}>*</span></label>
            <textarea
              id="justification"
              className={styles.textarea}
              name="justification"
              required
              rows={4}
              maxLength={2000}
              placeholder="Explique o impacto, usuários afetados e por que o atendimento precisa ser priorizado."
            />
          </div>
        )}

        <div className={`${styles.field} ${styles.fieldFull}`}>
          <span className={styles.fieldLabel}>Tipo de solicitação <span className={styles.required}>*</span></span>
          <div className={styles.helpBox}>
            <strong>Resumo rápido</strong>
            <ul>
              <li><strong>Incidente:</strong> falha, parada ou degradação.</li>
              <li><strong>Pedido de licença:</strong> nova licença ou alteração de uma existente, com aval do gestor.</li>
              <li><strong>Requisição:</strong> solicitação de serviço.</li>
              <li><strong>Dúvida:</strong> orientação sobre uso ou funcionamento.</li>
            </ul>
          </div>
          <select
            className={styles.select}
            value={requestType}
            onChange={(event) => {
              setRequestType(event.target.value);
              if (event.target.value !== 'Requisição de serviço') setServiceType('');
            }}
            required
          >
            <option value="" disabled>Selecione</option>
            {requestTypes.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
          <input type="hidden" name="requestType" value={normalizedRequestType} />
        </div>

        {requestType === 'Requisição de serviço' && (
          <div className={`${styles.field} ${styles.fieldFull}`}>
            <label htmlFor="serviceType">Escolha qual tipo de serviço <span className={styles.required}>*</span></label>
            <select
              id="serviceType"
              className={styles.select}
              value={serviceType}
              onChange={(event) => setServiceType(event.target.value)}
              required
            >
              <option value="" disabled>Selecione</option>
              {serviceTypes.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </div>
        )}

        <div className={`${styles.field} ${styles.fieldFull}`}>
          <span className={styles.fieldLabel}>Para ajudar na detecção e resolução</span>
          <div className={styles.helpBox}>
            <span>Anexe, quando possível:</span>
            <ul>
              <li>mensagens de erro;</li>
              <li>prints;</li>
              <li>documentos ou arquivos relacionados.</li>
            </ul>
          </div>
          <label className={styles.upload}>
            <span>
              Escolha um arquivo ou arraste e solte aqui
              <input name="file" type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip" />
              <small>Máximo de 8 MB.</small>
            </span>
          </label>
        </div>
      </div>

      <div className={styles.actions}>
        <button className="button button--primary" disabled={busy} type="submit">
          {busy ? 'Registrando…' : 'Abrir chamado'}
        </button>
      </div>
    </form>
  );
}
