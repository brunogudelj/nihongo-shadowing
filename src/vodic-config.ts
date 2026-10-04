// Pravila vodiča i konjugatora na jednom mjestu (docs/specifikacija-dorade.md).
// Nakon tjednog razgovora s Claudeom mijenja se samo ova datoteka, ne kod.

export const KONJUGATOR = {
  // Slaba točka (oblik + pravilo): u zadnjih `window` pokušaja barem `minAttempts` pokušaja
  // i barem `failRate` udjela "Nisam". Postaje slaba samo kad je zadnji odgovor "Nisam".
  weak: { window: 20, minAttempts: 5, failRate: 0.3 },
  // Prestaje biti slaba kad je u zadnjih `window` pokušaja barem `okRate` udjela "Znao".
  recover: { window: 10, okRate: 0.9 },
  // Slaba riječ: barem `fails` puta "Nisam" u zadnjih `window` pokušaja te riječi.
  weakWord: { window: 3, fails: 2 },
  // Sesija = jedno otvaranje konjugatora s barem `minAnswers` odgovora; "prolazna" uz barem `passRate` "Znao".
  session: { minAnswers: 10, passRate: 0.9 },
  // Riječ s "Nisam" vraća se nakon otprilike ovoliko drugih zadataka.
  retryAfter: 5,
  // Najviše ovoliko zapisa; iznad toga stariji se brišu, ali po točki i riječi ostaje `keepPerPoint` zadnjih.
  maxRecords: 20000,
  keepPerPoint: 50,
  // Koliko stavki pokazuje zaslon "Gdje zapinjem".
  listMax: 10,
}

// Vodič "Današnji trening" (dorada 1V). Minute, rokovi, redoslijed priča i tablica konjugatora.
export type StepId =
  | 'rijeci' // ponavljanje riječi
  | 'zagrijavanje' // rečenice kojima je danas rok ponavljanja
  | 'nove' // nove rečenice, faze A–D
  | 'cisto' // Čisto test jučerašnjih novih
  | 'konjugator'
  | 'nove-rijeci' // Sljedećih 8
  | 'citanje'
  | 'dorada' // rečenice u radu, bez novih (skraćeni plan, petak)
  | 'test-price' // subota: test cijele priče

export const VODIC = {
  // Prvi dan vodiča (ponedjeljak). Prije toga vodič samo pokazuje plan za taj dan.
  startDate: '2026-10-05',
  // Redoslijed priča (id iz content/stories).
  storyOrder: ['kyushu-001', 'putovanje-po-japanu-001', 'japanske-zeljeznice-001'],

  // Koraci običnog dana (75 min) i skraćenog plana (20 min).
  day: [
    { id: 'rijeci', minutes: 7 },
    { id: 'zagrijavanje', minutes: 7 },
    { id: 'nove', minutes: 25 },
    { id: 'cisto', minutes: 3 },
    { id: 'konjugator', minutes: 10 },
    { id: 'nove-rijeci', minutes: 8 },
    { id: 'citanje', minutes: 15 },
  ] as { id: StepId; minutes: number }[],
  short: [
    { id: 'rijeci', minutes: 5 },
    { id: 'zagrijavanje', minutes: 5 },
    { id: 'dorada', minutes: 10 },
  ] as { id: StepId; minutes: number }[],
  // Nedjelja: samo ponavljanje (sve gotove priče kojima je rok, konjugator 15 min, mjerenje čitanja).
  sunday: [
    { id: 'rijeci', minutes: 10 },
    { id: 'zagrijavanje', minutes: 25 },
    { id: 'cisto', minutes: 3 },
    { id: 'konjugator', minutes: 15 },
    { id: 'citanje', minutes: 15 },
  ] as { id: StepId; minutes: number }[],
  // Subota: test cijele priče umjesto novih rečenica.
  saturdayReplaces: { nove: 'test-price' } as Partial<Record<StepId, StepId>>,

  // Nove rečenice dnevno, i pravilo za treću.
  newPerDay: 2,
  third: { withinMinutes: 15, failStreakDays: 3, backoffDays: 7 },
  // Rokovi ponavljanja gotove rečenice (dani), zatim svakih zadnji. Neuspjeh vraća na prvi.
  reviewIntervals: [1, 3, 7, 14, 30],
  // Nakon toliko propuštenih dana, prvi dan je samo ponavljanje (bez novih rečenica i riječi).
  missedDaysForReviewOnly: 3,

  // Konjugator: redovi tablice iz plana (novo + za mix). Vodič kreće od reda `konjugatorStartRow` (0 = prvi).
  // Prvih `storyWordsDays` dana priče izvor su riječi iz priča, zatim svih 495.
  konjugatorRows: [
    { new: ['masu', 'masen'], mix: [] },
    { new: ['mashita', 'masendeshita'], mix: ['masu', 'masen'] },
    { new: ['te'], mix: ['masu', 'masen', 'mashita', 'masendeshita'] },
    { new: ['ta'], mix: ['te', 'mashita'] },
    { new: ['nai', 'nakatta'], mix: ['te', 'ta'] },
    { new: ['i-desu', 'i-nai', 'i-ta', 'i-nakatta', 'na-desu', 'na-nai', 'na-ta', 'na-nakatta'], mix: ['nai', 'ta'] },
    {
      new: ['i-te', 'i-adv', 'na-te', 'na-adv', 'na-noun'],
      mix: ['masu', 'masen', 'mashita', 'masendeshita', 'te', 'ta', 'nai', 'nakatta'],
    },
    { new: ['tai', 'potential'], mix: ['te', 'nai'] },
    { new: ['volitional', 'ba', 'i-ba'], mix: ['tai', 'potential'] },
    { new: ['passive'], mix: ['ba', 'nai'] },
    { new: ['causative'], mix: ['passive'] },
    { new: [], mix: [], all: true },
  ] as { new: string[]; mix: string[]; all?: boolean }[],
  konjugatorStartRow: 2, // ～て (uljudne oblike već znam)
  storyWordsDays: 3,
  // Prelazak na idući red: toliko sesija zaredom s barem 9/10 "Znao" u oblicima reda.
  konjugatorPassSessions: 2,

  // Korak 1, ponavljanje riječi: zadnjih N dodanih, pa M nasumičnih starijih. Riječ s toliko "Nisam"
  // zaredom ide sutra na početak.
  wordReview: { recent: 25, older: 10, nisamStreakForTomorrow: 2 },
  // Subota: priča je gotova ako padne najviše ovoliko rečenica; inače neuspjele idu na doradu.
  storyTestMaxFails: 2,
  // Traka "Naruči novu priču" kad u redu ostane manje od ovoliko neučenih rečenica.
  orderStoryBelow: 10,
  // Teme novih priča s gramatičkom metom (plan učenja), redom.
  storyTopics: [
    { tema: 'Kupnja karte za shinkansen na postaji', meta: '～たいです, ～をください, brojevi i sati' },
    { tema: 'Dolazak u Nagasaki, traženje hotela', meta: '～ている (stanje i radnja u tijeku)' },
    { tema: 'Ručak: 博多ラーメン, naručivanje', meta: '～てもいいですか, ～ないでください' },
    { tema: 'Onsen u Beppuu', meta: '～たことがある, ～たり～たり' },
    { tema: 'Vrijeme se mijenja, kišobran', meta: '～と思う, ～でしょう' },
    { tema: 'Pitanje za put, izgubljen na postaji', meta: '～たら, ～と (uvjet), smjerovi' },
    { tema: 'Suveniri i darovi', meta: 'あげる / くれる / もらう' },
    { tema: 'Usporedba Kyota i Zagreba', meta: '～より, ～のほうが, ～がいちばん' },
    { tema: 'Vlak kasni, promjena plana', meta: '～なければならない, ～てしまう' },
    { tema: 'Razgovor s Japancem u vlaku', meta: '～そうだ, ～らしい, ～ようだ (N3)' },
    { tema: 'Prenoćište kod obitelji, uljudnost', meta: 'osnove keigoa: いらっしゃる, いただく' },
    { tema: 'Planiranje sljedećeg putovanja', meta: '～ようと思う, ～つもり, ～ようにする (N3)' },
  ],
  // Tjedni izvještaj: najviše ovoliko redaka.
  reportMaxLines: 25,
}

export type VodicConfig = typeof VODIC
