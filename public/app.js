// Spoločný kalendár miestností TnUNI — frontend
// - 4 zobrazenia: mesiac / 4 dni / deň / zoznam
// - sync každých 5 minút
// - filtrovanie podľa miestnosti
// - detail udalosti v modálnom okne (miestnosť, názov, kontakt)

const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minút

let calendar = null;
let allEvents = [];
let sources = [];
let activeRooms = new Set();
let lastSyncOk = null;

const $ = (id) => document.getElementById(id);

function setSyncStatus(state, msg) {
  const dot = $('syncDot');
  const txt = $('syncText');
  dot.classList.remove('ok', 'warn', 'err');
  if (state) dot.classList.add(state);
  txt.textContent = msg;
}

function fmtRange(start, end) {
  const opts = { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' };
  const s = new Date(start);
  const e = new Date(end);
  const sameDay = s.toDateString() === e.toDateString();
  const dateF = new Intl.DateTimeFormat('sk-SK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const timeF = new Intl.DateTimeFormat('sk-SK', { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return `${dateF.format(s)}, ${timeF.format(s)} – ${timeF.format(e)}`;
  return `${dateF.format(s)} ${timeF.format(s)} → ${dateF.format(e)} ${timeF.format(e)}`;
}

function buildLegend() {
  const wrap = $('legend');
  wrap.innerHTML = '';
  // Tlačidlá hromadne
  const all = document.createElement('label');
  all.innerHTML = `<input type="checkbox" id="toggleAll" checked> <strong>Všetky</strong>`;
  wrap.appendChild(all);
  sources.forEach((s) => {
    const lbl = document.createElement('label');
    const id = 'r_' + btoa(unescape(encodeURIComponent(s.room))).replace(/=/g, '');
    lbl.innerHTML = `<input type="checkbox" id="${id}" data-room="${encodeURIComponent(s.room)}" checked>
                     <span class="swatch" style="background:${s.color}"></span>${s.room}`;
    wrap.appendChild(lbl);
    activeRooms.add(s.room);
  });
  wrap.addEventListener('change', (e) => {
    if (e.target.id === 'toggleAll') {
      const on = e.target.checked;
      activeRooms = new Set(on ? sources.map(s => s.room) : []);
      wrap.querySelectorAll('input[data-room]').forEach(cb => cb.checked = on);
    } else if (e.target.dataset.room) {
      const room = decodeURIComponent(e.target.dataset.room);
      if (e.target.checked) activeRooms.add(room); else activeRooms.delete(room);
      $('toggleAll').checked = activeRooms.size === sources.length;
    }
    refreshCalendarEvents();
  });
}

function refreshCalendarEvents() {
  if (!calendar) return;
  const filtered = allEvents.filter(ev => activeRooms.has(ev.extendedProps.room));
  calendar.removeAllEvents();
  calendar.addEventSource(filtered);
}

async function loadEvents() {
  try {
    const res = await fetch('/api/events', { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    sources = data.sources || [];
    allEvents = data.events || [];
    if (!$('legend').children.length) buildLegend();
    refreshCalendarEvents();
    const when = new Date(data.generatedAt || Date.now()).toLocaleTimeString('sk-SK');
    if (data.errors && data.errors.length) {
      setSyncStatus('warn', `Synchronizácia ${when} (${data.errors.length} zdroj/ov chyba)`);
      console.warn('Chyby zdrojov:', data.errors);
    } else {
      setSyncStatus('ok', `Posledná synchronizácia: ${when}`);
    }
    lastSyncOk = Date.now();
  } catch (err) {
    console.error(err);
    setSyncStatus('err', `Chyba synchronizácie (${err.message}). Skúsim znova o 5 min.`);
  }
}

function eventContent(arg) {
  const room = arg.event.extendedProps.room || '';
  const contact = arg.event.extendedProps.contactName || arg.event.extendedProps.contactEmail || '';
  const phone = arg.event.extendedProps.contactPhone || '';
  const isList = arg.view.type === 'listMonth' || arg.view.type === 'listWeek' || arg.view.type === 'listDay';
  if (isList) {
    return { html: `<span class="ev-room">${escapeHtml(room)}</span> — <span class="ev-title">${escapeHtml(arg.event.title)}</span>${contact ? ` <span class="ev-contact">· ${escapeHtml(contact)}</span>` : ''}${phone ? ` <span class="ev-contact">· ${escapeHtml(phone)}</span>` : ''}` };
  }
  const tooltipParts = [room, arg.event.title];
  if (contact) tooltipParts.push(contact);
  if (phone) tooltipParts.push(phone);
  return { html: `
    <div class="ev-content" title="${escapeHtml(tooltipParts.join(' — '))}">
      <div class="ev-room">${escapeHtml(room)}</div>
      <div class="ev-title">${escapeHtml(arg.event.title)}</div>
      ${contact ? `<div class="ev-contact">${escapeHtml(contact)}</div>` : ''}
      ${phone ? `<div class="ev-contact">${escapeHtml(phone)}</div>` : ''}
    </div>` };
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function openModal(ev) {
  $('evColor').style.background = ev.backgroundColor || '#999';
  $('evTitle').textContent = ev.title;
  $('evRoom').textContent = ev.extendedProps.room || ev.extendedProps.location || '—';
  $('evWhen').textContent = fmtRange(ev.start, ev.end);
  const name = ev.extendedProps.contactName || '';
  const email = ev.extendedProps.contactEmail || '';
  const phone = ev.extendedProps.contactPhone || '';
  const c = $('evContact');
  c.innerHTML = '';
  if (!name && !email) c.textContent = '—';
  else if (email) {
    c.innerHTML = `${escapeHtml(name)}${name ? ' ' : ''}<a href="mailto:${encodeURIComponent(email)}">${escapeHtml(email)}</a>`;
  } else c.textContent = name;
  const p = $('evPhone');
  if (phone) {
    const href = phone.replace(/[^\d+]/g, '');
    p.innerHTML = `<a href="tel:${escapeHtml(href)}">${escapeHtml(phone)}</a>`;
  } else {
    p.textContent = '—';
  }
  $('evDesc').textContent = ev.extendedProps.description || '';
  $('eventModal').classList.remove('hidden');
}
function closeModal() { $('eventModal').classList.add('hidden'); }
window.closeModal = closeModal;
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
document.addEventListener('click', (e) => { if (e.target.id === 'eventModal') closeModal(); });

function initCalendar() {
  const el = $('calendar');
  calendar = new FullCalendar.Calendar(el, {
    locale: 'sk',
    initialView: 'dayGridMonth',
    timeZone: 'Europe/Bratislava',
    firstDay: 1,
    nowIndicator: true,
    height: 'auto',
    expandRows: true,
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridFourDay,timeGridDay,listWeek'
    },
    buttonText: {
      today: 'Dnes',
      month: 'Mesiac',
      day: 'Deň',
      list: 'Zoznam'
    },
    views: {
      timeGridFourDay: {
        type: 'timeGrid',
        duration: { days: 4 },
        buttonText: '4 dni'
      },
      listWeek: {
        buttonText: 'Zoznam'
      }
    },
    slotMinTime: '07:00:00',
    slotMaxTime: '21:00:00',
    eventContent,
    eventClick: (info) => { info.jsEvent.preventDefault(); openModal(info.event); }
  });
  calendar.render();
}

document.addEventListener('DOMContentLoaded', () => {
  initCalendar();
  loadEvents();
  setInterval(loadEvents, SYNC_INTERVAL_MS);
  // Pri návrate do tabu spravíme rýchlu kontrolu, ak je sync starší ako 5 min
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && (!lastSyncOk || Date.now() - lastSyncOk > SYNC_INTERVAL_MS)) {
      loadEvents();
    }
  });
});
