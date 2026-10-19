// NZ gazetteer: 16 regions, towns > ~1,000 people, territorial districts (as used by
// Trade Me and Seek) and suburbs of Auckland, Wellington and Christchurch.
// Matching is macron-insensitive (see lib/geo.ts).

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

// "Town|region|alias1,alias2" — towns and cities (city = the town itself).
const TOWNS = `
Kaitaia|northland
Kerikeri|northland
Kaikohe|northland
Paihia|northland|bay of islands
Russell|northland
Kawakawa|northland
Moerewa|northland
Whangārei|northland|whangarei
Ruakākā|northland|ruakaka
Dargaville|northland
Mangawhai|northland|mangawhai heads
Waipu|northland
Kaiwaka|northland
Ōkaihau|northland
Rawene|northland
Ahipara|northland
Houhora|northland
Auckland|auckland|tamaki makaurau,auckland city,auckland central
Pukekohe|auckland
Waiuku|auckland
Warkworth|auckland
Wellsford|auckland
Helensville|auckland
Kumeū|auckland|kumeu
Huapai|auckland
Riverhead|auckland
Snells Beach|auckland
Waiheke Island|auckland|waiheke,oneroa
Great Barrier Island|auckland|aotea
Hamilton|waikato|kirikiriroa
Cambridge|waikato
Te Awamutu|waikato
Huntly|waikato
Ngāruawāhia|waikato|ngaruawahia
Raglan|waikato|whaingaroa
Matamata|waikato
Morrinsville|waikato
Te Aroha|waikato
Thames|waikato
Paeroa|waikato
Waihi|waikato
Whangamatā|waikato|whangamata
Whitianga|waikato
Tairua|waikato
Coromandel|waikato
Taupō|waikato|taupo
Tūrangi|waikato|turangi
Tokoroa|waikato
Putāruru|waikato|putaruru
Tīrau|waikato|tirau
Ōtorohanga|waikato|otorohanga
Te Kūiti|waikato|te kuiti
Waitomo|waikato
Pōkeno|waikato|pokeno
Tuakau|waikato
Te Kauwhata|waikato
Mangakino|waikato
Tauranga|bay-of-plenty
Mount Maunganui|bay-of-plenty|mt maunganui,the mount
Pāpāmoa|bay-of-plenty|papamoa
Te Puke|bay-of-plenty
Katikati|bay-of-plenty
Ōmokoroa|bay-of-plenty|omokoroa
Te Puna|bay-of-plenty
Rotorua|bay-of-plenty
Whakatāne|bay-of-plenty|whakatane
Ōpōtiki|bay-of-plenty|opotiki
Kawerau|bay-of-plenty
Edgecumbe|bay-of-plenty
Murupara|bay-of-plenty
Waihī Beach|bay-of-plenty|waihi beach
Maketu|bay-of-plenty
Gisborne|gisborne|turanganui a kiwa
Ruatoria|gisborne
Tolaga Bay|gisborne
Napier|hawkes-bay|ahuriri
Hastings|hawkes-bay|heretaunga
Havelock North|hawkes-bay
Flaxmere|hawkes-bay
Taradale|hawkes-bay
Clive|hawkes-bay
Wairoa|hawkes-bay
Waipukurau|hawkes-bay
Waipawa|hawkes-bay
New Plymouth|taranaki|ngamotu
Hāwera|taranaki|hawera
Stratford|taranaki
Waitara|taranaki
Inglewood|taranaki
Ōpunake|taranaki|opunake
Eltham|taranaki
Palmerston North|manawatu-whanganui|palmy,palmerston nth,te papaioea
Whanganui|manawatu-whanganui|wanganui
Levin|manawatu-whanganui|taitoko
Feilding|manawatu-whanganui
Marton|manawatu-whanganui
Dannevirke|manawatu-whanganui
Foxton|manawatu-whanganui
Taumarunui|manawatu-whanganui
Ohakune|manawatu-whanganui
Raetihi|manawatu-whanganui
Taihape|manawatu-whanganui
Bulls|manawatu-whanganui
Pahiatua|manawatu-whanganui
Woodville|manawatu-whanganui
Shannon|manawatu-whanganui
National Park|manawatu-whanganui
Wellington|wellington|te whanganui a tara,wellington city,wellington central,wellington cbd
Lower Hutt|wellington|hutt,hutt city,te awa kairangi
Upper Hutt|wellington
Porirua|wellington
Paraparaumu|wellington|kapiti,kapiti coast
Waikanae|wellington
Ōtaki|wellington|otaki
Paekākāriki|wellington|paekakariki
Raumati|wellington
Masterton|wellington|whakaoriori
Carterton|wellington
Greytown|wellington
Featherston|wellington
Martinborough|wellington
Eastbourne|wellington
Wainuiomata|wellington
Nelson|nelson|whakatu
Stoke|nelson
Richmond|tasman
Motueka|tasman
Tākaka|tasman|takaka
Māpua|tasman|mapua
Wakefield|tasman
Brightwater|tasman
Murchison|tasman
Blenheim|marlborough|te waiharakeke
Picton|marlborough|waitohi
Renwick|marlborough
Havelock|marlborough
Seddon|marlborough
Kaikōura|canterbury|kaikoura
Greymouth|west-coast|mawhera
Westport|west-coast|kawatiri
Hokitika|west-coast
Reefton|west-coast
Runanga|west-coast
Franz Josef|west-coast|waiau,franz josef glacier
Fox Glacier|west-coast|weheka
Haast|west-coast
Karamea|west-coast
Punakaiki|west-coast
Christchurch|canterbury|otautahi,chch,christchurch city,christchurch central
Rangiora|canterbury
Kaiapoi|canterbury
Rolleston|canterbury
Lincoln|canterbury
Ashburton|canterbury|hakatere
Timaru|canterbury|te tihi o maru
Temuka|canterbury
Geraldine|canterbury
Pleasant Point|canterbury
Waimate|canterbury
Oamaru|otago|oamaru
Methven|canterbury
Darfield|canterbury
Leeston|canterbury
Prebbleton|canterbury
West Melton|canterbury
Woodend|canterbury
Pegasus|canterbury
Oxford|canterbury
Amberley|canterbury
Hanmer Springs|canterbury
Akaroa|canterbury
Lyttelton|canterbury
Twizel|canterbury
Fairlie|canterbury
Lake Tekapo|canterbury|tekapo,takapo
Mount Cook|canterbury|aoraki,aoraki mount cook,mt cook
Cheviot|canterbury
Rakaia|canterbury
Dunedin|otago|otepoti
Mosgiel|otago
Queenstown|otago|tahuna,queenstown lakes,queenstown-lakes
Frankton|otago
Arrowtown|otago
Wānaka|otago|wanaka
Cromwell|otago
Alexandra|otago
Clyde|otago
Roxburgh|otago
Balclutha|otago
Milton|otago
Ranfurly|otago
Palmerston|otago
Port Chalmers|otago
Brighton|otago
Glenorchy|otago
Hāwea|otago|hawea,lake hawea
Invercargill|southland|waihopai
Gore|southland
Winton|southland
Te Anau|southland
Riverton|southland
Bluff|southland
Mataura|southland
Otautau|southland
Lumsden|southland
Wyndham|southland
Milford Sound|southland|piopiotahi
Stewart Island|southland|rakiura,oban
Chatham Islands|canterbury|wharekauri,rekohu
`;

// Territorial authorities / districts → [main town, region]. Trade Me "District" values.
const DISTRICTS = `
Far North|Kerikeri|northland
Whangarei|Whangārei|northland
Kaipara|Dargaville|northland
Rodney|Warkworth|auckland
North Shore City|Auckland|auckland
North Shore|Auckland|auckland
Waitakere City|Auckland|auckland
Waitakere|Auckland|auckland
Auckland City|Auckland|auckland
Manukau City|Auckland|auckland
Manukau|Auckland|auckland
Papakura|Auckland|auckland
Franklin|Pukekohe|auckland
Hauraki Gulf Islands|Waiheke Island|auckland
Waiheke Island|Waiheke Island|auckland
Thames-Coromandel|Thames|waikato
Thames Coromandel|Thames|waikato
Hauraki|Paeroa|waikato
Waikato|Hamilton|waikato
Matamata-Piako|Matamata|waikato
Matamata Piako|Matamata|waikato
Hamilton City|Hamilton|waikato
Waipa|Te Awamutu|waikato
Otorohanga|Ōtorohanga|waikato
South Waikato|Tokoroa|waikato
Waitomo|Te Kūiti|waikato
Taupo|Taupō|waikato
Western Bay of Plenty|Te Puke|bay-of-plenty
Tauranga City|Tauranga|bay-of-plenty
Rotorua Lakes|Rotorua|bay-of-plenty
Whakatane|Whakatāne|bay-of-plenty
Opotiki|Ōpōtiki|bay-of-plenty
Kawerau|Kawerau|bay-of-plenty
Gisborne District|Gisborne|gisborne
Wairoa|Wairoa|hawkes-bay
Hastings District|Hastings|hawkes-bay
Napier City|Napier|hawkes-bay
Central Hawke's Bay|Waipukurau|hawkes-bay
Central Hawkes Bay|Waipukurau|hawkes-bay
New Plymouth District|New Plymouth|taranaki
Stratford District|Stratford|taranaki
South Taranaki|Hāwera|taranaki
Ruapehu|Taumarunui|manawatu-whanganui
Whanganui District|Whanganui|manawatu-whanganui
Rangitikei|Marton|manawatu-whanganui
Manawatu District|Feilding|manawatu-whanganui
Palmerston North City|Palmerston North|manawatu-whanganui
Tararua|Dannevirke|manawatu-whanganui
Horowhenua|Levin|manawatu-whanganui
Kapiti Coast|Paraparaumu|wellington
Porirua City|Porirua|wellington
Upper Hutt City|Upper Hutt|wellington
Hutt City|Lower Hutt|wellington
Lower Hutt City|Lower Hutt|wellington
Wellington City|Wellington|wellington
Masterton District|Masterton|wellington
Carterton District|Carterton|wellington
South Wairarapa|Featherston|wellington
Wairarapa|Masterton|wellington
Tasman District|Richmond|tasman
Nelson City|Nelson|nelson
Marlborough District|Blenheim|marlborough
Kaikoura District|Kaikōura|canterbury
Buller|Westport|west-coast
Grey|Greymouth|west-coast
Grey District|Greymouth|west-coast
Westland|Hokitika|west-coast
Hurunui|Amberley|canterbury
Waimakariri|Rangiora|canterbury
Christchurch City|Christchurch|canterbury
Selwyn|Rolleston|canterbury
Ashburton District|Ashburton|canterbury
Timaru District|Timaru|canterbury
Mackenzie|Twizel|canterbury
Waimate District|Waimate|canterbury
Waitaki|Oamaru|otago
Central Otago|Alexandra|otago
Queenstown-Lakes|Queenstown|otago
Queenstown Lakes|Queenstown|otago
Dunedin City|Dunedin|otago
Clutha|Balclutha|otago
Southland District|Invercargill|southland
Gore District|Gore|southland
Invercargill City|Invercargill|southland
`;

// Suburbs → city. Auckland, Wellington region cities, Christchurch, plus a few large-city suburbs.
const SUBURBS: Record<string, string> = {
  Auckland: `Auckland CBD,Ponsonby,Grey Lynn,Herne Bay,Freemans Bay,Parnell,Newmarket,Remuera,Epsom,Mount Eden,Mt Eden,Kingsland,Morningside,Sandringham,Mount Albert,Mt Albert,Point Chevalier,Pt Chevalier,Westmere,Avondale,New Lynn,Henderson,Te Atatu,Glen Eden,Titirangi,Massey,West Harbour,Hobsonville,Whenuapai,Westgate,Northcote,Takapuna,Devonport,Milford,Glenfield,Birkenhead,Albany,Rosedale,Browns Bay,Mairangi Bay,Torbay,Orewa,Silverdale,Whangaparaoa,Red Beach,Wairau Valley,Beach Haven,Sunnynook,Forrest Hill,Onehunga,Penrose,Ellerslie,Mount Wellington,Mt Wellington,Sylvia Park,Panmure,Glen Innes,St Heliers,Mission Bay,Kohimarama,Meadowbank,Saint Johns,St Johns,Greenlane,Royal Oak,Three Kings,Mount Roskill,Mt Roskill,Hillsborough,Lynfield,Blockhouse Bay,New Windsor,Otahuhu,Mangere,Mangere Bridge,Papatoetoe,Otara,Manukau,East Tamaki,Highbrook,Botany,Botany Downs,Howick,Pakuranga,Half Moon Bay,Bucklands Beach,Flat Bush,Dannemora,Manurewa,Wiri,Takanini,Papakura,Drury,Karaka,Beachlands,Maraetai,Clevedon,Britomart,Wynyard Quarter,Viaduct,Grafton,Eden Terrace,Newton,Arch Hill,Mt Wellington,Glendowie,Ōrākei,Orakei,Saint Marys Bay,St Marys Bay,Westhaven,Point England,Mount Smart,Southdown,Favona,Airport Oaks,Auckland Airport,Ranui,Swanson,Kumeu,Albany Heights,Greenhithe,Hillcrest,Northcross,Long Bay,Stanmore Bay,Gulf Harbour,Kelston,Sunnyvale,Henderson Valley,Waitakere,Piha,Karekare,Muriwai,Rosebank,Waterview,Ellerslie,Ōtāhuhu,Māngere,Ōtara`,
  Wellington: `Wellington Central,Te Aro,Thorndon,Kelburn,Mount Victoria,Mt Victoria,Oriental Bay,Newtown,Mount Cook,Brooklyn,Aro Valley,Island Bay,Kilbirnie,Lyall Bay,Miramar,Seatoun,Rongotai,Hataitai,Karori,Northland,Wadestown,Khandallah,Ngaio,Johnsonville,Newlands,Tawa,Churton Park,Grenada,Kaiwharawhara,Pipitea,Lambton Quay,Petone,Naenae,Taita,Stokes Valley,Waterloo,Alicetown,Seaview,Gracefield,Moera,Avalon,Trentham,Silverstream,Heretaunga,Titahi Bay,Whitby,Paremata,Plimmerton,Kenepuru,Elsdon,Mana`,
  Christchurch: `Christchurch Central,Addington,Riccarton,Upper Riccarton,Ilam,Fendalton,Merivale,Papanui,St Albans,Saint Albans,Edgeware,Richmond,Shirley,Burwood,Parklands,New Brighton,Linwood,Woolston,Ferrymead,Sumner,Redcliffs,Opawa,Sydenham,Beckenham,Cashmere,Hoon Hay,Halswell,Wigram,Hornby,Islington,Sockburn,Middleton,Bishopdale,Harewood,Burnside,Avonhead,Russley,Belfast,Northwood,Redwood,Mairehau,Hillsborough,Heathcote,Spreydon,Somerfield,Phillipstown,Waltham,Aranui,Avonside,Dallington,Hornby South,Templeton,Yaldhurst,Christchurch Airport`,
  Hamilton: `Hamilton Central,Frankton,Hamilton East,Hillcrest,Chartwell,Rototuna,Te Rapa,Dinsdale,Nawton,Claudelands,Melville,Glenview,Flagstaff,Pukete,Fairfield,Enderley`,
  Tauranga: `Tauranga Central,Greerton,Bethlehem,Brookfield,Otumoetai,Matua,Welcome Bay,Gate Pa,Judea,Tauriko,Bayfair,Arataki,Parkvale,Pyes Pa`,
  Dunedin: `Dunedin Central,North Dunedin,South Dunedin,St Clair,Saint Clair,Caversham,Roslyn,Maori Hill,Andersons Bay,St Kilda,Green Island,Abbotsford,Halfway Bush,Pine Hill,Kaikorai Valley`,
  'Palmerston North': `Palmerston North Central,Hokowhitu,Terrace End,Kelvin Grove,Awapuni,Highbury,Takaro,Milson,Roslyn PN`,
  Napier: `Napier Central,Napier South,Ahuriri,Onekawa,Marewa,Greenmeadows,Tamatea,Pirimai,Westshore,Bay View`,
  'Lower Hutt': `Lower Hutt Central,Hutt Central,Epuni,Woburn,Boulcott,Belmont,Melling`,
  Queenstown: `Queenstown Central,Fernhill,Sunshine Bay,Kelvin Heights,Jacks Point,Lake Hayes,Arthurs Point,Remarkables Park`,
  Rotorua: `Rotorua Central,Ngongotaha,Fenton Park,Glenholme,Owhata,Lynmore`,
  'New Plymouth': `New Plymouth Central,Bell Block,Fitzroy,Merrilands,Westown,Moturoa,Spotswood`,
  Nelson: `Nelson Central,Tahunanui,Annesbrook,Atawhai,The Wood,Port Nelson`,
  Invercargill: `Invercargill Central,Waikiwi,Glengarry,Georgetown,Windsor,Kew`,
  Whangārei: `Whangarei Central,Kensington,Tikipunga,Onerahi,Kamo,Raumanga,Morningside Whangarei`,
};

export interface Place {
  name: string; // display name with macrons
  city: string;
  regionId: string;
  kind: 'town' | 'district' | 'suburb';
  suburb?: string;
}

function build(): Place[] {
  const out: Place[] = [];
  for (const line of TOWNS.trim().split('\n')) {
    const [name, regionId, aliases] = line.split('|');
    out.push({ name, city: name, regionId, kind: 'town' });
    for (const a of (aliases || '').split(',').filter(Boolean)) out.push({ name: a, city: name, regionId, kind: 'town' });
  }
  for (const line of DISTRICTS.trim().split('\n')) {
    const [name, town, regionId] = line.split('|');
    out.push({ name, city: town, regionId, kind: 'district' });
  }
  const cityRegion = new Map(out.filter((p) => p.kind === 'town').map((p) => [p.city, p.regionId]));
  for (const [city, list] of Object.entries(SUBURBS)) {
    const regionId = cityRegion.get(city)!;
    for (const s of list.split(',').map((x) => x.trim()).filter(Boolean)) {
      out.push({ name: s, city, regionId, kind: 'suburb', suburb: s.replace(/ (Central|CBD)$/, '') });
    }
  }
  return out;
}

export const PLACES: Place[] = build();
