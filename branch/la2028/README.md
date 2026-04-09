# LA28 Olympic Itinerary Planner

Static **HTML / CSS / JavaScript** app under this folder. It reads ticket rows from `tickets/extracted_tickets.json` (produced by `script_code/extract_tickets.py`) and lets you search, filter, sort, browse a **month calendar**, build an **itinerary**, and see an **estimated total** from listed starting prices.

## Run locally (recommended)

`fetch()` needs a **local HTTP server** (opening `index.html` as `file://` often blocks JSON).

From this directory (`branch/la2028`):

```bash
python -m http.server 8080
```

Then open `http://localhost:8080/` (or `http://127.0.0.1:8080/`).

## Data files

| File | Use |
|------|-----|
| `tickets/extracted_tickets.json` | Default load target |
| `tickets/extracted_tickets.json.partial` | In-progress extraction |

To load the partial file automatically, append **`?partial=1`** to the URL.

If fetch fails (wrong path or no server), use **Load JSON file** and pick a `.json` file from disk.

## Itinerary storage

Selections are saved in the browser under the key **`la28-itinerary-v1`** (`localStorage`). Clearing site data removes the itinerary.

## Export

**Export itinerary JSON** downloads only the events you selected (IDs resolved against the loaded dataset).

## Query parameters

- **`?partial=1`** — fetch `./tickets/extracted_tickets.json.partial` instead of the final JSON.
