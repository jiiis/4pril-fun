import chinese from "./locales/zh-CN.js";
import { DAMAGE_TYPES, ARMOR_CLASSES, TOWERS, ABILITIES, HERO_KINDS, DOG, EAGLE, DRAGON, BEAR, LOONG, LION } from "./config.js";
import { SPECIALIZATIONS } from "./specializations.js";

const LANGUAGE_KEY = "yunguard.language";
const SUPPORTED = ["en-US", "zh-CN"];
function savedLanguage() {
  try {
    const saved = globalThis.localStorage?.getItem(LANGUAGE_KEY);
    if (SUPPORTED.includes(saved)) return saved;
  } catch { /* Storage may be unavailable in private mode or workers. */ }
  return globalThis.navigator?.language?.toLowerCase().startsWith("zh") ? "zh-CN" : "en-US";
}
export let language = savedLanguage();
const interpolate = (text, values) => text.replace(/\{(\w+)\}/g, (match, key) => values[key] ?? match);

// English source strings are stable catalog keys; interpolation keeps numbers and names out of keys.
export function t(source, values = {}) {
  return interpolate(language === "zh-CN" ? chinese[source] ?? source : source, values);
}

// Used only at HTML rendering boundaries, never in the animation loop.
const patterns = Object.keys(chinese).filter((key) => key.includes("{")).map((key) => {
  const names = [];
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = escaped.replace(/\\\{(\w+)\\\}/g, (_, name) => {
    names.push(name);
    return /^(amount|rank|total|gold|level|levels|waves|wave|lives|seconds|purse|bonus|rate)$/.test(name) ? "([\\d.]+)" : "(.+?)";
  });
  return { key, names, regex: new RegExp(`^${pattern}$`) };
});
function translatedText(source) {
  const text = source.trim();
  if (!text || language === "en-US") return source;
  let result = chinese[text];
  if (result === undefined) for (const { key, names, regex } of patterns) {
    const match = text.match(regex);
    if (!match) continue;
    result = t(key, Object.fromEntries(names.map((name, i) => [name, t(match[i + 1])])));
    break;
  }
  return result === undefined ? source : source.replace(text, result);
}

export function translateMarkup(html) {
  if (language === "en-US") return html;
  const template = document.createElement("template");
  template.innerHTML = html;
  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) walker.currentNode.textContent = translatedText(walker.currentNode.textContent);
  for (const element of template.content.querySelectorAll("*")) {
    for (const name of ["title", "aria-label", "alt", "data-desc"]) {
      if (element.hasAttribute(name)) element.setAttribute(name, translatedText(element.getAttribute(name)));
    }
  }
  return template.innerHTML;
}

// Config keeps its numeric values and identity. Only display fields resolve the active language lazily.
const localizedDefinitions = new WeakSet();
export function localizeDefinitions(value) {
  if (!value || typeof value !== "object" || localizedDefinitions.has(value)) return;
  localizedDefinitions.add(value);
  for (const [key, original] of Object.entries(value)) {
    if (["name", "short", "desc"].includes(key) && typeof original === "string") {
      Object.defineProperty(value, key, { enumerable: true, configurable: true, get: () => t(original) });
    } else if (key === "descriptions" && Array.isArray(original)) {
      Object.defineProperty(value, key, { enumerable: true, configurable: true, get: () => original.map((text) => t(text)) });
    } else if (original && typeof original === "object") localizeDefinitions(original);
  }
}

function translatePage() {
  document.documentElement.lang = language;
  for (const element of document.querySelectorAll("[data-i18n]")) element.textContent = t(element.dataset.i18n);
  for (const attribute of ["title", "aria-label", "alt"]) {
    for (const element of document.querySelectorAll(`[data-i18n-${attribute}]`)) {
      element.setAttribute(attribute, t(element.getAttribute(`data-i18n-${attribute}`)));
    }
  }
  for (const button of document.querySelectorAll("[data-language]")) {
    button.setAttribute("aria-pressed", String(button.dataset.language === language));
  }
}
export function setLanguage(next) {
  if (!SUPPORTED.includes(next) || next === language) return;
  language = next;
  try { localStorage.setItem(LANGUAGE_KEY, language); } catch { /* Keep the choice for this session. */ }
  translatePage();
  window.dispatchEvent(new Event("languagechange"));
}
export function initLocalization() {
  // Keep localization in the UI process; map workers need only the original gameplay configuration.
  for (const definitions of [DAMAGE_TYPES, ARMOR_CLASSES, TOWERS, ABILITIES, HERO_KINDS, DOG, EAGLE, DRAGON, BEAR, LOONG, LION, SPECIALIZATIONS]) localizeDefinitions(definitions);
  translatePage();
  for (const button of document.querySelectorAll("[data-language]")) {
    button.addEventListener("click", () => setLanguage(button.dataset.language));
  }
}
