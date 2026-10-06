/** The Blacklist (Sid, 2026-10-06 rev 2): four categories. Each word is split left→right into
 *  equal zones, one per item — the cursor's position over the word picks the image. */
export interface Item {
  label: string;
  src: string;
  alt: string;
  /** Label colour that reads on this image (measured on its bottom band): ink on light, bone on dark. */
  tone: "ink" | "bone";
}

export interface Category {
  key: string;
  name: string;
  items: Item[];
}

const INK = new Set(["chains", "rings", "bag", "belt", "jacket", "cargo", "jeans", "linen", "trouser"]);
const item = (cat: string, slug: string, label: string, alt: string): Item => ({
  label,
  src: `/media/things/${cat}/${slug}.webp`,
  alt,
  tone: INK.has(slug) ? "ink" : "bone",
});

export const categories: Category[] = [
  {
    key: "jewellery",
    name: "JEWELLERY",
    items: [
      item("jewellery", "chains", "CHAINS", "Layered silver chains with a cross pendant"),
      item("jewellery", "rings", "RINGS", "Five engraved silver rings"),
      item("jewellery", "wrist-bracelets", "BRACELETS", "Stacked black leather and bead wrist bracelets"),
    ],
  },
  {
    key: "accessories",
    name: "ACCESSORIES",
    items: [
      item("accessories", "bag", "BAG", "White tote bag with a grey tribal print"),
      item("accessories", "belt", "BELT", "Black leather belt with a silver star buckle"),
      item("accessories", "cap", "CAP", "Cream and green Brooklyn NYC cap"),
      item("accessories", "watch", "WATCH", "Square watch with a pink dial on a silver mesh strap"),
    ],
  },
  {
    key: "upperwear",
    name: "UPPERWEAR",
    items: [
      item("upperwear", "full-sleeve", "FULL SLEEVE", "Oversized cream full-sleeve tee with a graphic print"),
      item("upperwear", "jacket", "JACKET", "Black jacket with embroidered crane and dragon"),
      item("upperwear", "polo-shirts", "POLO", "White Wednesday polo shirt with a green collar"),
      item("upperwear", "shirt", "SHIRT", "Brown corduroy shirt with floral embroidery"),
      item("upperwear", "t-shirt", "T-SHIRT", "White t-shirt with a red phoenix print"),
    ],
  },
  {
    key: "bottomwear",
    name: "BOTTOMWEAR",
    items: [
      item("bottomwear", "cargo", "CARGO", "Beige baggy cargo pants"),
      item("bottomwear", "jeans", "JEANS", "Black baggy jeans with an eagle print"),
      item("bottomwear", "linen", "LINEN", "Cream linen trousers"),
      item("bottomwear", "trouser", "TROUSER", "Dark brown pleated trousers with a belt"),
    ],
  },
];
