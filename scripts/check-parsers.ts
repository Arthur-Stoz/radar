import { readFileSync } from 'node:fs';
import { parseSeekDetail } from '../ingest/sources/seek';
import { parseGovResults } from '../ingest/sources/jobsgovt';
import { parseBackpackerList } from '../ingest/sources/backpackerboard';
import { findJobPostings, jobPostingToRaw } from '../ingest/jsonld';
import { parseLocation } from '../lib/geo';
const dir = process.argv[2];
const d = parseSeekDetail(readFileSync(`${dir}/sjob.html`, 'utf8'));
console.log('seek detail', d?.description?.slice(0, 80), d?.expiresAt);
const g = parseGovResults(readFileSync(`${dir}/jgr.html`, 'utf8'));
console.log('gov', g.total, g.jobs.length, g.jobs.slice(0, 2), g.jobs.at(-1));
const b = parseBackpackerList(readFileSync(`${dir}/bbl.html`, 'utf8'));
console.log('bb', b.jobs.length, b.lastPage, b.jobs[0]);
const jp = findJobPostings(readFileSync(`${dir}/jgd.html`, 'utf8'))[0];
console.log('gov detail', jobPostingToRaw(jp).descriptionHtml?.slice(0, 80));
for (const s of ['Waikato', 'Southland, Southland', 'Ponsonby, Auckland', 'Christchurch City, Canterbury', 'Richmond, Tasman', 'Richmond, Canterbury', 'Te Aro, Wellington', 'Queenstown-Lakes, Otago', 'Remote - New Zealand', 'Whangarei', 'Ōtautahi', 'Mount Wellington, Auckland', 'Rest of Wellington Region, Wellington', 'Hawkes Bay', 'Napier Central, Hawkes Bay'])
  console.log(s, '→', JSON.stringify(parseLocation(s)));
