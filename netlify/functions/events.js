// Netlify Function: načíta všetky ICS feedy a vráti zlúčený zoznam udalostí v JSON.
// Cache 5 min — udalosti sa obnovujú každých 5 minút aj pri vysokej návštevnosti.

const ical = require('node-ical');
const https = require('https');

// Zoznam zdrojov: číslo/názov miestnosti + ICS URL + farba pre kalendár
const SOURCES = [
  { room: 'Aula',                                color: '#e53935', url: 'https://booking.tnuni.sk/calendar/ical.php?resource_id=4&token=8462d30ef53e30eb393dc43b913f1f4321227b3a1e8499320097c7d6540d5e57' },
  { room: 'B1.14 — Konferenčné centrum 1',        color: '#1e88e5', url: 'https://booking.tnuni.sk/calendar/ical.php?resource_id=1&token=edee107d98ddb9bbac98573f13820a794c2a1ee35833bcc0a250726e28689d35' },
  { room: 'B1.13 — Konferenčné centrum 2',        color: '#43a047', url: 'https://booking.tnuni.sk/calendar/ical.php?resource_id=5&token=f293284c08866810bb5400de72e7e3031ef0ae94aa296f15243b04c95982ca81' },
  { room: 'B1.10 — Rokovacia miestnosť',          color: '#fb8c00', url: 'https://booking.tnuni.sk/calendar/ical.php?resource_id=6&token=894942c7e20ad9cb0944d7fd7a6a2030bc5148fc794541a408879a1d0d27b48e' },
  { room: 'B1.09 — Seminárna miestnosť CIT',      color: '#8e24aa', url: 'https://booking.tnuni.sk/calendar/ical.php?resource_id=14&token=ab92272472c19da472d3e656b07a2c4abdeba72783d6d7dc958b6408b0009190' },
  { room: 'B238 — Študentské centrum',            color: '#00897b', url: 'https://booking.tnuni.sk/calendar/ical.php?resource_id=7&token=900b3df1d754c7f6daaccb2e410403d74128faa848050a6a1f18d5853a8d9fdc' },
  { room: 'B221 — Zasadačka B221',                color: '#6d4c41', url: 'https://booking.tnuni.sk/calendar/ical.php?resource_id=12&token=8e5743de6c11f0de9c296d846bbc8fbdb6d2ed533bd48ece2afb47ddd16a0ee3' },
  { room: 'Zasadačka FZ',                         color: '#3949ab', url: 'https://booking.tnuni.sk/calendar/ical.php?resource_id=13&token=84569f77d92b72779f60d0671f81777d78941f6abca4df87a752e24050476cdf' },
  { room: 'Zasadačka FSEV',                       color: '#c0ca33', url: 'https://booking.tnuni.sk/calendar/ical.php?resource_id=9&token=eee984dd0e692d54a874850b17fb7a2d5a99b93645b3b6564da1c0b2b8e0f443' },
  { room: 'Zasadačka FŠT',                        color: '#d81b60', url: 'https://booking.tnuni.sk/calendar/ical.php?resource_id=10&token=cfc8b6904dc6125ba4013a5c1d75903161d816e85f8263ed35b95d1db4258ec5' }
];

// Stiahnutie ICS textu (fallback s vypnutou kontrolou cert. — booking.tnuni.sk používa
// reťazec, ktorý nie vždy validuje v Node prostredí)
function fetchIcs(url) {
  return new Promise((resolve, reject) => {
    const agent = new https.Agent({ rejectUnauthorized: false });
    https.get(url, { agent, timeout: 15000, headers: { 'User-Agent': 'tnuni-shared-calendar/1.0' } }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} pre ${url}`));
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    }).on('error', reject).on('timeout', function () { this.destroy(new Error('Timeout')); });
  });
}

// Vytiahne telefónne číslo z popisu rezervácie.
// V description býva napr.: "Telefón: +421 915 434 658\nÚčasť CIT: Nie\n..."
// Akceptujeme rôzne varianty: 'Telefón', 'Telefon', 'Tel', 'Phone', 'Mobil'.
function extractPhone(desc) {
  if (!desc) return '';
  const m = desc.match(/(?:Telef[oó]n|Tel\.?|Phone|Mobil)\s*[:\-]?\s*([+0-9 \-()\/]{6,})/i);
  if (!m) return '';
  // očistíme: necháme +, číslice, medzery a pomlčky
  return m[1].replace(/[^\d+\-\s]/g, '').replace(/\s+/g, ' ').trim();
}

// Pre tel: link odstránime všetko okrem + a číslic
function phoneToTelHref(phone) {
  if (!phone) return '';
  return phone.replace(/[^\d+]/g, '');
}

// Z parsovaného udalosti vytvorí FullCalendar event
function toFcEvent(ev, source) {
  if (!ev.start || !ev.end) return null;
  const summary  = (ev.summary || '').toString().trim();
  const location = (ev.location || '').toString().trim();
  // Kontakt z ORGANIZER (params.CN + val mailto:)
  let contactName = '';
  let contactEmail = '';
  if (ev.organizer) {
    if (typeof ev.organizer === 'string') {
      contactName = ev.organizer;
    } else {
      contactName = (ev.organizer.params && ev.organizer.params.CN) || '';
      const val = ev.organizer.val || '';
      contactEmail = val.replace(/^mailto:/i, '');
    }
  }
  const description = (ev.description || '').toString().trim();
  const contactPhone = extractPhone(description);
  return {
    id: `${source.room}::${ev.uid || summary}::${ev.start.toISOString()}`,
    title: summary || '(bez názvu)',
    start: ev.start.toISOString(),
    end: ev.end.toISOString(),
    allDay: !!ev.datetype && ev.datetype === 'date',
    backgroundColor: source.color,
    borderColor: source.color,
    extendedProps: {
      room: source.room,
      location: location || source.room,
      contactName,
      contactEmail,
      contactPhone,
      description
    }
  };
}

exports.handler = async () => {
  const results = await Promise.allSettled(SOURCES.map(async (src) => {
    const text = await fetchIcs(src.url);
    const parsed = ical.sync.parseICS(text);
    const events = [];
    for (const key of Object.keys(parsed)) {
      const ev = parsed[key];
      if (ev.type !== 'VEVENT') continue;
      const fc = toFcEvent(ev, src);
      if (fc) events.push(fc);
    }
    return events;
  }));

  const events = [];
  const errors = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') events.push(...r.value);
    else errors.push({ room: SOURCES[i].room, error: r.reason && r.reason.message ? r.reason.message : String(r.reason) });
  });

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // Cache 5 minút na CDN aj v prehliadači
      'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=60',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      generatedAt: new Date().toISOString(),
      sources: SOURCES.map(s => ({ room: s.room, color: s.color })),
      errors,
      events
    })
  };
};
