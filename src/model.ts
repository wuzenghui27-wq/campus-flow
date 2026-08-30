export const statuses = ['已投递', '笔试', '面试', '录用'] as const;
export type Status = typeof statuses[number];
export type Application = { id:string; company:string; role:string; location:string; appliedAt:string; status:Status };
export type Profile = { name:string; phone:string; email:string; school:string; major:string; degree:string };
export type ResumeRecord = { name:string; path:string; updatedAt:string };

export function summarize(apps: Application[]) {
  return Object.fromEntries(statuses.map(status => [status, apps.filter(app => app.status === status).length])) as Record<Status, number>;
}

export function summarizeCompanies(apps: Application[]) {
  return [...new Set(apps.map(app => app.company))].map(company => {
    const items = apps.filter(app => app.company === company).sort((a,b) => b.appliedAt.localeCompare(a.appliedAt));
    return { company, count:items.length, positions:items.map(({ role,location,status }) => ({ role,location,status })), statuses:summarize(items) };
  }).sort((a,b) => b.count-a.count || a.company.localeCompare(b.company,'zh-CN'));
}

export function parseApplications(raw: string | null): Application[] {
  try {
    const value = JSON.parse(raw ?? '[]');
    if (!Array.isArray(value)) return [];
    const migrated = value.map(app => app?.status === 'Offer' ? { ...app, status:'录用' } : app);
    return migrated.every(app => app && typeof app.id === 'string' && typeof app.company === 'string' && statuses.includes(app.status)) ? migrated : [];
  } catch { return []; }
}

export function parseObject<T extends object>(raw: string | null, fallback: T): T {
  try { const value = JSON.parse(raw ?? 'null'); return value && typeof value === 'object' && !Array.isArray(value) ? { ...fallback, ...value } : fallback; }
  catch { return fallback; }
}

export function extractProfile(text: string): Partial<Profile> {
  const clean = text.replace(/[\t\r]+/g, ' ').replace(/ +/g, ' ');
  const lines = clean.split('\n').map(line => line.trim()).filter(Boolean);
  const result: Partial<Profile> = {};
  const email = clean.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/)?.[0];
  const phone = clean.match(/(?:\+?86[- ]?)?(1[3-9]\d[- ]?\d{4}[- ]?\d{4})/)?.[1]?.replace(/[- ]/g, '');
  const named = clean.match(/(?:姓名|Name)\s*[:：]?\s*([\u4e00-\u9fa5·]{2,6})/i)?.[1];
  const name = named ?? lines.slice(0, 12).find(line => /^[\u4e00-\u9fa5·]{2,4}$/.test(line) && !/简历|求职|教育|经历|技能|项目/.test(line));
  const school = clean.match(/([\u4e00-\u9fa5]{2,20}(?:大学|学院))/)?.[1];
  const major = clean.match(/(?:专业|主修)\s*[:：]?\s*([^\n|｜]{2,24})/)?.[1]?.trim();
  const degree = clean.match(/博士|硕士|研究生|本科|学士|大专|专科/)?.[0];
  if (name) result.name = name;
  if (phone) result.phone = phone;
  if (email) result.email = email;
  if (school) result.school = school;
  if (major) result.major = major;
  if (degree) result.degree = degree;
  return result;
}
