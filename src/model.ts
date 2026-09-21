export const statuses = ['已投递', '笔试', '面试', '录用', '未通过'] as const;
export type Status = typeof statuses[number];
export type Application = { id:string; company:string; role:string; location:string; website:string; appliedAt:string; status:Status };
export type Profile = { name:string; phone:string; email:string; gender:string; birthDate:string; education:string; work:string; internship:string; projects:string; activities:string; awards:string; skills:string; languages:string };
export type ResumeRecord = { name:string; path:string; updatedAt:string; text?:string; originalText?:string; warnings?:string[] };
export type ResumeExtraction = { text:string; pages:{number:number;method:'text'|'ocr'|'error';text:string}[]; processedPages:number; totalPages:number; warnings:string[] };
export type LocalData = { applications?:Application[]; profile?:Profile; resume?:ResumeRecord|null };
export type LoadState = { status:'loaded'|'empty'|'error'; source:'main'|'backup'|'legacy'|'recovery'|'none'; data:LocalData|null; file:string };
export const emptyProfile: Profile = { name:'', phone:'', email:'', gender:'', birthDate:'', education:'', work:'', internship:'', projects:'', activities:'', awards:'', skills:'', languages:'' };

export function resolveInitialState(raw: unknown): LoadState {
  const unavailable: LoadState = { status:'error', source:'none', data:null, file:'' };
  if (!raw || typeof raw !== 'object') return unavailable;
  const state = raw as Partial<LoadState>;
  if (state.status !== 'loaded' && state.status !== 'empty' && state.status !== 'error') return unavailable;
  if (state.status === 'loaded' && (!state.data || typeof state.data !== 'object')) return unavailable;
  const sources: LoadState['source'][] = ['main','backup','legacy','recovery','none'];
  return { status:state.status, source:sources.includes(state.source as LoadState['source']) ? state.source as LoadState['source'] : 'none', data:state.data ?? null, file:typeof state.file === 'string' ? state.file : '' };
}

export function normalizeWebsite(raw: unknown) {
  if (typeof raw !== 'string' || !raw.trim()) return '';
  try {
    const url = new URL(/^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`);
    return ['http:','https:'].includes(url.protocol) ? url.toString() : '';
  } catch { return ''; }
}

export function summarize(apps: Application[]) {
  return Object.fromEntries(statuses.map(status => [status, apps.filter(app => app.status === status).length])) as Record<Status, number>;
}

export function summarizeCompanies(apps: Application[]) {
  return [...new Set(apps.map(app => app.company))].map(company => {
    const items = apps.filter(app => app.company === company).sort((a,b) => b.appliedAt.localeCompare(a.appliedAt));
    return { company, count:items.length, website:items.find(app => app.website)?.website ?? '', positions:items.map(({ role,location,status }) => ({ role,location,status })), statuses:summarize(items) };
  }).sort((a,b) => b.count-a.count || a.company.localeCompare(b.company,'zh-CN'));
}

export function parseApplications(raw: string | null): Application[] {
  try {
    const value = JSON.parse(raw ?? '[]');
    if (!Array.isArray(value)) return [];
    const migrated = value.map(app => ({ ...app, website:normalizeWebsite(app?.website), status:app?.status === 'Offer' ? '录用' : app?.status }));
    return migrated.filter(app => app && typeof app.id === 'string' && typeof app.company === 'string' && statuses.includes(app.status));
  } catch { return []; }
}

export function parseObject<T extends object>(raw: string | null, fallback: T): T {
  try { const value = JSON.parse(raw ?? 'null'); return value && typeof value === 'object' && !Array.isArray(value) ? { ...fallback, ...value } : fallback; }
  catch { return fallback; }
}

export function parseProfile(raw: string | null): Profile {
  const value = parseObject(raw, emptyProfile) as Profile & { school?:string; major?:string; degree?:string };
  return { ...value, education:value.education || [value.school,value.major,value.degree].filter(Boolean).join(' · ') };
}
