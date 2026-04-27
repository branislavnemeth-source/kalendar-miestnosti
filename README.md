# Spoločný kalendár miestností — TnUNI

Webová aplikácia, ktorá zlučuje **rezervačné kalendáre 10 miestností Trenčianskej univerzity Alexandra Dubčeka** z [booking.tnuni.sk](https://booking.tnuni.sk) do jedného prehľadu.

## Funkcie

- **4 zobrazenia**: Mesiac, 4 dni, Deň, Zoznam (agenda)
- Pri každej udalosti vidno **miestnosť**, **názov akcie** a **kontakt** (organizátor + e‑mail)
- **Filtrovanie miestností** v hornej legende (každá miestnosť má vlastnú farbu)
- **Detail udalosti** v modálnom okne (čas, miestnosť, kontakt s `mailto:` odkazom, popis)
- **Automatická synchronizácia každých 5 minút** + obnova pri návrate do tabu
- **CDN cache 5 min** — Netlify Function obsluhuje viacerých návštevníkov bez zaťaženia booking servera
- Plne responzívne, slovenská lokalizácia

## Architektúra

```
public/             ← statické súbory (HTML / CSS / JS) — FullCalendar v6
└─ index.html
└─ app.js           ← načítava /api/events každých 5 min
└─ styles.css

netlify/functions/
└─ events.js        ← Node.js function, parsuje 10 ICS feedov
                      a vracia zlúčené udalosti v JSON
netlify.toml        ← konfigurácia (publish, redirects, esbuild)
```

Frontend je čistý HTML/CSS/JS — žiadny build krok. Backend (jediný endpoint `/api/events`) je
serverless Netlify Function, ktorá obchádza CORS aj samopodpísané SSL certifikáty `booking.tnuni.sk`.

## Lokálny vývoj

```bash
npm install -g netlify-cli
npm install
netlify dev
```

Aplikácia bude na <http://localhost:8888>.

## Nasadenie cez Git

1. Pushni tento repozitár na GitHub.
2. V [Netlify](https://app.netlify.com/) → **Add new site → Import from Git** → vyber tento repozitár.
3. Nastavenia (predvyplnené z `netlify.toml`):
   - **Build command**: *(prázdne)*
   - **Publish directory**: `public`
   - **Functions directory**: `netlify/functions`
4. Klikni **Deploy** — pri každom `git push` Netlify automaticky znovu nasadí.

## Zmena/pridanie miestnosti

Uprav pole `SOURCES` v [`netlify/functions/events.js`](netlify/functions/events.js) a pushni zmenu.

## Zdroj dát

Údaje pochádzajú z verejných ICS feedov rezervačného systému `booking.tnuni.sk`.
