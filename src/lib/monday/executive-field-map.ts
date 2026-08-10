type ExecutiveColumn = {
  id: string;
  title: string;
  type: string;
  semanticHint?: string;
};

function normalizeSchemaText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

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
  responsibleText: 'text_mky2g5f9',
  status: 'status95',
  priority: 'priority',
  priorityJustification: 'long_textzr7lt7g8',
  requestType: 'request_type',
  rootCause: 'long_text_mkx84r4n',
  currentUpdate: 'text_mm0qa8s9',
  secondaryUpdate: 'text_mm03gt7h',
  requesterName: 'dropdown_mky7rgr1',
  requesterNameText: 'text',
  updateFiles: 'file_mm12mh4c',
  incidentFiles: 'file4t50hmgx',
  requestFiles: 'file7nrte5gu',
  duplicateRequestFiles: 'filee09d9aft',
  genericFile: 'filenlou89rv',
  userReply: 'long_text_mm12wpxe',
  category: 'color_mky7e9gb',
  incidentRelation: 'connect_boards2',
  tags: 'tag_mkxckwr6',
  workTime: 'duration_mkx84qkj',
  openTime: 'duration_mky1bm3m',
  supplierTicket: 'text_mm13vc8a',
  supplierLink: 'link_mm129mxs',
  hardwareIssue: 'text_mky7mt6k',
  softwareIssue: 'text_mky78j9s',
  selection: 'single_selectlqa52kw',
  text: 'text_mkxc1g3v',
  mondayDoc: 'doc_mky7zkr4',
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
  { excelField: 'Subelementos', internalField: null, knownColumnId: 'subitems' },
  { excelField: 'Descrição', internalField: 'description', knownColumnId: KNOWN_HELPDESK_MONDAY_FIELDS.description },
  { excelField: 'Link dos chamados', internalField: 'supplier_link', knownColumnId: KNOWN_HELPDESK_MONDAY_FIELDS.supplierLink },
  { excelField: 'N° do chamado Fornecedor', internalField: 'supplier_ticket', knownColumnId: KNOWN_HELPDESK_MONDAY_FIELDS.supplierTicket },
  { excelField: 'Atualização do chamado', internalField: 'current_update', knownColumnId: KNOWN_HELPDESK_MONDAY_FIELDS.currentUpdate },
  { excelField: 'Arquivos para atualizar chamado', internalField: 'update_files', knownColumnId: KNOWN_HELPDESK_MONDAY_FIELDS.updateFiles },
  { excelField: 'Nome do Funcionário', internalField: 'requester_name', knownColumnId: KNOWN_HELPDESK_MONDAY_FIELDS.requesterName },
  { excelField: 'Responsavel', internalField: 'responsible_name', knownColumnId: KNOWN_HELPDESK_MONDAY_FIELDS.responsible },
  { excelField: 'Status', internalField: 'status', knownColumnId: KNOWN_HELPDESK_MONDAY_FIELDS.status },
  { excelField: 'Prioridade', internalField: 'priority', knownColumnId: KNOWN_HELPDESK_MONDAY_FIELDS.priority },
  { excelField: 'Tipo de solicitação', internalField: 'request_type', knownColumnId: KNOWN_HELPDESK_MONDAY_FIELDS.requestType },
  { excelField: 'Resposta do Usuário ao chamado', internalField: 'user_reply', knownColumnId: KNOWN_HELPDESK_MONDAY_FIELDS.userReply },
  { excelField: 'Data de criação', internalField: 'opened_at', knownColumnId: KNOWN_HELPDESK_MONDAY_FIELDS.openedAt },
  { excelField: 'Arquivo para incidentes', internalField: 'incident_files', knownColumnId: KNOWN_HELPDESK_MONDAY_FIELDS.incidentFiles },
  { excelField: 'Justificativa da Prioridade', internalField: 'priority_justification', knownColumnId: KNOWN_HELPDESK_MONDAY_FIELDS.priorityJustification },
  { excelField: 'E-mail', internalField: 'requester_email', knownColumnId: KNOWN_HELPDESK_MONDAY_FIELDS.email },
  { excelField: 'Category', internalField: 'category', knownColumnId: KNOWN_HELPDESK_MONDAY_FIELDS.category },
  { excelField: 'Incidentes', internalField: 'incident_relation', knownColumnId: KNOWN_HELPDESK_MONDAY_FIELDS.incidentRelation },
  { excelField: 'Atualização do chamado', internalField: 'secondary_update', knownColumnId: KNOWN_HELPDESK_MONDAY_FIELDS.secondaryUpdate },
  { excelField: 'Data de resolução', internalField: 'resolved_at', knownColumnId: KNOWN_HELPDESK_MONDAY_FIELDS.resolvedAt },
  { excelField: 'Controle de tempo Tickets criado', internalField: 'work_time_seconds', knownColumnId: KNOWN_HELPDESK_MONDAY_FIELDS.workTime },
  { excelField: 'Controle de tempo tickets aberto', internalField: 'open_time_seconds', knownColumnId: KNOWN_HELPDESK_MONDAY_FIELDS.openTime },
  { excelField: 'Causa Raiz', internalField: 'root_cause', knownColumnId: KNOWN_HELPDESK_MONDAY_FIELDS.rootCause },
  { excelField: 'Tags', internalField: 'tags', knownColumnId: KNOWN_HELPDESK_MONDAY_FIELDS.tags },
  { excelField: 'Texto', internalField: 'text', knownColumnId: KNOWN_HELPDESK_MONDAY_FIELDS.text },
  { excelField: 'Arquivo para requisição de serviço', internalField: 'request_files', knownColumnId: KNOWN_HELPDESK_MONDAY_FIELDS.requestFiles },
  { excelField: 'Dup. of Preencha o documento para requisição de serviços', internalField: 'duplicate_request_files', knownColumnId: KNOWN_HELPDESK_MONDAY_FIELDS.duplicateRequestFiles },
  { excelField: 'Responsável', internalField: 'responsible_text', knownColumnId: KNOWN_HELPDESK_MONDAY_FIELDS.responsibleText },
  { excelField: 'Hardware Issue', internalField: 'hardware_issue', knownColumnId: KNOWN_HELPDESK_MONDAY_FIELDS.hardwareIssue },
  { excelField: 'Software Service Issue', internalField: 'software_issue', knownColumnId: KNOWN_HELPDESK_MONDAY_FIELDS.softwareIssue },
  { excelField: 'monday Doc', internalField: 'monday_doc', knownColumnId: KNOWN_HELPDESK_MONDAY_FIELDS.mondayDoc },
  { excelField: 'Arquivo', internalField: 'generic_file', knownColumnId: KNOWN_HELPDESK_MONDAY_FIELDS.genericFile },
  { excelField: 'Seleção individual', internalField: 'service_subtype', knownColumnId: KNOWN_HELPDESK_MONDAY_FIELDS.selection },
  { excelField: 'Nome do funcionário', internalField: 'requester_name_text', knownColumnId: KNOWN_HELPDESK_MONDAY_FIELDS.requesterNameText },
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

function compatible(column: ExecutiveColumn, definition: FieldDefinition): boolean {
  if (definition.expectedSemantic && column.semanticHint !== definition.expectedSemantic) return false;
  if (definition.expectedType?.length && !definition.expectedType.includes(column.type)) return false;
  return true;
}

export function buildExecutiveFieldMap(
  columns: ExecutiveColumn[],
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
