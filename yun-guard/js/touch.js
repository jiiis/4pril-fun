// Dragging the view. Touch: one finger pans, a quick tap clicks. Mouse: press and drag on the board pans,
// and a drag swallows the click that would otherwise follow. Native pinch zoom and scrolling are suppressed.
import { panBy, canPan, zoomTo, view } from "./ui.js";

let start = null, last = null, dragged = false, pinch = null;
const touchDist = (ev) => Math.hypot(ev.touches[0].clientX - ev.touches[1].clientX, ev.touches[0].clientY - ev.touches[1].clientY);
const touchMid = (ev) => ({ x: (ev.touches[0].clientX + ev.touches[1].clientX) / 2, y: (ev.touches[0].clientY + ev.touches[1].clientY) / 2 });
const DRAG = 8;   // pixels of movement before a press counts as a drag

export function initTouch() {
  window.addEventListener("touchstart", (ev) => {
    ev.preventDefault();
    if (ev.touches.length === 2) { pinch = { d: touchDist(ev), k: view.k, mid: touchMid(ev) }; start = null; return; }   // two fingers: pinch to zoom
    pinch = null;
    if (ev.touches.length !== 1) { start = null; return; }
    const t = ev.touches[0];
    start = { x: t.clientX, y: t.clientY, time: performance.now() }; last = { x: t.clientX, y: t.clientY }; dragged = false;
  }, { passive: false });
  window.addEventListener("touchmove", (ev) => {
    ev.preventDefault();
    if (pinch && ev.touches.length === 2) {
      const mid = touchMid(ev);
      zoomTo(pinch.k * touchDist(ev) / pinch.d, pinch.mid.x, pinch.mid.y);
      panBy(mid.x - pinch.mid.x, mid.y - pinch.mid.y); pinch.mid = mid;       // and the fingers drag the view along
      return;
    }
    if (!start || ev.touches.length !== 1) return;
    const t = ev.touches[0];
    if (Math.hypot(t.clientX - start.x, t.clientY - start.y) > DRAG) dragged = true;
    if (dragged && canPan()) panBy(t.clientX - last.x, t.clientY - last.y);
    last = { x: t.clientX, y: t.clientY };
  }, { passive: false });
  window.addEventListener("touchend", (ev) => {
    ev.preventDefault();
    if (ev.touches.length < 2) pinch = null;
    if (!start) return;
    if (!dragged && performance.now() - start.time < 600) {        // a tap: hover then click whatever is under the finger
      const el = document.elementFromPoint(last.x, last.y);
      if (el) {
        const opts = { clientX: last.x, clientY: last.y, bubbles: true, cancelable: true };
        el.dispatchEvent(new MouseEvent("mousemove", opts));
        el.dispatchEvent(new MouseEvent("click", opts));
      }
    }
    start = null;
  }, { passive: false });
  window.addEventListener("touchcancel", () => { start = null; }, { passive: false });

  // Scrolling pans too: two-finger swipes on a trackpad or Magic Mouse glide the view in any direction
  window.addEventListener("wheel", (ev) => {
    ev.preventDefault();                                         // never scroll or pinch-zoom the page itself
    if (ev.ctrlKey) { zoomTo(view.k * Math.exp(-ev.deltaY * 0.01), ev.clientX, ev.clientY); return; }   // ctrl+wheel is a trackpad pinch: zoom
    if (!canPan()) return;
    const k = ev.deltaMode === 1 ? 16 : 1;                       // line-based wheels report in lines
    panBy(-ev.deltaX * k, -ev.deltaY * k);
  }, { passive: false });

  // Safari on a Mac reports trackpad pinches as gesture events rather than ctrl+wheel
  let gestureK = 1;
  window.addEventListener("gesturestart", (ev) => { ev.preventDefault(); gestureK = view.k; });
  window.addEventListener("gesturechange", (ev) => { ev.preventDefault(); zoomTo(gestureK * ev.scale, ev.clientX, ev.clientY); });
  window.addEventListener("gestureend", (ev) => ev.preventDefault());

  // Mouse dragging on the board (buttons and menus are left alone)
  let mouse = null, mouseDragged = false;
  window.addEventListener("mousedown", (ev) => {
    if (ev.button !== 0 || ev.target.closest("button, #menu, #overlay, #heroPick")) return;
    mouse = { x: ev.clientX, y: ev.clientY, sx: ev.clientX, sy: ev.clientY }; mouseDragged = false;
  });
  window.addEventListener("mousemove", (ev) => {
    if (!mouse) return;
    if (Math.hypot(ev.clientX - mouse.sx, ev.clientY - mouse.sy) > DRAG) mouseDragged = true;
    if (mouseDragged && canPan()) { panBy(ev.clientX - mouse.x, ev.clientY - mouse.y); document.body.style.cursor = "grabbing"; }
    mouse.x = ev.clientX; mouse.y = ev.clientY;
  });
  window.addEventListener("mouseup", () => { mouse = null; document.body.style.cursor = ""; });
  window.addEventListener("click", (ev) => { if (mouseDragged) { ev.stopPropagation(); ev.preventDefault(); mouseDragged = false; } }, true);
}
