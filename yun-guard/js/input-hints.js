import { t } from "./i18n.js";

// Input capability, not viewport size: touch-enabled laptops count too.
const touchInput = navigator.maxTouchPoints > 0 || window.matchMedia("(any-pointer: coarse)").matches;

export function shortcutLabel(label, key) {
  return touchInput ? t(label) : t("{label} ({key})", { label: t(label), key });
}

export function inputHint(keyboardText, touchText) {
  return t(touchInput ? touchText : keyboardText);
}

export function initInputHints() {
  document.documentElement.classList.toggle("hide-shortcut-hints", touchInput);
  const refresh = () => {
    for (const element of document.querySelectorAll("[data-shortcut]")) {
      for (const attribute of ["title", "aria-label"]) {
        const label = element.getAttribute(`data-i18n-${attribute}`);
        if (label) element.setAttribute(attribute, shortcutLabel(label, element.dataset.shortcut));
      }
    }
    for (const element of document.querySelectorAll("[data-shortcut-text]")) {
      element.textContent = inputHint(element.dataset.shortcutText, element.dataset.i18n);
    }
  };
  refresh();
  window.addEventListener("languagechange", refresh);
}
