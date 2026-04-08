/**
 * Simple LA28 calendar: trip dates + family sports only. Selections → localStorage + JSON export.
 */

const STORAGE_KEY = "la28-family-planner-v2";
const DATA_URL = "data/LA28CompetitionScheduleByVenueSportSessionDetailed.json";

/** Sports your family actually talked about (exact strings from the schedule JSON). */
const FAMILY_SPORTS = new Set([
  "Athletics (Track & Field)",
  "Lacrosse",
  "Swimming",
  "Beach Volleyball",
  "Artistic Swimming",
  "Water Polo",
  "Climbing",
  "Rhythmic Gymnastics",
  "Triathlon",
  "Sailing (Windsurfing & Kite)",
  "Sailing (Dinghy, Skiff &\nMultihull)",
]);

/**
 * Equestrian: eventing (EQU01–EQU05) + jumping (EQU13–EQU16).
 * Dressage-only block EQU06–EQU12 is excluded — that matches “jumping + eventing” for Katlyn.
 */
const EQUESTRIAN_INCLUDED = new Set([
  "EQU01",
  "EQU02",
  "EQU03",
  "EQU04",
  "EQU05",
  "EQU13",
  "EQU14",
  "EQU15",
  "EQU16",
]);

/** Short labels from LA28 schedule wording (see Event Detailed PDF export). */
const EQU_LABEL = {
  EQU01: "Eventing — dressage (team & individual, day 1)",
  EQU02: "Eventing — dressage (team & individual, day 1)",
  EQU03: "Eventing — dressage (team & individual, day 2)",
  EQU04: "Eventing — cross country (team & individual)",
  EQU05: "Eventing — jumping finals (team + individual)",
  EQU13: "Jumping — team qualifier",
  EQU14: "Jumping — team final",
  EQU15: "Jumping — individual qualifier",
  EQU16: "Jumping — individual final",
};

const QUICK_PICKS = [
  { code: "ATH03", date_iso: "2028-07-16", label: "ATH03 — Sun Jul 16 (Sienna track day)" },
  { code: "LAC05", date_iso: "2028-07-26", label: "LAC05 — Wed Jul 26 (Sienna lacrosse day)" },
  { code: "EQU05", date_iso: "2028-07-18", label: "EQU05 — Tue Jul 18 (eventing jumping finals)" },
  { code: "EQU14", date_iso: "2028-07-26", label: "EQU14 — Wed Jul 26 (jumping team final, stacks with LAC05)" },
  { code: "EQU15", date_iso: "2028-07-28", label: "EQU15 — Fri Jul 28 (jumping individual qualifier)" },
  { code: "EQU16", date_iso: "2028-07-29", label: "EQU16 — Sat Jul 29 (jumping individual final)" },
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function sessionId(code, dateIso) {
  return `${code}|${dateIso}`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sportClass(sport) {
  if (sport.includes("Athletics")) return "ath";
  if (sport.includes("Lacrosse")) return "lacrosse";
  if (sport.includes("Swimming")) return "swim";
  if (sport === "Equestrian") return "equestrian";
  if (sport.includes("Beach")) return "beach";
  if (sport.includes("Artistic Swimming")) return "artswim";
  if (sport.includes("Water Polo")) return "polo";
  if (sport.includes("Climbing")) return "climb";
  if (sport.includes("Sailing")) return "sail";
  if (sport.includes("Rhythmic")) return "rhythmic";
  if (sport.includes("Triathlon")) return "tri";
  return "other";
}

function flattenFamilyOnly(json) {
  const out = [];
  for (const block of json.venue_sport_schedules) {
    const { venue, sport, zone } = block;
    if (!FAMILY_SPORTS.has(sport) && sport !== "Equestrian") continue;

    for (const s of block.sessions) {
      if (sport === "Equestrian" && !EQUESTRIAN_INCLUDED.has(s.session_code)) continue;

      const eqLabel = sport === "Equestrian" ? EQU_LABEL[s.session_code] || "" : "";

      out.push({
        id: sessionId(s.session_code, s.date_iso),
        session_code: s.session_code,
        date_iso: s.date_iso,
        date_label: s.date_label,
        weekday: s.weekday,
        sport,
        venue,
        zone,
        session_type: s.session_type,
        start_time_local: s.start_time_local,
        end_time_local: s.end_time_local,
        local_timezone_label: s.local_timezone_label,
        medal_profile: s.medal_profile,
        eqLabel,
      });
    }
  }
  out.sort((a, b) => {
    if (a.date_iso !== b.date_iso) return a.date_iso.localeCompare(b.date_iso);
    const ta = a.start_time_local || "";
    const tb = b.start_time_local || "";
    if (ta !== tb) return ta.localeCompare(tb);
    return a.session_code.localeCompare(b.session_code);
  });
  return out;
}

function formatTime(s) {
  const tz = s.local_timezone_label && s.local_timezone_label !== "PT" ? ` ${s.local_timezone_label}` : "";
  if (s.start_time_local && s.end_time_local) return `${s.start_time_local}–${s.end_time_local}${tz}`;
  if (s.start_time_local) return `${s.start_time_local}${tz}`;
  return "Time TBD";
}

function defaultState() {
  return {
    v: 2,
    arrivalDate: "2028-07-14",
    departureDate: "2028-07-30",
    travelerName: "",
    notes: "",
    selectedIds: [],
    viewMode: "all",
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return { ...defaultState(), ...parsed };
  } catch {
    return defaultState();
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function enumerateDays(arrival, departure) {
  const days = [];
  const cur = new Date(`${arrival}T12:00:00`);
  const end = new Date(`${departure}T12:00:00`);
  if (cur > end) return days;
  while (cur <= end) {
    days.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

/** Build week rows (Sun-first); null = empty padding cell. */
function calendarCells(dayIsos) {
  if (!dayIsos.length) return [];
  const first = new Date(`${dayIsos[0]}T12:00:00`);
  const pad = first.getDay();
  const cells = [];
  for (let i = 0; i < pad; i++) cells.push(null);
  for (const iso of dayIsos) cells.push(iso);
  while (cells.length % 7 !== 0) cells.push(null);
  const rows = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }
  return rows;
}

function buildExport(state, sessionsById) {
  const selected = state.selectedIds.map((id) => sessionsById.get(id)).filter(Boolean);
  return {
    exported_at: new Date().toISOString(),
    app: "LA28 Family Planner (simple calendar)",
    trip: {
      arrival_date: state.arrivalDate,
      departure_date: state.departureDate,
      traveler_name: state.travelerName || null,
      notes: state.notes || null,
    },
    selected_session_ids: [...state.selectedIds],
    sessions: selected.map((s) => ({
      id: s.id,
      code: s.session_code,
      date: s.date_iso,
      sport: s.sport,
      type: s.session_type,
      time: formatTime(s),
      venue: s.venue,
      zone: s.zone,
      ...(s.eqLabel ? { equestrian_detail: s.eqLabel } : {}),
    })),
  };
}

function downloadJson(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function sanitizeName(n) {
  return (n || "trip").replace(/[^a-z0-9-_]+/gi, "-").replace(/^-|-$/g, "").slice(0, 40) || "trip";
}

function $(sel) {
  return document.querySelector(sel);
}

async function main() {
  const loadEl = $("#load-status");
  const errEl = $("#error-banner");
  const appEl = $("#app");

  let allFamilySessions = [];
  let sessionsById = new Map();
  let state = loadState();

  try {
    loadEl.textContent = "Loading…";
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error(String(res.status));
    const json = await res.json();
    allFamilySessions = flattenFamilyOnly(json);
    sessionsById = new Map(allFamilySessions.map((s) => [s.id, s]));
    state.selectedIds = state.selectedIds.filter((id) => sessionsById.has(id));
    saveState(state);
  } catch (e) {
    errEl.hidden = false;
    errEl.textContent =
      "Could not load the schedule file. Open this site over HTTP (GitHub Pages or a local server), not as a raw file.";
    loadEl.textContent = "Could not load.";
    console.error(e);
    return;
  }

  loadEl.hidden = true;
  appEl.hidden = false;

  const els = {
    arrival: $("#arrival-date"),
    departure: $("#departure-date"),
    name: $("#traveler-name"),
    notes: $("#notes"),
    viewAll: $("#view-all"),
    viewSel: $("#view-selected"),
    calHead: $("#cal-head"),
    calBody: $("#cal-body"),
    count: $("#session-count"),
    selCount: $("#selected-count"),
    exportBtn: $("#btn-export"),
    resetBtn: $("#btn-reset"),
    quick: $("#quick-picks"),
  };

  const boundsMin = "2028-07-10";
  const boundsMax = "2028-08-15";
  els.arrival.min = boundsMin;
  els.arrival.max = boundsMax;
  els.departure.min = boundsMin;
  els.departure.max = boundsMax;

  function sessionsInTrip() {
    const a = state.arrivalDate;
    const b = state.departureDate;
    return allFamilySessions.filter((s) => s.date_iso >= a && s.date_iso <= b);
  }

  function visibleSessions() {
    const inTrip = sessionsInTrip();
    if (state.viewMode === "selected_only") {
      const set = new Set(state.selectedIds);
      return inTrip.filter((s) => set.has(s.id));
    }
    return inTrip;
  }

  function eventsByDate(visible) {
    const map = new Map();
    for (const s of visible) {
      if (!map.has(s.date_iso)) map.set(s.date_iso, []);
      map.get(s.date_iso).push(s);
    }
    return map;
  }

  function renderQuickPicks() {
    els.quick.innerHTML = QUICK_PICKS.map(
      (p) =>
        `<button type="button" class="btn small" data-pick="${escapeHtml(p.code)}" data-date="${escapeHtml(p.date_iso)}">${escapeHtml(p.label)}</button>`
    ).join("");
  }

  function renderCalendar() {
    const visible = visibleSessions();
    const byDate = eventsByDate(visible);
    const tripDays = enumerateDays(state.arrivalDate, state.departureDate);
    const rows = calendarCells(tripDays);

    els.count.textContent = String(visible.length);
    els.selCount.textContent = String(state.selectedIds.length);

    els.calHead.innerHTML = WEEKDAYS.map((d) => `<div class="cal-dow">${d}</div>`).join("");

    const selectedSet = new Set(state.selectedIds);
    let bodyHtml = "";

    for (const row of rows) {
      bodyHtml += '<div class="cal-row">';
      for (const iso of row) {
        if (iso === null) {
          bodyHtml += '<div class="cal-cell cal-cell--pad" aria-hidden="true"></div>';
          continue;
        }
        const list = byDate.get(iso) || [];
        const d = new Date(`${iso}T12:00:00`);
        const dayNum = d.getDate();
        const sub = d.toLocaleDateString("en-US", { month: "short" });

        let eventsHtml = "";
        for (const s of list) {
          const sel = selectedSet.has(s.id) ? " cal-event--selected" : "";
          const sienna =
            (s.session_code === "ATH03" && s.date_iso === "2028-07-16") ||
            (s.session_code === "LAC05" && s.date_iso === "2028-07-26")
              ? " cal-event--sienna"
              : "";
          const eqLine = s.eqLabel
            ? `<span class="cal-event-eq">${escapeHtml(s.eqLabel)}</span>`
            : "";
          eventsHtml += `<button type="button" class="cal-event ${sportClass(s.sport)}${sel}${sienna}" data-id="${escapeHtml(s.id)}" title="${escapeHtml(s.venue)}">
            <span class="cal-event-code">${escapeHtml(s.session_code)}</span>
            <span class="cal-event-sport">${escapeHtml(s.sport.replace(/\n/g, " "))}</span>
            ${eqLine}
            <span class="cal-event-meta">${escapeHtml(formatTime(s))}</span>
          </button>`;
        }

        if (!eventsHtml) {
          eventsHtml = '<div class="cal-empty">No sessions this day</div>';
        }

        bodyHtml += `<div class="cal-cell">
          <div class="cal-day-head"><span class="cal-day-num">${dayNum}</span><span class="cal-day-sub">${sub}</span></div>
          <div class="cal-events">${eventsHtml}</div>
        </div>`;
      }
      bodyHtml += "</div>";
    }

    els.calBody.innerHTML = bodyHtml;
  }

  function syncForm() {
    els.arrival.value = state.arrivalDate;
    els.departure.value = state.departureDate;
    els.name.value = state.travelerName;
    els.notes.value = state.notes;
    els.viewAll.checked = state.viewMode === "all";
    els.viewSel.checked = state.viewMode === "selected_only";
  }

  function fullRender() {
    syncForm();
    renderQuickPicks();
    renderCalendar();
  }

  els.arrival.addEventListener("change", () => {
    state.arrivalDate = els.arrival.value;
    if (state.departureDate < state.arrivalDate) {
      state.departureDate = state.arrivalDate;
      els.departure.value = state.departureDate;
    }
    saveState(state);
    fullRender();
  });

  els.departure.addEventListener("change", () => {
    state.departureDate = els.departure.value;
    if (state.arrivalDate > state.departureDate) {
      state.arrivalDate = state.departureDate;
      els.arrival.value = state.arrivalDate;
    }
    saveState(state);
    fullRender();
  });

  els.name.addEventListener("input", () => {
    state.travelerName = els.name.value;
    saveState(state);
  });

  els.notes.addEventListener("input", () => {
    state.notes = els.notes.value;
    saveState(state);
  });

  els.viewAll.addEventListener("change", () => {
    if (els.viewAll.checked) {
      state.viewMode = "all";
      saveState(state);
      fullRender();
    }
  });

  els.viewSel.addEventListener("change", () => {
    if (els.viewSel.checked) {
      state.viewMode = "selected_only";
      saveState(state);
      fullRender();
    }
  });

  els.calBody.addEventListener("click", (e) => {
    const btn = e.target.closest(".cal-event[data-id]");
    if (!btn) return;
    const id = btn.dataset.id;
    const set = new Set(state.selectedIds);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    state.selectedIds = [...set];
    saveState(state);
    btn.classList.toggle("cal-event--selected", set.has(id));
    els.selCount.textContent = String(state.selectedIds.length);
  });

  els.quick.addEventListener("click", (e) => {
    const b = e.target.closest("[data-pick]");
    if (!b) return;
    const id = sessionId(b.dataset.pick, b.dataset.date);
    if (!sessionsById.has(id)) return;
    const set = new Set(state.selectedIds);
    set.add(id);
    state.selectedIds = [...set];
    saveState(state);
    fullRender();
  });

  els.exportBtn.addEventListener("click", () => {
    const payload = buildExport(state, sessionsById);
    const fn = `la28-trip-${sanitizeName(state.travelerName)}-${new Date().toISOString().slice(0, 10)}.json`;
    downloadJson(payload, fn);
  });

  els.resetBtn.addEventListener("click", () => {
    if (!confirm("Clear saved choices on this device?")) return;
    localStorage.removeItem(STORAGE_KEY);
    state = defaultState();
    saveState(state);
    fullRender();
  });

  fullRender();
}

main();
