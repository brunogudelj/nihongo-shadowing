# Nihongo Shadowing: specifikacija projekta

## Cilj
Mobilna web aplikacija (PWA) za učenje japanskog govora kroz **shadowing** (slušanje i ponavljanje naglas). Fokus je na slušanju, govoru i čitanju. **Pisanje se ne vježba.**

## Korisnik i način rada (VAŽNO)
- Korisnik **ne zna programirati**. Zna koristiti VS Code i Claude Code.
- Komuniciraj na **hrvatskom**, jednostavno, bez žargona. Kad moraš upotrijebiti tehnički izraz, objasni ga jednom rečenicom.
- **Prije kodiranja uvijek napiši kratak plan** i čekaj potvrdu.
- Radi u **malim koracima**: jedan korak, korisnik testira, pa idući. Ne gradi sve odjednom.
- Nakon svakog koraka napiši **kako to testirati** (konkretni koraci, što bi trebao vidjeti).
- Često predlaži **commit i push**, s razumljivom porukom.
- Ako nešto nije jasno, pitaj. Ne pretpostavljaj.
- Korisnik radi **isključivo u GitHub Codespacesu**. Ništa se ne instalira lokalno na njegovo računalo.

## Fond jezika (ograničenje sadržaja)
- **Vokabular: JLPT N4** (uz N5 koji se podrazumijeva)
- **Gramatika: do JLPT N3**
- Sav generirani sadržaj mora ostati unutar tog fonda. Izuzeci: vlastita imena (mjesta, ljudi) i riječi koje je korisnik izričito dodao u temu.
- Popisi riječi i gramatike spremaju se u repo (`data/vocab-n4.json`, `data/grammar-n3.json`). JLPT nema službene popise, pa se koriste neslužbeni (npr. tanos.co.jp, open-anki-jlpt-decks, Bunpro). Prije korištenja objasni korisniku odakle popis dolazi i koja je licenca.
- **Provjera fonda:** nakon generiranja teksta, tokeniziraj ga (Kuromoji ili Sudachi), izvuci lemme i provjeri da su u popisu. Cilj je najmanje 95% pokrivenosti. Ako nije, regeneriraj. Ispiši koje su riječi izvan popisa.

## Sadržaj: teme i chunking
- Sadržaj se organizira u **teme** (npr. putovanje po Japanu, Kyushu, japanske željeznice, Hrvatska, prijatelji i obitelj). Teme se dodaju tijekom vremena.
- **Nova tema = nova datoteka** u `themes/` (YAML ili JSON): naziv, opis, ključne riječi, vlastita imena, eventualni dodatni rječnik. Dodavanje teme ne smije zahtijevati izmjenu koda aplikacije.
- Za svaku temu generiraju se **kratke priče i fraze** (npr. 5 do 8 rečenica) koje imaju smisla kao cjelina.
- **Chunking:** svaka rečenica je podijeljena na smislene dijelove (bunsetsu), za shadowing dio po dio. Svaka rečenica ima i hrvatski prijevod.
- Tekst generira Claude API, a rezultat se sprema kao gotova datoteka u repo (aplikacija ne poziva API u runtimeu).

## Glas (TTS)
- Audio se **generira unaprijed** i sprema kao mp3 u repo (po rečenici i po cijeloj priči). Aplikacija **ne poziva TTS u runtimeu**.
- TTS: **Azure Neural TTS**, glas **ja-JP-NanamiNeural** (korisnik ga je odabrao).
- Za usporavanje i ubrzavanje u aplikaciji koristi `playbackRate` s `preservesPitch = true`. Gumbi za brzinu: **0.7× / 0.85× / 1×** (jedan dodir, ne klizač).
- mp3 neka bude mono i niskog bitratea (oko 48 do 64 kbps) zbog mobilnog prostora i offline rada.
- Ako TTS vraća vremenske oznake po riječima, spremi ih za isticanje trenutne riječi.

## Prikaz teksta
- Rečenica se prikazuje **na japanskom, velikim slovima**, s **furiganom iznad kanjija** (HTML `<ruby>`).
- Furigana se generira unaprijed (tokenizer + rječnik) i sprema u podatke. Za sumnjiva čitanja označi rečenicu za ručnu provjeru.
- Hrvatski prijevod se prikazuje na zahtjev (gumb), da ne odvlači pažnju.
- **Pasivno učenje kanjija:** furigana se za pojedini kanji **skriva kad ga korisnik označi kao naučenog** (ili kad ga SRS prepozna kao poznatog). Kanji se uči samo za prepoznavanje (čitanje i značenje), nikad pisanje. Uči se samo kanji koji se pojavljuje u korisnikovim pričama.
- Pasivno učenje kane: kratki kvizovi slušanje → prepoznavanje.

## Anki mehanizam (SRS)
- Algoritam: **FSRS** (biblioteka `ts-fsrs`).
- Dvije vrste kartica: **riječ** (slušanje → značenje, značenje → izgovor) i **fraza** (shadowing, samoprocjena).
- Samoprocjena: **Again / Hard / Good / Easy**.
- Dnevni red ponavljanja ovisi o znanju, s ograničenjem broja novih kartica dnevno koje korisnik može podesiti.
- Napredak se sprema **lokalno u pregledniku** (IndexedDB, npr. preko Dexie). Aplikacija mora zatražiti **trajnu pohranu** (`navigator.storage.persist()`).
- Obavezno: **gumb za izvoz i uvoz napretka** (JSON) kao sigurnosna kopija, jer preglednik može obrisati podatke.

## Shadowing sučelje
- Reprodukcija rečenice ili chunka, petlja (ponavljanje), prelazak na iduću.
- U prvoj verziji **nema automatskog ocjenjivanja izgovora**. Korisnik sam ocjenjuje. Automatsko ocjenjivanje (Whisper) je moguće proširenje kasnije.
- Media Session API (kontrole na zaključanom zaslonu i slušalicama) i Screen Wake Lock tijekom vježbanja.

## Modovi učenja
### Rendgen mod
- Rečenica se prikazuje rastavljena na **riječi i čestice**, svaki dio u svojoj boji prema ulozi (npr. vrijeme, mjesto, subjekt, objekt, glagol, čestica).
- Dodir na dio prikazuje **kratko objašnjenje na hrvatskom**: značenje riječi **u kontekstu te rečenice** i njezina uloga (ne samo rječnička definicija).
- Gruba podjela: uljudni završeci (ます, です) ostaju uz riječ, ali se **objašnjavaju** (npr. 行きます: glagol 行く + ます, uljudni oblik; です: kopula "je/jest", uljudno).
- Uloge i objašnjenja generiraju se **unaprijed u pipelineu** i spremaju u JSON uz rečenicu. Aplikacija ih ne računa.

## Potencijalni modovi (kasnije, samo ako korisnik zatraži)
### Mod postupnog slaganja (odgođen)
- Rečenica se uči kroz chunkove koji se nadograđuju, dok se ne dođe do cijele rečenice.
- **Dva smjera:** od početka (1 → 1+2 → 1+2+3 → …) i od kraja (zadnji → predzadnji+zadnji → …).
- Smjer se mijenja gumbom koji je vidljiv kad je mod upaljen. Dizajn gumba: **kao UNO karta "obrni smjer"** (dvije zakrivljene strelice).
- **Zašto je odgođen:** rezanje snimke cijele rečenice po vremenskim oznakama zvuči odsječeno (između riječi nema tišine), a korisniku je to više smetalo nego pomoglo. Zato je maknut i dodir na chunk koji pušta samo taj dio.
- **Ideja ako se vrati:** Azure posebno izgovori svaki raspon (1, 1+2, …), prirodno i bez rezanja. Unutar besplatnog limita.

### Snimanje sebe (odgođeno)
- Gumb za **snimanje sebe** (MediaRecorder) i preslušavanje uz original. Podržava se samo format koji daje Firefox na Androidu.
- **Zašto je odgođeno:** korisnik je odlučio da ga zasad preskačemo.

## Platforma: mobile-first PWA
- **Ciljani uređaj: samo Android, preglednik Firefox.** iPhone i ostali preglednici se ne podržavaju i ne testiraju.
- **Glavni uređaj je mobitel**, uspravni položaj. Dizajniraj prvo za mobitel.
- Veliki gumbi, sve dohvatljivo jednom rukom, rečenica velikim slovima u sredini zaslona.
- Instalira se na početni zaslon (manifest, service worker), radi **offline** nakon prvog učitavanja.
- Audio se pokreće tek nakon dodira korisnika, pa je "Play" uvijek gumb.
- Testiranje na pravom uređaju radi se preko objavljenog GitHub Pages linka (HTTPS je potreban za mikrofon).

## Tehnički stack (predloženo, objasni korisniku prije odluke)
- React + Vite + TypeScript + Tailwind
- Dexie (IndexedDB), ts-fsrs
- Tokenizer: Kuromoji.js ili Sudachi; JMdict za značenja; KANJIDIC2 za podatke o kanjiju
- **Hosting: GitHub Pages**, deploy preko **GitHub Actions**
- **Pipeline sadržaja** (skripta u Node-u ili Pythonu) pokreće se ručno kroz GitHub Actions (`workflow_dispatch`): tema → priča (Claude API) → provjera fonda → furigana → audio (TTS) → JSON + mp3 u repo.

## Sigurnost i tajne
- API ključeve (Anthropic, Azure/Google TTS) **nikad ne stavljaj u kod, u chat ni u commit**. Samo u **GitHub Secrets** (za Actions) ili `.env` koji je u `.gitignore` (za razvoj u Codespaceu).
- Repo je **javni**, pa pazi da nigdje nema osobnih podataka ni ključeva.
- U sadržaju ne koristi stvarna puna imena korisnikovih prijatelja i obitelji bez njegovog izričitog odobrenja. Koristi izmišljena imena ili samo uloge (npr. "moj prijatelj"), jer su priče javne.

## Troškovi
- Cilj je **minimalan trošak**. Prije svake nove usluge koja se naplaćuje napiši korisniku okvirnu cijenu i upozori ga.
- Korisnik **nije unio karticu** u GitHub. Pazi da pipeline ne troši besmisleno (npr. ne regeneriraj audio koji već postoji).
- Podsjeti korisnika da **zaustavi Codespace** kad završi rad.

## Predložena struktura repoa
```
CLAUDE.md
README.md
themes/          # po jedna datoteka po temi
data/            # popisi N4 vokabulara, N3 gramatike
content/         # generirane priče (JSON) i audio (mp3)
pipeline/        # skripte za generiranje sadržaja
src/             # aplikacija
public/          # manifest, ikone, service worker
.github/workflows/  # deploy na Pages, pokretanje pipelinea
.devcontainer/devcontainer.json
```

## Redoslijed gradnje (drži se ovoga)
1. Postavi `.devcontainer` (Claude Code unutar Codespacea) i prazan projekt
2. **Najmanji prototip:** jedna stranica, jedna rečenica s furiganom, gumb za zvuk, tipke za brzinu
3. Objava na GitHub Pages i test na mobitelu (PWA)
4. Pipeline sadržaja za jednu temu (jedna priča, audio, furigana, vremenske oznake po riječima, uloge i objašnjenja za rendgen mod)
5. Fond: popisi N4/N3 i provjera pokrivenosti
6. Shadowing sučelje (chunkovi, petlja, isticanje riječi, boje blokova, doslovni prijevod, romaji)
7. Rendgen mod
8. FSRS kartice i izvoz/uvoz napretka
9. Više tema, nestajanje furigane, kanji praćenje
10. Opcionalno: snimanje sebe, automatsko ocjenjivanje izgovora, pitch accent

## Što NE radimo
- Ne vježbamo pisanje (nema KanjiVG, crtanja znakova ni tipkanja odgovora na japanskom).
- Ne gradimo vlastiti server ni korisničke račune.
- Ne dodajemo funkcije koje korisnik nije tražio bez pitanja.