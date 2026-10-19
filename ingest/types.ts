import type { Http } from './http';
import type { PayPeriod } from '../lib/pay';

/** What a connector yields. Everything except id/url/title is optional. */
export interface RawJob {
  sourceId: string;
  url: string;
  title: string;
  company?: string | null;
  companyLogo?: string | null;
  location?: string | null;
  region?: string | null;
  city?: string | null;
  remote?: boolean;
  workTypes?: (string | null | undefined)[];
  category?: string | null;
  payText?: string | null;
  payMin?: number | null;
  payMax?: number | null;
  payPeriod?: PayPeriod | null;
  postedAt?: string | null;
  expiresAt?: string | null;
  descriptionHtml?: string | null;
  description?: string | null;
  teaser?: string | null;
  bullets?: string[];
  /** true when the full description was fetched (or came with the listing). */
  hasDetail?: boolean;
}

/** The previous run's view of a job, used to skip detail fetches. */
export interface PrevJob {
  id: string;
  sourceId: string;
  description: string;
  hasDetail: boolean;
  postedAt: string | null;
  expiresAt: string | null;
  raw: RawJob | null;
}

export interface SourceContext {
  http: Http;
  now: Date;
  log: (msg: string) => void;
  previous: (sourceId: string) => PrevJob | undefined;
  /** Returns true and decrements when a detail fetch is allowed. */
  takeDetail: () => boolean;
  counters: { pages: number; details: number; errors: number };
}

export interface Source {
  id: string;
  name: string;
  homepage: string;
  enabled: boolean;
  kind: 'site' | 'ats' | 'feed';
  /** Hosts that original ads live on (allow-list for /go/[id]). */
  hosts: string[];
  fetchListings(ctx: SourceContext): AsyncIterable<RawJob>;
}
