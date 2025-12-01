/* script.js - GabayBahay
   Assumptions:
   - Optional global constant SHEET_CSV_URL can be set to published Google Sheet CSV URL
   - listings.json optionally placed at web root
*/

const SHEET_CSV_URL = ''; // <-- optionally paste your published Google Sheet CSV URL here

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('year').textContent = new Date().getFullYear();
  initHeaderScroll();
  initMenuToggle();
  initFilters();
  fetchListings().then(listings => {
    window._LISTINGS = listings; // global for debug
    renderListings(listings);
  }).catch(err=>{
    console.error('Failed to load listings:', err);
    renderListings([]);
  });
});

/* ---------------------------
   Fetch logic with fallbacks
   --------------------------- */
async function fetchListings() {
  // 1) Try local /listings.json
  try {
    const res = await fetch('/listings.json', {cache:'no-store'});
    if (res.ok) {
      const data = await res.json();
      console.info('Loaded /listings.json');
      return normalizeListings(data);
    }
  } catch (e) { /* ignore and fallback */ }

  // 2) Try published Google Sheet CSV if configured
  if (SHEET_CSV_URL) {
    try {
      const res = await fetch(SHEET_CSV_URL, {cache:'no-store'});
      if (res.ok) {
        const csvText = await res.text();
        const parsed = csvToJson(csvText);
        console.info('Loaded listings from sheet CSV');
        return normalizeListings(parsed);
      }
    } catch (e) { console.warn('Sheet CSV fetch failed', e); }
  }

  // 3) Fallback to embedded sample array
  console.info('Using embedded sample listings');
  return sampleListings();
}

/* ------- normalize shape --------
 expected fields (per listing):
  id, title, price_min, price_max, price, room_type, tenant_type, distance, wifi, features (string), image (url)
*/
function normalizeListings(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((r, i) => {
    // support a few naming variants from CSV/JSON
    const safe = (k)=> r[k] ?? r[k?.toLowerCase?.()] ?? r[k?.toUpperCase?.()] ?? '';
    const price = numberOrNull(safe('price')) ?? numberOrNull(safe('price_min')) ?? null;
    const price_min = numberOrNull(safe('price_min')) ?? numberOrNull(safe('min_price')) ?? price;
    const price_max = numberOrNull(safe('price_max')) ?? numberOrNull(safe('max_price')) ?? price;
    const room_type = safe('room_type') || safe('room') || 'Bedspace';
    const tenant_type = safe('tenant_type') || safe('tenant') || 'All';
    return {
      id: r.id ?? `auto-${i}`,
      title: safe('title') || safe('name') || 'Listing',
      price_min,
      price_max,
      price,
      room_type,
      tenant_type,
      distance: safe('distance') || '',
      wifi: safe('wifi') || '',
      features: safe('features') || '',
      image: safe('image') || `https://via.placeholder.com/640x360?text=${encodeURIComponent(safe('title')||'Image')}`
    };
  });
}

function numberOrNull(v){
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/[^\d.-]/g,''));
  return Number.isFinite(n) ? n : null;
}

/* ---------- CSV to JSON (simple) -----------
   Expects header row. Commas inside quotes supported.
*/
function csvToJson(csvText) {
  const rows = [];
  const lines = csvText.split(/\r?\n/).filter(l=>l.trim().length>0);
  if (lines.length === 0) return [];
  const header = parseCsvLine(lines[0]);
  for (let i=1;i<lines.length;i++){
    const parts = parseCsvLine(lines[i]);
    if (parts.length === 0) continue;
    const obj = {};
    for (let j=0;j<header.length;j++){
      obj[header[j].trim()] = parts[j] ?? '';
    }
    rows.push(obj);
  }
  return rows;
}

function parseCsvLine(line) {
  const result=[];
  let cur='', inQuotes=false;
  for (let i=0;i<line.length;i++){
    const ch=line[i];
    if (ch === '"' ){
      if (inQuotes && line[i+1]==='"'){ cur+='"'; i++; } else inQuotes=!inQuotes;
      continue;
    }
    if (ch===',' && !inQuotes){ result.push(cur); cur=''; continue; }
    cur+=ch;
  }
  result.push(cur);
  return result;
}

/* -------------------------
   Sample listings (fallback)
   ------------------------- */
function sampleListings(){
  return [
    {
      id:'patrick-rock',
      title:"Patrick's Rock House",
      price_min:1150,
      price_max:2000,
      room_type:'Bedspace / Solo',
      tenant_type:'All Male',
      distance:'200 steps',
      wifi:'Basic Access',
      features:'Quiet neighborhood',
      image:'https://via.placeholder.com/640x360?text=Patrick%27s+Rock+House'
    },
    {
      id:'squidward-head',
      title:"Squidward's Head House",
      price:2300,
      price_min:2300,
      price_max:2300,
      room_type:'Solo',
      tenant_type:'All Female',
      distance:'250 steps',
      wifi:'5G Converge',
      features:'Near market',
      image:'https://via.placeholder.com/640x360?text=Squidward%27s+Head+House'
    },
    {
      id:'sponge-pineapple',
      title:"Spongebob's Pineapple House",
      price_min:2000,
      price_max:5700,
      room_type:'Bedspace / Studio',
      tenant_type:'Mixed',
      distance:'100 steps',
      wifi:'5G PLDT',
      features:'Giant Pineapple Structure; Direct Beach Access',
      image:'https://via.placeholder.com/640x360?text=Spongebob%27s+Pineapple+House'
    }
  ];
}

/* -------------------------
   Render & Filtering
   ------------------------- */
function renderListings(listings) {
  const container = document.getElementById('listings-grid');
  container.innerHTML = '';
  if (!listings || listings.length===0){
    container.innerHTML = '<p class="muted">No listings found.</p>';
    return;
  }
  listings.forEach(l => {
    const card = document.createElement('article');
    card.className = 'card';
    card.setAttribute('tabindex','0');
    card.innerHTML = `
      <img id="img-${escapeId(l.id)}" data-listing-id="${escapeHtml(l.id)}" src="${escapeHtml(l.image)}" alt="${escapeHtml(l.title)}" />
      <div class="card-body">
        <h3 class="card-title">${escapeHtml(l.title)}</h3>
        <div class="card-meta">${escapeHtml(l.room_type)} &middot; ${escapeHtml(l.tenant_type)}</div>
        <div class="card-row">
          <div class="card-meta">₱${formatPrice(l.price ?? l.price_min ?? '')}${l.price_max && l.price_max !== l.price_min ? ' – ₱' + formatPrice(l.price_max) : ''}</div>
          <div class="badge">${escapeHtml(l.distance || '')}</div>
        </div>
        <div class="card-meta" style="margin-top:.5rem">${escapeHtml(l.wifi || '')}</div>
        <p class="card-meta" style="margin-top:.5rem">${escapeHtml(l.features || '')}</p>
      </div>
    `;
    container.appendChild(card);
  });
}

/* filter utilities */
function initFilters(){
  const priceRange = document.getElementById('price-range');
  const priceOutput = document.getElementById('price-output');
  const form = document.getElementById('filters-form');
  const resetBtn = document.getElementById('reset-filters');

  // update price display
  priceOutput.textContent = `₱${formatPrice(priceRange.value)}`;
  priceRange.addEventListener('input', ()=>{
    priceOutput.textContent = `₱${formatPrice(priceRange.value)}`;
    applyFilters();
  });

  form.addEventListener('change', applyFilters);
  resetBtn.addEventListener('click', () => {
    priceRange.value = priceRange.max;
    priceOutput.textContent = `₱${formatPrice(priceRange.value)}`;
    // reset tenant radios
    const tenants = form.querySelectorAll('input[name="tenant"]');
    tenants.forEach(t => t.checked = t.value === 'All');
    // reset room checkboxes
    form.querySelectorAll('input[name="roomType"]').forEach(c => c.checked = true);
    applyFilters();
  });
}

function applyFilters(){
  const maxBudget = Number(document.getElementById('price-range').value);
  const tenant = document.querySelector('input[name="tenant"]:checked')?.value || 'All';
  const roomTypes = Array.from(document.querySelectorAll('input[name="roomType"]:checked')).map(i=>i.value);

  const all = window._LISTINGS || [];
  const filtered = all.filter(l => {
    // price: check price_min or price or price_max <= maxBudget
    const pMin = Number(l.price_min ?? l.price ?? 0);
    const pMax = Number(l.price_max ?? l.price ?? pMin);
    if (Math.min(pMin,pMax) > maxBudget) return false;
    // tenant filter
    if (tenant && tenant !== 'All' && !String(l.tenant_type).toLowerCase().includes(tenant.toLowerCase())) return false;
    // room type filter - pass if any selected room-type matches listing room_type text (simple)
    if (roomTypes.length > 0) {
      const matches = roomTypes.some(rt => String(l.room_type ?? '').toLowerCase().includes(rt.toLowerCase()));
      if (!matches) return false;
    }
    return true;
  });
  renderListings(filtered);
}

/* -------------------------
   Header hide/show on scroll
   ------------------------- */
function initHeaderScroll(){
  const header = document.getElementById('site-header');
  let lastY = window.scrollY;
  let ticking = false;
  window.addEventListener('scroll', ()=>{
    if (!ticking){
      window.requestAnimationFrame(()=> {
        const y = window.scrollY;
        if (y > lastY && y > 80) {
          header.classList.add('hidden');
        } else {
          header.classList.remove('hidden');
        }
        lastY = y;
        ticking = false;
      });
      ticking = true;
    }
  }, {passive:true});
}

/* mobile menu */
function initMenuToggle(){
  const btn = document.getElementById('menu-toggle');
  const nav = document.getElementById('main-nav');
  btn.addEventListener('click', ()=>{
    const open = nav.classList.toggle('open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
}

/* -------------------------
   Helpers
   ------------------------- */
function formatPrice(v){
  if (!v && v !== 0) return '';
  return Number(v).toLocaleString('en-PH');
}
function escapeHtml(s){
  if (s === null || s === undefined) return '';
  return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
}
function escapeId(s){ return String(s).replace(/\s+/g,'-').replace(/[^a-zA-Z0-9\-_]/g,''); }
