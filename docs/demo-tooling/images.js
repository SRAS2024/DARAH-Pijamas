"use strict";

/**
 * SVG illustration generator for DARAH Pijamas demo content.
 * Produces flat-lay style pajama illustrations, hero banners,
 * about-page images and a brand logo. All output is plain SVG markup.
 */

/* ----------------------------- utilities ----------------------------- */

function rnd(seed) {
  // tiny deterministic PRNG
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255;
  r = Math.max(0, Math.min(255, Math.round(r + amt)));
  g = Math.max(0, Math.min(255, Math.round(g + amt)));
  b = Math.max(0, Math.min(255, Math.round(b + amt)));
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

/* scalloped lace edge from x1->x2 at baseline y, arcs bulge `dir` (1 down) */
function scallop(x1, x2, y, r, dir) {
  const d = dir >= 0 ? 1 : 0;
  let p = `M ${x1} ${y}`;
  const n = Math.max(1, Math.round((x2 - x1) / (2 * r)));
  const step = (x2 - x1) / n;
  for (let i = 0; i < n; i++) {
    p += ` a ${step / 2} ${r} 0 0 ${d} ${step} 0`;
  }
  return p;
}

/* ----------------------------- patterns ------------------------------ */

function patternDef(id, kind, c1, c2) {
  switch (kind) {
    case "dots":
      return `<pattern id="${id}" width="46" height="46" patternUnits="userSpaceOnUse">
        <rect width="46" height="46" fill="${c1}"/>
        <circle cx="11" cy="11" r="6" fill="${c2}"/>
        <circle cx="34" cy="34" r="6" fill="${c2}"/></pattern>`;
    case "hearts":
      return `<pattern id="${id}" width="58" height="58" patternUnits="userSpaceOnUse">
        <rect width="58" height="58" fill="${c1}"/>
        <path d="M16 14c-4-7-15-3-10 5 2 5 10 9 10 9s8-4 10-9c5-8-6-12-10-5z" fill="${c2}"/>
        <path d="M45 40c-4-7-15-3-10 5 2 5 10 9 10 9s8-4 10-9c5-8-6-12-10-5z" fill="${c2}" opacity="0.85"/></pattern>`;
    case "stars":
      return `<pattern id="${id}" width="60" height="60" patternUnits="userSpaceOnUse">
        <rect width="60" height="60" fill="${c1}"/>
        <path d="M16 6l3 8 8 1-6 6 2 8-7-4-7 4 2-8-6-6 8-1z" fill="${c2}"/>
        <path d="M44 34l2 6 6 1-4 4 1 6-5-3-5 3 1-6-4-4 6-1z" fill="${c2}" opacity="0.8"/></pattern>`;
    case "stripe":
      return `<pattern id="${id}" width="36" height="36" patternUnits="userSpaceOnUse" patternTransform="rotate(90)">
        <rect width="36" height="36" fill="${c1}"/>
        <rect width="18" height="36" fill="${c2}"/></pattern>`;
    case "plaid":
      return `<pattern id="${id}" width="64" height="64" patternUnits="userSpaceOnUse">
        <rect width="64" height="64" fill="${c1}"/>
        <rect width="64" height="22" y="0" fill="${c2}" opacity="0.55"/>
        <rect width="22" height="64" x="0" fill="${c2}" opacity="0.55"/>
        <rect width="6" height="64" x="40" fill="${shade(c2, -25)}" opacity="0.7"/>
        <rect width="64" height="6" y="40" fill="${shade(c2, -25)}" opacity="0.7"/></pattern>`;
    case "gingham":
      return `<pattern id="${id}" width="44" height="44" patternUnits="userSpaceOnUse">
        <rect width="44" height="44" fill="${c1}"/>
        <rect width="22" height="44" fill="${c2}" opacity="0.5"/>
        <rect width="44" height="22" fill="${c2}" opacity="0.5"/>
        <rect width="22" height="22" fill="${c2}"/></pattern>`;
    case "floral":
      return `<pattern id="${id}" width="70" height="70" patternUnits="userSpaceOnUse">
        <rect width="70" height="70" fill="${c1}"/>
        <g fill="${c2}">
          <circle cx="20" cy="20" r="5"/>
          <circle cx="12" cy="20" r="5"/><circle cx="28" cy="20" r="5"/>
          <circle cx="20" cy="12" r="5"/><circle cx="20" cy="28" r="5"/>
          <circle cx="52" cy="52" r="5"/>
          <circle cx="44" cy="52" r="5"/><circle cx="60" cy="52" r="5"/>
          <circle cx="52" cy="44" r="5"/><circle cx="52" cy="60" r="5"/>
        </g>
        <circle cx="20" cy="20" r="4" fill="${shade(c2, 40)}"/>
        <circle cx="52" cy="52" r="4" fill="${shade(c2, 40)}"/></pattern>`;
    case "clouds":
      return `<pattern id="${id}" width="80" height="64" patternUnits="userSpaceOnUse">
        <rect width="80" height="64" fill="${c1}"/>
        <g fill="${c2}">
          <ellipse cx="22" cy="20" rx="16" ry="10"/>
          <ellipse cx="60" cy="46" rx="16" ry="10"/>
        </g></pattern>`;
    default:
      return `<pattern id="${id}" width="10" height="10" patternUnits="userSpaceOnUse">
        <rect width="10" height="10" fill="${c1}"/></pattern>`;
  }
}

/* ----------------------------- garments ------------------------------ */

/* Each garment returns an array of <path>/<g> layers drawn centred on cx=500. */

function bow(cx, cy, col, dark) {
  return `<g transform="translate(${cx} ${cy}) scale(0.74)">
    <path d="M0 0 C -38 -26, -46 24, 0 0 C -46 -24, -38 26, 0 0 Z" fill="${col}" stroke="${dark}" stroke-width="2.6"/>
    <path d="M0 0 C 38 -26, 46 24, 0 0 C 46 -24, 38 26, 0 0 Z" fill="${col}" stroke="${dark}" stroke-width="2.6"/>
    <circle cx="0" cy="0" r="9" fill="${dark}"/>
  </g>`;
}

function babydoll() {
  // short flared babydoll + tiny matching shorts
  const body = `M 500 250
    C 470 218, 432 214, 410 246
    C 398 264, 384 300, 372 338
    C 330 470, 300 548, 268 612
    C 360 642, 640 642, 732 612
    C 700 548, 670 470, 628 338
    C 616 300, 602 264, 590 246
    C 568 214, 530 218, 500 250 Z`;
  const straps =
    `<path d="M421 244 C 432 188, 452 168, 470 156" stroke="STRAP" stroke-width="13" fill="none" stroke-linecap="round"/>` +
    `<path d="M579 244 C 568 188, 548 168, 530 156" stroke="STRAP" stroke-width="13" fill="none" stroke-linecap="round"/>`;
  return {
    body,
    straps,
    hemY: 624,
    hemX: [276, 724],
    bustScallop: scallop(372, 628, 250, 17, 1),
    extras: (col, dark) =>
      // tiny shorts laid below-right
      `<g transform="translate(0,8)">
        <path d="M372 660 q128 -34 256 0 q-8 70 -20 96 q-58 -16 -108 -8 q-50 -8 -108 8 q-12 -26 -20 -96 Z"
          fill="${shade(col, 18)}" stroke="${dark}" stroke-width="3"/>
        <path d="${scallop(372, 628, 658, 12, 0)}" fill="none" stroke="#fff" stroke-width="6" opacity="0.9"/>
      </g>`,
    cx: 500
  };
}

function camisola() {
  // long elegant slip nightgown
  const body = `M 500 252
    C 474 214, 446 210, 426 232
    C 414 246, 408 286, 404 330
    C 392 470, 372 612, 352 712
    C 446 742, 554 742, 648 712
    C 628 612, 608 470, 596 330
    C 592 286, 586 246, 574 232
    C 554 210, 526 214, 500 252 Z`;
  const straps =
    `<path d="M432 230 C 446 176, 470 158, 488 150" stroke="STRAP" stroke-width="11" fill="none" stroke-linecap="round"/>` +
    `<path d="M568 230 C 554 176, 530 158, 512 150" stroke="STRAP" stroke-width="11" fill="none" stroke-linecap="round"/>`;
  return {
    body,
    straps,
    hemY: 724,
    hemX: [356, 644],
    bustScallop: `M 426 232 C 460 286, 540 286, 574 232`,
    extras: () => "",
    cx: 500
  };
}

function longo() {
  // pajama set: long-sleeve button top (left) + long pants (right)
  const top = `M 232 248
    C 250 232, 286 224, 318 224
    L 318 214 C 348 198, 392 198, 420 214 L 420 224
    C 452 224, 486 232, 504 248
    C 488 286, 470 300, 452 306
    L 460 612 C 392 632, 344 632, 280 612
    L 288 306 C 270 300, 252 286, 232 248 Z`;
  // sleeves
  const sleeves =
    `<path d="M250 250 C 214 300, 196 392, 196 470 C 232 482, 268 478, 292 462 L 288 306 Z" fill="BODY" stroke="DARK" stroke-width="3"/>` +
    `<path d="M486 250 C 522 300, 540 392, 540 470 C 504 482, 468 478, 444 462 L 452 306 Z" fill="BODY" stroke="DARK" stroke-width="3"/>`;
  const pants = `M 560 250
    C 612 240, 760 240, 812 250
    L 800 470 L 792 690
    C 760 700, 726 700, 700 690
    L 686 486 L 672 486 L 660 690
    C 632 700, 600 700, 568 690
    L 560 470 Z`;
  return {
    body: top,
    secondBody: pants,
    sleeves,
    straps: "",
    hemY: 624,
    hemX: [280, 460],
    collar: `<path d="M318 224 L 369 268 L 420 224" fill="none" stroke="DARK" stroke-width="3"/>
             <path d="M318 224 L 369 268 L 420 224 L 405 210 L 369 240 L 333 210 Z" fill="COLLAR" stroke="DARK" stroke-width="2.5"/>`,
    placket: `<line x1="369" y1="268" x2="375" y2="612" stroke="DARK" stroke-width="3"/>
             <circle cx="372" cy="330" r="6" fill="COLLAR"/><circle cx="373" cy="396" r="6" fill="COLLAR"/>
             <circle cx="373" cy="462" r="6" fill="COLLAR"/><circle cx="374" cy="528" r="6" fill="COLLAR"/>`,
    waistband: `<path d="M560 250 C 612 240 760 240 812 250 L 810 280 C 758 270 614 270 562 280 Z" fill="COLLAR" stroke="DARK" stroke-width="2.5"/>`,
    extras: () => "",
    cx: 500
  };
}

function infantil() {
  // children's two-piece: short-sleeve top + shorts, playful
  const top = `M 300 286
    C 318 268, 348 258, 372 256
    C 388 240, 432 240, 448 256
    C 472 258, 502 268, 520 286
    C 506 318, 488 330, 470 334
    L 478 520 C 420 540, 392 540, 342 520
    L 350 334 C 332 330, 314 318, 300 286 Z`;
  const sleeves =
    `<path d="M314 290 C 286 318, 274 360, 276 392 C 304 400, 330 394, 348 380 L 350 334 Z" fill="BODY" stroke="DARK" stroke-width="3"/>` +
    `<path d="M506 290 C 534 318, 546 360, 544 392 C 516 400, 490 394, 472 380 L 470 334 Z" fill="BODY" stroke="DARK" stroke-width="3"/>`;
  const shorts = `M 566 300
    C 612 290, 720 290, 766 300
    L 758 430
    C 730 440, 706 440, 686 430
    L 678 360 L 664 360 L 654 430
    C 632 440, 606 440, 580 430
    L 566 360 Z`;
  return {
    body: top,
    secondBody: shorts,
    sleeves,
    straps: "",
    hemY: 530,
    hemX: [344, 476],
    collar: `<ellipse cx="410" cy="262" rx="40" ry="15" fill="none" stroke="COLLAR" stroke-width="9"/>`,
    waistband: `<path d="M566 300 C 612 290 720 290 766 300 L 764 326 C 718 316 614 316 568 326 Z" fill="COLLAR" stroke="DARK" stroke-width="2.5"/>`,
    extras: (col, dark) =>
      `<g transform="translate(410 420)">
        <circle r="34" fill="#fff" stroke="${dark}" stroke-width="3"/>
        <circle cx="-13" cy="-4" r="5.5" fill="${dark}"/><circle cx="13" cy="-4" r="5.5" fill="${dark}"/>
        <path d="M-13 13 q13 12 26 0" stroke="${dark}" stroke-width="4" fill="none" stroke-linecap="round"/>
        <circle cx="-20" cy="8" r="6" fill="#ffb9c4" opacity="0.8"/>
        <circle cx="20" cy="8" r="6" fill="#ffb9c4" opacity="0.8"/>
      </g>`,
    cx: 500
  };
}

const GARMENTS = { babydoll, camisola: camisola, longos: longo, infantil };

/* --------------------------- product image --------------------------- */

/**
 * opts: { category, base, accent, pattern, bg1, bg2, seed, variant }
 */
function productImage(opts) {
  const cat = opts.category;
  const builder =
    cat === "babydoll"
      ? babydoll
      : cat === "camisolas"
      ? camisola
      : cat === "longos"
      ? longo
      : infantil;
  const g = builder();

  const base = opts.base;
  const dark = shade(base, -70);
  const strapCol = shade(base, -30);
  const accent = opts.accent;
  const r = rnd(opts.seed || 1);

  const patId = "pat" + (opts.seed || 1);
  const pat = patternDef(patId, opts.pattern, base, accent);

  // scattered background decor
  let decor = "";
  for (let i = 0; i < 9; i++) {
    const x = 60 + r() * 880;
    const y = 60 + r() * 680;
    const rr = 6 + r() * 12;
    const inGarment = x > 300 && x < 820 && y > 200 && y < 700;
    if (inGarment) continue;
    decor +=
      r() > 0.5
        ? `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${rr.toFixed(0)}" fill="${opts.bg2}" opacity="0.55"/>`
        : `<path d="M${x.toFixed(0)} ${(y - rr).toFixed(0)}
            q ${rr} ${rr} 0 ${2 * rr} q ${-rr} ${-rr} 0 ${-2 * rr} Z" fill="${opts.bg2}" opacity="0.5"/>`;
  }

  const fill = (s) =>
    String(s)
      .replace(/BODY/g, `url(#${patId})`)
      .replace(/DARK/g, dark)
      .replace(/COLLAR/g, shade(base, 40))
      .replace(/STRAP/g, strapCol);

  // main body group with shadow + base + pattern + outline
  function piece(d) {
    return `
      <path d="${d}" fill="#000" opacity="0.12" transform="translate(7 12)"/>
      <path d="${d}" fill="${base}"/>
      <path d="${d}" fill="url(#${patId})"/>
      <path d="${d}" fill="url(#sheen)"/>
      <path d="${d}" fill="none" stroke="${dark}" stroke-width="3.5" stroke-linejoin="round"/>`;
  }

  let garmentSvg = "";
  if (g.sleeves) garmentSvg += fill(g.sleeves);
  if (g.straps) garmentSvg += fill(g.straps);
  garmentSvg += piece(g.body);
  if (g.secondBody) garmentSvg += piece(g.secondBody);
  if (g.collar) garmentSvg += fill(g.collar);
  if (g.waistband) garmentSvg += fill(g.waistband);
  if (g.placket) garmentSvg += fill(g.placket);

  // lace hem + trim
  let trim = "";
  if (g.hemX) {
    trim += `<path d="${scallop(g.hemX[0], g.hemX[1], g.hemY, 16, 1)}"
      fill="none" stroke="#ffffff" stroke-width="8" opacity="0.92"/>`;
  }
  if (g.bustScallop) {
    trim += `<path d="${g.bustScallop}" fill="none" stroke="#ffffff" stroke-width="6" opacity="0.85"/>`;
  }

  // accents
  let accents = "";
  if (cat === "babydoll" || cat === "camisolas") {
    accents += bow(500, cat === "babydoll" ? 264 : 256, shade(base, 45), dark);
  }
  if (g.extras) accents += g.extras(base, dark);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 800" width="1000" height="800">
  <defs>
    ${pat}
    <radialGradient id="bgGrad" cx="50%" cy="38%" r="80%">
      <stop offset="0%" stop-color="${opts.bg1}"/>
      <stop offset="100%" stop-color="${opts.bg2}"/>
    </radialGradient>
    <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.30"/>
      <stop offset="45%" stop-color="#ffffff" stop-opacity="0.04"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.10"/>
    </linearGradient>
  </defs>
  <rect width="1000" height="800" fill="url(#bgGrad)"/>
  ${decor}
  <ellipse cx="500" cy="720" rx="320" ry="40" fill="#000" opacity="0.05"/>
  ${garmentSvg}
  ${trim}
  ${accents}
  <rect x="6" y="6" width="988" height="788" rx="22" fill="none" stroke="#ffffff" stroke-width="3" opacity="0.5"/>
</svg>`;
}

/* ------------------------------ hero --------------------------------- */

function heroImage(opts) {
  // wide cozy lifestyle banner 1200x720
  const r = rnd(opts.seed || 7);
  let stars = "";
  for (let i = 0; i < 26; i++) {
    const x = (r() * 1200).toFixed(0);
    const y = (r() * 430).toFixed(0);
    const s = (1.5 + r() * 3).toFixed(1);
    stars += `<circle cx="${x}" cy="${y}" r="${s}" fill="#fff" opacity="${(0.4 + r() * 0.5).toFixed(2)}"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 720" width="1200" height="720">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${opts.c1}"/>
      <stop offset="100%" stop-color="${opts.c2}"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="720" fill="url(#sky)"/>
  ${stars}
  <circle cx="985" cy="150" r="74" fill="#fff" opacity="0.92"/>
  <circle cx="958" cy="138" r="74" fill="${opts.c1}"/>
  <!-- bed / cozy scene -->
  <rect x="0" y="540" width="1200" height="180" fill="${shade(opts.c2, -26)}"/>
  <rect x="120" y="470" width="980" height="90" rx="26" fill="${shade(opts.c2, 36)}"/>
  <rect x="120" y="420" width="300" height="90" rx="34" fill="#fff" opacity="0.95"/>
  <rect x="170" y="430" width="300" height="80" rx="34" fill="${shade(opts.c1, 30)}" opacity="0.9"/>
  <path d="M120 560 q480 -60 980 0 v160 h-980 Z" fill="${shade(opts.c2, 12)}"/>
  ${[260, 470, 690, 905].map((x, i) =>
    `<g transform="translate(${x} ${392 + (i % 2) * 6})">
       <circle r="48" fill="#fff" opacity="0.96"/>
       <circle r="48" fill="${i % 2 ? opts.c1 : opts.accent}" opacity="0.5"/>
       <path d="M-22 -2 q22 30 44 0" stroke="${shade(opts.c2, -50)}" stroke-width="5" fill="none" stroke-linecap="round"/>
     </g>`).join("")}
  <text x="600" y="226" font-family="Georgia, serif" font-size="92" fill="#fff"
        text-anchor="middle" letter-spacing="14" opacity="0.97">DARAH</text>
  <text x="600" y="290" font-family="Georgia, serif" font-size="40" fill="#fff"
        text-anchor="middle" letter-spacing="6" opacity="0.92" font-style="italic">${opts.tag}</text>
</svg>`;
}

/* ------------------------------ about -------------------------------- */

function aboutImage(opts) {
  const r = rnd(opts.seed || 3);
  let dots = "";
  for (let i = 0; i < 14; i++) {
    dots += `<circle cx="${(r() * 600).toFixed(0)}" cy="${(r() * 600).toFixed(0)}" r="${(4 + r() * 9).toFixed(0)}" fill="#fff" opacity="0.4"/>`;
  }
  const icon = {
    sewing: `<g transform="translate(300 300)">
        <path d="M-150 90 q150 -240 300 0" stroke="#fff" stroke-width="14" fill="none"/>
        <circle cx="-150" cy="90" r="22" fill="#fff"/><circle cx="150" cy="90" r="22" fill="#fff"/>
        <rect x="-26" y="-150" width="52" height="150" rx="22" fill="#fff"/>
        <circle cx="0" cy="-150" r="34" fill="#fff"/><circle cx="0" cy="-150" r="14" fill="${opts.c1}"/></g>`,
    hanger: `<g transform="translate(300 270)" stroke="#fff" stroke-width="16" fill="none" stroke-linecap="round">
        <path d="M0 -120 q40 0 40 40"/><path d="M-170 60 L0 -80 L170 60"/>
        <path d="M-170 60 q170 70 340 0" stroke-width="16"/></g>`,
    moon: `<g transform="translate(300 300)">
        <circle r="150" fill="#fff" opacity="0.95"/><circle cx="-44" cy="-22" r="150" fill="${opts.c2}"/>
        <circle cx="120" cy="-110" r="16" fill="#fff"/><circle cx="150" cy="-40" r="10" fill="#fff"/></g>`,
    heart: `<path transform="translate(300 320)" d="M0 70 C -120 -30 -90 -150 0 -90 C 90 -150 120 -30 0 70 Z" fill="#fff" opacity="0.95"/>`
  }[opts.icon || "heart"];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">
  <defs><linearGradient id="ag" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="${opts.c1}"/><stop offset="100%" stop-color="${opts.c2}"/>
  </linearGradient></defs>
  <rect width="600" height="600" fill="url(#ag)"/>
  ${dots}
  ${icon}
  <rect x="14" y="14" width="572" height="572" rx="26" fill="none" stroke="#fff" stroke-width="4" opacity="0.7"/>
</svg>`;
}

/* ------------------------------ logo --------------------------------- */

function logo() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#FDE8E9"/><stop offset="100%" stop-color="#C5898E"/>
  </linearGradient></defs>
  <circle cx="128" cy="128" r="120" fill="url(#lg)"/>
  <circle cx="128" cy="128" r="120" fill="none" stroke="#C5898E" stroke-width="6"/>
  <circle cx="128" cy="128" r="98" fill="none" stroke="#fff" stroke-width="3" opacity="0.8"/>
  <text x="128" y="150" font-family="Georgia, serif" font-size="118" fill="#fff"
        text-anchor="middle" font-weight="700">D</text>
  <path d="M70 188 q58 34 116 0" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" opacity="0.85"/>
</svg>`;
}

function toDataUrl(svg) {
  return "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
}

module.exports = { productImage, heroImage, aboutImage, logo, toDataUrl };
