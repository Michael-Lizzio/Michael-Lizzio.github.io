/**
 * One-off: parse data/raw_data.txt → data/la28-ticket-listings.json
 * Run: node scripts/build-tickets-json.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const rawPath = path.join(root, "data", "raw_data.txt");
const outPath = path.join(root, "data", "la28-ticket-listings.json");

function parseDate(mmddyyyy) {
  const m = String(mmddyyyy).trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return null;
  const [, mm, dd, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

function parsePrice(line) {
  const t = String(line || "").replace(/,/g, "");
  const num = t.match(/\$?\s*([\d.]+)/);
  return num ? Number.parseFloat(num[1]) : null;
}

function parseVenueZone(line) {
  const parts = String(line || "")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
  return { venue: parts[0] || "", zone: parts[1] || "" };
}

function main() {
  const text = fs.readFileSync(rawPath, "utf8");
  const re =
    /Title:\s*(.+?)\r?\nDescription:\s*(.+?)\r?\nDate:\s*(.+?)\r?\nTime:\s*(.+?)\r?\nVenue\/Zone:\s*(.+?)\r?\nStatus\/Price:\s*(.+?)\r?\nURL:\s*(.+?)\r?\nImage:\s*(.+?)(?=\r?\n\r?\n|$)/gs;

  const raw = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    const [, title, description, dateRaw, time, vz, priceLine, url, image] = m;
    const date_iso = parseDate(dateRaw.trim());
    const sessionMatch = title.trim().match(/^(\S+)/);
    const session_code = sessionMatch ? sessionMatch[1] : "";
    const { venue, zone } = parseVenueZone(vz);

    raw.push({
      session_code,
      title: title.trim(),
      description: description.trim(),
      date_raw: dateRaw.trim(),
      date_iso: date_iso || dateRaw.trim(),
      time: time.trim(),
      venue,
      zone,
      price_label: priceLine.trim(),
      price_start_usd: parsePrice(priceLine),
      url: url.trim(),
      image: image.trim(),
    });
  }

  const seen = new Map();
  const events = [];
  let dup = 0;

  for (const row of raw) {
    const key = `${row.session_code}|${row.date_iso}|${row.url}`;
    if (seen.has(key)) {
      dup++;
      continue;
    }
    seen.set(key, true);
    events.push({
      ...row,
      id: key,
    });
  }

  events.sort((a, b) => {
    if (a.date_iso !== b.date_iso) return a.date_iso.localeCompare(b.date_iso);
    return a.session_code.localeCompare(b.session_code);
  });

  const byDate = {};
  for (const e of events) {
    if (!byDate[e.date_iso]) byDate[e.date_iso] = [];
    byDate[e.date_iso].push(e.id);
  }

  const out = {
    schema_version: 1,
    source_file: "raw_data.txt",
    generated_at: new Date().toISOString(),
    stats: {
      raw_blocks: raw.length,
      unique_events: events.length,
      duplicates_dropped: dup,
    },
    events,
    by_date: byDate,
  };

  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");
  console.log(`Wrote ${outPath}`);
  console.log(`Events: ${events.length} (dropped ${dup} duplicates, ${raw.length} raw)`);
}

main();
