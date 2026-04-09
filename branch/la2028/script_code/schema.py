"""JSON Schema for LA28 ticket list extraction (OpenAI structured outputs, strict mode)."""

TICKET_PAGE_SCHEMA = {
    "type": "object",
    "properties": {
        "tickets": {
            "type": "array",
            "description": "Every ticket/event row visible on this screenshot.",
            "items": {
                "type": "object",
                "properties": {
                    "event_code": {
                        "type": "string",
                        "description": "Short code at start of title, e.g. FBL01, HBL01.",
                    },
                    "title": {
                        "type": "string",
                        "description": "Full headline line for the card, e.g. FBL01 Football (Soccer) Men's Preliminary.",
                    },
                    "description": {
                        "type": "string",
                        "description": "Secondary line under the title (session format, TBC notes, etc.).",
                    },
                    "date": {
                        "type": "string",
                        "description": "Date as shown, typically DD.MM.YYYY.",
                    },
                    "time_local": {
                        "type": "string",
                        "description": "Time as shown (24h, range, or TBC).",
                    },
                    "venue": {"type": "string", "description": "Venue / stadium / arena name."},
                    "zone": {"type": "string", "description": "Zone name when shown (e.g. Long Beach Zone)."},
                    "price_display": {
                        "type": "string",
                        "description": "Starting price as shown, e.g. $101.59.",
                    },
                    "price_amount": {
                        "anyOf": [
                            {"type": "number", "description": "Numeric amount when clearly parseable."},
                            {"type": "null"},
                        ],
                        "description": "Numeric amount if clearly parseable; else null.",
                    },
                    "currency": {
                        "type": "string",
                        "description": "ISO-like or display currency, e.g. USD.",
                    },
                },
                "required": [
                    "event_code",
                    "title",
                    "description",
                    "date",
                    "time_local",
                    "venue",
                    "zone",
                    "price_display",
                    "price_amount",
                    "currency",
                ],
                "additionalProperties": False,
            },
        },
        "notes": {
            "type": "string",
            "description": "Optional: OCR caveats, cropped rows, or ambiguity.",
        },
    },
    "required": ["tickets", "notes"],
    "additionalProperties": False,
}

SCHEMA_NAME = "la28_ticket_page"
