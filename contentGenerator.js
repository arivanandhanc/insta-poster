const Groq = require("groq-sdk");

let _groq = null;
function getGroq() {
  if (!_groq) _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return _groq;
}

// ─── 8 VISUAL STYLES — rotate per post for mixed high-quality look ────────────
const IMAGE_STYLES = [
  "National Geographic documentary photography, dramatic chiaroscuro lighting, ultra-sharp detail, award-winning composition",
  "cinematic 4K drone aerial view, golden hour sunset, breathtaking panorama, vivid saturated colors, epic scale",
  "vibrant festival street photography, shallow depth of field, warm bokeh balls, joyful energy, Magnum Photos style",
  "vintage 1970s Kodachrome film photography, warm nostalgic grain, faded edges, rich warm tones, timeless feel",
  "architectural photography, dramatic wide-angle lens, blue hour lighting, mirror reflection, geometric precision",
  "professional food photography, macro lens, studio rim lighting, steam wisps, rich textures, appetizing colors",
  "epic painterly digital art, hyperdetailed illustration, luminous lighting, intricate patterns, fantasy realism",
  "portrait photography, golden backlit rim light, shallow depth of field, warm skin tones, emotional expression",
];

function pickImageStyle(category) {
  const categoryMap = {
    "Tamil History": [0, 4, 6, 3],
    "Tamil Temples": [4, 0, 6, 2],
    "Tamil Food": [5, 2, 1, 3],
    "Tamil Festivals": [2, 7, 1, 3],
    "Tamil Literature": [6, 3, 0, 7],
    "Tamil Language": [6, 0, 3, 4],
    "Tamil Achievers": [7, 0, 3, 1],
    "Tamil Nadu Tourism": [1, 0, 2, 4],
    "Tamil Villages": [3, 2, 0, 7],
    "Tamil Arts": [6, 7, 2, 0],
    "Tamil Gods & Spirituality": [6, 0, 7, 3],
    "Tamil Science & Innovation": [0, 4, 6, 3],
    "Tamil Diaspora": [7, 1, 2, 0],
    "Tamil Cinema": [7, 2, 6, 1],
    "Tamil Social Reform": [7, 0, 3, 6],
    "Tamil Nature & Wildlife": [1, 0, 2, 3],
    "Tamil Maritime History": [0, 1, 3, 4],
    "Tamil Music & Dance": [2, 7, 6, 3],
    "Tamil Philosophy": [6, 7, 3, 0],
    "Tamil Architecture": [4, 0, 6, 1],
  };
  const indices = categoryMap[category] || [0, 1, 2, 3];
  return IMAGE_STYLES[indices[Math.floor(Math.random() * indices.length)]];
}

// ─── CONTENT UNIVERSE — 1000+ unique topics ───────────────────────────────────
const CONTENT_TOPICS = {
  "Tamil History": [
    "Chola Empire naval supremacy in Southeast Asia",
    "Pallava dynasty and Mahabalipuram construction mystery",
    "Battle of Talaiyalanganam — Tamil military mastery",
    "Pandya kingdom and ancient pearl diving trade routes",
    "Sangam Age civilization — Tamil culture 300 BCE",
    "Rajendra Chola's 5000km conquest to the Ganges",
    "Ancient Tamil trade routes with Rome and Greece",
    "Karikala Cholan and the Grand Anicut dam — 2000-year engineering",
    "Tamil merchant guilds that ruled the Indian Ocean trade",
    "The Indus Valley Tamil connection debate",
    "Veerapandiya Kattabomman's resistance against British",
    "Tamil kings who sent ambassadors to foreign kingdoms",
    "Keeladi excavation — rewriting Tamil civilization timeline",
    "The forgotten women warriors of ancient Tamil Nadu",
    "Tamil Nadu's 38 ancient sea ports",
    "How Tamil kings funded universities across Asia",
    "The Sibi Chakravarthy legend and Tamil justice system",
    "Thiruvalangadu copper plates — 1000-year-old royal records",
    "Tamil Navy that dominated Arab and Chinese trade routes",
    "Uthiyan Cheralathan — the Tamil king who fed both armies",
    "Poompuhar — the submerged Tamil city found underwater",
    "Tamil Nadu's forgotten Bronze Age civilization",
    "How Chola kings built hospitals across their empire",
    "Adiyas of Tamil Nadu — the forgotten Dalit warrior caste",
    "The 96 Kula Mudaliar history — traders who shaped Tamil Nadu",
    "Tamil Nadu's role in World War II — soldiers and famine",
    "How British destroyed Tamil Nadu's textile industry",
    "Draupadi worship — the Tamil tradition that spread to Southeast Asia",
    "Tipu Sultan's Tamil Nadu campaigns — lesser-known history",
    "The Maruthu Brothers — Tamil Nadu's first freedom fighters",
    "Rani Velu Nachiyar — first Indian queen to fight British",
    "Tamil Nadu temple treasures looted by colonists",
    "The Vellalar caste history — Tamil Nadu's landowning aristocracy",
    "Tamil Nadu in Mughal records — how Mughals saw South India",
    "The 1857 Sepoy Mutiny's Tamil Nadu connection",
    "How Chola bronzes ended up in world museums",
    "The mystery of the missing Pallava kings",
    "Tamil Nadu's ancient lighthouse — 2000-year navigation tower",
    "How Tamil Nadu resisted Aurangzeb's religious persecution",
    "The Tamil role in early Buddhist and Jain trade networks",
    "Kalabhras — the mysterious dynasty that disrupted Tamil history",
    "Madurai's history as Tamil Nadu's eternal cultural capital",
    "The Tamil Nadu salt march — lesser-known independence story",
    "How Tamil Nadu fed Southeast Asian kingdoms for 500 years",
    "Ancient Tamil guilds — the Manigramam and Ayyavole merchants",
    "The Nayak dynasty — Telugu kings who became Tamil patrons",
    "Tanjavur Maratha rule — when Tamil culture absorbed outsiders",
    "Tamil Nadu's role in ancient Sri Lankan civilization",
    "The Sangam-era trade city of Arikamedu near Pondicherry",
    "How Tamil kings maintained diplomatic embassies in China",
  ],
  "Tamil Temples": [
    "Brihadeeswarar Temple — engineering mystery no crane could solve",
    "Meenakshi Amman Temple — 33,000 sculptures, 14 gopurams",
    "Ranganathaswamy Temple — largest active Hindu temple complex",
    "Shore Temple Mahabalipuram — half-swallowed by the sea",
    "Nataraja Temple Chidambaram — cosmic dance and secret formula",
    "Hidden temples of the Nilgiri forest hills",
    "Airavatesvara Temple — stone steps that produce musical notes",
    "The 108 Divya Desam temples across Tamil Nadu",
    "Cave temples carved before iron tools existed",
    "Temple tanks that survived 2000 years of monsoons",
    "Astronomical alignment of Tamil temple towers at equinox",
    "Forgotten temples buried under modern Tamil cities",
    "Kailasanathar Temple Kanchipuram — oldest sandstone masterpiece",
    "The Gopuram — why Tamil towers grow impossibly tall",
    "Kanchipuram — city of 1000 temples across 2 millennia",
    "Rockfort Ucchi Pillayar Temple — carved from a living mountain",
    "Ekambareswarar Temple — the mango tree older than written history",
    "Sucindram Temple — pillars that produce 7 musical notes",
    "Kapaleeswarar Temple — peacock dance and Tamil myth",
    "The 5 Pancha Bhuta Stalas — temples of 5 elements",
    "Rameshwaram Jyotirlinga — the bridge that crossed to Lanka",
    "Palani Murugan Temple — hilltop deity of Tamil devotion",
    "Tiruchendur Murugan — seaside temple built by the god himself",
    "Swamimalai temple — where Murugan taught Shiva the Pranava",
    "Thiruparankundram cave temple — carved 2000 years ago",
    "Velankanni Basilica — Tamil Nadu's Catholic miracle temple",
    "Madurai Meenakshi — the goddess who rules a living city",
    "Srirangam island temple — 9 walls, 21 gopurams, 49 shrines",
    "Gangaikonda Cholapuram — the capital Rajendra Chola built",
    "Darasuram Airavatesvara — UNESCO World Heritage site secrets",
    "Thiruvannaamalai — the sacred hill that is Shiva himself",
    "Chidambaram Nataraja — why this pose appears in CERN",
    "Thanjavur Big Temple — how they placed the 80-ton capstone",
    "Tirumala Tirupati — Tamil Nadu's richest pilgrimage",
    "Madurai Alagar Kovil — the elder brother deity",
    "Palani Siddhar caves — where Tamil mystics meditated",
    "Kulasekara Alvar temple — the Pandya king saint's shrine",
    "Ramanathapuram temples — the forgotten Setupati kingdom",
    "Murugan temples along the ancient Tamil pilgrimage route",
    "Tamil Nadu's 12 Jyotirlinga temples visited by pilgrims",
    "Kamakshi Amman — the Tamil mother goddess of knowledge",
    "Sarangapani temple Kumbakonam — Vishnu's greatest festival",
    "Brihadeeswarar shadow secret — shadow that never falls outside",
    "Nellaiappar Temple Tirunelveli — the musical pillars mystery",
    "Vaikunta Perumal Temple Kanchipuram — Pallava king history",
    "Thyagarajaswamy temple music festivals — 5-day Carnatic marathon",
    "Gingee Fort temple — Tamil Nadu's unconquerable fortress temple",
    "Sri Rangam float festival — God sails on a sacred lake",
    "Uthirakosamangai temple — emerald Shivalinga 2500 years old",
    "Tamil Nadu's 7 secret underground temple chambers",
  ],
  "Tamil Food": [
    "Kanji — the ancient Tamil superfood eaten for 3000 years",
    "Chettinad spice trade with Rome — documented in ancient records",
    "How idli was really invented — the 1000-year food debate",
    "Ancient Tamil feast — what a Sangam-era Tamil ate daily",
    "Forgotten village foods of Tamil Nadu dying out",
    "Pongal — the dish that fed armies, farmers, and gods",
    "Palm sugar jaggery — Tamil Nadu's liquid gold exports",
    "The Tamil banana leaf meal — Ayurvedic science behind each position",
    "Kozhukattai — Ganesha's favourite Tamil sweet story",
    "Toddy culture — Tamil Nadu's ancient fermented palm wine",
    "Murungai drumstick — Tamil Nadu's miracle tree healing recipes",
    "Festival-specific foods unique to each Tamil Nadu district",
    "How Chettinad became India's most complex spice cuisine",
    "Tamil Nadu's forgotten grain crops making a comeback",
    "100-year history of street food of Tamil Nadu",
    "Rasam — the Tamil penicillin with modern scientific proof",
    "Avial — the story behind this Tamil-origin Kerala dish",
    "50 types of kuzhambu — Tamil curry variety explained",
    "Sundal — the protein beach snack of Tamil Nadu",
    "Why Tamil food deserves UNESCO heritage status",
    "Keerai — why Tamil greens are the world's most nutritious",
    "Vadai varieties — the Tamil fritter eaten for 2000 years",
    "Payasam — the divine dessert of Tamil temples",
    "Appam — the fermented Tamil rice pancake mystery",
    "Puttu — Tamil Nadu's ancient bamboo steam cake",
    "Idiyappam — string hoppers and their Tamil origin story",
    "Ulundu kali — the postnatal superfood of Tamil mothers",
    "Tamarind in Tamil cuisine — the sour pillar of flavour",
    "Bitter gourd — why Tamils eat what others avoid",
    "Chili history in Tamil Nadu — how it replaced pepper",
    "Rice varieties of Tamil Nadu — 50 kinds once grown",
    "Nanjil Nadu cuisine — the most distinct sub-cuisine",
    "Kongu cuisine — Coimbatore's meat and millet tradition",
    "Tirunelveli halwa — the authentic recipe and 200-year history",
    "Kavuni arisi — the Tamil black rice superfood",
    "Jackfruit cuisine — Tamil Nadu's vegetarian meat substitute",
    "Banana flower recipes — the Tamil superfood for women",
    "Kollu horsegram — the Tamil athlete's ancient protein",
    "Thaen mithai honey candy — the Tamil Nadu bee-keeping tradition",
    "Karuppu kavuni — the black rice porridge of Tamil temples",
    "Fish curry of Rameshwaram — the coastal Tamil masterpiece",
    "Crab curry of Nagapattinam — the fisherman's secret recipe",
    "Muttai kuzhambu — the egg curry every Tamil grandmother made",
    "Vatha kuzhambu — the pickled sun-dried vegetable curry",
    "Sambar origin story — Tamil Nadu vs Karnataka debate",
    "Kothu parotta — the midnight street food of Tamil Nadu",
    "Biryani styles of Tamil Nadu — 5 very different versions",
    "Tamil Nadu filter coffee — the ritual and the science",
    "Seepu seedai — the intricate Tamil snack for Gokulashtami",
    "Neer mor — the spiced Tamil buttermilk that beats the heat",
  ],
  "Tamil Festivals": [
    "Pongal — deeper cosmic meaning most Tamils don't know",
    "Thai Pusam — kavadi tradition origin and the science of pain",
    "Aadi Perukku — Tamil Nadu's ancient water goddess festival",
    "Navarathri Golu — hidden symbolism in the doll arrangement",
    "Karthigai Deepam — the light festival older than Diwali",
    "Panguni Uthiram — Tamil Nadu's divine marriage festival",
    "Chittirai festival — Meenakshi divine wedding celestial story",
    "Jallikattu — 5000-year history, cattle genetics, Tamil pride",
    "Arudra Darisanam — Shiva's cosmic dance at 3am festival",
    "Village festivals you've never heard of but must see",
    "Tamil monthly festival calendar — 12 months of celebration",
    "Ancient Tamil New Year vs modern Puthandu traditions",
    "Festival foods tied to Tamil astronomical calendar",
    "Regional festival differences across 38 Tamil districts",
    "The forgotten harvest festivals of ancient Tamil Nadu",
    "Mahamaham festival Kumbakonam — once every 12 years",
    "Float festival — temple chariots sailing on sacred tanks",
    "Adi Vel festival — mystery of the divine lance",
    "Tamil fishing community festivals of the Coromandel Coast",
    "Kolam traditions — mathematical fractal patterns at every door",
    "Thiruvizha — the 10-day Tamil temple festival explained",
    "Car Festival procession — Tamil Nadu's moving temple",
    "Kavadi Attam — the trance dance of Murugan devotees",
    "Panguni Uthiram — Murugan and Valli's wedding in the sky",
    "Skanda Sashti — the 6-day Murugan war festival",
    "Aipasi Brahmotsavam — Tamil Nadu's largest festival cycle",
    "Korukkai festival — the Tamil paddy harvest thanksgiving",
    "Maatu Pongal — Tamil Nadu's cattle worship day",
    "Kaanum Pongal — the day Tamil families gather at water",
    "Bhogi — the Tamil bonfire of the old and broken",
    "Karthigai Deepam at Thiruvannamalai — 2 million lamps",
    "Panguni Uthiram sea bath ritual at Rameswaram",
    "Kaveri Pushkaram — when the Kaveri River becomes sacred",
    "Vaikasi Visakam — Murugan's birthday celebrated by millions",
    "Chithirai Brahmotsavam — 1 million devotees in Madurai",
    "Navaratri bommai kolu — the living doll universe",
    "Aadi Amavasai — Tamil ancestor worship festival",
    "Karthigai Deepam home lamp tradition Tamil Nadu",
    "Tamil Nadu harvest moon festival — full moon worship",
    "Kumbaabhishekam — when a temple tower is re-consecrated",
    "Theyyam and its Tamil Nadu border celebrations",
    "Ther festival — wooden chariot pulled by devotees",
    "Pongal preparation — the night before ceremony",
    "Kolam competition during Margazhi month",
    "Margazhi music season — when Chennai becomes a concert hall",
    "Thiruvadirai kali — the festival pudding of Margazhi",
    "Arudra darisanam — dancing Shiva's sacred darshan night",
    "Somavara puja — Tamil Monday Shiva worship tradition",
    "Tamil Nadu's 365-day festival calendar explained",
    "Why Tamil Nadu has more festivals than any other state",
  ],
  "Tamil Literature": [
    "Thirukkural — the wisdom that runs Silicon Valley corporations",
    "Silappatikaram — Tamil's oldest novel, world's greatest love story",
    "Sangam poetry — the world's oldest secular love literature",
    "Avvaiyar — the greatest Tamil poet who challenged kings",
    "Kamba Ramayanam — where Tamil poet improved Valmiki's version",
    "Manimekalai — the forgotten Buddhist Tamil epic masterpiece",
    "Tolkappiyam — Tamil grammar predating Sanskrit grammar by centuries",
    "Tamil poets who walked into kings' courts and won debates",
    "The 18 Sangam anthologies — raw poetry of ancient Tamils",
    "Thiruvasagam — poems that made stone hearts cry",
    "Lost Tamil texts scholars are racing to find before they're gone",
    "Purananuru — battlefield poetry of Sangam warriors",
    "How Thirukkural is quoted in UN and Harvard speeches today",
    "Tamil literature translated into 100+ world languages",
    "Akam poetry — the Tamil theory of love and nature",
    "Kambar's mind-blowing metaphors that modern poets borrow",
    "Pattinathar — the merchant who became Tamil's great renunciant",
    "Nakkirar — the Tamil scholar who argued with Shiva himself",
    "The 5 great epics of Tamil literature explained simply",
    "Kalittokai — Tamil's most daring ancient romantic anthology",
    "Thirumurugarruppadai — the first Tamil pilgrimage poem",
    "Malaipadukadam — poem praising a Tamil king's mountain fort",
    "Pattinappaalai — the Sangam poem about a Tamil port city",
    "Cilappatikaram's Kannagi — why Tamil women still worship her",
    "Agananooru — 400 love poems from Sangam Tamil Nadu",
    "Purananuru — the warrior-poet tradition that built Tamil pride",
    "Paranar — the greatest Sangam poet nobody taught you about",
    "Kapilar — the Brahmin poet who wrote for tribal kings",
    "Auvaiyar's Vinayagar Agaval — mystical Tamil devotion explained",
    "Tevaram — the Tamil Shiva hymns older than any Hindu text",
    "Nalayira Divya Prabandham — 4000 Tamil Vishnu hymns explained",
    "Thiruppavai — 30 stanzas Tamil women recite every December",
    "Thiruppugazh — Arunagirinathar's impossible poetic complexity",
    "Koothanaar — the satirical Tamil Sangam poet who mocked kings",
    "Paripadal — Tamil Nadu's oldest cosmic philosophy in verse",
    "Madurai Kanchi — 782-line poem about the Pandya city",
    "Modern Tamil literature — Kalki, Jayakanthan, Sundara Ramasamy",
    "Tamil short story tradition — the forgotten golden era",
    "Tamil Nadu's Nobel Prize nomination — should Thiruvalluvar get one",
    "How Bharati transformed Tamil poetry in 1910",
    "Subramania Bharati — Tamil Nadu's most rebellious poet",
    "Tamil haiku tradition — Kuruntokai's 2-line masterpieces",
    "The Tamil poet who insulted a king and survived",
    "Tamil narrative poetry — the art of kathai in verse",
    "Why Tamil children still memorize 1500-year-old poems",
    "Tamil literature's influence on classical Kannada and Telugu",
    "How Tamil texts were saved during temple raids",
    "Tamil manuscript libraries — race to digitize before they decay",
    "The Tamil grammar that made Sanskrit scholars jealous",
    "Lost Tamil epics — texts described but never found",
  ],
  "Tamil Language": [
    "Tamil is 2000+ years old — proof from stone inscriptions",
    "English words secretly borrowed from Tamil language",
    "The Tamil script — most scientific writing system analyzed",
    "Ancient Tamil words with no translation in any language",
    "How Tamil survived 2000 years without changing core grammar",
    "Tamil numbers and the ancient zero concept connection",
    "Grantha script — when Tamil met Sanskrit elegantly",
    "Tamil dialects — how language changes every 50km",
    "The 247 Tamil letters — why global linguists are obsessed",
    "Tamil words used in space science and medicine today",
    "Forgotten Tamil words that should make a comeback",
    "Why MIT calls Tamil a language engineering miracle",
    "The oldest Tamil inscription ever found and decoded",
    "Tamil's influence on Southeast Asian scripts",
    "How to read ancient Tamil inscriptions carved in stone",
    "Tamil Brahmi — the oldest Tamil script ever discovered",
    "Why Tamil has no word for cousin — cultural genius",
    "Tamil loanwords in Portuguese, Dutch, Malay, and Swahili",
    "Classical Tamil vs Modern Tamil — what linguists found changed",
    "The mathematics of Tamil meter in Sangam poetry",
    "Tamil's unique 5-vowel system that preserves ancient sounds",
    "Why Tamil cinema subtitles reach 80 countries",
    "Sri Lanka Tamil vs India Tamil — how they split over 2000 years",
    "Tamil Nadu's language war — what really happened in 1965",
    "Tamil in Malaysia — how a diaspora kept a language alive",
    "How Tamil words entered Roman Latin through trade",
    "Tolkappiyam's phonetics — more accurate than Sanskrit Panini",
    "Why Tamil doesn't have an 'F' sound — phonological genius",
    "Tamil verb conjugation — why linguists call it revolutionary",
    "The 18 dialects of Tamil Nadu — a traveller's language guide",
    "Saurashtra Tamil dialect — the silk weaver language",
    "Brahui language — how it shows Tamil's ancient range",
    "Tamil place names and their ancient meanings decoded",
    "Body part names in Tamil — oldest unchanged vocabulary",
    "Tamil's influence on the English names of spices and gems",
    "How Tamil preserved Dravidian sounds lost elsewhere",
    "Tamil spoken in Singapore — unique hybrid dialect",
    "How Tamil newspapers survived colonial censorship",
    "The Tamil Sangam — the ancient academy of language",
    "Tamil computing — Unicode and the digital language revolution",
    "Why Google hires Tamil language AI researchers",
    "How Tamil grammar rules predict natural language structures",
    "Tamil classical music notation — a unique linguistic system",
    "The Tamil-Brahmi script found in Egypt — trade proof",
    "Tamil words in Malagasy — Madagascar's Tamil connection",
    "How Tamil survived 3 different colonial powers unchanged",
    "Tamil diglossic — why written and spoken Tamil differ so much",
    "The Tamil movement to protect the language globally",
    "Why Tamil scholars say Sanskrit borrowed from Tamil",
    "Modern Tamil slang evolution — Chennai vs Madurai",
  ],
  "Tamil Achievers": [
    "APJ Abdul Kalam — Tamil boy who gave India nuclear power",
    "Srinivasa Ramanujan — the man who knew infinity from dreams",
    "Subrahmanyan Chandrasekhar — Tamil astrophysicist who shocked Nobel",
    "M.S. Subbulakshmi — the voice that moved the United Nations",
    "C.V. Raman — Tamil Nadu's Nobel Prize light scientist",
    "Tamil CEOs running Apple, Google, Pepsi, Microsoft globally",
    "Tamil doctors who changed modern neurosurgery forever",
    "Tamil athletes who made the world stop and watch",
    "Tamil architects designing the world's tallest buildings",
    "Tamil women who broke every glass ceiling in science",
    "Tamil scientists at NASA's Mars mission team",
    "Tamil chess grandmaster Viswanathan Anand — 5-time world champion",
    "Tamil artists whose work is in Louvre and MoMA collections",
    "Tamil activists who changed international human rights law",
    "Young Tamil innovators under 30 changing the world",
    "Tamil IAS officers who transformed entire Indian states",
    "Tamil nurses who became global healthcare leaders",
    "Tamil writers who won Booker and international prizes",
    "Periyar — the Tamil thinker who shook all of India",
    "Ambedkar's connection to Tamil Nadu and Dravidian movements",
    "Gopichand — the Tamil badminton coach who built India's champions",
    "Saina Nehwal's Tamil Nadu training story",
    "Tamil boxers who won Olympic medals for India",
    "Tamil Nadu's first IIT student — the untold story",
    "Muthulakshmi Reddy — the first woman legislator in Asia",
    "E.V. Ramasamy — Tamil's greatest social reformer",
    "Anna Hazare's forgotten Tamil mentor",
    "Tamil Nadu doctors who pioneered kidney transplants in India",
    "The Tamil professor who decoded ancient Indus script",
    "Tamil Nadu's Forest Department officer who saved wildlife",
    "The Tamil inventor of the wireless telegraph before Marconi",
    "Tamil Nadu's first woman pilot and what she did next",
    "Chellammal — the Tamil woman who wrote 14 novels before 1920",
    "Raman Pillai — Tamil Nadu's first great historian",
    "The Tamil athlete who ran barefoot to Olympic glory",
    "Tamil Nadu's great mathematician who rejected Cambridge",
    "Theagaraja Chetty — Tamil merchant who built modern Chennai",
    "T.V. Sundaram Iyengar — Tamil Nadu's auto industry pioneer",
    "N.R. Narayana Murthy's Tamil Nadu family connection",
    "Satya Nadella's overlooked Tamil Nadu engineering mentors",
    "Tamil Nadu IPS officers who fought organized crime",
    "The Tamil teacher whose students won 10 Nobel Prizes",
    "Tamil Nadu child prodigies who became world chess champions",
    "Saraswathi Rajamani — the teenage spy of Tamil Nadu",
    "Tamil women scientists at ISRO designing satellites",
    "Tamil Nadu's greatest sculptor — Debi Prasad Roy Chowdhury",
    "Tamil Nadu's contribution to Indian classical dance globally",
    "Tamil filmmakers who influenced world cinema directors",
    "T. Balasaraswathi — the Bharatanatyam dancer who conquered NYC",
    "Tamil Nadu doctors who cracked coronavirus research",
  ],
  "Tamil Nadu Tourism": [
    "Kodaikanal lake city secrets most tourists never find",
    "Chettinad abandoned palaces — forgotten Tamil aristocracy",
    "Dhanushkodi — India's ghost town at land's very end",
    "Yelagiri — Tamil Nadu's hidden underrated hill station",
    "Ancient cave paintings of Tamil Nadu older than Ajanta",
    "Hidden beach villages of Rameswaram island",
    "Courtallam waterfalls — Tamil Nadu's natural spa retreat",
    "Ooty Botanical Garden 150-year history and rare plants",
    "Tranquebar — Tamil Nadu's perfectly preserved Danish colony",
    "Nagapattinam — Tamil Buddhist port city hidden history",
    "5 sacred Pancha Bhuta peaks of Tamil Nadu",
    "Toda tribe villages of the Nilgiris — ancient unchanged",
    "Kalakkad Mundanthurai Tiger Reserve — wild Tamil Nadu",
    "Pulicat Lake — flamingos and forgotten colonial Dutch history",
    "Chennai to Kanyakumari road trip — 47 hidden stops",
    "Papanasam beach — wild surfing in Tamil Nadu",
    "Siruvani waterfalls — world's second sweetest water source",
    "Vellore Fort — the fortress that was never conquered",
    "Hogenakkal Falls — Tamil Nadu's mini Niagara and secret caves",
    "Mudumalai National Park — where elephants rule the forest",
    "Yercaud hill station — hidden gem above Salem",
    "Javadu Hills — tribal Tamil Nadu most tourists miss",
    "Valparai — the plantation hill station of Tamil Nadu",
    "Anaimalai Tiger Reserve — the last rainforest of Tamil Nadu",
    "Pichavaram mangrove forest — boat through tree roots",
    "Vedanthangal Bird Sanctuary — millions of birds arrive",
    "Mahabalipuram by moonlight — the magical evening experience",
    "Chidambaram's dancing Shiva — the village around the cosmic temple",
    "Thanjavur Big Temple morning ritual — 2000-year-old ceremony",
    "Rameswaram island circling ritual — 22 sacred wells",
    "Kanyakumari sunrise — where three seas meet",
    "Nellai waterfall circuit — Tamil Nadu's Everest of waterfalls",
    "Kodaikanal Pine Forest — mist and silence",
    "Anamalai Hills trek — unclimbed peaks of Tamil Nadu",
    "Javadhu Hills honey — wild Tamil Nadu tribal honey trail",
    "Chettiar Mansions of Chettinad — palaces turning to dust",
    "Pondicherry French Quarter — Tamil Tamil meets French Tamil",
    "Karaikkal beach — where fishermen have never changed",
    "Kollidam river estuary — where river meets Bay of Bengal",
    "Courtallam five-falls circuit — the full waterfalls trail",
    "Megamalai Hill Station — Tamil Nadu's secret green paradise",
    "Kolli Hills — the honey hills of Namakkal district",
    "Tirupur textile city — how Tamil entrepreneurs built a global hub",
    "Kumbakonam temples circuit — the city of 2 million lamps",
    "Palani Hills trekking trail — pilgrimage on foot",
    "Tiruvallur waterways — Tamil Nadu's unsung backwaters",
    "Point Calimere wildlife sanctuary — flamingo breeding ground",
    "Salem steel city — Tamil Nadu's industrial cultural heritage",
    "Erode turmeric markets — Tamil Nadu's golden spice capital",
    "Madurai at midnight — the city that never sleeps",
  ],
  "Tamil Villages": [
    "Chettinad villages — time-frozen mansions of merchant kings",
    "Tamil Nadu's natural dyeing villages keeping craft alive",
    "Terracotta horse village of Aiyanar — 1000-year tradition",
    "Kumbakonam — the village that became city of temples",
    "Salt pan workers of Tuticorin — forgotten labor history",
    "Silambu making villages — bronze anklet craft families",
    "Kattaimedu — the village of Tamil classical dancers",
    "Kovilpatti — the kadalai mittai village known worldwide",
    "Karimnagar weavers — silk that clothed Tamil kings",
    "The floating villages of Vembanad Tamil coast",
    "Nachiarkoil bell metal village — the last artisans",
    "Swamimalai bronze village — Chola art still alive",
    "Irula tribal village — snake catchers of Tamil Nadu",
    "Kurumba village Nilgiris — Toda people's sacred buffalo",
    "Nattukotai Chettiar village — the banker caste of Tamil Nadu",
    "Vellore leather village — Tamil Nadu's tanning tradition",
    "Tirupur knitting villages — T-shirt capital of the world",
    "Erode turmeric farming villages — gold fields of Tamil Nadu",
    "Thanjavur painting village — every house an artist",
    "Manamadurai pottery village — Tamil Nadu's clay masters",
    "Keezhadi excavation village — where history was found",
    "Arani silk village — the Kanchipuram rival nobody knows",
    "Kavundapadi village — Tamil Nadu's handloom hub",
    "Karur cotton village — made textiles for East India Company",
    "Valparai estate village — Tamil Nadu's tea garden workers",
    "Kotagiri village — Nilgiri's original Badaga community",
    "Panruti jackfruit village — Tamil Nadu's jackfruit capital",
    "Virudhunagar fireworks village — Tamil Nadu's Diwali makers",
    "Udumalpet cotton village — Tamil Nadu's textile heartland",
    "Tenkasi Papanasam — the village below 300 waterfalls",
  ],
  "Tamil Arts": [
    "Bharatanatyam — the mathematics of divine movement",
    "Tanjore painting — gold leaf technique 300 years old",
    "Carnatic music — raga science that predicts weather",
    "Kolattam — the ancient Tamil stick dance origin",
    "Silambam — the Tamil martial art older than Kalaripayattu",
    "Bronze casting of Chola — lost wax technique that defeats modern science",
    "Tamil weaving — Kanchipuram silk that lasts 100 years",
    "Kalamkari — hand-painted Tamil textile masterpieces",
    "Therukoothu street theatre — Tamil Nadu's oldest drama tradition",
    "Nadaswaram music — the world's loudest non-electronic instrument",
    "Veena — the mother of all Indian string instruments from Tamil Nadu",
    "Mridangam — the ancient Tamil percussion science",
    "Kolam art — sacred geometry at Tamil Nadu's thresholds",
    "Tanjore Maratha paintings — history in gold and jewels",
    "Tamil Nadu puppet theatre — Bommalattam tradition fading",
    "Parai drumming — the ancient Tamil Dalit musical legacy",
    "Oyilattam — the flag dance of Tamil Nadu temples",
    "Karagattam — the Tamil Nadu pot-balancing dance",
    "Mayilattam — peacock dance of Murugan devotees",
    "Poikkal Kuthirai — fake horse dance of Tamil Nadu",
    "Vil Paatu — Tamil Nadu's bow-song storytelling tradition",
    "Burra Katha — Tamil Nadu's oral epic recitation",
    "Thavil — the barrel drum of Tamil Nadu temple festivals",
    "Tamil Nadu's clay figure making — the ritual mud sculpture",
    "Tanjore Thanjavur painting — modern revival story",
    "Tamil Nadu textile art — 50 weaving traditions explained",
    "Rock art of Tamil Nadu — prehistoric paintings decoding",
    "Tamil Nadu tribal art — Irula and Toda craft traditions",
    "Chola bronze school — the greatest metal art tradition in history",
    "Golu doll making — the handcrafted tradition of Navarathri",
  ],
  "Tamil Gods & Spirituality": [
    "Murugan — the Tamil god who defeated evil with a spear of light",
    "Amman — the fierce mother goddess of every Tamil village",
    "Shiva's cosmic dance — why Nataraja is at CERN particle physics lab",
    "Ayyappan — the god born from two male gods, Tamil mystery explained",
    "Karuppasamy — the guardian deity only Tamils truly understand",
    "Vinayagar — why Ganesha is always worshipped first in Tamil Nadu",
    "Tamil Shaivism philosophy — Thirumoolar's 3000-year wisdom",
    "Andal — the woman saint who married Vishnu and changed Tamil devotion",
    "Skanda Purana in Tamil — stories no other language preserved",
    "Kali temples of Tamil Nadu — why she dances on the defeated demon",
    "Valli and Devasena — the two wives of Murugan and their symbolism",
    "108 Shakti Peethas — how many are in Tamil Nadu",
    "Why every Tamil village has a different guardian deity",
    "Thiruvasagam — the Tamil scripture that converts hearts",
    "Tamil Siddhas — the 18 mystic scientists of ancient Tamil Nadu",
    "Murugan vs Subramanian vs Skanda — same god, different stories",
    "Why Tamils worship Aiyanar on white horse at village borders",
    "The Navagrahas — Tamil Nadu's 9 planetary temple circuit",
    "Why Tamil Shiva temples face east except one famous exception",
    "Thevaram — the Tamil devotional path that predates Bhakti movement",
    "Alwars — the 12 Tamil Vaishnava saints and their miracles",
    "Nayanmars — the 63 Tamil Shaiva saints who wandered singing",
    "Agamas — the Tamil temple ritual manuals 5000 years old",
    "Aum to Tamil — how the cosmic sound became Tamil literature",
    "Vaikunta Ekadasi — the night heaven's door opens, Tamil tradition",
    "Thaipusam kavadi — the science of why devotees feel no pain",
    "Panchabhuta Stalas — 5 temples for 5 elements of the universe",
    "Murugan's Vel spear — weapon of wisdom that defeats ignorance",
    "Tamil philosophy of grace — Arul in Tamil Shaiva Siddhanta",
    "Siva Nataraja — the dancing universe of physics",
    "Why Tamil Nadu's temples orient to star alignments",
    "The 9 forms of Durga worshipped across Tamil Nadu",
    "Kantha Sasti kavasam — the Tamil protective hymn millions recite",
    "Tamil Nadu village priest traditions — the Poojari system",
    "Aghoris of Tamil Nadu — the Shiva ascetics of the cremation ground",
    "Naga worship in Tamil Nadu — the snake deity tradition",
    "Mariamman — the village fever goddess who heals and punishes",
    "Sudalai Madan — the most feared Tamil village deity",
    "Muniyandi — Tamil Nadu's young warrior deity tradition",
    "Sekkizhar's Periya Puranam — lives of 63 Tamil Shiva saints",
    "Tamil tantric traditions — secret rituals of Shakti temples",
    "Why Tamil Hindus tie mango leaves at doorways",
    "The Tamil fire-walking tradition — Thimithi festival science",
    "Vedic Tamil — how Sanskrit Vedas traveled through Tamil Nadu",
    "Agastya Muni — the Tamil sage who drank the ocean",
    "Why Tamil temples have separate entrances for men and women",
    "Chidambaram Rahasyam — the secret at the center of the universe",
    "Tamil Siddha tradition — naked yogis who achieved immortality",
    "The 64 arts of Tamil divine culture — why number 64 is sacred",
    "How Tamil Nadu became the spiritual capital of South India",
  ],
  "Tamil Science & Innovation": [
    "Tamil vaidhyam — ancient Tamil medicine older than Ayurveda",
    "Siddha medicine — plant cures modern pharma is now copying",
    "Karikala's Grand Anicut dam — 2000-year dam still functioning",
    "Tamil astronomical calendar — more precise than modern GPS timing",
    "Ancient Tamil water harvesting — the system that defeated drought",
    "Tamil martial arts science — Silambam biomechanics explained",
    "Chola bronze casting alloy — metallurgists still can't replicate it",
    "Tamil architectural acoustics — temples designed to amplify sound",
    "Ancient Tamil ship design — Chola vessels without compass",
    "Agastya Muni — the Tamil sage who wrote on chemistry and medicine",
    "Tamil Siddha alchemy — the rasayana science of longevity",
    "How Tamil farmers predicted monsoons for 2000 years accurately",
    "Tamil Nadu's 40,000 ancient irrigation tanks still in use",
    "Varma kalai — Tamil pressure-point healing and combat system",
    "Tamil Nadu iron technology — sharper than Damascus steel",
    "Ancient Tamil astronomy — why Tamil calendar predicted eclipses",
    "Tamil Nadu's ancient surgical instruments — predating Greek medicine",
    "How Agastya invented a battery 2000 years ago — evidence",
    "Tamil Nadu's fractured healing — bone-setting tradition",
    "Thirukural's nutrition science — modern dietetics decoded",
    "Tamil counting system — why it was adopted across South Asia",
    "How Tamil temples used gravity for water distribution",
    "Ancient Tamil dyes — natural colors that lasted 500 years",
    "Tamil Nadu's ancient lighthouse technology — pre-modern navigation",
    "Siddha nadi astrology — the mysterious palm leaf libraries",
    "How Tamil cotton was the best textile in the ancient world",
    "Tamil Nadu's ancient pearl diving technology — 2000 BCE records",
    "How Sangam-era Tamils measured land and water accurately",
    "Tamil Nadu's climate science — ancient records of 2000 years",
    "Varmam therapy — the Tamil healing that YouTube is now teaching",
  ],
  "Tamil Diaspora": [
    "Tamil Nadu to Silicon Valley — how Tamils conquered tech",
    "Malaysian Tamils — a community that rebuilt a nation in 200 years",
    "Sri Lanka Tamil culture — what makes it distinct from mainland",
    "Tamil diaspora in 60 countries — the invisible global network",
    "Mauritius Tamil community — descendants of workers who thrived",
    "South African Tamil story — Gandhi's Tamil community",
    "How Tamil nurses saved healthcare in UK, Canada, Australia",
    "The Tamil restaurant that changed how the world eats dosas",
    "Tamil students who top IIT, MIT, Cambridge, Harvard yearly",
    "Thailand's Tamil temples — 1500 years of continuous worship",
    "Fiji Tamil community — the South Pacific Tamil story",
    "Singapore Tamil enclave — Little India built by Tamil workers",
    "Tamil diaspora funding ancient temple restoration in India",
    "How Tamil teachers built education systems in Malaysia",
    "UK Tamil community activism that shaped Brexit debate",
    "Canadian Tamil political power — riding-changing diaspora votes",
    "German Tamil scientists at Max Planck institutes",
    "Tamil diaspora doctors who became hospital directors globally",
    "How Tamil New Year is celebrated differently in 10 countries",
    "Dubai Tamil community — the Gulf migration story",
    "Australia Tamil community cultural renaissance",
    "France Tamil diaspora — Tamil temples in Paris suburbs",
    "Tamil language schools in 40 countries — keeping culture alive",
    "Tamil entrepreneurs in London who built retail empires",
    "How Tamil food traveled to Caribbean through indentured workers",
    "Second-generation Tamils reconnecting with their roots",
    "Tamil diaspora remittances — billions flowing back to Tamil Nadu",
    "Norway Tamil asylum seekers who built new community",
    "Tamil cricket teams in UK, Canada, Australia leagues",
    "How Tamil diaspora saved Tamil cinema during streaming era",
  ],
  "Tamil Cinema": [
    "Kollywood vs Bollywood — why Tamil cinema is technically superior",
    "MGR — the actor who became god and then chief minister",
    "Rajinikanth philosophy — why fans build temples for an actor",
    "AR Rahman — the Tamil musician who globalized Indian sound",
    "Mani Ratnam's Tamil cinema — each frame a painting",
    "Tamil cinema's influence on Korean action directors",
    "K. Balachander — the father of realistic Tamil cinema",
    "Why Tamil dubbing industry is world's most sophisticated",
    "Tamil silent film era — the lost golden age of cinema",
    "Kamal Haasan's contribution to Tamil cinema and Indian music",
    "Tamil cinema special effects — made in Chennai, seen worldwide",
    "Shankar's epic filmmaking — how he changed Indian blockbusters",
    "Tamil cinema stunt culture — real action no CGI tradition",
    "Why Tamil film music sells more than Hindi film music",
    "Tamil cinema's Dalit representation — progressive evolution",
    "Sivaji Ganesan — the greatest actor Indian cinema produced",
    "M.G. Ramachandran and the political rise of film in Tamil Nadu",
    "The Tamil film industry during the British period",
    "How Tamil cinema survived during India's emergency period",
    "Bharathiraja — Tamil Nadu's countryside cinema revolution",
    "K. Balachander's feminist Tamil films before feminism",
    "Tamil cinema's international academy award campaigns",
    "How Tamil cinema exports grew to 100 countries",
    "Cinematographer P.C. Sreeram — Tamil cinema's visual master",
    "Tamil cinema's influence on Telugu and Malayalam films",
    "First Tamil talkie — the 90-year-old industry history",
    "Tamil music composers who scored Hollywood films",
    "How Chennai recording studios became South India hub",
    "Tamil cinema's social impact — films that changed laws",
    "New wave Tamil cinema — Vetrimaaran, Pa.Ranjith revolution",
  ],
  "Tamil Social Reform": [
    "Periyar's self-respect movement — how it changed Tamil Nadu",
    "Dr. Ambedkar's visits to Tamil Nadu and Dalit empowerment",
    "Tamil Nadu's anti-caste tradition — 2000 years of resistance",
    "Why Tamil Nadu leads India in social equality indicators",
    "Muthulakshmi Reddy — the doctor who became India's first woman MLA",
    "Tamil Nadu Devadasi reform — the women who fought tradition",
    "The Tamil Nadu mid-day meal scheme — changed a generation",
    "Why Tamil Nadu has highest female literacy in rural India",
    "E.V. Ramasamy's rational thought revolution in Tamil Nadu",
    "Tamil Nadu's caste violence history — the fights for dignity",
    "Anna Arivalayam — how DMK changed Tamil political culture",
    "Tamil Nadu's pioneer in widow remarriage — 1800s social reform",
    "Tamil Nadu's sex worker rights movement — unique in India",
    "How Tamil films fought untouchability in the 1950s",
    "Tamil women journalists who covered social reform 1920-1960",
    "Tamil Nadu's Panchami Land issue — Dalit land rights history",
    "The Adi Dravidar movement — reclaiming Tamil Dalit identity",
    "Tamil Nadu temple entry proclamation — fight that changed India",
    "Why Tamil Nadu's affirmative action policy is India's model",
    "The Tirunelveli massacre and the Tamil justice movement",
  ],
  "Tamil Nature & Wildlife": [
    "Tamil Nadu's Western Ghats — one of world's 8 hottest biodiversity spots",
    "Nilgiri tahr — the mountain goat only Tamil Nadu has",
    "Tamil Nadu's lion-tailed macaque — rarest primate in Asia",
    "Anaimalai Hills biodiversity — 100 species per square km",
    "Tamil Nadu's ancient banyan forests — trees older than history",
    "Vedanthangal — where 40,000 birds come home every winter",
    "Tamil Nadu's elephants — 3000 wild elephants and their routes",
    "Mudumalai — where tigers and elephants share the same forest",
    "Tamil Nadu's coral reefs — Gulf of Mannar underwater world",
    "Olive Ridley turtles — nesting on Tamil Nadu's moonlit beaches",
    "Tamil Nadu's migratory bird highways from Siberia",
    "Palni Hills shola forests — ancient cool-climate ecosystem",
    "Tamil Nadu's water bodies — 40,000 lakes supporting all life",
    "Irula tribe — the people who talk to snakes of Tamil Nadu",
    "Tamil Nadu's medicinal plant forests — Siddha medicine source",
    "The Palani Hills endangered species rescue story",
    "Tamil Nadu's tiger population — record recovery story",
    "Hump-backed dolphin spotting in Tamil Nadu waters",
    "Tamil Nadu mangroves — protecting 1000km of coastline",
    "How Tamil Nadu farmers coexist with wild animals for centuries",
  ],
  "Tamil Maritime History": [
    "Tamil sailors who discovered Australia before Europeans",
    "Chola naval routes to China mapped by archaeologists",
    "Tamil Nadu's ancient shipbuilding — boats without nails",
    "How Tamil sailors invented the compass before Europeans",
    "Tamil Nadu's 1000-year maritime trade with Indonesia",
    "Kaveri delta ports — the ancient export hub of Tamil Nadu",
    "Tamil Nadu pearl fishers — the most dangerous profession in history",
    "Poompuhar — Tamil Nadu's lost port city found underwater",
    "Tamil Nadu's fishing communities — caste, skill, and sea",
    "Ancient Tamil Nadu maps — how they charted the Indian Ocean",
    "Kaveripattinam — the merchant city that Roman traders visited",
    "How Tamil ships carried Tamil gods to Southeast Asia",
    "Tamil Nadu's monsoon trade wind navigation — ancient science",
    "Marakkar admiral family — Tamil Nadu's last great sea warriors",
    "Kalakad fishing village — unchanged for 2000 years",
    "Tamil Nadu's ancient glass bead trade with Rome",
    "Chola Empire's occupation of Maldives — little-known history",
    "Thanjavur Chola's Sri Lanka marine campaigns",
    "Tamil Nadu's ancient boat festivals still continuing today",
    "How Tamil Nadu's fishing industry feeds South India",
  ],
  "Tamil Music & Dance": [
    "Carnatic music — the raga that cures disease, proven by science",
    "Bharatanatyam — the divine code language of gods decoded",
    "How AR Rahman changed global film music from a Chennai studio",
    "Tamil Nadu's devadasi tradition — sacred dance and controversy",
    "The Nayanmars — saints who sang Shiva into existence",
    "Alwars — 12 poets whose Tamil songs are sung 1000 years later",
    "Tamil parai drumming — the war drum that became cultural symbol",
    "Carnatic violin — how Tamil musicians transformed a western instrument",
    "Tamil folk music — 50 types that change per district",
    "Kummi — the women's circle dance of Tamil harvest festivals",
    "Villu Pattu — the bow song storytelling of Tamil Nadu",
    "Oppari — Tamil Nadu's unique lament singing tradition",
    "Koothu — Tamil street theatre that survived colonialism",
    "MS Subbulakshmi's journey from Madurai to UN General Assembly",
    "Muthuswami Dikshitar — the Carnatic trinity's cosmic traveller",
    "Thyagaraja — the saint who composed 700 krithis to Rama",
    "Syama Sastri — the forgotten genius of the Carnatic trinity",
    "Tamil Nadu's Nadaswaram — the 3-meter wind instrument",
    "Tavil — the barrel drum that's played only at auspicious occasions",
    "How Chennai's December music season became the world's longest",
    "Tamil Nadu's classical dance forms — 10 beyond Bharatanatyam",
    "Kolam — the mathematical dance pattern of Tamil thresholds",
    "Tamil Nadu music school tradition — gurukulam lives on",
    "Tamil Nadu's musical instrument makers — the Mirudangam craft",
    "How Tamil classical music influenced Beatles and jazz",
    "Lalgudi Jayaraman — the violinist who made Tamil Nadu proud",
    "Ilayaraja — the self-taught genius who composed 1000 soundtracks",
    "Tamil film music evolution — 1930 to today in 5 minutes",
    "Purandaradasa — Carnatic music's founding father's Tamil connections",
    "Tamil Nadu musicians who play at Carnegie Hall today",
  ],
  "Tamil Philosophy": [
    "Saiva Siddhanta — Tamil Nadu's unique theology of grace and liberation",
    "Why Thirukural is more universal than any religious scripture",
    "Tamil Siddha philosophy — the body is the temple teaching",
    "Advaita Vedanta's Tamil roots — Adi Shankaracharya's southern journey",
    "Tamil Buddhism — the forgotten Buddhist civilization of Tamil Nadu",
    "Tamil Jainism — merchants who built temple mountains",
    "Meykanda Shastra — the 14 Tamil philosophical texts explained",
    "Cilappatikaram philosophy — fate, justice, and the divine order",
    "Tamil concept of Anbu — love as the highest philosophy",
    "Why Thiruvalluvar's Kural makes a better legal code than Manu Smriti",
    "Tamil philosophy of Aram Porul Inbam — the three goods of life",
    "Periyar's rational humanism — rejecting god for human dignity",
    "Tamil Tantric philosophy — the body as universe teaching",
    "Tolkappiyam's theory of consciousness — 2000-year psychology",
    "Tamil Marabu — the tradition that holds everything together",
    "Tamil concept of Ullam — the heart as cosmic mirror",
    "Why Tamil philosophy says the universe is made of sound",
    "Thirumandiram — 3000 verses on yoga, tantra, and consciousness",
    "Tamil Nadu's Siddhar caves — where philosophy became practice",
    "Tamil philosophy of Thiruvalluvar — 1330 couplets for modern life",
  ],
  "Tamil Architecture": [
    "Why Chola temple towers are mathematically perfect fractals",
    "The 108 Divya Desam temple architecture styles compared",
    "Pallava rock-cut architecture — carving history into mountains",
    "How Tamil Nadu temple architecture spread to Southeast Asia",
    "Chettinad mansions — the architecture of accumulated wealth",
    "Tamil Nadu's colonial architecture in Pondicherry",
    "Brihadeeswara Temple — how 80-ton capstone was placed without cranes",
    "Tamil Nadu stepwells — ancient water architecture masterpieces",
    "Temple gopuram science — the physics of Tamil towers",
    "Tamil Nadu cave architecture — 1500 years of carved rooms",
    "Shore Temple Mahabalipuram — Tamil Nadu's oldest standing temple",
    "Gangaikondacholapuram — the capital Rajendra built to outdo his father",
    "Tamil Nadu fort architecture — Gingee, Vellore, Krishnagiri",
    "Agama Shastra — the Tamil temple architecture manual",
    "Tamil Nadu's tank architecture — 40,000 engineered reservoirs",
    "How Chola architecture influenced Angkor Wat in Cambodia",
    "Tamil Nadu Dutch and British architecture fusion in Chennai",
    "Srirangam temple city — architecture of nested enclosures",
    "Madurai temple city — how the city grew around the goddess",
    "Tamil Nadu's modern architecture — IIT Madras campus story",
  ],
};

const ALL_TOPICS = Object.entries(CONTENT_TOPICS).flatMap(([category, topics]) =>
  topics.map((topic) => ({ category, topic }))
);

// ─── USED TOPICS TRACKING (avoid repeats) ────────────────────────────────────
const fs = require("fs");
const path = require("path");
const USED_TOPICS_FILE = path.join(__dirname, "used_topics.json");

function loadUsedTopics() {
  if (!fs.existsSync(USED_TOPICS_FILE)) return new Set();
  try { return new Set(JSON.parse(fs.readFileSync(USED_TOPICS_FILE, "utf8"))); }
  catch { return new Set(); }
}

function saveUsedTopics(set) {
  fs.writeFileSync(USED_TOPICS_FILE, JSON.stringify([...set].slice(-2000)));
}

// ─── AI-GENERATED TOPICS (unlimited mode) ─────────────────────────────────────
const CATEGORIES = Object.keys(CONTENT_TOPICS);

async function generateFreshTopics(category, count = 40) {
  const cat = category || CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
  const prompt = `Generate ${count} UNIQUE, SPECIFIC Instagram content topic ideas for Tamil culture page "TamilNadu Unfiltered".
Category: ${cat}

Rules:
- Each topic must be a specific, fascinating, lesser-known fact or story
- NOT generic — be hyper-specific (name places, people, dates, objects)
- Mix emotional angles: shocking discovery, hidden history, proud moment, surprising science
- Topics must be DIFFERENT from standard history textbook content

Return ONLY a JSON array of strings:
["topic 1", "topic 2", ...]`;

  try {
    const response = await getGroq().chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.95,
      max_tokens: 2000,
    });

    const text = response.choices[0].message.content.trim();
    const arr = JSON.parse(text.match(/\[[\s\S]*\]/)?.[0] || text);
    return arr.map((t) => ({ category: cat, topic: t, aiGenerated: true }));
  } catch (err) {
    console.error("Topic generation failed:", err.message);
    return [];
  }
}

// ─── TOPIC ROTATION (hardcoded first, then AI-generated infinitely) ───────────
let _topicQueue = [...ALL_TOPICS];
let _usedTopics = loadUsedTopics();

async function getNextTopic() {
  // Filter out recently used
  let available = _topicQueue.filter((t) => !_usedTopics.has(t.topic));

  // If less than 20 left, generate 40 fresh AI topics
  if (available.length < 20) {
    console.log("🔄 Topic queue low — generating 40 fresh AI topics...");
    const cat = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
    const fresh = await generateFreshTopics(cat, 40);
    _topicQueue = [...ALL_TOPICS, ...fresh];
    available = _topicQueue.filter((t) => !_usedTopics.has(t.topic));
    // If still empty (all used), reset used topics and start fresh cycle
    if (available.length === 0) {
      _usedTopics = new Set();
      saveUsedTopics(_usedTopics);
      available = _topicQueue;
    }
  }

  const item = available[Math.floor(Math.random() * Math.min(available.length, 50))];
  _usedTopics.add(item.topic);
  saveUsedTopics(_usedTopics);
  return item;
}

function getRandomTopic() {
  return ALL_TOPICS[Math.floor(Math.random() * ALL_TOPICS.length)];
}

// ─── BRAND SYSTEM ─────────────────────────────────────────────────────────────
const BRAND_NAME = process.env.BRAND_NAME || "TamilNadu Unfiltered";
const BRAND_SYSTEM = `You are the content director of "TamilNadu Unfiltered" — the world's #1 Tamil culture Instagram brand targeting global Tamil diaspora and curious non-Tamils.

BRAND VOICE: Premium, educational, emotionally resonant. Proud without being divisive. Facts only — never myths as facts. Write like a blend of National Geographic and a passionate Tamil professor.

PSYCHOLOGY TRIGGERS (use ethically):
- Pride: "You didn't know this about your own heritage"
- Nostalgia: Emotional connection to homeland
- Curiosity: Surprising facts that break assumptions
- Discovery: "Share this before it's forgotten"
- Identity: "This is who we are"

INSTAGRAM ALGORITHM RULES:
- First line = SCROLL STOPPER (must make thumb stop in 0.5 seconds)
- Short sentences. Mobile reader. No paragraph walls.
- Each post must teach ONE thing they can tell 3 people today
- End with CTA that triggers saves + shares (saves = #1 algorithm signal)
- Hashtag strategy: 10 mega (1M+), 10 large (100K-1M), 10 niche (10K-100K)`;

// ─── CONTENT GENERATORS ───────────────────────────────────────────────────────
// ── Post FORMATS — rotated so captions never feel repetitive ──────────────────
const CAPTION_FORMATS = [
  { name: "did-you-know",  instr: "Frame the body as a 'Did you know?' revelation. Open the body with a startling little-known fact, then expand." },
  { name: "myth-buster",   instr: "Frame it as busting a common myth/misconception. Start the body with what people wrongly believe, then reveal the truth." },
  { name: "listicle",      instr: "Structure the body as 3-5 numbered punchy facts (1️⃣ 2️⃣ 3️⃣ style), each one line." },
  { name: "storytime",     instr: "Tell it as a short dramatic mini-story with a beginning, tension, and payoff. Narrative voice." },
  { name: "this-vs-that",  instr: "Use a surprising comparison or 'most people think X, but actually Y' contrast to drive the body." },
  { name: "untold",        instr: "Frame it as a forgotten/untold/erased piece of Tamil history that deserves to be remembered." },
  { name: "quiz",          instr: "Open the body with a question the reader can't answer, then deliver the fascinating answer." },
  { name: "pride",         instr: "Frame it to evoke deep Tamil pride — emphasize how this was first/biggest/oldest in the world." },
];

// Free Groq models rotated for variety; invalid/unavailable ones fall back safely.
const CAPTION_MODELS = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "openai/gpt-oss-120b"];
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

async function generateCaption(topic, category) {
  const imageStyle = pickImageStyle(category);
  const format = pick(CAPTION_FORMATS);
  const prompt = `Write a HIGH-ENGAGEMENT Instagram caption for ${BRAND_NAME}.

Topic: ${topic}
Category: ${category}

FORMAT FOR THIS POST: "${format.name}" — ${format.instr}

Return ONLY valid JSON, no markdown:
{
  "hook": "scroll-stopping first line — shocking/surprising/bold (max 10 words)",
  "body": "main caption (180-220 words). Short punchy sentences. 3-5 specific fascinating facts. Build emotional crescendo. Mobile-reader friendly. Follow the FORMAT above.",
  "cta": "call to action — ask a question OR 'Save this before it disappears' OR 'Tag someone who needs to know this'",
  "hashtags": "30 hashtags: 10 mega-viral + 10 category-specific + 10 hyper-niche, as one string",
  "image_prompt": "detailed, evocative text-to-image prompt for this exact topic",
  "alt_text": "accessibility description"
}

Image style to use: ${imageStyle}`;

  // Try a rotated model first, fall back to the reliable default on any error.
  const models = [pick(CAPTION_MODELS), "llama-3.3-70b-versatile"];
  let lastErr;
  for (const model of [...new Set(models)]) {
    try {
      const response = await getGroq().chat.completions.create({
        model,
        messages: [
          { role: "system", content: BRAND_SYSTEM },
          { role: "user", content: prompt },
        ],
        temperature: 0.9,
        max_tokens: 1200,
      });
      const text = response.choices[0].message.content.trim();
      let parsed;
      try { parsed = JSON.parse(text); }
      catch {
        const match = text.match(/\{[\s\S]*\}/);
        if (!match) throw new Error("invalid JSON: " + text.slice(0, 120));
        parsed = JSON.parse(match[0]);
      }
      parsed._format = format.name;
      parsed._model = model;
      return parsed;
    } catch (e) {
      lastErr = e;
      // try next model in the list
    }
  }
  throw new Error("Caption generation failed: " + (lastErr?.message || "unknown"));
}

async function generateReelScript(topic, category) {
  const prompt = `Write a VIRAL 60-second Instagram Reel script for TamilNadu Unfiltered.

Topic: ${topic}
Category: ${category}

Return ONLY valid JSON:
{
  "hook_text": "3-word on-screen text for first second",
  "hook_voiceover": "jaw-dropping opening line",
  "script": [
    {"time": "0-5s", "voiceover": "...", "visual": "...", "text_overlay": "..."},
    {"time": "5-15s", "voiceover": "...", "visual": "...", "text_overlay": "..."},
    {"time": "15-30s", "voiceover": "...", "visual": "...", "text_overlay": "..."},
    {"time": "30-45s", "voiceover": "...", "visual": "...", "text_overlay": "..."},
    {"time": "45-60s", "voiceover": "...", "visual": "...", "text_overlay": "..."}
  ],
  "music_mood": "describe exact music vibe",
  "thumbnail_text": "text for reel thumbnail",
  "cta": "end screen CTA"
}`;

  const response = await getGroq().chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: BRAND_SYSTEM },
      { role: "user", content: prompt },
    ],
    temperature: 0.85,
    max_tokens: 1400,
  });

  const text = response.choices[0].message.content.trim();
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("Invalid JSON from Groq");
  }
}

async function generateCarousel(topic, category) {
  const prompt = `Write a VIRAL 9-slide Instagram Carousel for TamilNadu Unfiltered.

Topic: ${topic}
Category: ${category}

Return ONLY valid JSON:
{
  "cover": {"headline": "thumb-stopping title (max 6 words)", "subheadline": "curiosity hook"},
  "slides": [
    {"number": 1, "headline": "max 6 words", "body": "max 40 words — one fact per slide", "visual": "describe image"},
    {"number": 2, "headline": "...", "body": "...", "visual": "..."},
    {"number": 3, "headline": "...", "body": "...", "visual": "..."},
    {"number": 4, "headline": "...", "body": "...", "visual": "..."},
    {"number": 5, "headline": "...", "body": "...", "visual": "..."},
    {"number": 6, "headline": "...", "body": "...", "visual": "..."},
    {"number": 7, "headline": "...", "body": "...", "visual": "..."}
  ],
  "final_slide": {"cta": "follow + save message", "account": "@tamilnadu.unfiltered"}
}`;

  const response = await getGroq().chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: BRAND_SYSTEM },
      { role: "user", content: prompt },
    ],
    temperature: 0.85,
    max_tokens: 1600,
  });

  const text = response.choices[0].message.content.trim();
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("Invalid JSON from Groq");
  }
}

async function generateBulkIdeas(category, count = 30) {
  const prompt = `Generate ${count} unique VIRAL Instagram content ideas for TamilNadu Unfiltered.
Category focus: ${category || "all 20 categories evenly"}

Return ONLY a valid JSON array:
[{
  "topic": "specific content topic",
  "category": "which pillar",
  "type": "reel or carousel or caption",
  "hook": "one viral hook line",
  "viral_angle": "why this will spread",
  "emotion": "pride/curiosity/nostalgia/discovery/shock"
}]`;

  const response = await getGroq().chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: BRAND_SYSTEM },
      { role: "user", content: prompt },
    ],
    temperature: 0.9,
    max_tokens: 3000,
  });

  const text = response.choices[0].message.content.trim();
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]);
    throw new Error("Invalid JSON from Groq");
  }
}

module.exports = {
  generateCaption,
  generateReelScript,
  generateCarousel,
  generateBulkIdeas,
  getNextTopic,
  getRandomTopic,
  pickImageStyle,
  CONTENT_TOPICS,
  ALL_TOPICS,
};
