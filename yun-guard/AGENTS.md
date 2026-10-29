# Balance documentation

Whenever changing gameplay balance, update `BALANCE.md` in the same change. Document current values, tower and monster properties, counters, upgrade costs and behavior, and the reason for the change. Keep implemented mechanics separate from proposed designs. Update the player-facing README when its guidance changes.

# UI spacing

Prefer multiples of 6px for new or adjusted margins and padding. Do not restyle unrelated existing spacing solely to follow this preference.

# Localization

All new or changed player-facing text must support both English (US) (`en-US`) and Simplified Chinese (`zh-CN`) in the same change. English source strings are catalog keys in `js/locales/zh-CN.js`; provide their Chinese translations there. Use `t(source, values)` from `js/i18n.js` for dynamic text and canvas labels, and `data-i18n` / `data-i18n-title` / `data-i18n-aria-label` / `data-i18n-alt` for static HTML in both entry pages. Inspector and radial markup is localized at its rendering boundary; add every new phrase or interpolated template to the catalog. Use named placeholders rather than concatenating translated sentences, and keep placeholders identical in both languages. Configuration display fields (`name`, `short`, `desc`, skill `descriptions`) are localized through `localizeDefinitions`; keep identifiers, URLs, storage keys and all gameplay values language-independent. Check both languages and phone-width layouts; switching language must preserve the map, level, selection and control availability.

Keep the brand names `Yun Guard` and `4pril.fun` in English in every locale, including logo text and image alt text.
