/**
 * LA28-style discipline codes (first 3 letters of event_code) → display emoji.
 * Fallback: title keyword match in app.js, then DEFAULT.
 */
(function (global) {
  const SPORT_EMOJI = {
    DEFAULT: "\u{1F3C5}", // 🏅
    FBL: "\u26BD", // ⚽ Football
    HBL: "\u{1F93E}", // 🤾 Handball
    HOC: "\u{1F3D2}", // 🏒 Hockey (ice)
    IHO: "\u{1F3D2}",
    CRK: "\u{1F3CF}", // 🏏 Cricket
    RU7: "\u{1F3C9}", // 🏉 Rugby Sevens code prefix
    RUG: "\u{1F3C9}",
    RU: "\u{1F3C9}",
    BKB: "\u{1F3C0}", // 🏀 Basketball
    VVO: "\u{1F3D0}", // 🏐 Volleyball
    VOL: "\u{1F3D0}",
    TEN: "\u{1F3BE}", // 🎾 Tennis
    SWI: "\u{1F3CA}", // 🏊 Swimming
    ATH: "\u{1F3C3}", // 🏃 Athletics
    GAR: "\u{1F938}", // 🤸 Gymnastics (artistic)
    GYM: "\u{1F938}",
    BOX: "\u{1F94A}", // 🥊 Boxing
    JUD: "\u{1F94B}", // 🥋 Judo
    TKW: "\u{1F94B}",
    WRE: "\u{1F93C}", // 🤼 Wrestling
    FEN: "\u{1F93A}", // 🤺 Fencing
    SHO: "\u{1F52B}", // 🔫 Shooting
    ARC: "\u{1F3F9}", // 🏹 Archery
    ROW: "\u{1F6A3}", // 🚣 Rowing
    SAI: "\u26F5", // ⛵ Sailing
    CYC: "\u{1F6B4}", // 🚴 Cycling
    MTB: "\u{1F6B5}",
    TRI: "\u{1F3CA}\u200D\u2642\uFE0F", // tri placeholder — use swim/bike/run compact
    GOL: "\u26F3", // ⛳ Golf
    EQU: "\u{1F3C7}", // 🏇 Equestrian
    SKB: "\u{1F6F9}", // 🛹 Skateboarding
    BMX: "\u{1F6B4}",
    CLB: "\u{1F9D7}", // climbing
    SUR: "\u{1F3C4}", // 🏄 Surfing
    SRF: "\u{1F3C4}",
    DVG: "\u{1F3CA}", // Diving → swim
    SYN: "\u{1F30A}", // Artistic swimming
    WPO: "\u{1F3CA}", // Water polo
    BAS: "\u26BE", // ⚾ Baseball
    SBL: "\u{1F3BE}", // Softball
    KTE: "\u{1FA81}", // 🪁 Kite (placeholder) — use canoe
    CAN: "\u{1F6F6}", // 🛶 Canoe
    KAY: "\u{1F6F6}",
    LUG: "\u{1F6F7}", // 🛷 Luge/sled
    BOB: "\u{1F6F7}",
    SKI: "\u26F7", // ⛷ Ski
    SNB: "\u{1F3C2}", // 🏂 Snowboard
    CUR: "\u{1F94C}", // 🥌 Curling
    TTE: "\u{1F3D3}", // 🏓 Table tennis
    BDM: "\u{1F3F8}", // 🏸 Badminton
    WLF: "\u{1F3CB}\uFE0F", // 🏋 Weightlifting
    MOD: "\u{1F3C1}", // 🏁 Modern pentathlon
    RIF: "\u{1F52B}", // Rifle
  };

  const TITLE_KEYWORDS = [
    ["football", "\u26BD"],
    ["soccer", "\u26BD"],
    ["basketball", "\u{1F3C0}"],
    ["volleyball", "\u{1F3D0}"],
    ["handball", "\u{1F93E}"],
    ["hockey", "\u{1F3D2}"],
    ["cricket", "\u{1F3CF}"],
    ["rugby", "\u{1F3C9}"],
    ["tennis", "\u{1F3BE}"],
    ["swim", "\u{1F3CA}"],
    ["athletic", "\u{1F3C3}"],
    ["gymnastic", "\u{1F938}"],
    ["boxing", "\u{1F94A}"],
    ["judo", "\u{1F94B}"],
    ["wrestling", "\u{1F93C}"],
    ["fencing", "\u{1F93A}"],
    ["golf", "\u26F3"],
    ["cycling", "\u{1F6B4}"],
    ["baseball", "\u26BE"],
    ["softball", "\u{1F3BE}"],
    ["surf", "\u{1F3C4}"],
    ["skate", "\u{1F6F9}"],
    ["weightlift", "\u{1F3CB}"],
    ["badminton", "\u{1F3F8}"],
    ["table tennis", "\u{1F3D3}"],
    ["archery", "\u{1F3F9}"],
    ["rowing", "\u{1F6A3}"],
    ["sailing", "\u26F5"],
    ["marathon", "\u{1F3C3}"],
    ["triathlon", "\u{1F3CA}"],
  ];

  function getSportKey(eventCode) {
    if (!eventCode || typeof eventCode !== "string") return "";
    const u = eventCode.trim().toUpperCase();
    const threeLetters = u.match(/^([A-Z]{3})(?=\d|$)/);
    if (threeLetters) return threeLetters[1];
    const twoPlusDigit = u.match(/^([A-Z]{2})(\d)/);
    if (twoPlusDigit) return (twoPlusDigit[1] + twoPlusDigit[2]).slice(0, 3);
    const letters = u.match(/^([A-Z]+)/);
    if (letters) return letters[1].slice(0, 3);
    return u.slice(0, 3);
  }

  function emojiForSportKey(sportKey) {
    if (!sportKey) return SPORT_EMOJI.DEFAULT;
    const k = sportKey.toUpperCase();
    if (SPORT_EMOJI[k]) return SPORT_EMOJI[k];
    return SPORT_EMOJI.DEFAULT;
  }

  function emojiFromTitle(title) {
    if (!title) return SPORT_EMOJI.DEFAULT;
    const t = title.toLowerCase();
    for (const [kw, emoji] of TITLE_KEYWORDS) {
      if (t.includes(kw)) return emoji;
    }
    return SPORT_EMOJI.DEFAULT;
  }

  global.LA28SportIcons = {
    SPORT_EMOJI,
    TITLE_KEYWORDS,
    getSportKey,
    emojiForSportKey,
    emojiFromTitle,
  };
})(typeof window !== "undefined" ? window : globalThis);
