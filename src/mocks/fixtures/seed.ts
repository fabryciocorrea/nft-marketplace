// Dados iniciais (seed) da API simulada. Nada aqui é importado pela interface.

export type Network = "Ethereum" | "Polygon" | "Arbitrum";

export interface SeedNft {
  id: string;
  title: string;
  description: string;
  image: string;
  priceEth: string;
  author: { name: string; avatar: string; verified: boolean };
  category: string; // aba: Art, Collectibles, Abstract, Gaming
  collection: { id: string; name: string };
  network: Network;
  availableQuantity: number;
  likes: number;
  createdAt: string;
}

export const COLLECTIONS = [
  { id: "cosmic", name: "Cosmic Genesis" },
  { id: "cyber", name: "Neo Tokyo" },
  { id: "abstract", name: "Abstract Dimensions" },
  { id: "pixel", name: "Pixel Forest" },
  { id: "mythic", name: "Mythic Beasts" },
  { id: "ocean", name: "Deep Ocean" },
];

export const NETWORKS: Network[] = ["Ethereum", "Polygon", "Arbitrum"];
export const TABS = ["Art", "Collectibles", "Abstract", "Gaming"];

// Imagem gerada localmente (SVG): o catálogo não depende de rede externa.
function artwork(seed: number, label: string) {
  const h1 = (seed * 47) % 360;
  const h2 = (h1 + 60 + ((seed * 13) % 90)) % 360;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="hsl(${h1} 70% 45%)"/>` +
    `<stop offset="1" stop-color="hsl(${h2} 75% 20%)"/></linearGradient></defs>` +
    `<rect width="400" height="400" fill="url(#g)"/>` +
    `<circle cx="${120 + ((seed * 29) % 160)}" cy="${120 + ((seed * 17) % 160)}" r="${60 + (seed % 5) * 14}" fill="hsl(${h2} 80% 70% / .35)"/>` +
    `<circle cx="${280 - ((seed * 11) % 120)}" cy="${300 - ((seed * 7) % 140)}" r="${40 + (seed % 4) * 12}" fill="hsl(${h1} 90% 75% / .3)"/>` +
    `<text x="20" y="380" font-family="monospace" font-size="18" fill="#F7F3EC">${label}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const AUTHORS = [
  { name: "CyberArtist", verified: true },
  { name: "NeoCreator", verified: true },
  { name: "PolygonArt", verified: false },
  { name: "PixelMonk", verified: true },
  { name: "AquaForge", verified: false },
];

function avatar(i: number) {
  return artwork(i + 100, "");
}

const BASE: Omit<SeedNft, "image" | "author" | "createdAt">[] = [
  {
    id: "1",
    title: "Cosmic Genesis #001",
    description:
      "Uma obra de arte digital única explorando o cosmos e as origens do universo.",
    priceEth: "0.85",
    category: "Art",
    collection: COLLECTIONS[0],
    network: "Ethereum",
    availableQuantity: 5,
    likes: 120,
  },
  {
    id: "2",
    title: "Ethereal Cyber Punk",
    description:
      "Retrato futurista gerado com foco em estética cyberpunk e cores neon vibrantes.",
    priceEth: "1.20",
    category: "Collectibles",
    collection: COLLECTIONS[1],
    network: "Ethereum",
    availableQuantity: 2,
    likes: 340,
  },
  {
    id: "3",
    title: "Abstract Dimensions #4",
    description:
      "Exploração visual de formas geométricas em um espaço tridimensional abstrato.",
    priceEth: "0.45",
    category: "Abstract",
    collection: COLLECTIONS[2],
    network: "Polygon",
    availableQuantity: 10,
    likes: 85,
  },
];

const EXTRA_TITLES = [
  ["Pixel Forest Dawn", "pixel", "Gaming"],
  ["Mythic Griffin", "mythic", "Collectibles"],
  ["Deep Ocean Whisper", "ocean", "Art"],
  ["Neo Tokyo Rain", "cyber", "Art"],
  ["Cosmic Genesis #002", "cosmic", "Art"],
  ["Abstract Dimensions #7", "abstract", "Abstract"],
  ["Pixel Forest Night", "pixel", "Gaming"],
  ["Mythic Dragon", "mythic", "Collectibles"],
  ["Coral Dream", "ocean", "Art"],
  ["Neon Samurai", "cyber", "Collectibles"],
  ["Cosmic Genesis #003", "cosmic", "Art"],
  ["Abstract Dimensions #9", "abstract", "Abstract"],
  ["Pixel Quest Hero", "pixel", "Gaming"],
  ["Mythic Phoenix", "mythic", "Collectibles"],
  ["Abyssal Light", "ocean", "Art"],
  ["Neo Tokyo Alley", "cyber", "Art"],
  ["Nebula Bloom", "cosmic", "Abstract"],
  ["Fractal Garden", "abstract", "Abstract"],
  ["Pixel Arena", "pixel", "Gaming"],
  ["Mythic Kraken", "mythic", "Collectibles"],
  ["Tidal Glass", "ocean", "Abstract"],
  ["Neo Tokyo Drift", "cyber", "Gaming"],
  ["Micro Fragment #1", "abstract", "Abstract"], // preço com muitas casas
  ["Sold Out Relic", "mythic", "Collectibles"], // esgotado
] as const;

const PRICES = [
  "0.30", "2.50", "0.75", "1.05", "0.90", "0.55", "0.15", "3.20", "0.65",
  "1.80", "0.95", "0.40", "0.25", "2.10", "0.70", "1.35", "0.60", "0.50",
  "0.20", "2.75", "0.80", "1.10", "0.000123", "5.00",
];

function build(): SeedNft[] {
  const list: SeedNft[] = BASE.map((b, i) => ({
    ...b,
    image: artwork(i + 1, b.title),
    author: {
      ...AUTHORS[i % AUTHORS.length],
      avatar: avatar(i),
    },
    createdAt: new Date(Date.UTC(2026, 8, 30 - i)).toISOString(),
  }));

  EXTRA_TITLES.forEach(([title, collectionId, tab], index) => {
    const n = index + 4;
    const collection = COLLECTIONS.find((c) => c.id === collectionId)!;
    list.push({
      id: String(n),
      title,
      description: `${title}: edição digital da coleção ${collection.name}, com autenticidade verificada on-chain.`,
      image: artwork(n, title),
      priceEth: PRICES[index],
      author: { ...AUTHORS[n % AUTHORS.length], avatar: avatar(n) },
      category: tab,
      collection,
      network: NETWORKS[n % NETWORKS.length],
      availableQuantity: title === "Sold Out Relic" ? 0 : 1 + (n % 7),
      likes: 20 + ((n * 37) % 400),
      createdAt: new Date(Date.UTC(2026, 8, 30 - n)).toISOString(),
    });
  });
  return list;
}

export const SEED_NFTS: SeedNft[] = build();

export interface SeedUser {
  id: string;
  name: string;
  email: string;
  salt: string;
  passwordHash: string; // SHA-256(salt + senha). Nunca a senha em claro.
}

// Larissa: Senha@123 · Chaves: Senha@456
export const SEED_USERS: SeedUser[] = [
  {
    id: "user-1",
    name: "Larissa Rosa",
    email: "larissa@exemplo.com",
    salt: "kurio:larissa:",
    passwordHash:
      "01071ae5679e728e5adbfe51ce9b605a76e914ddda566730178a2b03c662d2ad",
  },
  {
    id: "user-2",
    name: "Chaves do 8",
    email: "chavesdo8@exemplo.com",
    salt: "kurio:chaves:",
    passwordHash:
      "7020f07426e727b0ac725dafd356fae5f6d2958042b10f972896fb2f6de25bc2",
  },
];

export interface SeedWallet {
  id: string;
  userId: string;
  address: string;
  network: Network;
  label: string;
  isPrimary: boolean;
}

export const SEED_WALLETS: SeedWallet[] = [
  {
    id: "w-1",
    userId: "user-1",
    address: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
    network: "Ethereum",
    label: "Principal",
    isPrimary: true,
  },
  {
    id: "w-2",
    userId: "user-1",
    address: "0x8ba1f109551bD432803012645Ac136ddd64DBA72",
    network: "Polygon",
    label: "Secundária",
    isPrimary: false,
  },
  {
    id: "w-3",
    userId: "user-2",
    address: "0x2546BcD3c84621e976D8185a91A922aE77ECEc30",
    network: "Ethereum",
    label: "Principal",
    isPrimary: true,
  },
];

// Pagamentos para esta carteira são recusados (para testar o estado "failed")
export const BLOCKED_ADDRESS = "0x000000000000000000000000000000000000dEaD";

export interface Coupon {
  code: string;
  kind: "percent" | "zero_fee";
  value?: string; // percentual, ex.: "10"
  expiresAt?: string;
  maxUses?: number;
}

export const COUPONS: Coupon[] = [
  { code: "PROMO10", kind: "percent", value: "10" },
  { code: "FRETE0", kind: "zero_fee" },
  { code: "VENCIDO", kind: "percent", value: "50", expiresAt: "2020-01-01T00:00:00Z" },
  { code: "UNICO", kind: "percent", value: "20", maxUses: 1 },
];

export const POSTS = [
  {
    id: "p1",
    title: "Como a taxa de rede é calculada",
    excerpt:
      "Entenda por que a taxa varia entre Ethereum, Polygon e Arbitrum e como ela entra na cotação.",
    publishedAt: "2026-10-01T10:00:00Z",
  },
  {
    id: "p2",
    title: "Guia: conectando a sua carteira",
    excerpt:
      "Passo a passo para cadastrar uma carteira principal e uma secundária no KURIO.",
    publishedAt: "2026-09-24T10:00:00Z",
  },
  {
    id: "p3",
    title: "Novas coleções de setembro",
    excerpt: "Pixel Forest e Deep Ocean chegam ao catálogo com edições limitadas.",
    publishedAt: "2026-09-12T10:00:00Z",
  },
];

const REVIEWERS = ["Ana", "Bruno", "Camila", "Diego", "Elisa", "Fábio"];
const COMMENTS = [
  "Obra incrível, acabamento impecável.",
  "Chegou rápido e a autenticidade foi verificada.",
  "Vale cada ETH. Recomendo.",
  "Muito bonito, mas a edição é pequena.",
  "Ótima coleção, quero as próximas.",
  "Detalhes ótimos em tela cheia.",
];

export function reviewsFor(nftId: string) {
  const n = Number(nftId);
  return Array.from({ length: 3 + (n % 4) }, (_, i) => ({
    id: `r-${nftId}-${i}`,
    author: REVIEWERS[(n + i) % REVIEWERS.length],
    rating: 3 + ((n + i) % 3),
    comment: COMMENTS[(n + i * 2) % COMMENTS.length],
    createdAt: new Date(Date.UTC(2026, 8, 1 + ((n + i) % 25))).toISOString(),
  }));
}
