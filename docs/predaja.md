# Predaja: gdje smo stali (27. 10. 2026.)

Ovaj dokument služi da nastaviš bez prepričavanja. U novom razgovoru s Claudeom napiši:

> Pročitaj docs/predaja.md i nastavi.

Sve je spremljeno i poslano na GitHub. Rad ide i **s mobitela**: Claude aplikacija (Claude piše kod i otvara pull request) → GitHub aplikacija (spoji PR) → aplikacija se objavi za 2 do 3 minute. Codespace je rezerva; ako radiš u njemu, prvo `git checkout main` i `git pull`.

---

## 1. Što je napravljeno 17. 10.

| PR | Što |
|---|---|
| #1 | Nakon „Pokaži” (Ponavljanje riječi, blok Riječi) rečenica iz priča s tom riječju: furigana, 🔊, prijevod na dodir. |
| #2 | 5 novih tema (avion, ramen, hrvatska hrana, Mirko Filipović, Incheon); nove priče same ulaze u sesije. **Emoji uz riječi** (1199 od 1304). **📰 Vijest dana** (blok u sesiji, bez kartica, brisanje nakon 30 dana). |
| #3 | „Nova priča” prima više tema odjednom (odvojenih zarezom). |
| #4 | **Light i fat priče**; Vijest dana svako jutro (Haiku); furigana 日本 = にほん; strana imena u katakani ne ruše fond. |

## 1a. Što je napravljeno 27. 10.

| PR | Što |
|---|---|
| #6 | **Player kao glazbeni player**: tanka gornja traka (← i naslov), jedan red kontrola s ikonama, **jedan gumb za brzinu** (1 → 0.85 → 0.7), traka napretka. Vodoravni zaslon je glavni. |
| #7 | Vodoravno: player lijevo, točkice/status/あ/razina desno; uspravno: te kontrole su red iznad playera. Gumb **あ** pali/gasi furiganu. Novi zaslon **📐 Oblici** (lekcija o te-obliku). |
| #8 | あ u svim razinama pomoći (svaka pamti svoj izbor) i na zaslonu Oblici. **Memento**: stupac kane, osnova u boji (a/i/u/e/o, te), nastavak, gotov oblik (行き+ます). |
| #9 | 📐 Oblici kreću od **oblika i konstrukcija iz tvojih priča**: kartice *oblici* (28 oblika po učestalosti, pravilo + rečenice iz priča s 🔊), *konstrukcije* (✦ iz priča, po značenju: mišljenje, usporedba, opis imenice, uzrok, promjena stanja…), *memento*. Vijesti su postale obične priče. Testova: 96. |

Kod: `src/StoryPlayer.tsx` (player), `src/Forms.tsx` (zaslon Oblici), `src/grammar-index.ts` (konstrukcije i primjeri oblika), `src/stems.ts` (osnove glagola).

Sadržaj: 5 novih light priča (Opus, ukupno 2,08 $), ramen fat (0,62 $), dvije probne vijesti (Haiku 0,02 $, Opus 0,30 $). Testova: 92.

### Razine priča (dogovoreno)
- **light**: 5 do 8 kratkih rečenica (10 do 30 znakova), N5/N4. Sve starije priče.
- **fat**: točno 5 duljih, povezanih rečenica (25 do 45 znakova), uglavnom N4; piše se na temelju light priče iste teme.
- U sesijama tema po tema: light → fat; fat dolazi tek kad su sve rečenice light priče upoznate.
- Vijesti su uvijek fat. Pokretanje: Actions → Nova priča → tema(e) → razina.

### Vijesti (ugašeno 27. 10.)
- Automatske vijesti su maknute (teme se nisu mogle kontrolirati): nema robota, bloka 📰, arhive ni brisanja.
- Već napisane vijesti (tema `vijesti`) su **obične priče**: u 📚 Pričama, u redu sesija (tema po tema, light pa fat), s karticama i primjerima u 📐 Oblici.
- Ideja ako se vrati: 📅 Priča dana iz vlastitih tema (robot svako jutro piše iduću light/fat priču po redu tema).

## 2. Kako sesije rade (dogovoreno)

- **Svaka sesija je za sebe.** Nema dnevnog plana. Jedina veza među sesijama su **FSRS kartice** i dnevno ograničenje novih: **3 nove fraze i 10 novih riječi** dnevno.
- **Trajanje:** 5 min = 1 blok, 10 min = 1 ili 2 bloka, 15 min = 2 ili 3 bloka. Zbroj je uvijek točan.
- **Blokovi** se biraju nasumično, bez ponavljanja u istoj sesiji, i nasumičnim redom:

| Blok | Minute | Što |
|---|---|---|
| 🔁 Riječi | 5 | riječi na redu, pa nove. Pokaži → Znao / Nisam |
| 🗣️ Fraze | 5 | rečenice na redu, shadowing na 1×, Da / Ne |
| ✨ Nova rečenica | 10 | upoznaj → 3 kruga (0.7× s tekstom, 1× s tekstom, 1× bez teksta) → 3 pitanja |
| 📚 Priča | 10 | cijela tekuća priča u ista 3 kruga |
| 🔄 Konjugator | 5 | oblici tvog reda tablice, pola iz slabih točaka |
| 👀 Čitanje | 5 | čitanje naglas u Čistom načinu |
| 🎯 Nove riječi | 5 | Sljedećih 8 |

- **Ocjena:** samo Znao (= Good) / Nisam (= Again). Nova kartica: Znao → opet za 1 h, Nisam → za 10 min, zatim dani.
- **Zaštite:**
  - nudi se samo blok koji ima sadržaja;
  - kad je na redu više od 20 riječi ili 5 fraza, taj blok sigurno ulazi.
- **Brojač** broji sesiju tek kad stigneš do sažetka. Minute su stvarno proteklo vrijeme.
- **Snimanje sebe:** odgođeno (treći put).

Sve brojke se mijenjaju na jednom mjestu: `src/vodic-config.ts` (`KARTICE` i `SESIJA`).

## 3. Što je otvoreno

### A) Prijedlozi za kasnije (korisnik je odlučio: ne sada)
- **3. razina priče** (iznad fat): 5 duljih rečenica s **2 do 3 namjerne N3 konstrukcije**, nasumično s N3 popisa (`data/grammar-n3.json`, 101 točka), pisana na temelju fat priče. Sesije: light → fat → 3. razina. Ime još nije izabrano (prijedlozi: extra, pro, N3). Oko 0,60 $ po priči (Opus).
- **Slika u Ponavljanju riječi**: emoji u pozadini nije dovoljno dobar; naći bolje rješenje. U popisu riječi emoji je dobar.
- **Sesije od 30 i 45 min**: gumbi 5/10/15/30/45; ako ostane vremena, drugi krug blokova koji se smiju ponoviti (Riječi, Konjugator, Čitanje, Nove riječi), nikad isti blok zaredom.
- **📐 Gramatika sesije** (novi blok, 10 min, u sesijama od 30/45): jedna točka po sesiji. Kratko objašnjenje na hrvatskom s formulom, 4–6 primjera (furigana, zvuk, prijevod, ponovi naglas), mini kviz od 4 pitanja, Znao/Nisam → FSRS kartica (vrsta „gramatika”). Prvi skup: parovi prijelazni/neprijelazni glagoli (開ける/開く, 閉める/閉まる, つける/つく, 消す/消える, 始める/始まる, 止める/止まる, 入れる/入る, 出す/出る, 落とす/落ちる, 壊す/壊れる). Sadržaj piše Claude u pipelineu (10 točaka: ~1,5 $ Opus ili ~0,10 $ Haiku), zvuk Azure besplatno. Otvoreno: i u sesijama od 15 min? model?
- **Čisti način: dodir na riječ je izgovori.** Sada se u Čistom mora slušati cijela rečenica. Izvedba: pipeline izgovori svaku riječ priče zasebno (Azure, unutar besplatnog limita; rezanje snimke rečenice zvuči odsječeno), a dodir pusti taj mp3. Za riječi s popisa već postoji izgovor u `public/izgovor/`.
- **Fraze s glagolima** (📐 Oblici): koje čestice glagol traži, npr. AのBを手伝う (pomoći nekome s nečim), AにBを教える, AとBを比べる. Nema ih u pričama; Claude bi jednom prošao glagole iz priča (~150) i napisao frazu + primjer (~0,50 $ Haiku / ~3 $ Opus), zvuk besplatno.
- **💰 Potrošnja u aplikaciji**: pipeline zapisuje trošak (Anthropic, Azure znakovi), zaslon po mjesecima.

### B) Iduće (redom)
- Fat verzije ostalih tema (oko 0,60 $ po temi, Opus): Actions → Nova priča → npr. `incheon, hrvatska-hrana, mirko-filipovic, putovanje-avionom, kyushu, putovanje-po-japanu, japanske-zeljeznice` → razina fat.
- **Rečenice za kontekst u Konjugatoru** (kao kod riječi; besplatno iz priča).
- Rečenice za kontekst koje piše Claude (vidi stari plan: 2 rečenice po riječi, model po izboru).

### C) Od prije
- Tjedni izvještaj za Claudea prilagođen sesijama; čišćenje starog dnevnog vodiča (`planDay`, `Training.tsx`, `vodic-rules.ts`).
- Značenja oblika u konjugatoru za zadnjih 55 riječi (`npm run konjugator-znacenja`), pa maknuti „/la”.
- Zaslon s popisom gramatike (280 točaka).

## 4. Važne datoteke

| Datoteka | Što je u njoj |
|---|---|
| `src/vodic-config.ts` | sva pravila i brojke (`KARTICE`, `SESIJA`, konjugator, redoslijed priča) |
| `src/cards.ts` | FSRS: ocjena, kartice na redu, dnevna kvota, prijenos starog napretka |
| `src/vodic-plan.ts` | sastavljač sesije (`planSession`), brojač (`sessionStats`), popis riječi za blok, sažetak |
| `src/Training.tsx` | zaslon sesije (`SessionRun`) i svi blokovi; na vrhu je još stari dnevni vodič |
| `src/TodayPlan.tsx` | ploča 🧭 Sesija na početnom zaslonu |
| `src/Kanji.tsx` | kartica riječi i kanjija (dugi pritisak) |
| `src/db.ts` | baza u mobitelu (verzija 9): kartice, ocjene, sesije |
| `docs/specifikacija-dorade.md` | stara specifikacija dorada; dio o dnevnom vodiču je zamijenjen sesijama |
| `pipeline/story.mjs` | piše priču; razina light/fat (`LEVEL_RULES`), model (`STORY_MODEL`) |
| `src/Forms.tsx`, `src/grammar-index.ts`, `src/stems.ts` | 📐 Oblici: oblici, konstrukcije, memento |
| `src/StoryPlayer.tsx` | player priča (kontrole, brzina, あ furigana po razini) |
| `src/context.ts`, `src/ContextSentence.tsx` | rečenica iz priča nakon „Pokaži” |
| `data/emoji.json`, `src/emoji.ts` | emoji uz riječi |

## 5. Podsjetnici

- Radi se s mobitela (Claude aplikacija → PR → GitHub aplikacija) ili u Codespaceu. API ključevi idu samo u GitHub Secrets ili `.env`, nikad u kod.
- Prije svake usluge koja se plaća, Claude mora napisati okvirnu cijenu.
- Hrvatski prijevodi koriste muški rod (jeo sam).
- **Kad završiš s radom, zaustavi Codespace.**
