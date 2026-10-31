import { ctx, rect, ellipse, poly, line } from "./gfx.js";
import { state } from "../state.js";
import { addLight } from "./lights.js";

// Material faces carry the silhouette. Optional flat styling keeps joints and adds restrained contours.
export function shaded(x, y, w, h, light, mid, dark) {
  const fill = ctx.createLinearGradient(x, y, x + w, y + h * 0.2);
  fill.addColorStop(0, light); fill.addColorStop(0.42, mid); fill.addColorStop(1, dark);
  return fill;
}

export function masonry(x, y, w, h, jade = false, style) {
  const colors = jade ? ["#a6c3ad", "#6e9784", "#405f57"] : ["#c5bbaa", "#9b9587", "#656d68"];
  rect(ctx, x, y, w, h, style?.flat ? colors[1] : shaded(x, y, w, h, ...colors), style?.flat ? colors[2] : null, 1);
  if (!style?.flat) {
    poly(ctx, [[x, y], [x + 3, y - 3], [x + w + 3, y - 3], [x + w, y]], jade ? "#b7cbb4" : "#d2caba");
    rect(ctx, x + w - 3, y, 3, h, "rgba(24,38,33,0.16)");
  }
  const rows = Math.ceil(h / 7), step = h / rows;
  for (let i = 1; i < rows; i++) {
    const yy = y + i * step;
    line(ctx, x + 0.5, yy, x + w - 1, yy, "rgba(42,49,39,0.24)", 0.65);
    line(ctx, x + 1, yy + 0.8, x + w - 2, yy + 0.8, "rgba(255,244,210,0.2)", 0.55);
  }
  for (let row = 0; row < rows; row++) for (let xx = x + (row % 2 ? 5 : 11); xx < x + w - 2; xx += 13) {
    line(ctx, xx, y + row * step + 0.7, xx, y + (row + 1) * step - 0.7, "rgba(36,44,34,0.2)", 0.6);
  }
}

export function timber(x, y, w, h, style) {
  rect(ctx, x, y, w, h, style?.flat ? "#a17d50" : shaded(x, y, w, h, "#c29c68", "#987246", "#594735"), style?.flat ? "#69523a" : null, 0.9);
  for (let i = 1; i <= 3; i++) {
    const xx = x + w * i / 4;
    line(ctx, xx, y + 2, xx + Math.sin(i * 3 + x) * 0.7, y + h - 2, "rgba(67,43,25,0.28)", 0.55);
  }
  line(ctx, x + 0.6, y + 1, x + 0.6, y + h - 1, "rgba(250,222,170,0.45)", 0.7);
  if (h > 18) { rect(ctx, x, y + 5, w, 2, "#66706a"); rect(ctx, x, y + h - 7, w, 2, "#66706a"); }
}

const ROOF_COLORS = {
  red: ["#bf8070", "#8e4b3d", "#553c34"],
  straw: ["#d4ba7f", "#b2935c", "#776342"],
  blue: ["#8ea8aa", "#52777c", "#304c54"],
  green: ["#a2b17a", "#6f874e", "#455d36"],
};

export function tiledRoof(x, y, halfWidth, height, color = "blue", style) {
  const colors = ROOF_COLORS[color] || ROOF_COLORS.blue;
  const fill = style?.flat ? colors[1] : shaded(x - halfWidth, y - height, halfWidth * 2, height, ...colors);
  if (style?.flat) {
    // A filled gable with a soft peak and swept eaves, rather than an open chevron.
    ctx.beginPath(); ctx.moveTo(x - halfWidth, y);
    ctx.quadraticCurveTo(x - halfWidth * 0.78, y - 2, x - halfWidth * 0.5, y - height * 0.48);
    ctx.quadraticCurveTo(x - halfWidth * 0.16, y - height * 0.87, x, y - height);
    ctx.quadraticCurveTo(x + halfWidth * 0.16, y - height * 0.87, x + halfWidth * 0.5, y - height * 0.48);
    ctx.quadraticCurveTo(x + halfWidth * 0.78, y - 2, x + halfWidth, y);
    ctx.quadraticCurveTo(x, y + 4, x - halfWidth, y); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = colors[2]; ctx.lineWidth = 1; ctx.stroke();
  } else {
    poly(ctx, [[x - halfWidth, y], [x - halfWidth * 0.8, y - 3], [x, y - height], [x + halfWidth * 0.8, y - 3], [x + halfWidth, y], [x + halfWidth * 0.7, y + 3], [x, y - height * 0.66], [x - halfWidth * 0.7, y + 3]], fill);
  }
  for (let row = 1; row < 5; row++) {
    const f = row / 5, yy = y - height + height * f, hw = halfWidth * f * 0.93;
    line(ctx, x - hw, yy, x + hw, yy, "rgba(28,42,40,0.27)", 0.7);
    for (let xx = -hw + 3 + row % 2 * 2; xx < hw - 1; xx += 6) line(ctx, x + xx, yy - 2, x + xx + 1, yy, "rgba(246,239,210,0.24)", 0.55);
  }
  if (style?.flat) {
    ctx.strokeStyle = colors[0]; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(x - halfWidth + 1, y + 0.5);
    ctx.quadraticCurveTo(x, y + 3, x + halfWidth - 1, y + 0.5); ctx.stroke();
  } else {
    line(ctx, x - halfWidth, y, x - halfWidth * 0.7, y + 2, colors[0], 1);
    line(ctx, x - halfWidth * 0.7, y + 2, x, y - height * 0.66, "rgba(236,219,173,0.45)", 0.65);
  }
  line(ctx, x, y - height, x + halfWidth * 0.8, y - 3, colors[2], 1);
}

export function lantern(x, y, seed = 0, radius = 22) {
  // An enclosed oil flame stays at its wick; only its brightness and tip flicker.
  const flicker = Math.sin(state.time * 8 + seed) * 0.15 + Math.sin(state.time * 13 + seed) * 0.07;
  line(ctx, x, y - 8, x, y - 5, "#65716b", 0.8);
  rect(ctx, x - 2.7, y - 4, 5.4, 8, "#514e3c");
  rect(ctx, x - 1.9, y - 3, 3.8, 6, shaded(x - 2, y - 3, 4, 6, "#fff2bc", "#efba65", "#aa7038"));
  ellipse(ctx, x, y + 0.7, 0.8, 1.6 + flicker, "#fff6c7");
  line(ctx, x, y - 3, x, y + 3, "rgba(88,66,37,0.4)", 0.65);
  poly(ctx, [[x - 3.7, y - 4], [x, y - 6], [x + 3.7, y - 4]], "#6f796c");
  rect(ctx, x - 3, y + 3, 6, 1.5, "#6f796c");
  addLight(ctx, x, y, radius + flicker, "lantern");
}

export function insetWindow(x, y, w = 7, h = 10, glow = false) {
  rect(ctx, x - 1, y - 1, w + 2, h + 2, "#6f7467");
  rect(ctx, x, y, w, h, glow ? "#c79553" : "#34453e");
  rect(ctx, x + 1, y + 1, w - 2, h - 2, glow ? "#e4be80" : "#233a33");
  for (let xx = x + 2; xx < x + w; xx += 3) line(ctx, xx, y, xx, y + h, "#667264", 0.7);
  line(ctx, x - 1, y + h + 1, x + w + 1, y + h + 1, "#d3c9ae", 1);
  if (glow) addLight(ctx, x + w / 2, y + h / 2, 15, "lantern");
}
