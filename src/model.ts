export const statuses = ['已投递', '笔试', '面试', '录用'] as const;
export type Status = typeof statuses[number];
export type Application = { id:string; company:string; role:string; location:string; website:string; appliedAt:string; status:Status };
export type Profile = { name:string; phone:string; email:string; gender:string; birthDate:string; education:string; work:string; internship:string; projects:string; activities:string; awards:string; skills:string; languages:string };
export type ResumeRecord = { name:string; path:string; updatedAt:string };
export const emptyProfile: Profile = { name:'', phone:'', email:'', gender:'', birthDate:'', education:'', work:'', internship:'', projects:'', activities:'', awards:'', skills:'', languages:'' };

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
  const gender = clean.match(/性别\s*[:：]?\s*(男|女|其他)/)?.[1];
  const birth = clean.match(/(?:出生日期|出生年月日|生日)\s*[:：]?\s*(\d{4})[年./-](\d{1,2})[月./-](\d{1,2})日?/);
  const headings = '教育经历|教育背景|工作经历|实习经历|项目经历|实践活动|校园实践|社会实践|奖励荣誉|荣誉奖励|获奖经历|专业技能|技能特长|语言能力|语言水平';
  const section = (names:string) => clean.match(new RegExp(`(?:^|\\n)\\s*(?:${names})\\s*[:：]?\\s*\\n([\\s\\S]*?)(?=\\n\\s*(?:${headings})\\s*[:：]?\\s*(?:\\n|$)|$)`,'i'))?.[1].trim().slice(0,4000);
  if (name) result.name = name;
  if (phone) result.phone = phone;
  if (email) result.email = email;
  if (gender) result.gender = gender;
  if (birth) result.birthDate = `${birth[1]}-${birth[2].padStart(2,'0')}-${birth[3].padStart(2,'0')}`;
  result.education = section('教育经历|教育背景') ?? ([school,major,degree].filter(Boolean).join(' · ') || undefined);
  result.work = section('工作经历');
  result.internship = section('实习经历');
  result.projects = section('项目经历');
  result.activities = section('实践活动|校园实践|社会实践');
  result.awards = section('奖励荣誉|荣誉奖励|获奖经历');
  result.skills = section('专业技能|技能特长');
  result.languages = section('语言能力|语言水平');
  for (const key of Object.keys(result) as (keyof Profile)[]) if (!result[key]) delete result[key];
  return result;
}
