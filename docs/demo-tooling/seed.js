"use strict";

/**
 * Seeds a running DARAH server with the demo catalogue used to produce the
 * proof in the project README — 20 pajama products in Brazilian Portuguese
 * across the four collections, plus homepage content, the about page and a
 * brand logo.
 *
 * Usage:
 *   1. Start the app:  npm start   (with DATABASE_URL + admin credentials set)
 *   2. node docs/demo-tooling/seed.js
 *
 * Configure via env vars (defaults shown):
 *   BASE_URL=http://localhost:5000
 *   ADMIN_USERNAME=darah.demo
 *   ADMIN_PASSWORD=Darah@Demo2026
 */

const { productImage, heroImage, aboutImage, logo, toDataUrl } = require("./images");

const BASE = process.env.BASE_URL || "http://localhost:5000";
const ADMIN = {
  username: process.env.ADMIN_USERNAME || "darah.demo",
  password: process.env.ADMIN_PASSWORD || "Darah@Demo2026"
};

let cookie = "";

async function login() {
  const res = await fetch(BASE + "/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ADMIN)
  });
  const sc = res.headers.get("set-cookie");
  if (sc) cookie = sc.split(";")[0];
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error("login failed: " + JSON.stringify(data));
  console.log("login ok ->", data.welcome);
}

async function api(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: body ? JSON.stringify(body) : undefined
  });
  const txt = await res.text();
  let data;
  try {
    data = JSON.parse(txt);
  } catch {
    data = txt;
  }
  if (!res.ok) throw new Error(method + " " + path + " -> " + res.status + " " + JSON.stringify(data));
  return data;
}

/* mix a colour toward a target by ratio t */
function mix(hex, target, t) {
  const a = parseInt(hex.slice(1), 16);
  const b = parseInt(target.slice(1), 16);
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1);
}

function imagesFor(p, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(
      toDataUrl(
        productImage({
          category: p.category,
          base: p.base,
          accent: p.accent || "#ffffff",
          pattern: p.pattern,
          bg1: mix(p.base, "#ffffff", 0.9 - i * 0.05),
          bg2: mix(p.base, "#ffffff", 0.6 - i * 0.05),
          seed: p.seed * 17 + i * 5 + 3
        })
      )
    );
  }
  return out;
}

/* ---- product catalogue (Brazilian Portuguese) ---- */
const PRODUCTS = [
  // ---------------- BABYDOLL ----------------
  {
    category: "babydoll",
    name: "Babydoll Renda Encanto",
    description:
      "Babydoll em cetim com detalhes em renda delicada no busto e na barra. Alças finas reguláveis para um caimento perfeito em qualquer corpo.",
    price: 119.9, originalPrice: 159.9, discountLabel: "25% OFF", stock: 18,
    base: "#7d2f3e", accent: "#e8c8a0", pattern: "floral", seed: 11, imgs: 3
  },
  {
    category: "babydoll",
    name: "Babydoll Cetim Aurora",
    description:
      "Modelo soltinho em cetim toque suave, perfeito para as noites mais quentes. Acompanha shortinho combinando para um look completo.",
    price: 99.9, stock: 25,
    base: "#e8a0ab", accent: "#ffffff", pattern: "dots", seed: 12, imgs: 3
  },
  {
    category: "babydoll",
    name: "Babydoll Coração Doce",
    description:
      "Estampa de coraçõezinhos e laço charmoso no decote. Conforto e fofura na medida certa para dormir bem todas as noites.",
    price: 89.9, stock: 32,
    base: "#ef9fb6", accent: "#ffffff", pattern: "hearts", seed: 13, imgs: 2
  },
  {
    category: "babydoll",
    name: "Babydoll Florale Primavera",
    description:
      "Babydoll em viscose leve com estampa floral romântica. Barra com acabamento em renda que valoriza cada detalhe.",
    price: 109.9, stock: 14,
    base: "#9fb8a6", accent: "#f3ead7", pattern: "floral", seed: 14, imgs: 3
  },
  {
    category: "babydoll",
    name: "Babydoll Tule Glamour",
    description:
      "Babydoll sofisticado com sobreposição de tule e brilho discreto. Para se sentir poderosa mesmo na hora de descansar.",
    price: 134.9, originalPrice: 169.9, discountLabel: "Oferta especial", stock: 0,
    base: "#6e2233", accent: "#e6c79a", pattern: "stars", seed: 15, imgs: 2
  },

  // ---------------- CAMISOLAS ----------------
  {
    category: "camisolas",
    name: "Camisola Lua de Seda",
    description:
      "Camisola longa em cetim acetinado com leve brilho natural. Decote em V elegante e tecido fluido que desliza pela pele.",
    price: 149.9, stock: 12,
    base: "#c8a6cf", accent: "#ffffff", pattern: "stars", seed: 21, imgs: 3
  },
  {
    category: "camisolas",
    name: "Camisola Jardim Secreto",
    description:
      "Camisola midi em viscose com estampa floral exclusiva da DARAH. Alças ajustáveis e tecido respirável para noites tranquilas.",
    price: 129.9, originalPrice: 159.9, discountLabel: "20% OFF", stock: 20,
    base: "#9fb8a6", accent: "#f3ead7", pattern: "floral", seed: 22, imgs: 3
  },
  {
    category: "camisolas",
    name: "Camisola Cetim Pérola",
    description:
      "Elegância pura: camisola em cetim cor pérola com acabamento em renda no busto. Um clássico atemporal do enxoval.",
    price: 139.9, stock: 16,
    base: "#d8c2a0", accent: "#ffffff", pattern: "dots", seed: 23, imgs: 2
  },
  {
    category: "camisolas",
    name: "Camisola Estrelas da Noite",
    description:
      "Camisola em malha macia com estampa de estrelas. Caimento leve e fresco para um sono tranquilo de ponta a ponta.",
    price: 99.9, stock: 28,
    base: "#8390b3", accent: "#f0e6c4", pattern: "stars", seed: 24, imgs: 3
  },
  {
    category: "camisolas",
    name: "Camisola Algodão Sereno",
    description:
      "Camisola em algodão cem por cento natural, fresquinha e confortável para usar o ano inteiro. Toque macio que abraça.",
    price: 89.9, stock: 35,
    base: "#d99fa6", accent: "#ffffff", pattern: "gingham", seed: 25, imgs: 1
  },

  // ---------------- LONGOS ----------------
  {
    category: "longos",
    name: "Pijama Longo Xadrez Aconchego",
    description:
      "Conjunto de pijama longo em flanela xadrez. Blusa de manga comprida e calça com elástico confortável para os dias frios.",
    price: 179.9, stock: 15,
    base: "#8d9fc4", accent: "#ffffff", pattern: "plaid", seed: 31, imgs: 3
  },
  {
    category: "longos",
    name: "Pijama Longo Listras Clássicas",
    description:
      "Pijama longo em malha premium com listras atemporais. Blusa com bolso frontal e calça de cós ajustável que não aperta.",
    price: 159.9, originalPrice: 199.9, discountLabel: "R$ 40 OFF", stock: 22,
    base: "#b06a72", accent: "#f3dcc4", pattern: "stripe", seed: 32, imgs: 3
  },
  {
    category: "longos",
    name: "Pijama Longo Inverno Quente",
    description:
      "Conjunto quentinho em moletinho felpudo. Ideal para os dias mais frios, com punhos em ribana que mantêm o calor.",
    price: 199.9, stock: 10,
    base: "#9a9aa6", accent: "#ffffff", pattern: "dots", seed: 33, imgs: 2
  },
  {
    category: "longos",
    name: "Pijama Longo Botões Charme",
    description:
      "Pijama estilo camisaria com botões e gola tradicional. Tecido de viscose macia em tom suave, elegante de manhã à noite.",
    price: 169.9, stock: 0,
    base: "#8fae93", accent: "#f3ead7", pattern: "floral", seed: 34, imgs: 2
  },
  {
    category: "longos",
    name: "Pijama Longo Algodão Premium",
    description:
      "Pijama longo em algodão penteado, durável e respirável. Acabamento refinado e costura reforçada que dura muitas estações.",
    price: 149.9, stock: 19,
    base: "#8a4450", accent: "#f0d8b8", pattern: "gingham", seed: 35, imgs: 3
  },

  // ---------------- INFANTIL ----------------
  {
    category: "infantil",
    name: "Pijama Infantil Nuvens Felizes",
    description:
      "Pijaminha infantil em algodão com estampa de nuvens. Toque extra macio que não irrita a pele sensível dos pequenos.",
    price: 69.9, stock: 40,
    base: "#7ec0e8", accent: "#ffffff", pattern: "clouds", seed: 41, imgs: 3
  },
  {
    category: "infantil",
    name: "Pijama Infantil Estrelinhas",
    description:
      "Conjunto infantil com estampa de estrelas que brilham na imaginação. Disponível em tamanhos de 2 a 10 anos.",
    price: 64.9, stock: 38,
    base: "#f2b65c", accent: "#ffffff", pattern: "stars", seed: 42, imgs: 2
  },
  {
    category: "infantil",
    name: "Pijama Infantil Ursinho Soninho",
    description:
      "Pijama fofinho com carinha de ursinho aplicada. Algodão hipoalergênico, perfeito para a soneca da tarde e a noite de sono.",
    price: 74.9, originalPrice: 94.9, discountLabel: "Promoção", stock: 30,
    base: "#8fd0bf", accent: "#ffffff", pattern: "dots", seed: 43, imgs: 3
  },
  {
    category: "infantil",
    name: "Pijama Infantil Corações",
    description:
      "Conjunto infantil em malha leve com coraçõezinhos por toda a peça. Conforto e diversão garantidos na hora de dormir.",
    price: 59.9, stock: 44,
    base: "#f2998f", accent: "#ffffff", pattern: "hearts", seed: 44, imgs: 2
  },
  {
    category: "infantil",
    name: "Pijama Infantil Sonho Lilás",
    description:
      "Pijama infantil em tom lilás delicado com estampa de estrelas. Elástico suave que acompanha o crescimento sem apertar.",
    price: 67.9, stock: 26,
    base: "#c2a9de", accent: "#ffffff", pattern: "stars", seed: 45, imgs: 3
  }
];

/* ---- homepage + about content (Brazilian Portuguese) ---- */
const ABOUT_TEXT =
  "A DARAH Pijamas nasceu do desejo de transformar a hora de dormir em um " +
  "momento de carinho. Criamos pijamas elegantes e confortáveis, com tecidos " +
  "macios e acabamento cuidadoso, para acompanhar você e a sua família em " +
  "todas as noites especiais.";

const ABOUT_LONG_TEXT =
  "A DARAH Pijamas começou em casa, com uma máquina de costura, muito amor " +
  "e a vontade de criar peças que abraçassem de verdade.\n\n" +
  "Acreditamos que descansar bem é um cuidado essencial com quem a gente ama. " +
  "Por isso, cada pijama da DARAH é pensado nos mínimos detalhes: tecidos " +
  "selecionados, modelagens confortáveis e um caimento que respeita todos os " +
  "corpos e todas as idades.\n\n" +
  "Da camisola de cetim para as noites de verão ao pijama longo de flanela " +
  "para o inverno, passando pelas peças infantis cheias de fofura, nossa " +
  "missão é a mesma: levar conforto, autoestima e aconchego para dentro do " +
  "seu quarto.\n\n" +
  "Obrigada por fazer parte da nossa história. Vista a DARAH e durma com o " +
  "carinho que você merece.";

const NOTICES = [
  "Frete gratis para todo o Brasil nas compras acima de R$ 199,90.",
  "Novidades da colecao Inverno ja disponiveis: pijamas longos quentinhos.",
  "Atendimento pelo WhatsApp de segunda a sabado, das 9h as 18h."
];

async function seedHomepage() {
  const heroImages = [
    toDataUrl(heroImage({ c1: "#3a3357", c2: "#6d6a96", accent: "#e8a0ab", tag: "Conforto para as suas melhores noites", seed: 7 })),
    toDataUrl(heroImage({ c1: "#4a3550", c2: "#8a6f86", accent: "#f2b65c", tag: "Pijamas que abracam toda a familia", seed: 8 })),
    toDataUrl(heroImage({ c1: "#33455a", c2: "#6f8aa0", accent: "#c8a6cf", tag: "Elegancia e aconchego em cada detalhe", seed: 9 }))
  ];
  const aboutImages = [
    toDataUrl(aboutImage({ c1: "#c98f97", c2: "#e8c2b0", icon: "sewing", seed: 1 })),
    toDataUrl(aboutImage({ c1: "#9fb0c4", c2: "#c2d0dc", icon: "moon", seed: 2 })),
    toDataUrl(aboutImage({ c1: "#cfa6b6", c2: "#e6c6cf", icon: "heart", seed: 3 })),
    toDataUrl(aboutImage({ c1: "#a9b9a6", c2: "#cdd9c2", icon: "hanger", seed: 4 }))
  ];
  await api("PUT", "/api/homepage", {
    aboutText: ABOUT_TEXT,
    aboutLongText: ABOUT_LONG_TEXT,
    heroImages,
    aboutImages,
    notices: NOTICES,
    theme: "default"
  });
  console.log("homepage + about page saved");
}

async function seedLogo() {
  await api("PUT", "/api/admin/logo", { logoUrl: toDataUrl(logo()) });
  console.log("brand logo saved");
}

async function seedProducts() {
  let n = 0;
  for (const p of PRODUCTS) {
    const imageUrls = imagesFor(p, p.imgs || 1);
    const res = await api("POST", "/api/products", {
      category: p.category,
      name: p.name,
      description: p.description,
      price: p.price,
      stock: p.stock,
      imageUrl: imageUrls[0],
      imageUrls,
      originalPrice: typeof p.originalPrice === "number" ? p.originalPrice : null,
      discountLabel: p.discountLabel || ""
    });
    n++;
    console.log("  [" + n + "/" + PRODUCTS.length + "] " + p.category + " :: " + p.name + " (id " + res.id + ")");
  }
}

(async () => {
  await login();
  await seedLogo();
  await seedHomepage();
  await seedProducts();
  console.log("\nSEED COMPLETE: " + PRODUCTS.length + " produtos.");
})().catch((e) => {
  console.error("SEED FAILED:", e.message);
  process.exit(1);
});
