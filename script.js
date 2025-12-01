/* script.js for GabayBahay
   - fetchListings tries /listings.json
   - falls back to sampleData
   - optionally can fetch Google Sheet CSV if window.SHEET_CSV_URL is set
*/
(() => {
  // configuration
  const MAX_PRICE_DEFAULT = 6000;
  const listingsGrid = document.getElementById('listingsGrid');
  const priceRange = document.getElementById('priceRange');
  const priceValue = document.getElementById('priceValue');
  const tenantType = document.getElementById('tenantType');
  const roomType = document.getElementById('roomType');
  const fallbackNote = document.getElementById('fallback-note');

  let rawListings = []; // array of listing objects

  // sample data for fallback
  const sampleData = [
    {
      "id": "patrick-1",
      "title": "Patrick's Rock House",
      "min_price": 1150,
      "max_price": 2000,
      "room_type": "Bedspace",
      "tenant_type": "All Male",
      "distance": "200 steps",
      "wifi": "Basic Access",
      "features": "Sea view, friendly landlord",
      "image_url": "https://via.placeholder.com/400x300?text=Patrick%27s+Rock+House"
    },
    {
      "id":"squidward-1",
      "title":"Squidward's Head House",
      "price":2300,
      "room_type":"Solo",
      "tenant_type":"All Female",
      "distance":"250 steps",
      "wifi":"5G Converge",
      "features":"Quiet neighborhood",
      "image_url":"https://via.placeholder.com/400x300?text=Squidward%27s+Head+House"
    },
    {
      "id":"spongebob-1",
      "title":"Spongebob's Pineapple House",
      "min_price":2000,
      "max_price":5700,
      "room_type":"Studio",
      "tenant_type":"Mixed",
      "distance":"100 steps",
      "wifi":"5G PLDT",
      "features":"Giant Pineapple Structure, Direct Beach Access",
      "image_url":"https://via.placeholder.com/400x300?text=Spongebob%27s+Pineapple+House"
    }
  ];

  // minimal CSV -> JSON parser (assumes first row headers)
  function csvToObjects(csvText) {
    const lines = csvText.trim().split(/\r?\n/).filter(Boolean);
    if (!lines.length) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
      // handle quoted commas
      const values = [];
      let cur = '', inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"' ) { inQuotes = !inQuotes; continue; }
        if (ch === ',' && !inQuotes) { values.push(cur.trim()); cur = ''; continue; }
        cur += ch;
      }
      values.push(cur.trim());
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = values[i] !== undefined ? values[i] : '';
      });
      return obj;
    });
  }

  // normalize a listing object to a predictable shape
  function normalize(listing) {
    // convert numeric fields
    const out = Object.assign({}, listing);
    // if price given as "price" convert to numeric and set min/max
    if (out.price) {
      const p = Number(out.price);
      if (!isNaN(p)) { out.min_price = p; out.max_price = p; }
    }
    if (out.min_price) out.min_price = Number(out.min_price);
    if (out.max_price) out.max_price = Number(out.max_price);
    // ensure room_type and tenant_type exist
    out.room_type = out.room_type || out.roomType || out.room || "Bedspace";
    out.tenant_type = out.tenant_type || out.tenantType || out.tenant || "Mixed";
    out.title = out.title || out.name || "Untitled Listing";
    out.image_url = out.image_url || out.image || ("https://via.placeholder.com/400x300?text=" + encodeURIComponent(out.title));
    return out;
  }

  // Fetch listings from different sources
  async function fetchListings() {
    // Try SHEET_CSV_URL first if provided (so sheet can override local file)
    const sheetUrl = window.SHEET_CSV_URL && window.SHEET_CSV_URL.trim();
    if (sheetUrl) {
      try {
        const res = await fetch(sheetUrl);
        if (!res.ok) throw new Error('Sheet fetch failed');
        const csv = await res.text();
        const objs = csvToObjects(csv).map(normalize);
        rawListings = objs;
        fallbackNote.hidden = true;
        return;
      } catch (e) {
        console.warn('Sheet fetch failed, continuing to other sources.', e);
      }
    }

    // Try /listings.json (hosted with the site)
    try {
      const res = await fetch('/listings.json', {cache: 'no-store'});
      if (!res.ok) throw new Error('listings.json not found');
      const data = await res.json();
      rawListings = data.map(normalize);
      fallbackNote.hidden = true;
      return;
    } catch (e) {
      console.warn('listings.json load failed:', e);
    }

    // fallback embedded
    rawListings = sampleData.map(normalize);
    fallbackNote.hidden = false;
  }

  // Render
  function renderListings(listings) {
    listingsGrid.innerHTML = '';
    if (!listings.length) {
      listingsGrid.innerHTML = '<p>No listings match your filters.</p>';
      return;
    }
    const frag = document.createDocumentFragment();
    listings.forEach(l => {
      const card = document.createElement('article');
      card.className = 'card';
      card.setAttribute('tabindex', '0');
      card.setAttribute('data-id', l.id || '');
      card.innerHTML = `
        <img class="media" src="${l.image_url}" alt="${escapeHtml(l.title)}" data-listing-image-id="${l.id || ''}" />
        <div class="content">
          <div style="display:flex;align-items:center;gap:0.5rem">
            <h3>${escapeHtml(l.title)}</h3>
            <div class="price">${formatPriceRange(l)}</div>
          </div>
          <div class="meta">
            <div>Type: ${escapeHtml(l.room_type)}</div>
            <div>Tenant: ${escapeHtml(l.tenant_type)}</div>
            <div>Distance: ${escapeHtml(l.distance || '—')}</div>
            <div>WiFi: ${escapeHtml(l.wifi || '—')}</div>
          </div>
          <div class="features">${escapeHtml(l.features || '')}</div>
        </div>
      `;
      frag.appendChild(card);
    });
    listingsGrid.appendChild(frag);
  }

  function escapeHtml(s) {
    if (!s && s !== 0) return '';
    return String(s).replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  function formatPriceRange(l) {
    if (typeof l.min_price === 'number' && typeof l.max_price === 'number' && l.min_price !== l.max_price) {
      return `₱${numberWithCommas(l.min_price)} - ₱${numberWithCommas(l.max_price)}`;
    }
    const p = l.min_price || l.max_price || l.price;
    if (p) return `₱${numberWithCommas(p)}`;
    return 'Contact';
  }

  function numberWithCommas(x){
    return String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  // Filtering logic
  function applyFilters() {
    const maxBudget = Number(priceRange.value) || MAX_PRICE_DEFAULT;
    const tenant = tenantType.value || 'All';
    const room = roomType.value || 'All';

    const filtered = rawListings.filter(l => {
      // price: if listing has min_price / max_price use max_price to compare
      const listingMax = l.max_price || l.min_price || l.price || 0;
      if (listingMax > maxBudget) return false;

      // tenant type
      if (tenant !== 'All' && (String(l.tenant_type || '').toLowerCase() !== tenant.toLowerCase())) return false;

      // room type
      if (room !== 'All' && (String(l.room_type || '').toLowerCase() !== room.toLowerCase())) return false;

      return true;
    });

    renderListings(filtered);
  }

  // UI wiring
  function setupFilters() {
    // show price text
    priceValue.textContent = `₱${priceRange.value}`;
    priceRange.addEventListener('input', e => {
      priceValue.textContent = `₱${e.target.value}`;
      applyFilters();
    });

    tenantType.addEventListener('change', applyFilters);
    roomType.addEventListener('change', applyFilters);
  }

  // Header hide/show on scroll
  function setupHeaderScroll() {
    const header = document.getElementById('site-header');
    let lastY = window.scrollY;
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
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

  // init
  async function init() {
    document.getElementById('year').textContent = new Date().getFullYear();
    priceRange.max = 6000;
    priceRange.value = 6000;
    priceValue.textContent = `₱${priceRange.value}`;
    setupFilters();
    setupHeaderScroll();

    try {
      await fetchListings();
    } catch (e) {
      console.error(e);
      rawListings = sampleData.map(normalize);
    }
    applyFilters();
  }

  // start
  init();
})();
