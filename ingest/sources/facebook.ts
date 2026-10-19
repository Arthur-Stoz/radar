// Facebook groups / Marketplace jobs.
// DISABLED and intentionally empty. Meta removed the Groups API (April 2024) and shut down
// Facebook Jobs; job posts now only live inside groups and Marketplace behind a login. There is
// no feed we can read without automating a personal account, which Radar will not do.
// If Meta ever provides an official public jobs feed, implement fetchListings here and enable it.

import type { Source } from '../types';

export const facebook: Source = {
  id: 'facebook',
  name: 'Facebook',
  homepage: 'https://www.facebook.com',
  enabled: false,
  kind: 'feed',
  hosts: ['www.facebook.com', 'facebook.com'],
  async *fetchListings(ctx) {
    ctx.log('facebook: no official feed available; skipped');
  },
};
