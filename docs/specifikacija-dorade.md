# Specifikacija dorada – aplikacija za shadowing japanskog

Aplikaciju razvijam sam i za sebe. Ovaj dokument opisuje dorade poredane redom izrade, a uz svaku stoji kad se smatra gotovom. Prateći dokument je `japanski-plan-ucenja.md`: plan učenja iz kojeg su ove potrebe izašle.

## Kontekst za implementaciju

- **Korisnik:** jedan (ja). Cilj je za godinu dana (do listopada 2027.) doći do govora i razumijevanja na razini vokabulara N5+N4 i gramatike do N3. Metoda je shadowing.
- **Uređaj:** Android, Firefox, PWA instalirana na početni zaslon. Mora raditi **offline**.
- **Glas:** Nanami (TTS). Blokovi rečenica snimljeni su zasebno.
- **Namjerno izvan opsega:** pisanje japanskog, tipkanje odgovora, bodovanje, testovi s bodovima. Bilješke na hrvatskom su u redu.
- **U izradi (ne dirati bez dogovora):** FSRS kartice, slobodno vježbanje, popis gramatike. Dorade dolje moraju se moći kasnije spojiti s njima (vidi „Ovisnosti”).

### Pravila rada za Claude Code

1. Prije bilo kakve izmjene pročitaj postojeći kod i opiši gdje bi dorada sjela (audio, pohrana, zasloni).
2. Jedna dorada = jedan zaseban commit (ili grana). Postojeće ponašanje ne mijenjaj osim ako to dorada izričito traži.
3. Sve što se sprema lokalno ide kroz verzionirani format s migracijom. Postojeći podaci (Moje riječi) ne smiju se izgubiti.
4. Sve mora raditi offline. Ako nešto traži mrežu (npr. generiranje izgovora), označi to i ponudi offline zamjenu.
5. Nakon svake dorade napiši kako da je ručno provjerim na mobitelu (koraci od 1 do N).

---

## Redoslijed izrade

| # | Dorada | Zašto ovim redom |
| --- | --- | --- |
| 1 | Izvoz / uvoz podataka | Zaštita podataka prije svega ostalog; isti format kasnije nosi FSRS |
| 1V | **Vodič: Današnji trening** (uključuje status rečenice iz dorade 4) | Glavna dorada: aplikacija vodi učenje po pravilima plana. Prva verzija radi s postojećim alatima, a dorade 2–9 joj kasnije samo skraćuju korake |
| 1K | **Konjugator: Znao/Nisam uvijek + slabe točke** | Svaki odgovor se bilježi, i u vodiču i u slobodnom vježbanju; vodič iz toga bira što vježbati |
| 2 | Shadowing: podesiva stanka + petlja bez stanke | Mala izmjena audio-petlje, temelj za doradu 3 |
| 3 | Vođena sesija shadowinga | Najveći dobitak za svakodnevno učenje |
| 4 | Status rečenice + „Nastavi gdje sam stao” | Potrebno planu i kasnije karticama fraza |
| 5 | Konjugator: novi oblici | Pokriva N4–N3 oblike koji fale |
| 6 | Konjugator: način „na sluh” i „obrnuto” | Vježba razumijevanja, ne samo proizvodnje |
| 7 | Slušni način u priči + skrivanje romajija | Male dorade; kanu čitam sporo, pa romaji ne smije biti štaka |
| 8 | Furigana samo za nepoznate riječi | Međukorak prema Čistom načinu |
| 9 | Popis riječi: „Sljedećih 8” i teme | Ubrzava dnevni korak dodavanja riječi |
| 10 | Provjera novih priča (validator) | Svaka priča košta, pa neka bude ispravna prvi put |
| 11 | Tonski naglasak | Treba izvor podataka |
| 12 | Niži prioritet: drugi glas, kanji na hrvatskom, bilješka uz rečenicu | — |
| 13 | Za razmisliti: snimanje sebe bez ocjene | Moja odluka; tehnički izvedivo |

---

## 1. Izvoz / uvoz podataka

**Cilj:** sve što je spremljeno samo na mobitelu može se spremiti u datoteku i vratiti.

**Ponašanje**
- Gumb „Izvezi” stvara JSON datoteku `japanski-backup-YYYY-MM-DD.json` i nudi je za preuzimanje.
- Sadržaj: `formatVersion`, `exportedAt`, Moje riječi (uključujući ručno upisane), status rečenica (dorada 4), postavke (brzina, sheme vođene sesije). Kasnije i FSRS stanje.
- Gumb „Uvezi” otvara odabir datoteke i nudi dvije opcije: **Spoji** (dodaj što nedostaje, postojeće ne briši) ili **Zamijeni** (uz potvrdu).

**Rubni slučajevi**
- Duplikati riječi: ista riječ s popisa prepoznaje se po ID-u, a ručno upisana po paru (pismo, čitanje).
- Stariji `formatVersion` se migrira, a noviji od podržanog odbija se s jasnom porukom.
- Neispravna datoteka ne smije ništa promijeniti.

**Gotovo kada:** izvezem, obrišem podatke aplikacije, uvezem i sve je natrag. Spoji na istoj datoteci dvaput ne stvara duplikate.

## 1V. Vodič: Današnji trening

**Cilj:** aplikacija svaki dan sama složi trening i provede me kroz njega korak po korak. Svaku odluku (što je novo, je li rečenica gotova, kad novi oblik u konjugatoru, kad nova priča, kad nova faza) donosi po pravilima ispod, a ne po mom mišljenju. Ja samo izvršavam korake i odgovaram na konkretna da/ne pitanja.

**Načelo:** samoprocjena ostaje jedina ocjena, ali je pretvorena u konkretna pitanja na koja se može odgovoriti činjenicom („Jesi li igdje zastao?”), nikad u „Kako je išlo?”. Brojevi točnih odgovora služe samo vodiču za odluke. Ne prikazuju se kao bodovi ni statistika.

### Početni zaslon

Gumb **„Današnji trening (75 min)”** i ispod njega popis koraka za danas s minutama. Uz to dva gumba: **„Imam samo 20 min”** (skraćeni plan) i **„Nastavi”** (ako je trening prekinut, nastavlja od istog koraka).

### Dnevni trening (redom)

Svaki korak ima odbrojavanje, upute u jednoj rečenici i gumb koji otvara pravi alat s već postavljenim postavkama (priča, rečenica, brzina, oblici). Kad vrijeme istekne, korak se završava tek kad potvrdim da sam ga završio ili kad odgovorim na njegova pitanja.

| # | Min | Korak | Što vodič radi sam | Pitanja / odluka |
| --- | --- | --- | --- | --- |
| 1 | 7 | Ponavljanje riječi | Prikazuje riječi jednu po jednu sa skrivenim značenjem: prvo zadnjih 25 dodanih, pa 10 nasumičnih starijih. Kad stignu FSRS kartice, ovaj korak ide na njih | Dodir otkriva značenje, pa „Znao sam / Nisam”. Riječ s 2 „Nisam” zaredom ide u sutrašnje ponavljanje |
| 2 | 7 | Zagrijavanje | Bira rečenice kojima je danas rok ponavljanja (raspored niže) | Po rečenici: „Uz Nanami na 1× bez zastajanja?” Ne → rok ponavljanja se vraća na 1 dan |
| 3 | 25 | Nove rečenice | Uzima sljedeće 2 rečenice sa statusom „nova” iz tekuće priče i vodi kroz faze A–D (brzine, petlja i broj krugova zadani, kao u planu) | Na kraju faze D tri pitanja (niže). Treću rečenicu nudi sam po pravilu za brži tempo |
| 4 | 3 | Čisto test | Otvara jučerašnje nove rečenice u Čistom načinu | „Pročitao naglas bez zastajanja i bez furigane?” Da → status „gotova”. Ne → ostaje „u radu” i ide u sutrašnju fazu D |
| 5 | 10 | Konjugator | Uključuje oblike tjedne faze (tablica konjugatora iz plana) i izvor riječi (prva 3 dana priče, zatim svih 495). Polovicu zadataka bira iz slabih točaka (dorada 1K) | Nakon svakog „Pokaži”: „Znao / Nisam” (znao = točno i bez dugog razmišljanja). Vodič broji |
| 6 | 8 | Nove riječi | Nudi „Sljedećih 8”, prednost imaju riječi iz tekuće priče | Za svaku: poslušaj, ponovi 3×, ☆ |
| 7 | 15 | Čitanje | 5 min hladno čitanje sutrašnjih rečenica, 5 min brzo čitanje gotovih, 5 min riječi s pokrivenim romajijem | Nedjeljom: štoperica u vodiču mjeri čitanje cijele poznate priče, a vrijeme se sprema |

**Pitanja na kraju faze D** (sva tri moraju biti „Da”):
1. Jesi li cijelu rečenicu izgovorio uz Nanami na 1× bez zastajanja?
2. Jesi li ostao unutar jednog sloga iza nje?
3. Znaš li bez gledanja reći što rečenica znači?

Ako je sve „Da”, rečenica dobiva status „u radu (D prošla)” i sutra ide na Čisto test. Ako nije, vodič vraća na fazu C za tu rečenicu, s jednim dodatnim krugom D. Ako i drugi put nije prošla, rečenica ostaje za sutra kao prva nova i danas se ne uzima nijedna druga.

### Pravila odlučivanja (vodič ih primjenjuje sam)

| Odluka | Pravilo |
| --- | --- |
| Treća nova rečenica | Ako su obje nove prošle fazu D unutar prvih 15 min koraka 3, vodič nudi treću (stanje se pamti). Ako treća rečenica 3 dana zaredom ne prođe D prvi put, vodič se vraća na 2 dnevno idućih 7 dana |
| Raspored ponavljanja gotove rečenice | Rok nakon 1, 3, 7, 14, 30 dana, zatim svakih 30. Neuspjeh u zagrijavanju vraća na 1 dan |
| Priča gotova (subota) | Vodič pušta cijelu priču na 1× u Čistom i po rečenici pita „Uz Nanami bez više od jednog zapinjanja?”, a zatim slušanje bez ekrana: „Razumio sam svaku rečenicu?” Najviše 2 neuspjele rečenice → priča gotova i sljedeća iz reda počinje u ponedjeljak. Više → neuspjele rečenice dobivaju 2–3 dana dorade, nova priča čeka |
| Nedjelja | Samo ponavljanje: sve gotove priče kojima je rok, konjugator 15 min, riječi samo ponavljanje, mjerenje čitanja |
| Novi oblik u konjugatoru | Dvije sesije zaredom s barem 9/10 „Točno” → vodič prelazi na sljedeći red tablice konjugatora. Ako tjedan prođe bez toga, oblik ostaje |
| Narudžba nove priče | Kad u redu ostane manje od 10 neučenih rečenica, na početnom zaslonu se pojavi traka „Naruči novu priču” sa sljedećom temom i gramatičkom metom s popisa iz plana (i brojem blokova po rečenici za trenutnu fazu) |
| Faza | Na kraju svake faze vodič provodi provjeru te faze iz godišnjeg plana kroz da/ne pitanja i mjerenja. Prošla → sljedeća faza (mijenja se dozvoljena složenost priča). Nije prošla → faza traje još 2 tjedna, zatim nova provjera |
| Propušteni dani | Propušteno se ne nadoknađuje. Nakon 1–2 propuštena dana trening je normalan; nakon 3 i više, prvi dan je samo ponavljanje, bez novih rečenica |
| „Imam samo 20 min” | Korak 1 (5 min), korak 2 (5 min), dorada rečenica u radu bez novih (10 min). Konjugator i riječi taj dan otpadaju |

### Tjedni izvještaj za Claudea

Nedjeljom, na kraju treninga, vodič nudi gumb **„Kopiraj tjedni izvještaj”**. Kopira kratak tekst koji zalijepim u razgovor s Claudeom, a Claude prema njemu prilagodi plan ili pravila. Sadržaj:
- tjedan i faza, tekuća priča, rečenice gotove ovaj tjedan i ukupno;
- rečenice koje su pale 2 ili više puta (tekst rečenice);
- red konjugatora i broj sesija iznad 9/10;
- 5 najslabijih točaka konjugatora (oblik + pravilo, postotak „Nisam” u zadnjih 20 pokušaja) i riječi koje stalno padaju;
- broj riječi u Moje riječi i riječi s najviše „Nisam”;
- vrijeme čitanja priče (ovaj i prošli tjedan);
- propušteni dani i koliko je puta korišten skraćeni plan.

### Podaci

Lokalno i verzionirano, uključeno u izvoz (dorada 1): datum početka, faza, tjedan, red priča i tekuća priča, po rečenici status, datum završetka i sljedeći rok ponavljanja, red konjugatora i dnevni zbrojevi, riječi s brojem „Nisam”, vremena čitanja, dnevnik dana (koji koraci su odrađeni).

Pravila (minute, granice, rokovi ponavljanja, tablica konjugatora, popis tema priča) drže se u jednoj konfiguracijskoj datoteci, a ne razbacana po kodu. Tako se nakon tjednog razgovora s Claudeom mijenja samo ta datoteka.

### Prva verzija (MVP)

Vodič mora raditi i prije dorada 2–9. U koracima koji traže alat koji još ne postoji (vođena sesija, „Sljedećih 8”, skrivanje romajija) prikazuje uputu što da učinim ručno u postojećem alatu. Kad dorada stigne, korak se skraćuje na „otvori i kreni”.

**Gotovo kada:**
- Cijeli tjedan (pon–ned) mogu odraditi samo prateći vodič, bez gledanja u plan i bez ijedne vlastite odluke.
- Pravila iz tablice „Pravila odlučivanja” pokrivena su testovima (npr. simulirani tjedan s propuštenim danima, neuspjelim rečenicama i prelaskom oblika).
- Izmjena vrijednosti u konfiguracijskoj datoteci mijenja ponašanje bez izmjene koda.
- Tjedni izvještaj je kraći od 25 redaka i razumljiv bez aplikacije.

## 1K. Konjugator: Znao/Nisam uvijek i slabe točke

**Cilj:** konjugator uvijek bilježi gdje zapinjem, i u vodiču i kad ga otvorim izvan lekcija. Vodič onda više vježba ono što ne ide.

**Ponašanje**
- Nakon „Pokaži” pojavljuju se dva gumba: **Znao** i **Nisam**. Sljedeći zadatak dolazi tek nakon jednog od njih. Gumb „Preskoči” postoji, ali se ne bilježi.
- „Znao” znači da je odgovor bio točan i izgovoren bez dugog razmišljanja (oko 3 s). To piše malim slovima ispod gumba.
- Tijekom vježbanja nema prikaza bodova ni postotaka. Bilježenje radi u pozadini.

**Što se bilježi po pokušaju:** vrijeme, riječ, vrsta riječi (godan / ichidan / nepravilni / i-pridjev / na-pridjev), traženi oblik, **pravilo** (isto ono koje „Pokaži” već prikazuje, npr. „godan ～く → ～いて”, „iznimka 行く → 行って”), smjer (proizvodnja / obrnuto / na sluh), izvor (vodič / slobodno) i rezultat.

**Slaba točka** = kombinacija *oblik + pravilo* (i, odvojeno, pojedina riječ):
- postaje slaba kad u zadnjih 20 pokušaja ima barem 5 pokušaja i 30 % ili više „Nisam”;
- prestaje biti slaba kad je zadnjih 10 pokušaja barem 90 % „Znao”;
- riječ je slaba ako je pala 2 od zadnja 3 puta.

Granice su u konfiguracijskoj datoteci vodiča.

**Kako se koristi**
- **Vodič:** u koraku konjugatora polovica zadataka dolazi iz slabih točaka unutar oblika koji su uključeni. Riječ na koju odgovorim „Nisam” vraća se u istoj sesiji nakon otprilike 5 drugih zadataka.
- **Slobodno vježbanje:** novi izvor „Moje slabe točke” uz postojeće „sve N5+N4” i „samo iz priča”.
- **Zaslon „Gdje zapinjem”:** popis do 10 slabih točaka (oblik + pravilo, primjer riječi, „Nisam” u zadnjih 20) i do 10 slabih riječi. Bez grafova i povijesti. Dodir na stavku pokreće vježbu samo te točke.
- **Svi pokušaji vrijede jednako**, bez obzira jesu li iz vodiča ili iz slobodnog vježbanja: i za slabe točke i za napredovanje (novi oblik nakon dvije sesije s barem 9/10 u oblicima tekućeg reda). Sesija je svako otvaranje konjugatora s barem 10 odgovora.
- Dnevnik pokušaja ide u izvoz (dorada 1). Ako naraste preko 20 000 zapisa, stariji se sažimaju u zbrojeve po slaboj točki.

**Gotovo kada:**
- Nakon 20 namjerno pogrešnih odgovora na jednom pravilu (npr. ～く → ～いて), ono se pojavi u „Gdje zapinjem” i u vodiču dolazi češće.
- Nakon 10 točnih zaredom nestane s popisa.
- Pokušaji iz slobodnog vježbanja i iz vodiča jednako ulaze i u slabe točke i u napredovanje.

## 2. Shadowing: podesiva stanka i petlja bez stanke

**Cilj:** pravi shadowing znači govoriti istovremeno sa zvukom. Sadašnja stanka služi samo za ponavljanje nakon zvuka.

**Ponašanje**
- Postavka „Stanka” s vrijednostima **0 (preklapanje)**, 1×, 1,5× i 2×. Stanka = trajanje odsviranog dijela × faktor + 0,5 s. Kod 0 nema stanke ni dodatnih 0,5 s.
- Za vrijednosti iznad 0 oznaka „🗣️ Ponovi” ostaje kao sada.
- Postavka se pamti i vrijedi i za blok i za rečenicu.

**Gotovo kada:** na 0 se rečenica vrti bez praznine, a na 2× stanka traje dvostruko duže od rečenice. Sve radi sa zaključanog zaslona.

## 3. Vođena sesija shadowinga

**Cilj:** faze iz plana (0.85× ponavljanje → 1× shadowing) bez dodirivanja ekrana, npr. u šetnji sa slušalicama.

**Ponašanje**
- Odabir: priča, raspon rečenica (od–do) i shema.
- Shema je popis koraka, npr. `[{brzina: 0.85, ponavljanja: 3, stanka: 1}, {brzina: 1, ponavljanja: 4, stanka: 0}]`. Gotove sheme: „Učenje” (0.7 blokovi → 0.85 → 1), „Dorada” (0.85 ×2 → 1 ×4) i „Održavanje” (1 ×3). Sheme se mogu uređivati i spremiti.
- Opcionalni korak „po blokovima”: prije cijele rečenice svaki blok N puta.
- Nakon zadnjeg koraka sesija ide na sljedeću rečenicu. Između rečenica može se uključiti kratak zvučni signal.
- Kontrole na zaključanom zaslonu i slušalicama (Media Session API): play/pauza, sljedeća rečenica (preskače ostatak sheme), prethodna rečenica (počinje je ispočetka).
- Prikaz prati rečenicu i korak („2/3 · 0.85×”).

**Rubni slučajevi:** dolazni poziv ili gubitak audio-fokusa pauzira sesiju. Nastavak kreće od početka tekuće rečenice.

**Gotovo kada:** odabrem rečenice 1–8 i shemu „Dorada”, zaključam mobitel i cijela sesija prođe do kraja bez dodira, s ispravnim brzinama i stankama.

## 4. Status rečenice i „Nastavi gdje sam stao”

> Ako je Vodič (1V) već izgrađen, ovo je već uključeno u njega; ovdje ostaje samo ručna izmjena statusa iz zaslona priče.

**Cilj:** bilježenje kriterija „rečenica gotova” iz plana. Ovo nije statistika: sam postavljam status.

**Ponašanje**
- Svaka rečenica ima status **nova / u radu / gotova**, koji mijenjam dodirom (npr. kružić uz broj rečenice).
- U popisu priča uz svaku stoji „5/8 gotovo”.
- Na početnom zaslonu je gumb „Nastavi”, koji otvara zadnju priču na zadnjoj rečenici.
- Status se sprema lokalno i ulazi u izvoz (dorada 1).

**Ovisnost:** kasnije kartice fraza mogu se stvarati iz rečenica sa statusom „gotova”.

**Gotovo kada:** status preživi zatvaranje aplikacije, a „Nastavi” me vrati točno gdje sam stao.

## 5. Konjugator: novi oblici

**Cilj:** najčešći govorni oblici koji danas fale.

**Novi oblici** (svaki se uključuje/isključuje kao postojeći):

| Oblik | Primjer | Napomene / iznimke |
| --- | --- | --- |
| ～ている / ～ています | 食べている, 書いています | Iz te-oblika |
| ～たら | 行ったら, 高かったら, 静かだったら | Glagoli i oba tipa pridjeva |
| ～なら | 行くなら, 高いなら, 静かなら | Na-pridjev bez だ |
| imperativ (命令形) | 書け, 食べろ, しろ, 来い | Napomena „grubo, rijetko u uljudnom govoru” |
| ～そう (izgleda kao) | 降りそう, 高そう, 静かそう | いい → よさそう, ない → なさそう |
| ～てしまう | 食べてしまった | Opcionalno prikaži i ～ちゃう |
| ～てもいい | 入ってもいいですか | — |
| ～なければならない | 行かなければならない | Opcionalno prikaži ～なきゃ |

**Za sve oblike:** nepravilni する / 来る, 行く → 行って / 行った, ある (niječno ない), いい → よ- osnova. Za svaki odgovor vrijedi isti prikaz kao danas: oblik, čitanje, romaji, pravilo i hrvatsko značenje.

**Izgovor:** ako se izgovor generira, treba ga generirati i spremiti unaprijed za sve kombinacije koje uključim, da radi offline. Ako to nije moguće, izgovor odgovora mora barem raditi online i to treba jasno označiti.

**Gotovo kada:** za svaki novi oblik provjeren je uzorak od 20 nasumičnih riječi, uključujući sve nepravilne.

## 6. Konjugator: „na sluh” i „obrnuto”

**Cilj:** prepoznavanje oblika koje čujem, jer je to moj glavni fokus.

**Ponašanje**
- Izbornik smjera: **Proizvodnja** (današnji način), **Obrnuto** (vidim npr. 食べられなかった, kažem osnovni oblik i značenje) i **Na sluh** (čujem oblik bez teksta, kažem osnovni oblik i značenje; „Ponovi zvuk” je dostupan).
- „Pokaži” otkriva osnovni oblik, naziv oblika i hrvatsko značenje.
- Filtri oblika i izvora riječi isti su kao u proizvodnji.

**Gotovo kada:** sva tri smjera rade s istim filtrima, a „Na sluh” ne pokazuje nikakav tekst prije „Pokaži”.

## 7. Slušni način u priči

**Ponašanje:** prekidač „Samo zvuk”. Tekst rečenice je skriven i vide se samo obrisi blokova. Dodir na rečenicu otkriva tekst, a sljedeća rečenica opet je skrivena. Radi i s ▶ Cijela priča i s vođenom sesijom.

**Gotovo kada:** cijelu priču mogu odslušati bez ijednog vidljivog japanskog znaka, a otkriti mogu svaku rečenicu posebno.

### 7b. Skrivanje romajija

**Cilj:** kanu čitam sporo i vježbam čitanje 15 min dnevno. Romaji mi stalno nudi prečac.

**Ponašanje:** globalni prekidač „Romaji: prikaži / sakrij / na dodir”. Vrijedi za prijevod u priči, Rendgen, popis riječi, Moje riječi i konjugator. U načinu „na dodir” romaji je zamućen dok ga ne dodirnem.

**Gotovo kada:** uz „sakrij” nigdje u aplikaciji nema romajija, a sve ostalo radi kao prije.

## 8. Furigana samo za nepoznate riječi

**Ponašanje:** postavka furigane s tri vrijednosti: **sve / samo nepoznate / ništa**. „Ništa” nije isto što i Čisto, jer boje i ostalo ostaju. Poznata riječ je ona koja je u Moje riječi (kasnije: FSRS kartica sa stabilnošću iznad praga).

**Rubni slučajevi:** povezivanje riječi u rečenici s riječju na popisu ide preko osnovnog oblika koji Rendgen već zna. Riječ koja nije na popisu uvijek dobiva furiganu.

**Gotovo kada:** kad dodam riječ u Moje riječi, njezina furigana nestane u svim pričama, a kad je maknem, vrati se.

## 9. Popis riječi: „Sljedećih 8” i teme

**Ponašanje**
- Gumb „Sljedećih 8”: prvih 8 riječi odabrane razine (N5/N4) kojih nema u Moje riječi, redom popisa (ili po učestalosti ako taj podatak postoji). Uz njih ide „Dodaj sve” i dodavanje jedne po jedne.
- Oznake tema (hrana, putovanje, vlak, vrijeme, smjerovi, brojevi i vrijeme na satu, ljudi, kupovina…) i filter po temi.

**Podaci:** oznake za 1304 riječi treba generirati jednom (skriptom) i ručno pregledati. Riječ može imati više tema.

**Gotovo kada:** „Sljedećih 8” nikad ne nudi riječ koja je već u Moje riječi, a svaka riječ ima bar jednu temu.

## 10. Provjera novih priča (validator)

**Cilj:** svaka nova priča košta, pa se prije uvoza mora provjeriti automatski.

**Provjere** (skripta ili zaslon pri uvozu priče):
- 7–8 rečenica (kasnije 10–12; ograničenje je podesivo).
- Svaka riječ je ili na N5/N4 popisu ili ručno odobrena. Izvještaj ispisuje sve riječi izvan popisa.
- Udio poznatih riječi (iz Moje riječi + prethodnih priča) je oko 80 %, a broj novih je ispisan.
- Zadana gramatička meta pojavljuje se u bar 2 rečenice i ima ✦ formulu.
- Svaki blok ima ulogu, doslovni prijevod, romaji i audio. Postoji i prirodni prijevod rečenice.

**Ulaz za narudžbu priče** (predložak): tema, gramatička meta, popis poznatih riječi, broj rečenica, likovi i nastavak prethodne priče.

**Gotovo kada:** priča s jednom riječju izvan popisa ili bez gramatičke mete ne prolazi i dobivam jasan izvještaj zašto.

## 11. Tonski naglasak

**Ponašanje:** prekidač „Naglasak”. Iznad riječi crta pokazuje visoko/nisko po morama. Pod Rendgenom se prikazuje i tip naglaska.

**Podaci:** treba otvoreni izvor podataka o naglasku za riječi s popisa. Prije upotrebe provjeri licencu. Riječi bez podatka ostaju bez crte.

**Gotovo kada:** riječi s podatkom imaju ispravnu crtu, a riječi bez podatka ne prikazuju ništa i ne pucaju.

## 12. Niži prioritet

- **Drugi glas (muški) i priče u dijalogu:** svaka rečenica dobiva polje `govornik` koje određuje glas. Ako TTS servis nudi muški japanski glas, koristi njega.
- **Značenje kanjija na hrvatskom:** jednokratni prijevod (skriptom) za sve kanjije u N5/N4 riječima, uz ručni pregled. Engleski može ostati kao drugi redak.
- **Bilješka uz rečenicu:** kratki tekst na hrvatskom (npr. „pazi na っ”), vidljiv pod rečenicom i uključen u izvoz.

## 13. Za razmisliti: snimanje sebe bez ocjene

Ranije sam to isključio, ali nema automatske ocjene, pa je izvedba jednostavna: gumb snima moj pokušaj (MediaRecorder), a zatim pušta **original pa moj snimak**. Snimka se ne sprema, osim ako to izričito zatražim. Treba dozvolu za mikrofon i HTTPS. Ovo je jedino što rješava „ne čujem kako zvučim”.

---

## Ovisnosti s dijelovima u izradi

- **FSRS kartice:** koriste format izvoza iz dorade 1, statuse rečenica iz dorade 4 (kartice fraza iz „gotovih” rečenica) i „poznatost” riječi za doradu 8.
- **Popis gramatike:** ✦ formule u pričama i gramatička meta iz validatora (dorada 10) trebaju upućivati na istu stavku u popisu gramatike, i to u oba smjera.
