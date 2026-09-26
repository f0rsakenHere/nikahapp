export const pricing = {
  benefits: [
    "No monthly subscription.",
    "No paying just to browse.",
    "Pay only when there is mutual interest and you are ready to connect for potential Nikah.",
    "Unlimited conversation once a connection is opened.",
  ],
  packages: [
    { connections: 1, price: "29.99", description: "Open a conversation with 1 mutual match." },
    { connections: 3, price: "69.99", description: "Open conversations with up to 3 different mutual matches.", featured: true },
    { connections: 5, price: "99.99", description: "Open conversations with up to 5 different mutual matches." },
  ],
} as const;
