export type MondayUpdateAsset = {
  id: string;
  name?: string | null;
  url?: string | null;
  public_url?: string | null;
  file_extension?: string | null;
  file_size?: number | null;
  created_at?: string | null;
};

export type MondayUpdateAuthor = {
  id?: string | null;
  name?: string | null;
};

export type MondayUpdateNode = {
  id: string;
  body?: string | null;
  text_body?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  creator?: MondayUpdateAuthor | null;
  assets?: MondayUpdateAsset[] | null;
  replies?: MondayUpdateNode[] | null;
};

export type NormalizedMondayComment = {
  updateId: string;
  parentUpdateId: string | null;
  body: string;
  authorName: string;
  createdAt: string | null;
  updatedAt: string | null;
  assets: MondayUpdateAsset[];
  rawPayload: MondayUpdateNode;
};

function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function mondayUpdateText(update: MondayUpdateNode): string {
  const text = String(update.text_body || '').trim();
  if (text) return text;
  return stripHtml(String(update.body || ''));
}

export function portalCommentMarkerId(body: string): string | null {
  return body.match(/\[CAF-COMMENT:([0-9a-f-]{36})\]/i)?.[1]?.toLowerCase() || null;
}

export function flattenMondayUpdates(updates: MondayUpdateNode[]): NormalizedMondayComment[] {
  const output: NormalizedMondayComment[] = [];
  const seen = new Set<string>();

  const append = (node: MondayUpdateNode, parentUpdateId: string | null) => {
    const updateId = String(node.id || '').trim();
    if (!updateId || seen.has(updateId)) return;
    seen.add(updateId);
    const body = mondayUpdateText(node);
    const assets = Array.isArray(node.assets) ? node.assets.filter((asset) => String(asset?.id || '').trim()) : [];
    if (body || assets.length > 0) {
      output.push({
        updateId,
        parentUpdateId,
        body,
        authorName: String(node.creator?.name || 'Usuário do Monday').trim(),
        createdAt: node.created_at ? String(node.created_at) : null,
        updatedAt: node.updated_at ? String(node.updated_at) : null,
        assets,
        rawPayload: node,
      });
    }
    for (const reply of node.replies || []) append(reply, updateId);
  };

  for (const update of updates) append(update, null);
  return output;
}
