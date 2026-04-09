/**
 * Priced ticket listings browser + itinerary (localStorage + JSON export).
 */

const DATA_URL = "data/la28-ticket-listings.json";
const STORAGE_KEY = "la28-ticket-itinerary-v1";

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function $(sel) {
  return document.querySelector(sel);
}

function loadItinerary() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { v: 1, selectedIds: [] };
    const p = JSON.parse(raw);
    return { v: 1, selectedIds: [], ...p };
  } catch {
    return { v: 1, selectedIds: [] };
  }
}

function saveItinerary(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function eventCardHtml(ev, selectedSet) {
  const inList = selectedSet.has(ev.id);
  const price =
    ev.price_start_usd != null
      ? `<div class="event-price">From $${ev.price_start_usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>`
      : `<div class="event-price muted">${escapeHtml(ev.price_label || "—")}</div>`;

  return `<article class="event-card${inList ? " in-itinerary" : ""}" data-id="${escapeHtml(ev.id)}">
    <div class="event-code">${escapeHtml(ev.session_code)}</div>
    <div class="event-title">${escapeHtml(ev.title)}</div>
    <div class="event-meta">${escapeHtml(ev.description)}</div>
    <div class="event-meta">${escapeHtml(ev.date_iso)} · ${escapeHtml(ev.time)}</div>
    <div class="event-meta">${escapeHtml(ev.venue)} · ${escapeHtml(ev.zone)}</div>
    ${price}
    <button type="button" class="btn ${inList ? "btn-remove" : "btn-add"}" data-action="${inList ? "remove" : "add"}" data-id="${escapeHtml(ev.id)}">${inList ? "Remove from itinerary" : "Add to itinerary"}</button>
  </article>`;
}

function groupByDate(events) {
  const map = new Map();
  for (const e of events) {
    if (!map.has(e.date_iso)) map.set(e.date_iso, []);
    map.get(e.date_iso).push(e);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function applyFilters(events, q, zone) {
  const t = q.trim().toLowerCase();
  return events.filter((e) => {
    if (zone && e.zone !== zone) return false;
    if (!t) return true;
    const blob = [e.session_code, e.title, e.description, e.venue, e.zone, e.date_iso].join(" ").toLowerCase();
    return blob.includes(t);
  });
}

function sortEvents(events, mode) {
  const copy = [...events];
  if (mode === "low") {
    copy.sort((a, b) => (a.price_start_usd ?? Infinity) - (b.price_start_usd ?? Infinity));
  } else if (mode === "high") {
    copy.sort((a, b) => (b.price_start_usd ?? -1) - (a.price_start_usd ?? -1));
  } else {
    copy.sort((a, b) => {
      if (a.date_iso !== b.date_iso) return a.date_iso.localeCompare(b.date_iso);
      return a.session_code.localeCompare(b.session_code);
    });
  }
  return copy;
}

async function main() {
  const loadEl = $("#load-status");
  const errEl = $("#error-banner");
  const appEl = $("#app");
  let payload = null;
  let eventsById = new Map();
  let allEvents = [];
  let itinerary = loadItinerary();

  try {
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    payload = await res.json();
    allEvents = payload.events || [];
    eventsById = new Map(allEvents.map((e) => [e.id, e]));
    itinerary.selectedIds = itinerary.selectedIds.filter((id) => eventsById.has(id));
    saveItinerary(itinerary);
  } catch (e) {
    errEl.hidden = false;
    errEl.textContent =
      "Could not load la28-ticket-listings.json. Serve this folder over HTTP (e.g. GitHub Pages), not file://.";
    loadEl.textContent = "Failed to load.";
    console.error(e);
    return;
  }

  loadEl.hidden = true;
  appEl.hidden = false;

  const zones = [...new Set(allEvents.map((e) => e.zone).filter(Boolean))].sort();
  const zoneSel = $("#filter-zone");
  for (const z of zones) {
    const o = document.createElement("option");
    o.value = z;
    o.textContent = z;
    zoneSel.appendChild(o);
  }

  const browseEl = $("#browse-list");
  const itinEl = $("#itinerary-list");
  const totalsEl = $("#itinerary-totals");
  const statsEl = $("#stats-line");

  function selectedSet() {
    return new Set(itinerary.selectedIds);
  }

  function renderBrowse() {
    const q = $("#search").value;
    const zone = $("#filter-zone").value;
    const sortMode = $("#sort-price").value;
    let list = applyFilters(allEvents, q, zone);
    list = sortEvents(list, sortMode);
    const sel = selectedSet();

    statsEl.textContent = `Showing ${list.length} of ${allEvents.length} listings · ${itinerary.selectedIds.length} in itinerary`;

    if (!list.length) {
      browseEl.innerHTML = '<p class="empty-msg">No listings match. Clear search or zone.</p>';
      return;
    }

    if (sortMode === "date") {
      const groups = groupByDate(list);
      let html = "";
      for (const [date, evs] of groups) {
        html += `<section class="day-block"><h3>${escapeHtml(date)}</h3>`;
        for (const ev of evs) {
          html += eventCardHtml(ev, sel);
        }
        html += "</section>";
      }
      browseEl.innerHTML = html;
    } else {
      browseEl.innerHTML = `<div class="day-block">${list.map((ev) => eventCardHtml(ev, sel)).join("")}</div>`;
    }
  }

  function orderedItinerary() {
    return itinerary.selectedIds
      .map((id) => eventsById.get(id))
      .filter(Boolean)
      .sort((a, b) => a.date_iso.localeCompare(b.date_iso) || a.session_code.localeCompare(b.session_code));
  }

  function renderItinerary() {
    const ordered = orderedItinerary();
    if (!ordered.length) {
      itinEl.innerHTML = '<p class="muted">Nothing added yet.</p>';
      totalsEl.innerHTML = "";
      return;
    }

    let sum = 0;
    let n = 0;
    itinEl.innerHTML = ordered
      .map((ev) => {
        if (ev.price_start_usd != null) {
          sum += ev.price_start_usd;
          n++;
        }
        return `<div class="itin-item">
      <div><code>${escapeHtml(ev.session_code)}</code> · ${escapeHtml(ev.date_iso)}</div>
      <div class="muted" style="margin-top:4px;font-size:0.8rem">${escapeHtml(ev.title)}</div>
      <div class="muted" style="margin-top:4px">${escapeHtml(ev.venue)}</div>
      <div style="margin-top:6px">${ev.price_start_usd != null ? `From $${ev.price_start_usd.toFixed(2)}` : escapeHtml(ev.price_label || "—")}</div>
      <button type="button" class="btn btn-remove" data-action="remove" data-id="${escapeHtml(ev.id)}">Remove</button>
    </div>`;
      })
      .join("");

    totalsEl.innerHTML =
      n > 0
        ? `<div><strong>Sum of “from” prices (${n} with numeric price):</strong> ~$${sum.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div><p class="muted" style="margin-top:8px;margin-bottom:0">Not a checkout total — starting prices only.</p>`
        : "";
  }

  function fullRender() {
    renderBrowse();
    renderItinerary();
  }

  $("#search").addEventListener("input", () => fullRender());
  $("#filter-zone").addEventListener("change", () => fullRender());
  $("#sort-price").addEventListener("change", () => fullRender());

  browseEl.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action][data-id]");
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    const set = new Set(itinerary.selectedIds);
    if (action === "add") set.add(id);
    else set.delete(id);
    itinerary.selectedIds = [...set];
    saveItinerary(itinerary);
    fullRender();
  });

  itinEl.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action][data-id]");
    if (!btn || btn.dataset.action !== "remove") return;
    const id = btn.dataset.id;
    itinerary.selectedIds = itinerary.selectedIds.filter((x) => x !== id);
    saveItinerary(itinerary);
    fullRender();
  });

  $("#btn-clear").addEventListener("click", () => {
    if (!confirm("Clear all sessions from your itinerary on this device?")) return;
    itinerary.selectedIds = [];
    saveItinerary(itinerary);
    fullRender();
  });

  $("#btn-export").addEventListener("click", () => {
    const ordered = orderedItinerary();
    const out = {
      exported_at: new Date().toISOString(),
      source: "la28-ticket-listings.json",
      schema_version: 1,
      itinerary_sessions: ordered.map((e) => ({
        id: e.id,
        session_code: e.session_code,
        title: e.title,
        description: e.description,
        date_iso: e.date_iso,
        time: e.time,
        venue: e.venue,
        zone: e.zone,
        price_label: e.price_label,
        price_start_usd: e.price_start_usd,
        url: e.url,
      })),
      totals: {
        count: ordered.length,
        sum_price_start_usd: ordered.reduce((s, e) => s + (e.price_start_usd ?? 0), 0),
      },
    };
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `la28-priced-itinerary-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  fullRender();
}

main();
