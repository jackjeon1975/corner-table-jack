import type { MetadataRoute } from 'next';
import { all } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Public pages search engines can index: home, about, explore, every public project and idea.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.APP_URL || 'http://localhost:3000';
  const projects = await all<{ id: string; updated_at: string }>(
    `SELECT id, updated_at FROM projects WHERE visibility = 'public' ORDER BY updated_at DESC LIMIT 500`,
  );
  const ideas = await all<{ id: string; updated_at: string }>(
    `SELECT p.id, p.updated_at FROM posts p WHERE p.kind = 'idea' AND p.visibility = 'public' ORDER BY p.updated_at DESC LIMIT 500`,
  );
  return [
    { url: `${base}/`, changeFrequency: 'hourly' },
    { url: `${base}/explore`, changeFrequency: 'daily' },
    { url: `${base}/about`, changeFrequency: 'monthly' },
    { url: `${base}/privacy`, changeFrequency: 'yearly' },
    { url: `${base}/terms`, changeFrequency: 'yearly' },
    ...projects.map((p) => ({ url: `${base}/projects/${p.id}`, lastModified: p.updated_at })),
    ...ideas.map((p) => ({ url: `${base}/p/${p.id}`, lastModified: p.updated_at })),
  ];
}
