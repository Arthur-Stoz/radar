// The 16 NZ regions. Kept apart from the (large) gazetteer so client components stay small.

export interface Region {
  id: string;
  name: string;
  aliases: string[];
}

export const REGIONS: Region[] = [
  { id: 'northland', name: 'Northland', aliases: ['te tai tokerau', 'northland region'] },
  { id: 'auckland', name: 'Auckland', aliases: ['tamaki makaurau', 'auckland region', 'akl', 'auckland city', 'auckland cbd'] },
  { id: 'waikato', name: 'Waikato', aliases: ['waikato region'] },
  { id: 'bay-of-plenty', name: 'Bay of Plenty', aliases: ['bop', 'te moana a toi', 'bay of plenty region'] },
  { id: 'gisborne', name: 'Gisborne', aliases: ['tairawhiti', 'gisborne region', 'east coast'] },
  { id: 'hawkes-bay', name: "Hawke's Bay", aliases: ['hawkes bay', 'hawke s bay', 'hb', 'te matau a maui', 'hawke bay'] },
  { id: 'taranaki', name: 'Taranaki', aliases: ['taranaki region'] },
  { id: 'manawatu-whanganui', name: 'Manawatū-Whanganui', aliases: ['manawatu whanganui', 'manawatu', 'manawatu wanganui', 'whanganui region', 'central north island'] },
  { id: 'wellington', name: 'Wellington', aliases: ['te whanganui a tara', 'wellington region', 'wgtn', 'greater wellington'] },
  { id: 'tasman', name: 'Tasman', aliases: ['tasman region', 'tasman district'] },
  { id: 'nelson', name: 'Nelson', aliases: ['whakatu', 'nelson region', 'nelson tasman', 'nelson & tasman', 'nelson bays'] },
  { id: 'marlborough', name: 'Marlborough', aliases: ['marlborough region', 'te tauihu'] },
  { id: 'west-coast', name: 'West Coast', aliases: ['westland region', 'te tai poutini', 'west coast region'] },
  { id: 'canterbury', name: 'Canterbury', aliases: ['waitaha', 'canterbury region'] },
  { id: 'otago', name: 'Otago', aliases: ['otago region', 'central otago region'] },
  { id: 'southland', name: 'Southland', aliases: ['murihiku', 'southland region'] },
];
