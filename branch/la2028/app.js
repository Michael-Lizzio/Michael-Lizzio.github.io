(function () {
  "use strict";

  const STORAGE_KEY = "la28-itinerary-v1";
  const THEME_KEY = "la28-theme";
  const icons = window.LA28SportIcons;

  /** @type {ReturnType<typeof normalizeTicket>[] | null} */
  let allEvents = null;
  /** @type {Set<string>} */
  const selectedIds = new Set();

  const state = {
    search: "",
    sport: "",
    zone: "",
    day: "",
    priceMax: "",
    sortBy: "date-asc",
    view: "list",
    calMonth: new Date(2028, 6, 1),
    selectedCalDay: "",
    dataPartial: false,
  };

  const els = {};

  function $(id) {
    return document.getElementById(id);
  }

  function simpleId(parts) {
    const s = parts.join("|");
    let h = 0;
    for (let i = 0; i < s.length; i += 1) {
      h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    }
    return "e" + (h >>> 0).toString(16);
  }

  function parsePriceAmount(raw, display) {
    if (raw != null && typeof raw === "number" && !Number.isNaN(raw)) return raw;
    const d = String(display || "").replace(/,/g, "");
    const m = d.match(/(\d+(\.\d+)?)/);
    return m ? parseFloat(m[1]) : null;
  }

  function parseDateToken(str) {
    const m = String(str || "")
      .trim()
      .match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (!m) return { dateObj: null, dateKey: "", invalid: true };
    const p1 = +m[1];
    const p2 = +m[2];
    const y = +m[3];

    function finish(d) {
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return { dateObj: d, dateKey, invalid: false };
    }

    if (p1 >= 1 && p1 <= 12 && p2 >= 1 && p2 <= 31) {
      const d = new Date(y, p1 - 1, p2);
      if (d.getFullYear() === y && d.getMonth() === p1 - 1 && d.getDate() === p2) return finish(d);
    }
    if (p2 >= 1 && p2 <= 12 && p1 >= 1 && p1 <= 31) {
      const d = new Date(y, p2 - 1, p1);
      if (d.getFullYear() === y && d.getMonth() === p2 - 1 && d.getDate() === p1) return finish(d);
    }
    return { dateObj: null, dateKey: "", invalid: true };
  }

  function sortMinutes(timeLocal) {
    const s = String(timeLocal || "").toLowerCase();
    if (s.includes("tbc")) return 12 * 60;
    const m = s.match(/(\d{1,2}):(\d{2})/);
    if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
    const m2 = s.match(/(\d{1,2})\s*(am|pm)/);
    if (m2) {
      let h = parseInt(m2[1], 10);
      if (m2[2] === "pm" && h < 12) h += 12;
      if (m2[2] === "am" && h === 12) h = 0;
      return h * 60;
    }
    return 12 * 60;
  }

  function normalizeTicket(t) {
    const eventCode = String(t.event_code || "").trim();
    const sportKey = icons.getSportKey(eventCode);
    let emoji = icons.emojiForSportKey(sportKey);
    if (emoji === icons.SPORT_EMOJI.DEFAULT) {
      emoji = icons.emojiFromTitle(t.title || "");
    }
    const { dateObj, dateKey, invalid } = parseDateToken(t.date);
    const priceValue = parsePriceAmount(t.price_amount, t.price_display);
    const id = simpleId([
      eventCode,
      t.date || "",
      t.time_local || "",
      t.venue || "",
      t.title || "",
    ]);
    return {
      id,
      event_code: eventCode,
      title: String(t.title || ""),
      description: String(t.description || ""),
      dateRaw: String(t.date || ""),
      time_local: String(t.time_local || ""),
      venue: String(t.venue || ""),
      zone: String(t.zone || ""),
      price_display: String(t.price_display || ""),
      priceValue,
      currency: String(t.currency || "USD"),
      source_image: t.source_image ? String(t.source_image) : "",
      sportKey,
      emoji,
      dateObj,
      dateKey,
      dateInvalid: invalid,
      sortMinutes: sortMinutes(t.time_local),
    };
  }

  function getDataUrl() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("partial") === "1" || params.get("partial") === "true") {
      return "./tickets/extracted_tickets.json.partial";
    }
    return "./tickets/extracted_tickets.json";
  }

  async function loadDataFromFetch() {
    const url = getDataUrl();
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status} loading ${url}`);
    return res.json();
  }

  function ingestPayload(payload) {
    const tickets = payload && Array.isArray(payload.tickets) ? payload.tickets : [];
    allEvents = tickets.map(normalizeTicket);
    const meta = payload && payload.meta;
    state.dataPartial =
      !!(meta && typeof meta.processed_image_count === "number" && typeof meta.planned_image_count === "number" && meta.processed_image_count < meta.planned_image_count);
  }

  function loadItineraryFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.version !== 1 || !Array.isArray(data.selectedIds)) return;
      data.selectedIds.forEach((id) => selectedIds.add(String(id)));
    } catch (_) {
      /* ignore */
    }
  }

  function saveItineraryToStorage() {
    const payload = {
      version: 1,
      selectedIds: Array.from(selectedIds),
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }

  function pruneItineraryIds() {
    if (!allEvents) return;
    const valid = new Set(allEvents.map((e) => e.id));
    let removed = 0;
    selectedIds.forEach((id) => {
      if (!valid.has(id)) {
        selectedIds.delete(id);
        removed += 1;
      }
    });
    if (removed) console.info("[LA28] Dropped", removed, "itinerary id(s) not present in current data.");
  }

  function getFilteredSorted() {
    if (!allEvents) return [];
    let list = allEvents.slice();
    const q = state.search.trim().toLowerCase();
    if (q) {
      list = list.filter((e) => {
        const blob = [e.title, e.event_code, e.venue, e.zone, e.description, e.time_local].join(" ").toLowerCase();
        return blob.includes(q);
      });
    }
    if (state.sport) list = list.filter((e) => e.sportKey === state.sport);
    if (state.zone) list = list.filter((e) => e.zone === state.zone);
    if (state.day) list = list.filter((e) => e.dateKey === state.day);
    const maxP = state.priceMax === "" ? null : Number(state.priceMax);
    if (maxP != null && !Number.isNaN(maxP)) {
      list = list.filter((e) => e.priceValue != null && e.priceValue <= maxP);
    }

    const sortBy = state.sortBy;
    list.sort((a, b) => {
      if (sortBy === "date-asc" || sortBy === "date-desc") {
        const ta = a.dateObj ? a.dateObj.getTime() : 0;
        const tb = b.dateObj ? b.dateObj.getTime() : 0;
        if (ta !== tb) return sortBy === "date-asc" ? ta - tb : tb - ta;
        const sm = a.sortMinutes - b.sortMinutes;
        if (sm !== 0) return sortBy === "date-asc" ? sm : -sm;
      }
      if (sortBy === "price-asc" || sortBy === "price-desc") {
        const pa = a.priceValue;
        const pb = b.priceValue;
        if (pa == null && pb == null) return 0;
        if (pa == null) return 1;
        if (pb == null) return -1;
        if (pa !== pb) return sortBy === "price-asc" ? pa - pb : pb - pa;
      }
      const cmp = a.title.localeCompare(b.title);
      if (sortBy === "title-asc") return cmp;
      if (sortBy === "title-desc") return -cmp;
      return 0;
    });
    return list;
  }

  function uniqueSortedDays() {
    if (!allEvents) return [];
    const keys = new Set();
    allEvents.forEach((e) => {
      if (e.dateKey) keys.add(e.dateKey);
    });
    return Array.from(keys).sort();
  }

  function uniqueSports() {
    if (!allEvents) return [];
    const keys = new Set();
    allEvents.forEach((e) => {
      if (e.sportKey) keys.add(e.sportKey);
    });
    return Array.from(keys).sort();
  }

  function uniqueZones() {
    if (!allEvents) return [];
    const keys = new Set();
    allEvents.forEach((e) => {
      if (e.zone) keys.add(e.zone);
    });
    return Array.from(keys).sort();
  }

  function passesFiltersExceptDay(e) {
    const q = state.search.trim().toLowerCase();
    if (q) {
      const blob = [e.title, e.event_code, e.venue, e.zone, e.description, e.time_local].join(" ").toLowerCase();
      if (!blob.includes(q)) return false;
    }
    if (state.sport && e.sportKey !== state.sport) return false;
    if (state.zone && e.zone !== state.zone) return false;
    const maxP = state.priceMax === "" ? null : Number(state.priceMax);
    if (maxP != null && !Number.isNaN(maxP)) {
      if (e.priceValue == null || e.priceValue > maxP) return false;
    }
    return true;
  }

  function eventsByDateKeyFiltered() {
    /** @type {Record<string, typeof allEvents>} */
    const map = {};
    if (!allEvents) return map;
    allEvents.forEach((e) => {
      if (!e.dateKey || !passesFiltersExceptDay(e)) return;
      if (!map[e.dateKey]) map[e.dateKey] = [];
      map[e.dateKey].push(e);
    });
    return map;
  }

  function renderFilterOptions() {
    const sportSel = els.filterSport;
    const zoneSel = els.filterZone;
    const daySel = els.filterDay;
    const sports = uniqueSports();
    const zones = uniqueZones();
    const days = uniqueSortedDays();

    const keepSport = state.sport;
    sportSel.innerHTML = '<option value="">All sports</option>';
    sports.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = s;
      sportSel.appendChild(opt);
    });
    sportSel.value = sports.includes(keepSport) ? keepSport : "";

    const keepZone = state.zone;
    zoneSel.innerHTML = '<option value="">All zones</option>';
    zones.forEach((z) => {
      const opt = document.createElement("option");
      opt.value = z;
      opt.textContent = z;
      zoneSel.appendChild(opt);
    });
    zoneSel.value = zones.includes(keepZone) ? keepZone : "";

    const keepDay = state.day;
    daySel.innerHTML = '<option value="">All days</option>';
    days.forEach((d) => {
      const opt = document.createElement("option");
      opt.value = d;
      opt.textContent = d;
      daySel.appendChild(opt);
    });
    daySel.value = days.includes(keepDay) ? keepDay : "";
  }

  function renderEventCard(e) {
    const inIt = selectedIds.has(e.id);
    const card = document.createElement("article");
    card.className = "event-card" + (inIt ? " is-in-itinerary" : "");
    card.dataset.id = e.id;

    const emoji = document.createElement("div");
    emoji.className = "event-card__emoji";
    emoji.textContent = e.emoji;
    emoji.setAttribute("aria-hidden", "true");

    const body = document.createElement("div");
    body.className = "event-card__body";
    const h3 = document.createElement("h3");
    h3.textContent = e.title;
    if (e.dateInvalid) {
      const b = document.createElement("span");
      b.className = "event-card__badge";
      b.textContent = "Date?";
      h3.appendChild(b);
    }
    const meta = document.createElement("p");
    meta.className = "event-card__meta";
    meta.textContent = [e.dateRaw, e.time_local, e.venue, e.zone].filter(Boolean).join(" · ");
    const desc = document.createElement("p");
    desc.className = "event-card__desc";
    desc.textContent = e.description;
    body.appendChild(h3);
    body.appendChild(meta);
    if (e.description) body.appendChild(desc);

    const price = document.createElement("div");
    price.className = "event-card__price";
    price.textContent = e.price_display || (e.priceValue != null ? `$${e.priceValue.toFixed(2)}` : "—");

    const actions = document.createElement("div");
    actions.className = "event-card__actions";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn " + (inIt ? "btn--danger" : "btn--primary");
    btn.textContent = inIt ? "Remove" : "Add to itinerary";
    btn.addEventListener("click", () => {
      if (selectedIds.has(e.id)) selectedIds.delete(e.id);
      else selectedIds.add(e.id);
      saveItineraryToStorage();
      refresh();
    });
    actions.appendChild(btn);

    card.appendChild(emoji);
    card.appendChild(body);
    card.appendChild(price);
    card.appendChild(actions);
    return card;
  }

  function renderList() {
    const container = els.eventList;
    const empty = els.listEmpty;
    container.innerHTML = "";
    const list = getFilteredSorted();
    if (list.length === 0) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    list.forEach((e) => container.appendChild(renderEventCard(e)));
  }

  function startOfCalendarMonth(d) {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }

  function renderCalendar() {
    const month = state.calMonth;
    const start = startOfCalendarMonth(month);
    const label = els.calMonthLabel;
    label.textContent = start.toLocaleDateString("en-US", { month: "long", year: "numeric" });

    const grid = els.calendarGrid;
    grid.innerHTML = "";

    const firstDow = start.getDay();
    const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    const map = eventsByDateKeyFiltered();

    const prevPad = firstDow;
    const totalCells = Math.ceil((prevPad + daysInMonth) / 7) * 7;
    const prevMonthLastDate = new Date(start.getFullYear(), start.getMonth(), 0).getDate();

    const todayKey = (() => {
      const n = new Date();
      return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
    })();

    for (let i = 0; i < totalCells; i += 1) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "calendar-cell";

      if (i < prevPad) {
        cell.classList.add("calendar-cell--muted");
        cell.disabled = true;
        const dayNum = prevMonthLastDate - prevPad + i + 1;
        cell.innerHTML = `<span class="calendar-cell__num">${dayNum}</span><span class="calendar-cell__dots"> </span>`;
        grid.appendChild(cell);
        continue;
      }

      if (i >= prevPad + daysInMonth) {
        cell.classList.add("calendar-cell--muted");
        cell.disabled = true;
        const nextMonDay = i - (prevPad + daysInMonth) + 1;
        cell.innerHTML = `<span class="calendar-cell__num">${nextMonDay}</span><span class="calendar-cell__dots"> </span>`;
        grid.appendChild(cell);
        continue;
      }

      const dayNum = i - prevPad + 1;
      const d = new Date(start.getFullYear(), start.getMonth(), dayNum);
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const evs = map[dateKey] || [];
      const count = evs.length;

      cell.innerHTML = `<span class="calendar-cell__num">${dayNum}</span><span class="calendar-cell__dots">${count ? `${count} session${count === 1 ? "" : "s"}` : " "}</span>`;

      if (dateKey === todayKey) cell.classList.add("calendar-cell--today");
      if (dateKey === state.selectedCalDay) cell.classList.add("calendar-cell--selected");

      cell.addEventListener("click", () => {
        state.selectedCalDay = dateKey;
        state.day = dateKey;
        els.filterDay.value = dateKey;
        renderCalendar();
        renderCalendarDayEvents();
      });

      grid.appendChild(cell);
    }

    renderCalendarDayEvents();
  }

  function renderCalendarDayEvents() {
    const wrap = els.calendarDayEvents;
    const key = state.selectedCalDay;
    if (!key) {
      wrap.innerHTML = "<p class=\"empty-state\">Select a day on the calendar.</p>";
      return;
    }
    const map = eventsByDateKeyFiltered();
    const evs = map[key] || [];
    const h3 = document.createElement("h3");
    h3.textContent = `Sessions on ${key} (${evs.length})`;
    wrap.innerHTML = "";
    wrap.appendChild(h3);
    if (evs.length === 0) {
      const p = document.createElement("p");
      p.className = "empty-state";
      p.textContent = "No events in the dataset for this day.";
      wrap.appendChild(p);
      return;
    }
    const sorted = evs.slice().sort((a, b) => a.sortMinutes - b.sortMinutes);
    sorted.forEach((e) => wrap.appendChild(renderEventCard(e)));
  }

  function eventById(id) {
    if (!allEvents) return null;
    return allEvents.find((e) => e.id === id) || null;
  }

  function renderItinerary() {
    const ul = els.itineraryList;
    const empty = els.itineraryEmpty;
    const totalEl = els.itineraryTotal;
    const noteEl = els.itineraryTotalNote;
    const fabCount = els.fabCount;

    ul.innerHTML = "";
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      empty.hidden = false;
      totalEl.textContent = "—";
      noteEl.textContent = "";
      fabCount.textContent = "0";
      return;
    }
    empty.hidden = true;
    fabCount.textContent = String(ids.length);

    const byDay = {};
    ids.forEach((id) => {
      const e = eventById(id);
      if (!e) return;
      const k = e.dateKey || "_nodate";
      if (!byDay[k]) byDay[k] = [];
      byDay[k].push(e);
    });

    const dayKeys = Object.keys(byDay).sort();

    dayKeys.forEach((dk) => {
      const group = document.createElement("li");
      group.className = "itinerary-group";
      const label = document.createElement("div");
      label.className = "itinerary-group__label";
      label.textContent = dk === "_nodate" ? "Date TBC" : dk;
      group.appendChild(label);

      byDay[dk].sort((a, b) => {
        const ta = a.dateObj ? a.dateObj.getTime() : 0;
        const tb = b.dateObj ? b.dateObj.getTime() : 0;
        if (ta !== tb) return ta - tb;
        return a.sortMinutes - b.sortMinutes;
      });

      byDay[dk].forEach((e) => {
        const item = document.createElement("div");
        item.className = "itinerary-item";

        const em = document.createElement("span");
        em.className = "itinerary-item__emoji";
        em.textContent = e.emoji;

        const tit = document.createElement("div");
        tit.className = "itinerary-item__title";
        tit.textContent = e.title;

        const price = document.createElement("div");
        price.className = "itinerary-item__price";
        price.textContent = e.price_display || (e.priceValue != null ? `$${e.priceValue.toFixed(2)}` : "—");

        const rm = document.createElement("button");
        rm.type = "button";
        rm.className = "itinerary-item__remove";
        rm.setAttribute("aria-label", "Remove from itinerary");
        rm.textContent = "✕";
        rm.addEventListener("click", () => {
          selectedIds.delete(e.id);
          saveItineraryToStorage();
          refresh();
        });

        const meta = document.createElement("div");
        meta.className = "itinerary-item__meta";
        meta.textContent = [e.time_local, e.venue].filter(Boolean).join(" · ");

        item.appendChild(em);
        item.appendChild(tit);
        item.appendChild(price);
        item.appendChild(rm);
        item.appendChild(meta);

        group.appendChild(item);
      });

      ul.appendChild(group);
    });

    let sum = 0;
    let unknown = 0;
    ids.forEach((id) => {
      const e = eventById(id);
      if (!e) return;
      if (e.priceValue != null) sum += e.priceValue;
      else unknown += 1;
    });

    if (unknown === 0) {
      totalEl.textContent = `$${sum.toFixed(2)}`;
      noteEl.textContent = "Sum of listed starting prices only; not an official quote.";
    } else {
      totalEl.textContent = `$${sum.toFixed(2)} + ${unknown} unpriced`;
      noteEl.textContent =
        "Some sessions have no parsed price; total reflects priced lines only. Not an official quote.";
    }
  }

  function setView(view) {
    state.view = view;
    document.querySelectorAll(".view-toggle__btn").forEach((btn) => {
      const v = btn.getAttribute("data-view");
      const on = v === view;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
    const listView = $("list-view");
    const calView = $("calendar-view");
    if (view === "list") {
      listView.hidden = false;
      calView.hidden = true;
      renderList();
    } else {
      listView.hidden = true;
      calView.hidden = false;
      if (!state.selectedCalDay && state.day) state.selectedCalDay = state.day;
      else if (!state.selectedCalDay && allEvents && allEvents.length) {
        const ds = uniqueSortedDays();
        if (ds.length) state.selectedCalDay = ds[0];
      }
      renderCalendar();
    }
  }

  function refresh() {
    renderFilterOptions();
    if (state.view === "list") renderList();
    else {
      renderCalendar();
    }
    renderItinerary();
  }

  function showStatus(message, kind) {
    const b = els.statusBanner;
    if (!message) {
      b.hidden = true;
      b.textContent = "";
      return;
    }
    b.hidden = false;
    b.textContent = message;
    b.className = "status-banner";
    if (kind === "error") b.classList.add("status-banner--error");
    else if (kind === "warn") b.classList.add("status-banner--warn");
  }

  function isLightTheme() {
    return document.documentElement.getAttribute("data-theme") === "light";
  }

  function applyTheme(mode) {
    if (mode === "light") {
      document.documentElement.setAttribute("data-theme", "light");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    try {
      localStorage.setItem(THEME_KEY, mode === "light" ? "light" : "dark");
    } catch (_) {
      /* ignore */
    }
    syncThemeToggle();
  }

  function syncThemeToggle() {
    const btn = $("theme-toggle");
    if (!btn) return;
    const light = isLightTheme();
    btn.textContent = light ? "Dark" : "Light";
    btn.setAttribute("aria-pressed", light ? "true" : "false");
    btn.setAttribute("aria-label", light ? "Switch to dark mode" : "Switch to light mode");
  }

  function bind() {
    els.themeToggle = $("theme-toggle");
    if (els.themeToggle) {
      syncThemeToggle();
      els.themeToggle.addEventListener("click", () => {
        applyTheme(isLightTheme() ? "dark" : "light");
      });
    }

    els.statusBanner = $("status-banner");
    els.eventList = $("event-list");
    els.listEmpty = $("list-empty");
    els.filterSport = $("filter-sport");
    els.filterZone = $("filter-zone");
    els.filterDay = $("filter-day");
    els.filterPriceMax = $("filter-price-max");
    els.sortBy = $("sort-by");
    els.searchInput = $("search-input");
    els.calMonthLabel = $("cal-month-label");
    els.calendarGrid = $("calendar-grid");
    els.calendarDayEvents = $("calendar-day-events");
    els.itineraryList = $("itinerary-list");
    els.itineraryEmpty = $("itinerary-empty");
    els.itineraryTotal = $("itinerary-total-amount");
    els.itineraryTotalNote = $("itinerary-total-note");
    els.fabCount = $("fab-count");
    els.fab = $("fab-itinerary");
    els.itineraryPanel = $("itinerary-panel");
    els.filtersPanel = $("filters-panel");
    els.filtersToggle = $("filters-toggle");

    els.searchInput.addEventListener("input", () => {
      state.search = els.searchInput.value;
      refresh();
    });

    els.filterSport.addEventListener("change", () => {
      state.sport = els.filterSport.value;
      refresh();
    });
    els.filterZone.addEventListener("change", () => {
      state.zone = els.filterZone.value;
      refresh();
    });
    els.filterDay.addEventListener("change", () => {
      state.day = els.filterDay.value;
      state.selectedCalDay = state.day;
      if (state.day) {
        const p = state.day.split("-").map(Number);
        if (p.length === 3 && p.every((n) => !Number.isNaN(n))) {
          state.calMonth = new Date(p[0], p[1] - 1, 1);
        }
      }
      if (state.view === "calendar") renderCalendar();
      refresh();
    });
    els.filterPriceMax.addEventListener("input", () => {
      state.priceMax = els.filterPriceMax.value;
      refresh();
    });
    els.sortBy.addEventListener("change", () => {
      state.sortBy = els.sortBy.value;
      refresh();
    });

    document.querySelectorAll(".view-toggle__btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        setView(btn.getAttribute("data-view") || "list");
        refresh();
      });
    });

    $("cal-prev").addEventListener("click", () => {
      state.calMonth = new Date(state.calMonth.getFullYear(), state.calMonth.getMonth() - 1, 1);
      renderCalendar();
    });
    $("cal-next").addEventListener("click", () => {
      state.calMonth = new Date(state.calMonth.getFullYear(), state.calMonth.getMonth() + 1, 1);
      renderCalendar();
    });

    $("btn-reset-filters").addEventListener("click", () => {
      state.search = "";
      state.sport = "";
      state.zone = "";
      state.day = "";
      state.priceMax = "";
      state.selectedCalDay = "";
      state.sortBy = "date-asc";
      els.searchInput.value = "";
      els.filterPriceMax.value = "";
      els.sortBy.value = "date-asc";
      refresh();
    });

    $("btn-clear-itinerary").addEventListener("click", () => {
      selectedIds.clear();
      saveItineraryToStorage();
      refresh();
    });

    $("btn-export-itinerary").addEventListener("click", () => {
      const rows = Array.from(selectedIds)
        .map((id) => eventById(id))
        .filter(Boolean);
      const out = {
        exportedAt: new Date().toISOString(),
        events: rows,
      };
      const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "la28-itinerary.json";
      a.click();
      URL.revokeObjectURL(a.href);
    });

    const jsonFile = $("json-file");
    jsonFile.addEventListener("change", async () => {
      const f = jsonFile.files && jsonFile.files[0];
      if (!f) return;
      try {
        const text = await f.text();
        const payload = JSON.parse(text);
        ingestPayload(payload);
        pruneItineraryIds();
        saveItineraryToStorage();
        const n = allEvents ? allEvents.length : 0;
        if (state.dataPartial) {
          showStatus(`Loaded ${n} events from file (partial extraction).`, "warn");
        } else {
          showStatus(`Loaded ${n} events from file.`, "");
        }
        if (allEvents && allEvents.length) {
          const sorted = allEvents
            .slice()
            .filter((e) => e.dateObj)
            .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
          const first = sorted[0];
          if (first && first.dateObj) {
            state.calMonth = new Date(first.dateObj.getFullYear(), first.dateObj.getMonth(), 1);
          }
        }
        refresh();
      } catch (e) {
        showStatus(`Invalid JSON: ${e.message}`, "error");
      }
      jsonFile.value = "";
    });

    els.filtersToggle.addEventListener("click", () => {
      const open = !els.filtersPanel.classList.contains("is-open");
      els.filtersPanel.classList.toggle("is-open", open);
      els.filtersToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });

    els.fab.addEventListener("click", () => {
      const open = !els.itineraryPanel.classList.contains("is-open");
      els.itineraryPanel.classList.toggle("is-open", open);
      els.fab.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  async function init() {
    if (!icons) {
      showStatus("sport-icons.js failed to load.", "error");
      return;
    }
    bind();
    loadItineraryFromStorage();

    try {
      const payload = await loadDataFromFetch();
      ingestPayload(payload);
      pruneItineraryIds();
      saveItineraryToStorage();
      const n = allEvents ? allEvents.length : 0;
      if (state.dataPartial) {
        showStatus(
          `Loaded ${n} events (partial extraction — not all screenshots processed). Use ?partial=1 to force the .partial file.`,
          "warn"
        );
      } else {
        showStatus(`Loaded ${n} events.`, "");
      }
      if (allEvents && allEvents.length) {
        const sorted = allEvents
          .slice()
          .filter((e) => e.dateObj)
          .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
        const first = sorted[0];
        if (first && first.dateObj) {
          state.calMonth = new Date(first.dateObj.getFullYear(), first.dateObj.getMonth(), 1);
        }
      }
    } catch (e) {
      showStatus(
        `Could not load JSON (${e.message}). Use “Load JSON file” or run a local server from this folder.`,
        "error"
      );
    }

    els.sortBy.value = state.sortBy;
    setView("list");
    refresh();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
