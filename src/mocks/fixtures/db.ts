import type { NFT, User } from "../../types";

export const initialNfts: NFT[] = [
  {
    id: "1",
    title: "Cosmic Genesis #001",
    description:
      "Uma obra de arte digital única explorando o cosmos e as origens do universo.",
    image:
      "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=800&auto=format&fit=crop",
    priceEth: "0.85",
    author: {
      name: "CyberArtist",
      avatar:
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop",
      verified: true,
    },
    category: "Art",
    availableQuantity: 5,
    likes: 120,
  },
  {
    id: "2",
    title: "Ethereal Cyber Punk",
    description:
      "Retrato futurista gerado com foco em estética cyberpunk e cores neon vibrantes.",
    image:
      "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=800&auto=format&fit=crop",
    priceEth: "1.20",
    author: {
      name: "NeoCreator",
      avatar:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&auto=format&fit=crop",
      verified: true,
    },
    category: "Collectibles",
    availableQuantity: 2,
    likes: 340,
  },
  {
    id: "3",
    title: "Abstract Dimensions #4",
    description:
      "Exploração visual de formas geométricas em um espaço tridimensional abstrato.",
    image:
      "https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?q=80&w=800&auto=format&fit=crop",
    priceEth: "0.45",
    author: {
      name: "PolygonArt",
      avatar:
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200&auto=format&fit=crop",
      verified: false,
    },
    category: "Abstract",
    availableQuantity: 10,
    likes: 85,
  },
];

export const mockUser: User = {
  id: "user-1",
  name: "Fabrycio Correa",
  email: "fabrycio@exemplo.com",
  avatar:
    "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=200&auto=format&fit=crop",
  wallets: [
    {
      id: "w-1",
      address: "0x71C...3d29",
      network: "Ethereum",
      isPrimary: true,
    },
  ],
};

export interface MockAccount {
  id: string;
  name: string;
  email: string;
  passwordHash: string; // SHA-256 da senha (nunca a senha em claro)
}

export const mockUsers: MockAccount[] = [
  {
    id: "user-1",
    name: "Larissa Rosa",
    email: "larissa@exemplo.com",
    passwordHash:
      "a2ca37fe6fdc490b8f7ce841e1701a169d2b1697c6b5b5c63f94abb8f9b6d6dd",
  },
  {
    id: "user-2",
    name: "Chaves do 8",
    email: "chavesdo8@exemplo.com",
    passwordHash:
      "9875d879e70abde04d1959fb9d3450837bbd78217423bc11734574413532ada8",
  },
];
