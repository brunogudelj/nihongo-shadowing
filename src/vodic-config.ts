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
