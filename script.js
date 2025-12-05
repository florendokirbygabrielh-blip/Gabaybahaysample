/* script.js - GabayBahay
   - fetchListings() supports /listings.json fallback to sampleList
   - optional: provide SHEET_CSV_URL in the top-level constant to load published Google Sheet CSV
*/

const SHEET_CSV_URL = ""; // OPTIONAL: paste published CSV URL here (see instructions)
const LISTINGS_JSON_PATH = "/listings.json"; // primary attempt
const listingGrid = document.getElementById("listingGrid");
const priceRange = document.getElementById("priceRange");
const priceValue = document.getElementById("priceValue");
const tenantSelect = document.getElementById("tenantSelect");
const roomTypeSelect = document.getElementById("roomTypeSelect");
const dataSourceNote = document.getElementById("dataSourceNote");
const detailPanel = document.getElementById("detailPanel");
const detailContent = document.getElementById("detailContent");
const closeDetail = document.getElementById("closeDetail");
const overlay = document.getElementById("overlay");
document.getElementById("year").textContent = new Date().getFullYear();

// sample fallback dataset
const SAMPLE_LISTINGS = [
  {
    id: "patrick-rock",
    title: "Patrick's Rock House",
    tenant: "All Male",
    room_types: ["Bedspace","Solo"],
    price_min: 1150,
    price_max: 2000,
    distance: "200 steps",
    wifi: "Basic Access",
    image: "https://via.placeholder.com/480x320?text=Patrick%27s+Rock+House",
    description: "Cozy rock-house option. Bedspace and solo rooms available."
  },
  {
    id: "squidward-head",
    title: "Squidward's Head House",
    tenant: "All Female",
    room_types: ["Bedspace"],
    price_min: 2300,
    price_max: 2300,
    distance: "250 steps",
    wifi: "5G Converge",
    image: "https://via.placeholder.com/480x320?text=Squidward%27s+Head+House",
    description: "Quiet and tidy. Ideal for female tenants."
  },
   {
    id: "patrick-stone",
    title: "FrancisxLin Bh",
    tenant: "All Male",
    room_types: ["Bedspace","Solo"],
    price_min: 1150,
    price_max: 2000,
    distance: "200 steps",
    wifi: "Basic Access",
    image: "https://via.placeholder.com/480x320?text=Patrick%27s+Rock+House",
    description: "Cozy rock-house option. Bedspace and solo rooms available."
  },
  {
    id: "spongebob-pineapple",
    title: "Spongebob's Pineapple House",
    tenant: "Mixed",
    room_types: ["Bedspace","Studio"],
    price_min: 2000,
    price_max: 5700,
    distance: "100 steps",
    wifi: "5G PLDT",
    image: "https://via.placeholder.com/480x320?text=Spongebob%27s+Pineapple+House",
    description: "Unique pineapple structure with beach access and bright spaces."
  }
];

// UI: header hide/show on scroll
(function headerScroll() {
  const header = document.getElementById("siteHeader");
  let lastY = window.scrollY;
  window.addEventListener("scroll", () => {
    const y = window.scrollY;
    if (y > lastY && y > 60) header.classList.add("hidden");
    else header.classList.remove("hidden");
    lastY = y;
  });
})();

// detail panel open/close
function openDetail(listing) {
  detailContent.innerHTML = `
    <img src="${listing.image}" alt="${listing.title}" style="width:100%;border-radius:8px;margin-bottom:8px" data-img-id="${listing.id}" />
    <p class="muted">${listing.distance} • ${listing.wifi}</p>
    <h3>${listing.title}</h3>
    <p><strong>Tenant:</strong> ${listing.tenant}</p>
    <p><strong>Room types:</strong> ${listing.room_types.join(", ")}</p>
    <p><strong>Price:</strong> ₱${listing.price_min.toLocaleString()}${listing.price_max && listing.price_max !== listing.price_min ? " — ₱"+listing.price_max.toLocaleString() : ""}</p>
    <p>${listing.description || ""}</p>
  `;
  detailPanel.classList.add("open");
  detailPanel.setAttribute("aria-hidden","false");
  overlay.hidden = false;
  overlay.style.display = "block";
  overlay.focus && overlay.focus();
}

function closeDetailPanel(){
  detailPanel.classList.remove("open");
  detailPanel.setAttribute("aria-hidden","true");
  overlay.hidden = true;
  overlay.style.display = "none";
}

closeDetail.addEventListener("click", closeDetailPanel);
overlay.addEventListener("click", closeDetailPanel);
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeDetailPanel();
});

// fetchListings: try /listings.json -> optional google sheet -> sample
async function fetchListings(){
  dataSourceNote.textContent = "Attempting to load /listings.json ...";
  try {
    const resp = await fetch(LISTINGS_JSON_PATH, {cache: "no-store"});
    if (resp.ok){
      const data = await resp.json();
      dataSourceNote.textContent = "Loaded listings from /listings.json";
      return normalizeListings(data);
    } else {
      dataSourceNote.textContent = "listings.json not found; trying Google Sheet if provided...";
      throw new Error("listings.json not ok");
    }
  } catch(e){
    // try sheet CSV if URL provided
    if (SHEET_CSV_URL){
      dataSourceNote.textContent = "Attempting to load published Google Sheet...";
      try {
        const resp = await fetch(SHEET_CSV_URL);
        if (!resp.ok) throw new Error("sheet fetch failed");
        const text = await resp.text();
        const parsed = csvToJson(text);
        dataSourceNote.textContent = "Loaded listings from published Google Sheet CSV.";
        return normalizeListings(parsed);
      } catch(err){
        dataSourceNote.textContent = "Google Sheet fetch failed — using sample data.";
        return SAMPLE_LISTINGS;
      }
    } else {
      dataSourceNote.textContent = "Using sample embedded listings (no listings.json or Google Sheet).";
      return SAMPLE_LISTINGS;
    }
  }
}

// CSV to JSON simple parser (assumes header row)
function csvToJson(csvText){
  const rows = csvText.trim().split(/\r?\n/);
  if (!rows.length) return [];
  const headers = rows[0].split(",").map(h => h.trim());
  const data = rows.slice(1).map(r=>{
    const cols = r.split(",").map(c => c.trim());
    const obj = {};
    headers.forEach((h,i)=>obj[h]=cols[i] ?? "");
    return obj;
  });
  return data;
}

// normalize listings from different sources into consistent JS objects
function normalizeListings(raw){
  // if raw already an array of objects with expected fields, map them
  return raw.map(r => {
    // handle CSV string values vs proper objects
    const id = r.id || (r.title ? r.title.toLowerCase().replace(/\s+/g,"-") : Math.random().toString(36).slice(2,9));
    const title = r.title || r.Title || r.name || "Listing";
    const tenant = r.tenant || r.Tenant || "Mixed";
    const room_types = (r.room_types || r.room_types?.split?.(",") || r.RoomTypes || r.room_types)?.toString().split?.(",").map(s => s.trim()) || (r.room_type ? [r.room_type] : ["Bedspace"]);
    const price_min = Number(r.price_min ?? r.priceMin ?? r.PriceMin ?? r.price ?? r.Price) || Number(r.price_min) || 0;
    const price_max = Number(r.price_max ?? r.priceMax ?? r.PriceMax) || price_min;
    const distance = r.distance || r.Distance || "";
    const wifi = r.wifi || r.WiFi || r.wifi_type || "";
    const image = r.image || r.Image || `https://via.placeholder.com/480x320?text=${encodeURIComponent(title)}`;
    const description = r.description || r.Description || "";
    return { id, title, tenant, room_types, price_min, price_max, distance, wifi, image, description };
  });
}

// render function
function renderListings(listings){
  listingGrid.innerHTML = "";
  const maxBudget = +priceRange.value;
  const tenantFilter = tenantSelect.value;
  const roomFilter = roomTypeSelect.value;

  const filtered = listings.filter(l => {
    const withinPrice = l.price_min <= maxBudget || l.price_max <= maxBudget;
    const tenantOk = tenantFilter === "all" || l.tenant === tenantFilter;
    const roomOk = roomFilter === "all" || (l.room_types && l.room_types.includes(roomFilter));
    return withinPrice && tenantOk && roomOk;
  });

  if (!filtered.length){
    listingGrid.innerHTML = `<p>No listings match your filters.</p>`;
    return;
  }

  filtered.forEach(l => {
    const card = document.createElement("article");
    card.className = "card";
    card.setAttribute("tabindex","0");
    card.innerHTML = `
      <img src="${l.image}" alt="${l.title}" data-img-id="${l.id}" />
      <div class="meta"><div>${l.distance || ""}</div><div class="price">₱${l.price_min.toLocaleString()}${l.price_max !== l.price_min ? " — ₱"+l.price_max.toLocaleString() : ""}</div></div>
      <h4>${l.title}</h4>
      <p class="muted">${l.wifi || ""}</p>
      <div class="meta"><div class="muted">${l.tenant} • ${l.room_types.join(", ")}</div></div>
      <div class="actions">
        <button class="view-btn" data-id="${l.id}">View details</button>
      </div>
    `;
    listingGrid.appendChild(card);
  });

  // attach listeners to view buttons
  listingGrid.querySelectorAll(".view-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const id = e.currentTarget.dataset.id;
      const listing = listings.find(x=>x.id === id);
      openDetail(listing);
    });
  });
}

// wire up filters
priceRange.addEventListener("input", () => {
  priceValue.value = priceRange.value;
  refreshListings();
});
priceValue.value = priceRange.value;
tenantSelect.addEventListener("change", refreshListings);
roomTypeSelect.addEventListener("change", refreshListings);

let cachedListings = [];

// initial load
async function refreshListings(){
  renderListings(cachedListings);
}

(async function init(){
  const listings = await fetchListings();
  cachedListings = listings;
  renderListings(cachedListings);
})();
