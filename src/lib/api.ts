import type {
  Bench,
  Room,
  DocKind,
  DocEnvelope,
  DocMeta,
  PutRes,
  PutReq,
  ListRes,
  CreateReq,
  UpdateReq,
  PresentationRes,
  ConflictRes,
} from '../../shared/types';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export class ConflictError extends ApiError {
  constructor(public current: DocMeta) {
    super(409, 'A newer revision is available.');
  }
}

async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (response.status === 409) {
    const conflict = (await response.json()) as Partial<ConflictRes>;
    if (conflict.current) throw new ConflictError(conflict.current);
    throw new ApiError(409, 'This presentation already exists.');
  }
  if (!response.ok) throw new ApiError(response.status, `Request failed (${response.status}).`);
  return (await response.json()) as T;
}

const path = (slug: string) => `/presentations/${encodeURIComponent(slug)}`;
const docPath = (slug: string, kind: DocKind) => `${path(slug)}/${kind}`;

export const api = {
  list: () => request<ListRes>('/presentations'),
  create: (body: CreateReq) => request<PresentationRes>('/presentations', 'POST', body),
  presentation: (slug: string) => request<PresentationRes>(path(slug)),
  update: (slug: string, body: UpdateReq) => request<PresentationRes>(path(slug), 'PATCH', body),
  document: <T extends Bench | Room>(slug: string, kind: DocKind) =>
    request<DocEnvelope<T>>(docPath(slug, kind)),
  meta: (slug: string, kind: DocKind) => request<DocMeta>(`${docPath(slug, kind)}/meta`),
  put: <T extends Bench | Room>(slug: string, kind: DocKind, baseRev: number, doc: T) =>
    request<PutRes>(docPath(slug, kind), 'PUT', { baseRev, doc } satisfies PutReq<T>),
};
