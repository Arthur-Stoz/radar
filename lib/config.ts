// Runtime configuration from environment variables (BUILD.md §2).
export function siteUrl(): string {
  return (process.env.SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
}

export function contactEmail(): string {
  return process.env.CONTACT_EMAIL || '';
}

export function dataDir(): string {
  return process.env.DATA_DIR || './.data';
}

export function userAgent(): string {
  const email = contactEmail();
  return `RadarNZ/1.0 (+${siteUrl()}/about${email ? `; ${email}` : ''})`;
}
