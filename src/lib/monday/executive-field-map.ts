import { normalizeSchemaText, type MondaySchemaColumnRecord } from './schema-domain';

export const EXECUTIVE_EXCEL_FIELDS = [
  'Nome',
  'Subelementos',
  'Descrição',
  'Link dos chamados',
  'N° do chamado Fornecedor',
  'Atualização do chamado',
  'Arquivos para atualizar chamado',
  'Nome do Funcionário',
  'Responsavel',
  'Status',
  'Prioridade',
  'Tipo de solicitação',
  'Resposta do Usuário ao chamado',
  'Data de criação',
  'Arquivo para incidentes',
  'Justificativa da Prioridade',
  'E-mail',
  'Category',
  'Incidentes',
  'Atualização do chamado',
  'Data de resolução',
  'Controle de tempo Tickets criado',
  'Controle de tempo tickets aberto',
  'Causa Raiz',
  'Tags',
  'Texto',
  'Arquivo para requisição de serviço',
  'Dup. of Preencha o documento para requisição de serviços',
  'Responsável',
  'Hardware Issue',
  'Software Service Issue',
  'monday Doc',
  'Arquivo',
  'Seleção individual',
  'Nome do funcionário',
  'Item ID (auto generated)',
] as const;

export const KNOWN_HELPDESK_MONDAY_FIELDS = {
  email: 'email',
  openedAt: 'date',
  resolvedAt: 'date6',
  description: 'long_text7',
  responsible: 'people0',
  status: 'status95',
  priority: 'priority',
  priorityJustification: 'long_textzr7lt7g8',
  requestType: 'request_type',
  rootCause: 'long_text_mkx84r4n',
  currentUpdate: 'text_mm0qa8s9',
  requesterName: 'dropdown_mky7rgr1',
  legacyFiles: 'file_mm12mh4c',
  userReply: 'long_text_mm12wpxe',
  userFiles: 'file4t50hmgx',
} as const;

type MappingStatus = 'confirmed' | 'probable' | 'ambiguous' | 'unmapped';

type FieldDefinition = {
  excelField: string;
  internalField: string | null;
  knownColumnId?: string;
  expectedSemantic?: string;
  expectedType?: string[];
};

const FIELD_DEFINITIONS: FieldDefinition[] = [
  { excelField: 'Nome', internalField: 'title' },
  { excelField: 'Subelementos', internalField: null },
  { excelField: 'Descrição', internalField: 'description', knownColumnId: KNOWN_HELPDESK_MONDAY_FIELDS.description },
  { excelField: 'Link dos chamados', internalField: 'supplier_link', expectedSemantic: 'supplier_link', expectedType: ['link', 'text'] },
  { excelField: 'N° do chamado Fornecedor', internalField: 'supplier_ticket', expectedSemantic: 'supplier_ticket', expectedType: ['text', 'numbers'] },
  { excelField: 'Atualização do chamado', internalField: 'current_update', knownColumnId: KNOWN_HELPDESK_MONDAY_FIELDS.currentUpdate },
  { excelField: 'Arquivos para atualizar chamado', internalField: null, expectedSemantic: 'file', expectedType: ['file', 'files'] },
  { excelField: 'Nome do Funcionário', internalField: 'requester_name', knownColumnId: KNOWN_HELPDESK_MONDAY_FIELDS.requesterName },
  { excelField: 'Responsavel', internalField: 'responsible_name', knownColumnId: KNOWN_HELPDESK_MONDAY_FIELDS.responsible },
  { excelField: 'Status', internalField: 'status', knownColumnId: KNOWN_HELPDESK_MONDAY_FIELDS.status },
  { excelField: 'Prioridade', internalField: 'priority', knownColumnId: KNOWN_HELPDESK_MONDAY_FIELDS.priority },
  { excelField: 'Tipo de solicitação', internalField: 'request_type', knownColumnId: KNOWN_HELPDESK_MONDAY_FIELDS.requestType },
  { excelField: 'Resposta do Usuário ao chamado', internalField: 'user_reply', knownColumnId: KNOWN_HELPDESK_MONDAY_FIELDS.userReply },
  { excelField: 'Data de criação', internalField: 'opened_at', knownColumnId: KNOWN_HELPDESK_MONDAY_FIELDS.openedAt },
  { excelField: 'Arquivo para incidentes', internalField: 'incident_files', knownColumnId: KNOWN_HELPDESK_MONDAY_FIELDS.legacyFiles },
  { excelField: 'Justificativa da Prioridade', internalField: 'priority_justification', knownColumnId: KNOWN_HELPDESK_MONDAY_FIELDS.priorityJustification },
  { excelField: 'E-mail', internalField: 'requester_email', knownColumnId: KNOWN_HELPDESK_MONDAY_FIELDS.email },
  { excelField: 'Category', internalField: 'category', expectedSemantic: 'category' },
  { excelField: 'Incidentes', internalField: 'incident_relation', expectedSemantic: 'incident' },
  { excelField: 'Atualização do chamado', internalField: null },
  { excelField: 'Data de resolução', internalField: 'resolved_at', knownColumnId: KNOWN_HELPDESK_MONDAY_FIELDS.resolvedAt },
  { excelField: 'Controle de tempo Tickets criado', internalField: 'work_time_seconds', expectedSemantic: 'time_tracking', expectedType: ['time_tracking'] },
  { excelField: 'Controle de tempo tickets aberto', internalField: 'open_time_seconds', expectedSemantic: 'time_tracking', expectedType: ['time_tracking'] },
  { excelField: 'Causa Raiz', internalField: 'root_cause', knownColumnId: KNOWN_HELPDESK_MONDAY_FIELDS.rootCause },
  { excelField: 'Tags', internalField: 'tags', expectedSemantic: 'tags', expectedType: ['tags'] },
  { excelField: 'Texto', internalField: null, expectedType: ['text', 'long_text'] },
  { excelField: 'Arquivo para requisição de serviço', internalField: 'user_files', knownColumnId: KNOWN_HELPDESK_MONDAY_FIELDS.userFiles },
  { excelField: 'Dup. of Preencha o documento para requisição de serviços', internalField: null },
  { excelField: 'Responsável', internalField: 'responsible_name', knownColumnId: KNOWN_HELPDESK_MONDAY_FIELDS.responsible },
  { excelField: 'Hardware Issue', internalField: 'hardware_relation', expectedSemantic: 'hardware' },
  { excelField: 'Software Service Issue', internalField: 'software_relation', expectedSemantic: 'software' },
  { excelField: 'monday Doc', internalField: null },
  { excelField: 'Arquivo', internalField: null, expectedSemantic: 'file' },
  { excelField: 'Seleção individual', internalField: 'service_subtype' },
  { excelField: 'Nome do funcionário', internalField: 'requester_name', knownColumnId: KNOWN_HELPDESK_MONDAY_FIELDS.requesterName },
  { excelField: 'Item ID (auto generated)', internalField: 'monday_item_id' },
];

if (FIELD_DEFINITIONS.length !== EXECUTIVE_EXCEL_FIELDS.length) {
  throw new Error('Mapa executivo não corresponde aos 36 campos do Excel.');
}

export type ExecutiveFieldMapping = {
  excelIndex: number;
  excelField: string;
  internalField: string | null;
  status: MappingStatus;
  columnId: string | null;
  columnTitle: string | null;
  columnType: string | null;
  candidates: Array<{ id: string; title: string; type: string }>;
};

function compatible(column: MondaySchemaColumnRecord, definition: FieldDefinition): boolean {
  if (definition.expectedSemantic && column.semanticHint !== definition.expectedSemantic) return false;
  if (definition.expectedType?.length && !definition.expectedType.includes(column.type)) return false;
  return true;
}

export function buildExecutiveFieldMap(
  columns: MondaySchemaColumnRecord[],
): ExecutiveFieldMapping[] {
  return FIELD_DEFINITIONS.map((definition, excelIndex) => {
    if (definition.knownColumnId) {
      const confirmed = columns.find((column) => column.id === definition.knownColumnId);
      if (confirmed) {
        return {
          excelIndex,
          excelField: definition.excelField,
          internalField: definition.internalField,
          status: 'confirmed' as const,
          columnId: confirmed.id,
          columnTitle: confirmed.title,
          columnType: confirmed.type,
          candidates: [{ id: confirmed.id, title: confirmed.title, type: confirmed.type }],
        };
      }
    }

    // Fields represented by item metadata rather than a board column are intentionally unmapped.
    if (['title', 'monday_item_id'].includes(definition.internalField || '')) {
      return {
        excelIndex,
        excelField: definition.excelField,
        internalField: definition.internalField,
        status: 'confirmed' as const,
        columnId: null,
        columnTitle: null,
        columnType: null,
        candidates: [],
      };
    }

    const normalizedTitle = normalizeSchemaText(definition.excelField);
    let candidates = columns.filter(
      (column) => normalizeSchemaText(column.title) === normalizedTitle && compatible(column, definition),
    );

    // If the visible title differs slightly (e.g. accents/case), semantic classification can still suggest it.
    if (candidates.length === 0 && definition.expectedSemantic) {
      candidates = columns.filter((column) => compatible(column, definition));
    }

    const rendered = candidates.map((candidate) => ({
      id: candidate.id,
      title: candidate.title,
      type: candidate.type,
    }));

    if (candidates.length === 1) {
      const candidate = candidates[0];
      return {
        excelIndex,
        excelField: definition.excelField,
        internalField: definition.internalField,
        status: 'probable' as const,
        columnId: candidate.id,
        columnTitle: candidate.title,
        columnType: candidate.type,
        candidates: rendered,
      };
    }
    if (candidates.length > 1) {
      return {
        excelIndex,
        excelField: definition.excelField,
        internalField: definition.internalField,
        status: 'ambiguous' as const,
        columnId: null,
        columnTitle: null,
        columnType: null,
        candidates: rendered,
      };
    }
    return {
      excelIndex,
      excelField: definition.excelField,
      internalField: definition.internalField,
      status: 'unmapped' as const,
      columnId: null,
      columnTitle: null,
      columnType: null,
      candidates: [],
    };
  });
}
