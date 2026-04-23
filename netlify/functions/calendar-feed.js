const https = require('https');
const http = require('http');

const ROOMS = [
  { name: 'Aula', url: 'https://booking.tnuni.sk/calendar/ical.php?resourceid=4&token=8462d30ef53e30eb393dc43b913f1f4321227b3a1e8499320097c7d6540d5e57', color: '#f59e0b' },
  { name: 'B1.14 Konferenčné centrum 1', url: 'https://booking.tnuni.sk/calendar/ical.php?resourceid=1&token=edee107d98ddb9bbac98573f13820a794c2a1ee35833bcc0a250726e28689d35', color: '#16a34a' },
  { name: 'B1.13 Konferenčné centrum 2', url: 'https://booking.tnuni.sk/calendar/ical.php?resourceid=5&token=f293284c08866810bb5400de72e7e3031ef0ae94aa296f15243b04c95982ca81', color: '#2563eb' },
  { name: 'B1.10 Rokovacia miestnosť', url: 'https://booking.tnuni.sk/calendar/ical.php?resourceid=6&token=894942c7e20ad9cb0944d7fd7a6a2030bc5148fc794541a408879a1d0d27b48e', color: '#dc2626' },
  { name: 'B1.09 Seminárna miestnosť CIT', url: 'https://booking.tnuni.sk/calendar/ical.php?resourceid=14&token=ab92272472c19da472d3e656b07a2c4abdeba72783d6d7dc958b6408b0009190', color: '#9333ea' },
  { name: 'B238 Študentské centrum', url: 'https://booking.tnuni.sk/calendar/ical.php?resourceid=7&token=900b3df1d754c7f6daaccb2e410403d74128faa848050a6a1f18d5853a8d9fdc', color: '#0891b2' },
  { name: 'B221 Zasadačka B221', url: 'https://booking.tnuni.sk/calendar/ical.php?resourceid=12&token=8e5743de6c11f0de9c296d846bbc8fbdb6d2ed533bd48ece2afb47ddd16a0ee3', color: '#ea580c' },
  { name: 'Zasadačka FZ', url: 'https://booking.tnuni.sk/calendar/ical.php?resourceid=13&token=84569f77d92b72779f60d0671f81777d78941f6abca4df87a752e24050476cdf', color: '#7c3aed' },
  { name: 'Zasadačka FSEV', url: 'https://booking.tnuni.sk/calendar/ical.php?resourceid=9&token=eee984dd0e692d54a874850b17fb7a2d5a99b93645b3b6564da1c0b2b8e0f443', color: '#0f766e' },
  { name: 'Zasadačka FŠT', url: 'https://booking.tnuni.sk/calendar/ical.php?resourceid=10&token=cfc8b6904dc6125ba4013a5c1d75903161d816e85f8263ed35b95d1db4258ec5', color: '#be185d' }
];

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const options = {
      headers: { 'User-Agent': 'NetlifyFunction/1.0' },
      rejectUnauthorized: false
    };
    
    const req = mod.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function parseIcal(icalText, room) {
  const events = [];
  const blocks = icalText.split('BEGIN:VEVENT');
  
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    const get = (key) => {
      const r = new RegExp(key + '[^:]*:([^\\r\\n]+)', 'i');
      const m = block.match(r);
      return m ? m[1].trim() : '';
    };
    
    const summary = get('SUMMARY');
    const dtstart = get('DTSTART');
    const dtend = get('DTEND');
    
    if (summary && dtstart) {
      events.push({
        title: summary,
        start: dtstart,
        end: dtend || dtstart,
        room: room.name,
        color: room.color
      });
    }
  }
  return events;
}

exports.handler = async (event, context) => {
  const allEvents = [];
  const errors = [];
  
  for (const room of ROOMS) {
    try {
      const icalData = await fetchUrl(room.url);
      const events = parseIcal(icalData, room);
      allEvents.push(...events);
    } catch (error) {
      errors.push({ room: room.name, error: error.message });
    }
  }
  
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      ok: true,
      events: allEvents,
      errors: errors,
      count: allEvents.length,
      updated: new Date().toISOString()
    })
  };
};
