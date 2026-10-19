import { fold } from './text';

// Synonym groups (BUILD.md §5.1). Each line is one group, terms separated by "|".
// The first term is the canonical one (used for "Showing results for").
// Includes common French / German / Spanish / Portuguese / Italian words used by backpackers.
const GROUPS = `
barista|coffee|espresso|coffee maker|cafe barista|serveur barista
chef|cook|line cook|commis|chef de partie|sous chef|cuisinier|koch|cocinero|cozinheiro|cuoco
kitchen hand|kp|dishwasher|dish washer|kitchen porter|kitchenhand|kitchen assistant|plongeur|commis de cuisine|tellerwascher|kuchenhilfe|lavaplatos|ayudante de cocina
waiter|waitress|wait staff|waitstaff|server|food and beverage attendant|fob|floor staff|serveur|serveuse|kellner|kellnerin|camarero|camarera|garcon|mesero|garcom|cameriere
bartender|barman|barmaid|bar staff|bar attendant|mixologist|barkeeper|camarero de barra
hospitality|hospo|food and beverage|f&b|restaurant|cafe|hotel|bar|hotellerie|restauration|gastronomie|gastronomia|hosteleria
fruit picking|picker|fruit picker|harvest|orchard|picking|harvesting|apple picking|kiwifruit|cherry picking|cueillette|cueilleur|erntehelfer|ernte|obsternte|recoleccion|recolector|cosecha|colheita|raccolta
packhouse|packer|fruit packer|packing|pack house|grader|emballage|conditionnement|verpackung|empacador|empaquetador
vineyard|vineyard hand|vineyard worker|viticulture|winery|wine|pruning|vigne|vendange|vendanges|weinberg|weinlese|vinedo|vendimia
labourer|labour|laborer|labor|general hand|general labourer|manual labour|construction labourer|hammer hand|manoeuvre|ouvrier|hilfsarbeiter|peon|obrero
farm hand|farm worker|farm assistant|farmhand|dairy farm|dairy assistant|milker|farm|ouvrier agricole|landarbeiter|bauernhof|granja|trabajador agricola
shepherd|shearer|shearing|wool handler|shed hand
developer|dev|software engineer|software developer|programmer|coder|engineer software|full stack|fullstack|frontend|front end|backend|back end|developpeur|entwickler|desarrollador|programador
data analyst|data scientist|analytics|business intelligence|bi analyst|data engineer
devops|site reliability|sre|platform engineer|cloud engineer|infrastructure engineer
it support|helpdesk|help desk|service desk|desktop support|it technician|technical support
retail assistant|shop assistant|sales assistant|retail|store assistant|retail sales|shop|sales associate|vendeur|vendeuse|verkaufer|verkauferin|dependiente|vendedor|commesso
cashier|checkout operator|checkout|caissier|caissiere|kassierer|cajero
nanny|au pair|aupair|babysitter|childcare|child care|nounou|kindermadchen|nineira|niñera
housekeeper|housekeeping|room attendant|cleaner|room cleaner|chambermaid|femme de chambre|menage|zimmermadchen|reinigungskraft|camarera de piso|limpieza|limpiador
cleaner|cleaning|janitor|custodian|commercial cleaner|nettoyage|agent d'entretien|putzkraft|limpiadora
receptionist|front desk|front office|reception|guest services|concierge|night auditor|receptionniste|empfang|rezeption|recepcionista
caregiver|support worker|carer|care worker|aged care|disability support|healthcare assistant|hca|personal care|aide soignant|pflegekraft|pflegehelfer|cuidador
nurse|registered nurse|rn|enrolled nurse|nursing|infirmier|infirmiere|krankenschwester|pfleger|enfermero|enfermera
doctor|physician|gp|general practitioner|medical officer|registrar|medecin|arzt|medico
teacher|educator|tutor|lecturer|kaiako|enseignant|professeur|lehrer|profesor
early childhood teacher|ece|early childhood educator|preschool teacher|kindergarten teacher
driver|truck driver|delivery driver|courier|class 2|class 4|class 5|chauffeur|livreur|fahrer|lkw fahrer|conductor|repartidor|camionero
forklift|forklift operator|forklift driver|reach truck|cariste|staplerfahrer|carretillero
warehouse|storeperson|store person|warehouse worker|picker packer|pick packer|warehouse assistant|logistics|distribution|entrepot|magasinier|lager|lagerarbeiter|almacen|mozo de almacen
builder|carpenter|chippy|joiner|charpentier|menuisier|zimmermann|tischler|carpintero
electrician|sparky|electrical|electricien|elektriker|electricista
plumber|plumbing|gasfitter|drainlayer|plombier|klempner|installateur|fontanero
painter|decorator|painting|peintre|maler|pintor
mechanic|automotive technician|motor mechanic|diesel mechanic|heavy diesel|automotive|mecanicien|mechaniker|kfz|mecanico
welder|fabricator|welding|boilermaker|soudeur|schweisser|soldador
landscaper|gardener|landscaping|groundsperson|horticulture|arborist|jardinier|paysagiste|gartner|jardinero
accountant|accounting|accounts|chartered accountant|ca|cpa|comptable|buchhalter|contador
accounts payable|accounts receivable|ap|ar|credit controller|bookkeeper|payroll
administrator|admin|administration|office administrator|office assistant|administrative assistant|office manager|secretaire|buroangestellte|administrativo
personal assistant|pa|executive assistant|ea|secretary
customer service|customer support|call centre|call center|contact centre|customer service representative|csr|customer care|service client|kundenservice|atencion al cliente
sales|sales representative|sales rep|account manager|business development|bdm|sales executive|commercial|vertrieb|ventas
marketing|digital marketing|marketing coordinator|marketing manager|social media|communications|comms
designer|graphic designer|ui designer|ux designer|product designer|visual designer|graphiste|grafikdesigner|disenador
project manager|pm|project coordinator|programme manager|program manager|chef de projet|projektleiter
manager|management|supervisor|team leader|team lead|shift manager|responsable|gerente|leiter
store manager|retail manager|shop manager|branch manager
restaurant manager|cafe manager|bar manager|duty manager|venue manager|food and beverage manager|f&b manager
hotel manager|lodge manager|motel manager|accommodation manager|front office manager
security|security guard|security officer|crowd controller|guard|agent de securite|sicherheitsdienst|vigilante
tour guide|guide|tour leader|tourism|activity guide|adventure guide|guide touristique|reisefuhrer|guia turistico
ski|ski instructor|snowboard instructor|lift operator|lifty|ski patrol|snow sports|ski field|moniteur de ski|skilehrer|instructor de esqui
lifeguard|pool lifeguard|swim teacher|swimming instructor|maitre nageur|rettungsschwimmer|socorrista
deckhand|crew|boat crew|skipper|marine|fishing|matelot|marinero
butcher|meat processing|meat worker|boner|slaughterman|abattoir|freezing works|boucher|metzger|carnicero
baker|bakery|pastry chef|patissier|boulanger|pastry|backer|panadero|pastelero
dairy|dairy worker|dairy farm assistant|herd manager|calf rearer
tractor driver|tractor|machinery operator|plant operator|digger driver|excavator operator|machine operator|heavy machinery|conducteur d'engins|baggerfahrer|operador de maquinaria
traffic controller|stms|traffic management|tc|road worker|roading|road crew
factory worker|production worker|process worker|factory hand|production operator|manufacturing|assembly|ouvrier d'usine|fabrikarbeiter|operario
quality assurance|qa|quality control|qc|quality technician
tester|software tester|qa engineer|test analyst|test engineer
lawyer|solicitor|legal counsel|barrister|legal|attorney|avocat|anwalt|abogado
paralegal|legal secretary|legal executive|legal assistant
pharmacist|pharmacy assistant|pharmacy technician|pharmacy|pharmacien|apotheker|farmaceutico
dental assistant|dental nurse|dentist|dental|hygienist
vet|veterinarian|vet nurse|veterinary|animal care|veterinaire|tierarzt|veterinario
physiotherapist|physio|physiotherapy|kinesitherapeute|physiotherapeut|fisioterapeuta
psychologist|counsellor|counselor|therapist|social worker|mental health
scientist|researcher|research assistant|lab technician|laboratory|science
engineer|engineering|civil engineer|structural engineer|mechanical engineer|electrical engineer|ingenieur|ingeniero
surveyor|quantity surveyor|qs|land surveyor
architect|architectural designer|draughtsperson|draftsman|drafter|architecte|architekt|arquitecto
real estate|property manager|real estate agent|salesperson real estate|property|immobilier|makler|inmobiliaria
recruiter|recruitment|talent acquisition|recruitment consultant|hr|human resources|people and culture|recrutement|personal
finance|financial analyst|financial accountant|management accountant|finance manager|cfo
bank|banking|bank teller|teller|banker|lending|mortgage adviser|mortgage broker|banque|bank angestellte|banco
insurance|claims|claims officer|underwriter|insurance adviser
policy|policy advisor|policy analyst|advisor|adviser|government|public service|public sector
event|events|event staff|event crew|festival|festival crew|event coordinator|events coordinator|evenementiel|veranstaltung|eventos
brand ambassador|promoter|promotions|promo staff
hairdresser|hair stylist|barber|beauty therapist|beautician|nail technician|coiffeur|friseur|peluquero
fitness|personal trainer|gym|fitness instructor|coach|entraineur|trainer|entrenador
cook|line cook|short order cook|grill cook|prep cook|kitchen
pizza|pizza chef|pizza maker|pizzaiolo
fast food|crew member|team member|crew|quick service|qsr
delivery|courier|food delivery|parcel delivery|postie|livraison|lieferung|reparto
remote|work from home|wfh|telecommute|teletravail|homeoffice|remoto|teletrabajo
part time|part-time|casual|temps partiel|teilzeit|medio tiempo|tiempo parcial
full time|full-time|permanent|temps plein|vollzeit|tiempo completo
seasonal|season|seasonal work|summer job|winter job|saisonnier|saisonarbeit|temporada|temporal
volunteer|volunteering|unpaid|benevole|freiwillig|voluntario
internship|intern|graduate|grad|graduate programme|stage|stagiaire|praktikum|practicas|pasantia
apprentice|apprenticeship|trainee|apprenti|apprentissage|lehrling|ausbildung|aprendiz
english teacher|esl teacher|tesol|language teacher
translator|interpreter|traducteur|ubersetzer|traductor
lodge|backcountry lodge|wilderness lodge|remote lodge|eco lodge
campervan|campground|holiday park|camping|motor camp
accommodation|live in|live-in|staff accommodation|housing provided|logement|logement fourni|unterkunft|alojamiento
construction|building|builders labourer|site worker|construction worker|batiment|bau|construccion
scaffolder|scaffolding|rigger|echafaudage|geruestbauer|andamio
roofer|roofing|couvreur|dachdecker|techador
tiler|tiling|carreleur|fliesenleger|alicatador
glazier|glass|vitrier|glaser|cristalero
upholsterer|furniture|furniture maker|cabinet maker|cabinetmaker
gardening|lawn mowing|mowing|garden maintenance
pet|dog walker|pet sitter|kennel|cattery|animal attendant
cleaner commercial|office cleaner|night cleaner
call centre|outbound|inbound|telemarketing|telesales
admin assistant|data entry|data entry operator|typist|clerk|office junior|filing
receptionist medical|medical receptionist|practice manager|medical administrator
lab|laboratory technician|lab assistant|medical laboratory scientist|phlebotomist
midwife|midwifery|lmc|sage femme|hebamme|matrona
paramedic|ambulance|emergency medical technician|emt
firefighter|fire|pompier|feuerwehr|bombero
police|police officer|constable|policier|polizist|policia
soldier|army|defence force|navy|air force|military|nzdf
pilot|aviation|first officer|cabin crew|flight attendant|steward|stewardess|hostesse de l'air
airport|ground crew|baggage handler|ramp|check in agent|aviation security
train|rail|train driver|locomotive engineer|railway|kiwirail
bus driver|coach driver|passenger transport|p endorsement
taxi|uber|rideshare|chauffeur taxi
gardener orchard|orchard hand|orchard worker|thinning|thinner|fruit thinning
kiwifruit|kiwi fruit|zespri|kiwifruit picker|kiwifruit packhouse
apple|apples|apple picker|apple thinning|pomme
cherry|cherries|cherry picker|cerise|kirschen|cereza
grape|grapes|vintage|cellar hand|cellarhand|winemaker|wine cellar|caviste|vinificateur
blueberry|berries|strawberry|strawberries|berry picking|fraise|myrtille|erdbeeren
avocado|avocados|citrus|orange|mandarin
honey|beekeeper|apiarist|beekeeping|manuka|apiculteur|imker|apicultor
fishing|fisherman|fish processing|seafood|mussel|oyster|aquaculture|salmon|pecheur|fischer|pescador
forestry|forestry worker|tree planter|tree planting|silviculture|logging|bucheron|forstarbeiter|forestal
mining|miner|quarry|drilling|mineur|bergbau|minero
oil and gas|energy|power|utilities|lines mechanic|electricity
solar|solar installer|renewable|wind|photovoltaic
hvac|refrigeration|air conditioning|heat pump|refrigeration technician|hvac technician
locksmith|security systems|alarm technician
printer|printing|print operator|signwriter|sign maker
photographer|videographer|camera operator|photographe|fotograf|fotografo
writer|copywriter|content writer|editor|journalist|reporter|redacteur|journaliste|redakteur|periodista
artist|illustrator|animator|creative|art director
musician|dj|performer|entertainer|actor|actress
cinema|usher|film|theatre|front of house|foh
casino|croupier|dealer|gaming|pokies
church|pastor|youth worker|ministry|community worker
librarian|library|library assistant|bibliothecaire|bibliothekar|bibliotecario
museum|gallery|curator|collections
school|teacher aide|teacher assistant|learning support|education support|kaiawhina
university|tertiary|academic|professor|research fellow
student|students|uni student|etudiant|student job|student work|studierende|estudiante
backpacker|backpackers|working holiday|whv|traveller|travellers|working holiday visa|pvt|vacances travail|work and travel|working holiday maker
no experience|entry level|no experience required|no experience necessary|training provided|beginner|sans experience|ohne erfahrung|sin experiencia
host|hostess|maitre d|greeter|front of house host
sommelier|wine waiter|wine steward
runner|food runner|bar back|barback|glassie|glassy|busser
cafe all rounder|cafe allrounder|cafe assistant|cafe staff|cafe worker|counter staff|counter assistant
gelato|ice cream|scooper|dessert
butler|valet|porter|bell hop|bellhop|doorman|hotel porter|night porter
spa|massage therapist|massage|spa therapist|masseur|masseuse
yoga|pilates|instructor
swim|swimming|aquatics
surf|surf instructor|kayak guide|raft guide|rafting|bungy|skydive|jet boat
dive|dive instructor|divemaster|scuba
horse|equine|stable hand|groom|horse riding|trekking guide|equestrian|cheval|pferd|caballo
cattle|beef|sheep|stockman|stock work|shepherd|livestock
gardener greenhouse|greenhouse|glasshouse|nursery|plant nursery|propagation|serre|gewachshaus|invernadero
asparagus|onions|potatoes|vegetables|vegetable picking|market garden|grower
pruner|pruning|vine pruning|tree pruning|taille|rebschnitt|poda
tractor|tractor driver|harvester|header|baler|contractor agricultural|agricultural contractor
irrigation|irrigation technician|water|wastewater|water treatment
engineering technician|technician|tech|service technician|field technician|field service
electronics|electronics technician|instrument technician|automation|plc
telecommunications|telco|fibre|fiber|network technician|cabling|installer
network engineer|network|systems administrator|sysadmin|system administrator|infrastructure
cyber security|cybersecurity|security analyst|infosec|security engineer
product manager|product owner|po|product
business analyst|ba|analyst|systems analyst
consultant|consulting|advisory|management consultant
executive|ceo|general manager|gm|director|head of
operations|operations manager|ops|operations coordinator|logistics coordinator
procurement|purchasing|buyer|supply chain|planner|inventory|stock controller
import|export|freight|freight forwarder|customs|shipping|port
health and safety|h&s|hse|safety advisor|health safety
environmental|sustainability|ecology|conservation|ranger|doc ranger|biodiversity
carer aged|rest home|retirement village|aged residential care|dementia care
community support|support person|disability worker|whanau support|youth support
sales consultant|sales advisor|retail sales consultant|customer advisor
stock|stocker|shelf filler|shelf stacker|night fill|nightfill|merchandiser|replenishment
supermarket|grocery|countdown|new world|pak n save|woolworths|foodstuffs
butchery assistant|meat packer|meat processor|boning room
dairy hand|relief milker|calf rearing|dairy farm hand
cleaner domestic|house cleaner|home cleaner|domestic cleaner
mover|removalist|furniture removals|moving
postal|mail sorter|nz post|mail centre
lifeguard beach|surf lifesaver|surf life saving
handyman|maintenance|maintenance worker|maintenance technician|facilities|property maintenance
groundskeeper|greenkeeper|turf|golf course
caretaker|custodian school|site caretaker
fundraiser|street fundraiser|face to face fundraiser|charity
call taker|dispatcher|despatch|dispatch coordinator
estimator|cost estimator|quoting
foreman|site manager|site supervisor|construction manager|leading hand
drainlayer|civil works|pipelayer|civil construction
concrete|concreter|concrete finisher|formworker
fencer|fencing|fence builder
`;

const groups: string[][] = GROUPS.trim()
  .split('\n')
  .map((l) =>
    l
      .split('|')
      .map((t) => fold(t))
      .filter(Boolean),
  )
  .filter((g) => g.length > 1);

const index = new Map<string, number[]>();
groups.forEach((g, i) => {
  for (const t of g) {
    const arr = index.get(t) || [];
    arr.push(i);
    index.set(t, arr);
  }
});

/** Longest synonym phrase length in words (for greedy matching). */
export const MAX_PHRASE_WORDS = Math.max(...groups.flat().map((t) => t.split(' ').length));

export function synonymGroupCount(): number {
  return groups.length;
}

/** All synonyms of a (folded) term or phrase, including itself. */
export function synonymsOf(term: string): string[] {
  const t = fold(term);
  const ids = index.get(t);
  if (!ids) return [t];
  const out = new Set<string>([t]);
  for (const id of ids) for (const s of groups[id]) out.add(s);
  return [...out];
}

/** Canonical English term for a foreign/slang term, e.g. "serveur" → "waiter". */
export function canonicalOf(term: string): string | null {
  const ids = index.get(fold(term));
  return ids ? groups[ids[0]][0] : null;
}

export function isKnownTerm(term: string): boolean {
  return index.has(fold(term));
}
