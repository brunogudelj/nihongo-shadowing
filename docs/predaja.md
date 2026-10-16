# Predaja: gdje smo stali (16. 10. 2026.)

Ovaj dokument služi da sutra nastaviš bez prepričavanja. U novom razgovoru s Claudeom napiši:

> Pročitaj docs/predaja.md i nastavi.

Sve je spremljeno i poslano na GitHub (zadnji commit `e822c0d`).

---

## 1. Što je napravljeno danas

Aplikacija je prešla s velikog dnevnog plana (75 min) na **kratke, neovisne sesije**.

| Commit | Što |
|---|---|
| `69d845c` | **FSRS kartice** (biblioteka `ts-fsrs`): kartice riječi i fraza. Stari napredak je prenesen sam (na mobitelu je nastalo 23 kartice). Kartice su u izvozu i uvozu. |
| `7810f86` | **Sastavljač sesije** i **početni zaslon**: Započni sesiju, izbor 5 / 10 / 15 min, brojač sesija i minuta (danas i ukupno), dnevni cilj (− / +). |
| `54590fb` | **Zaslon sesije**: tajmer bloka i sesije, traka napretka, svih 7 blokova, nastavak prekinute sesije, sažetak. Probne sesije su obrisane. |
| `e822c0d` | **Kartica kanjija** sad prvo pokazuje cijelu riječ (npr. 九州 i značenje iz rečenice), a kanjiji su ispod. Maknut je „▶ Nastavi” s početnog zaslona. |

Testova ima 81 i svi prolaze (`npm test`).

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

## 3. Što je otvoreno (redom)

### A) Testiranje na mobitelu (čeka tvoj povratni dojam)
- **Sesije** (5 i 15 min, prekid i Nastavi sesiju, sažetak).
- **Nova kartica kanjija:** dugi pritisak na 州 u 九州, dodir na gumb kanjija, zatvaranje dodirom izvan kartice.
- Javi što bi promijenio: trajanje blokova, tekstove, koliko često dolazi koji blok.

### B) Rečenice za kontekst kod „Pokaži” (glavna iduća dorada, plan dogovoren u načelu)
**Ideja:** u Ponavljanju riječi, bloku Riječi i Konjugatoru, nakon „Pokaži” pojavi se jedna rečenica s tom riječju ili baš tim oblikom: furigana, 🔊 i hrvatski prijevod na dodir. Svaki put je druga, nasumično.

- **Izvor rečenica:** nove rečenice koje napiše Claude, plus rečenice iz tvojih priča u kojima se riječ pojavljuje.
- **Fond:** vokabular N4 provjerava se automatski (ista provjera kao za priče). Gramatika do N3 drži se samo uputom Claudeu i kratkim rečenicama, pa nije 100% zajamčena.
- **Redoslijed:** prvo riječi (2 rečenice po riječi, oko 2600 rečenica), pa konjugator (1 rečenica po obliku, oko 5000 rečenica).
- **Okvirna cijena** (grupna obrada, namjerno procijenjena više):

| | Opus 5.5 | Haiku 5.5 |
|---|---|---|
| Riječi | 5–10 $ | ispod 0,50 $ |
| Konjugator | 10–20 $ | ispod 1 $ |

- **Zvuk** (Azure, Nanami): besplatno unutar mjesečnog limita (oko 15% za riječi, oko 25% za konjugator). Postojeći audio se nikad ne radi ponovno.

**Tvoje odluke koje još fale:**
1. **Model:** prijedlog je proba na 20 riječi s oba modela (par centi), pa izabereš.
2. **Redoslijed:** prvo riječi, pa konjugator?
3. **Krediti:** Anthropic račun treba dopuniti (krediti su potrošeni 4. 10.).

**Što se može odmah, besplatno, bez kredita:** skripta za generiranje, provjera fonda i prikaz rečenice u aplikaciji. Za početak bi prikaz koristio samo rečenice iz tvojih priča.

### C) Korak 7 (manje hitno)
- Tjedni izvještaj za Claudea prilagođen sesijama: sesije i minute po danu, kartice koje stalno padaju, slabe točke konjugatora.
- Čišćenje starog dnevnog vodiča iz koda (`planDay`, stari dijelovi u `Training.tsx` i `vodic-rules.ts`). To se ne vidi, ali pojednostavljuje daljnje izmjene.

### D) Čeka kredite (od prije)
- Značenja oblika u konjugatoru za zadnjih 55 riječi (`npm run konjugator-znacenja`, preskače gotove), pa maknuti ženske nastavke „/la”.
- Zaslon s popisom gramatike (280 točaka, objašnjenja na hrvatskom, audio primjera).

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

## 5. Podsjetnici

- Radi se samo u Codespaceu. API ključevi idu samo u GitHub Secrets ili `.env`, nikad u kod.
- Prije svake usluge koja se plaća, Claude mora napisati okvirnu cijenu.
- Hrvatski prijevodi koriste muški rod (jeo sam).
- **Kad završiš s radom, zaustavi Codespace.**
