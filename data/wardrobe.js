/**
 * Timeless Wardrobe — frozen catalogue seed (offline fallback + dev).
 *
 * Frozen from Supabase wardrobe_items on 2026-05-16T20:44:39.750Z.
 * Regenerate: npm run db:freeze-catalogue
 *
 * Collection thesis is described in the site header. Each row uses `category` (and optional
 * `season`) for browsing; `section` / `pillar` are legacy fields and not shown in the UI.
 *
 * Images: full `https://…` public URLs (Supabase `wardrobe-images` bucket).
 * Optional `gallery`: string[] of extra image URLs; `image` is always the cover.
 * Optional `colourVariants`: same product in multiple colours — one collection row.
 * Optional `size`, `measuredDimensions`, and `purchaseDate`.
 */

const WARDROBE_ITEMS = [
  {
    "id": "acme-cultum-navy-double-breasted-super-120s-blazer",
    "category": "Jackets",
    "brand": "ACME CULTUM",
    "name": "Navy Double-Breasted  Blazer",
    "season": "A/W",
    "colour": "Navy",
    "colourCode": "#1C1D28",
    "fabric": "Super 120s Wool",
    "weight": "265 gsm",
    "size": "56C",
    "purchaseDate": "2024-11-06",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/acme-cultum-navy-double-breasted-super-120s-blazer/1778701651368-cover-edit.png",
    "gallery": [
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/acme-cultum-navy-double-breasted-super-120s-blazer/main/gallery/01.jpg"
    ],
    "metadata": {
      "price": 1284.65,
      "priceCurrency": "CNY"
    }
  },

  {
    "id": "alden-563-tassel-loafer-color-8-cordovan",
    "category": "Footwear",
    "brand": "ALDEN",
    "name": "Tassel Loafer",
    "season": "All-season",
    "colour": "Color 8",
    "fabric": "Horween shell cordovan",
    "weight": "563",
    "size": "US 10.5 E",
    "purchaseDate": "2023-01-19",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/alden-563-tassel-loafer-color-8-cordovan/1778704459416-cover-edit.png",
    "gallery": [
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/alden-563-tassel-loafer-color-8-cordovan/main/gallery/01.webp"
    ],
    "notes": "Sole: Single oak leather outsole \nLast: Aberdeen",
    "metadata": {
      "price": 200,
      "basicColour": "red",
      "priceCurrency": "USD"
    }
  },

  {
    "id": "barbour-sage-beaufort-waxed-jacket",
    "category": "Outerwear",
    "brand": "BARBOUR",
    "name": "Sage Beaufort Waxed Jacket",
    "season": "A/W",
    "colour": "Sage",
    "fabric": "Waxed cotton",
    "size": "44",
    "purchaseDate": "2025-08-01",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/barbour-sage-beaufort-waxed-jacket/main/cover.png",
    "gallery": [
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/barbour-sage-beaufort-waxed-jacket/main/gallery/01.jpg",
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/barbour-sage-beaufort-waxed-jacket/main/gallery/02.jpg",
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/barbour-sage-beaufort-waxed-jacket/main/gallery/03.jpg"
    ],
    "metadata": {
      "price": 43200,
      "priceCurrency": "JPY"
    }
  },

  {
    "id": "jewellery-curb-bracelet",
    "category": "Jewellery",
    "brand": "bespoke",
    "name": "Curb Bracelet",
    "season": "All-season",
    "colour": "18ct yellow gold, 5.2 mm",
    "size": "20.5 cm （8.07inches）",
    "purchaseDate": "2024-10-26",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/jewellery-curb-bracelet/1778704222719-cover-edit.png",
    "gallery": [
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/jewellery-curb-bracelet/main/gallery/01.jpg",
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/jewellery-curb-bracelet/main/gallery/01.png"
    ],
    "notes": "Size: 20.5 cm （8.07inches）\nWeight: 11.71 g\nGold price: 596 CNY/g (base: 472, +45% vs 2020)\nMaking: 124 CNY/g\nTotal: 6,973 CNY ≈ 31,200 TWD (2024)\nDate: 26 October 2024",
    "metadata": {
      "price": 31200,
      "priceCurrency": "TWD"
    }
  },

  {
    "id": "jewellery-rolo-chain",
    "category": "Jewellery",
    "brand": "bespoke",
    "name": "Rolo Chain",
    "season": "All-season",
    "colour": "18ct yellow gold, 2.5 mm",
    "size": "50 cm",
    "purchaseDate": "2024-08-20",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/jewellery-rolo-chain/1778704232768-cover-edit.png",
    "gallery": [
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/jewellery-rolo-chain/main/gallery/01.jpg"
    ],
    "notes": "Size: 50 cm\nWeight: 9.29 g\nGold price: 514 CNY/g (base: 431, +25% vs 2020)\nMaking: 83 CNY/g\nTotal: 4,778 CNY ≈ 21,400 TWD (2024)\n\u001aDate: 20 August 2024",
    "metadata": {
      "price": 21400,
      "priceCurrency": "TWD"
    }
  },

  {
    "id": "jewellery-ruby-gypsy-ring",
    "category": "Jewellery",
    "brand": "bespoke",
    "name": "Ruby Gypsy Ring",
    "season": "All-season",
    "colour": "18ct yellow gold with Diamonds, 6.8 mm face, 3 mm shank",
    "fabric": "18K",
    "size": "HK 22",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/jewellery-ruby-gypsy-ring/1778698277222-cover-edit.png",
    "notes": "Size: HK 22 (2024-10-10; adjusted to 22.5–23 on 2026-04-07)\nWeight: 8.20 g (total, including stones)   Gold price: 604 CNY/g (base 450, +47% vs 2020)\nRuby: 3 × 4 mm (~0.2 ct)\nDiamonds: 2.3 mm × 2 (total ~0.1 ct)\nMaking: 154 CNY/g\nTotal: 5,057 CNY ≈ 22,600 TWD (2024)\nDate: 4 October 2024\n\nEngraving\nInscription: Ad Meliora . 2024\n￼\n\nReference: A gold ring inset with a single turquoise, inscribed Rumpenheim, 1843",
    "metadata": {
      "price": 22600,
      "priceCurrency": "TWD"
    }
  },

  {
    "id": "jewellery-signet-ring",
    "category": "Jewellery",
    "brand": "bespoke",
    "name": "Signet Ring",
    "season": "All-season",
    "colour": "18ct yellow gold, 12 × 14 mm",
    "size": "HK 14",
    "purchaseDate": "2020-11-01",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/jewellery-signet-ring/1778698092039-cover-edit.png",
    "gallery": [
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/jewellery-signet-ring/main/gallery/01.jpg"
    ],
    "notes": "Size: HK 14 (2020-11-20; confirmed 2026-04-07)\nWeight: 9.6 g (actual)   Gold price: 411 CNY/g (base: 385 CNY/g)\nMaking: 78 CNY/g\nTotal: 4,698 CNY ≈ 20,000 TWD (2020)\nDate: 1 November 2020\n\nEngraving: Victorian interlaced monogram (TYL)",
    "metadata": {
      "price": 20000,
      "priceCurrency": "TWD"
    }
  },

  {
    "id": "brooks-brothers-golden-fleece-navy-twill-blazer",
    "category": "Jackets",
    "brand": "BROOKS BROTHERS",
    "name": "Golden Fleece Navy Blazer",
    "season": "A/W",
    "colour": "Navy",
    "colourCode": "#1B1C26",
    "fabric": "Twill",
    "weight": "300 gsm",
    "size": "46R",
    "purchaseDate": "2025-02-01",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/brooks-brothers-golden-fleece-navy-twill-blazer/1778693552701-cover-edit.png",
    "gallery": [
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/brooks-brothers-golden-fleece-navy-twill-blazer/main/gallery/01.png"
    ],
    "metadata": {
      "price": 55,
      "priceCurrency": "USD"
    }
  },

  {
    "id": "brooks-brothers-light-brown-houndstooth-tweed-jacket",
    "category": "Jackets",
    "brand": "BROOKS BROTHERS",
    "name": "Houndstooth Tweed Jacket",
    "season": "A/W",
    "colourCode": "#A28060",
    "fabric": "Tweed",
    "weight": "~450 gsm",
    "size": "46R",
    "purchaseDate": "2025-03-09",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/brooks-brothers-light-brown-houndstooth-tweed-jacket/main/cover.png",
    "gallery": [
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/brooks-brothers-light-brown-houndstooth-tweed-jacket/main/gallery/01.jpg"
    ],
    "metadata": {
      "price": 79.99,
      "priceCurrency": "USD"
    }
  },

  {
    "id": "burberrys-beige-single-breasted-balmacaan-coat",
    "category": "Outerwear",
    "brand": "BURBERRYS",
    "name": "Balmacaan Coat",
    "season": "A/W",
    "weight": "Single-Breasted",
    "size": "42R",
    "purchaseDate": "2020-12-06",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/burberrys-beige-single-breasted-balmacaan-coat/main/cover.png",
    "metadata": {
      "price": 83.99,
      "priceCurrency": "USD"
    }
  },

  {
    "id": "cartier-tank-solo-large",
    "category": "Dress watch",
    "brand": "CARTIER",
    "name": "Tank Solo",
    "season": "All-season",
    "weight": "W5200004",
    "size": "Large Model",
    "purchaseDate": "2024-11-03",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/cartier-tank-solo-large/main/cover.png",
    "gallery": [
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/cartier-tank-solo-large/main/gallery/01.jpg",
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/cartier-tank-solo-large/main/gallery/01.png"
    ],
    "notes": "Reference: W5200004\nMovement: Cartier Cal. 690 quartz\nCase: 34.8 × 27.4 mm, 18ct yellow gold with alloyed steel case back\nThickness: 5.55 mm\nLugs: 17 mm\nCrown: Beaded crown set with blue synthetic spinel cabochon\nDial: Clear silvered opaline dial, Roman numerals\nHands: Blued-steel sword-shaped hands\nCrystal: Square sapphire crystal\nStrap: Brown square-scale alligator leather\nBuckle: 18ct yellow gold ardillon buckle\nWater Resistance: 3 bar (30 m)\nDate: 3 Nov 2024\n\nNotes:\nDesigned by Louis Cartier in 1917, the Tank remains one of the purest expressions of modern watch design, defined by geometry, restraint, and exact proportion. In continuous production for over a century, it has remained unmistakable while giving rise to later interpretations including Tank Cintrée, Chinoise, Américaine, and Française. The blue spinel cabochon crown, Roman numerals, and blued-steel hands preserve Cartier’s original design language. At only 5.55 mm thick, it retains the ultra-thin elegance expected of a true dress watch. As the only solid-gold watch in this collection, the Tank serves as its aesthetic anchor—not a variation, but one of the original canonical forms of twentieth-century design.",
    "metadata": {
      "price": 100000,
      "basicColour": "gold",
      "priceCurrency": "TWD"
    }
  },

  {
    "id": "common-projects-achilles-low-white",
    "category": "Footwear",
    "brand": "COMMON PROJECTS",
    "name": "Achilles Low",
    "season": "All-season",
    "colour": "White",
    "fabric": "Leather",
    "size": "EU 45",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/common-projects-achilles-low-white/1778704429485-cover-edit.png",
    "gallery": [
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/common-projects-achilles-low-white/main/gallery/01.jpg"
    ],
    "notes": "Margom cup sole. Date: 28 Nov 2025.",
    "metadata": {
      "price": 374.85,
      "priceCurrency": "CNY"
    }
  },

  {
    "id": "crockett-jones-chukka-snuff-suede",
    "category": "Footwear",
    "brand": "CROCKETT & JONES",
    "name": "Chukka",
    "season": "All-season",
    "colour": "Snuff",
    "fabric": "Repello suede",
    "size": "UK 10 D",
    "purchaseDate": "2023-01-29",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/crockett-jones-chukka-snuff-suede/1778697977522-cover-edit.png",
    "gallery": [
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/crockett-jones-chukka-snuff-suede/main/gallery/01.jpg"
    ],
    "notes": "Unlined ankle boot; Scotch-guard treated\nSole: single leather\nLast: 200",
    "metadata": {
      "price": 161.44,
      "basicColour": "brown",
      "priceCurrency": "USD"
    }
  },

  {
    "id": "crockett-jones-pembroke-tan",
    "category": "Footwear",
    "brand": "CROCKETT & JONES",
    "name": "Pembroke",
    "season": "All-season",
    "colour": "Tan",
    "fabric": "Scotch grain calf",
    "size": "UK 10 E",
    "purchaseDate": "2020-10-26",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/crockett-jones-pembroke-tan/1778698000508-cover-edit.png",
    "gallery": [
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/crockett-jones-pembroke-tan/main/gallery/01.jpg"
    ],
    "notes": "Type: Full brogue country derby, wing-tip with full punching. Sole: Dainite rubber. Last: 325. Date: 27 Oct 2020.",
    "metadata": {
      "price": 201.75,
      "basicColour": "brown",
      "priceCurrency": "USD"
    }
  },

  {
    "id": "custom-69db120c-9ec2-4f76-a08c-744a42777fb3",
    "category": "Eyewear",
    "brand": "CUTLER AND GROSS",
    "name": "Kingsman 0847 Sunglasses",
    "season": "All-season",
    "colour": "Black, Brown Lenses",
    "purchaseDate": "2023-11-27",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/custom-69db120c-9ec2-4f76-a08c-744a42777fb3/main/cover.png",
    "gallery": [
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/custom-69db120c-9ec2-4f76-a08c-744a42777fb3/main/gallery/01.png",
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/custom-69db120c-9ec2-4f76-a08c-744a42777fb3/main/gallery/02.png"
    ],
    "metadata": {
      "price": 177.99,
      "basicColour": "black",
      "priceCurrency": "CNY"
    }
  },

  {
    "id": "future-wedding-bands",
    "category": "Jewellery",
    "brand": "future piece",
    "name": "Wedding Bands",
    "season": "All-season",
    "fabric": "Pt950 1.8 mm (bride) / 18ct YG 2 mm size 13 (groom)",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/future-wedding-bands/1778704141467-cover-edit.png",
    "notes": "Inscription: spouse name · date (e.g. Edward · 29 Mai). Worn at base when stacked. Reference: bands of Prince Edward Duke of Kent (1767–1820) and Princess Victoria Duchess of Kent (1786–1861).",
    "metadata": {
      "basicColour": "gold"
    }
  },

  {
    "id": "custom-2aeb4687-58b4-4a4b-90be-43492ca9e1cb",
    "category": "Beater",
    "brand": "G-Shock",
    "name": "DW-5600",
    "season": "All-season",
    "purchaseDate": "2020-04-09",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/custom-2aeb4687-58b4-4a4b-90be-43492ca9e1cb/main/cover.png",
    "gallery": [
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/custom-2aeb4687-58b4-4a4b-90be-43492ca9e1cb/main/gallery/01.jpg"
    ],
    "metadata": {
      "price": 1479,
      "basicColour": "black",
      "priceCurrency": "TWD"
    }
  },

  {
    "id": "gu-wine-cable-knit-polo",
    "category": "Shirts",
    "brand": "GU",
    "name": "Cable-Knit Polo",
    "season": "S/S",
    "colour": "Wine (White Striped Trim)",
    "fabric": "53% Cotton, 47% Acrylic",
    "size": "XL",
    "purchaseDate": "2025-07-15",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/gu-wine-cable-knit-polo/main/cover.png",
    "gallery": [
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/gu-wine-cable-knit-polo/main/gallery/01.jpg"
    ],
    "metadata": {
      "price": 1990,
      "priceCurrency": "JPY"
    }
  },

  {
    "id": "gu-olive-brown-wide-straight-trousers",
    "category": "Bottoms",
    "brand": "GU",
    "name": "Wide-Straight Trousers",
    "season": "All-season",
    "colour": "Mole Brown",
    "fabric": "Poly blend",
    "weight": "Crease front",
    "size": "XL",
    "purchaseDate": "2025-08-11 · Taupe",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/gu-olive-brown-wide-straight-trousers/1778703733818-cover-edit.png",
    "gallery": [
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/gu-olive-brown-wide-straight-trousers/main/gallery/01.avif"
    ],
    "notes": "ワイドスラックス+EC(丈長め78.5cm)",
    "metadata": {
      "price": 2990,
      "priceCurrency": "JPY"
    }
  },

  {
    "id": "hm-hole-knit-beige-polo",
    "category": "Shirts",
    "brand": "H&M",
    "name": "Hole-Knit Polo Shirt",
    "season": "S/S",
    "colour": "Oatmeal Beige",
    "fabric": "Knit",
    "size": "XL",
    "purchaseDate": "2025-07-28",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/hm-hole-knit-beige-polo/1778703469914-cover-edit.png",
    "gallery": [
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/hm-hole-knit-beige-polo/main/gallery/01.jpg"
    ],
    "metadata": {
      "price": 2499,
      "priceCurrency": "JPY"
    }
  },

  {
    "id": "hm-linen-pleated-shorts-beige",
    "category": "Bottoms",
    "brand": "H&M",
    "name": "Linen Pleated Shorts",
    "season": "S/S",
    "colour": "Ecru",
    "colourCode": "#E2DDD1",
    "fabric": "Linen",
    "size": "XL",
    "purchaseDate": "2025-07-29",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/hm-linen-pleated-shorts-beige/1778703351069-cover-edit.png",
    "gallery": [
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/hm-linen-pleated-shorts-beige/main/gallery/01.png"
    ],
    "metadata": {
      "price": 3600,
      "basicColour": "white",
      "priceCurrency": "JPY"
    }
  },

  {
    "id": "hm-oatmeal-stripe-camp-collar-shirt",
    "category": "Shirts",
    "brand": "H&M",
    "name": "Striped Camp Collar Shirt",
    "season": "S/S",
    "colour": "Oatmeal/Striped",
    "size": "XL",
    "purchaseDate": "2025-08-01",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/hm-oatmeal-stripe-camp-collar-shirt/1778703504683-cover-edit.png",
    "gallery": [
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/hm-oatmeal-stripe-camp-collar-shirt/main/gallery/01.webp",
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/hm-oatmeal-stripe-camp-collar-shirt/main/gallery/02.webp",
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/hm-oatmeal-stripe-camp-collar-shirt/main/gallery/03.webp"
    ],
    "notes": "Regular Fit Textured resort shirt",
    "metadata": {
      "price": 2499,
      "priceCurrency": "JPY"
    }
  },

  {
    "id": "jpress-grey-herringbone-tweed-jacket",
    "category": "Jackets",
    "brand": "J. PRESS",
    "name": "Herringbone Tweed Jacket",
    "season": "A/W",
    "colour": "Grey",
    "fabric": "Tweed",
    "weight": "~480 gsm",
    "size": "46R",
    "purchaseDate": "2025-01-13",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/jpress-grey-herringbone-tweed-jacket/main/cover.png",
    "gallery": [
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/jpress-grey-herringbone-tweed-jacket/main/gallery/01.png"
    ],
    "metadata": {
      "price": 175,
      "priceCurrency": "USD"
    }
  },

  {
    "id": "custom-c60ef29b-7596-4b2c-aac2-6d1dcedbd74c",
    "category": "Eyewear",
    "brand": "KlassiC.",
    "name": "Smoke Olive Acetate Optical (copy)",
    "season": "All-season",
    "colour": "Clear",
    "weight": "M141",
    "purchaseDate": "2024-08-15",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/custom-c60ef29b-7596-4b2c-aac2-6d1dcedbd74c/main/cover.png",
    "gallery": [
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/custom-c60ef29b-7596-4b2c-aac2-6d1dcedbd74c/main/gallery/01.png",
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/custom-c60ef29b-7596-4b2c-aac2-6d1dcedbd74c/main/gallery/02.png"
    ],
    "metadata": {
      "price": 990,
      "basicColour": "brown",
      "priceCurrency": "TWD"
    }
  },

  {
    "id": "llbean-camel-corduroy-trousers",
    "category": "Bottoms",
    "brand": "L.L.BEAN",
    "name": "Corduroy Trousers",
    "season": "A/W",
    "colour": "Dark Khaki",
    "colourCode": "#C3A581",
    "fabric": "Corduroy",
    "size": "38 x 30 inch",
    "purchaseDate": "2025-01-01",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/llbean-camel-corduroy-trousers/main/cover.png",
    "gallery": [
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/llbean-camel-corduroy-trousers/main/gallery/01.jpg"
    ],
    "metadata": {
      "price": 11000,
      "basicColour": "brown",
      "priceCurrency": "JPY"
    }
  },

  {
    "id": "mfk-grand-soir",
    "category": "Evening",
    "brand": "MAISON FRANCIS KURKDJIAN",
    "name": "Grand Soir",
    "season": "All-season",
    "colour": "Labdanum, benzoin, vanilla, amber",
    "size": "70 ml",
    "purchaseDate": "2025-08-01",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/mfk-grand-soir/main/cover.png",
    "gallery": [
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/mfk-grand-soir/main/gallery/01.jpg"
    ],
    "metadata": {
      "price": 22000,
      "basicColour": "__omit__",
      "priceCurrency": "JPY"
    }
  },

  {
    "id": "muji-oatmeal-beige-heavy-aran-wool-cable-knit-jumper",
    "category": "Mid Layer",
    "brand": "MUJI",
    "name": "Aran Cable-Knit Jumper",
    "season": "A/W",
    "colour": "Oatmeal beige",
    "fabric": "Wool",
    "weight": "Heavy",
    "size": "XL",
    "purchaseDate": "2024-12-27",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/muji-oatmeal-beige-heavy-aran-wool-cable-knit-jumper/main/cover.png",
    "gallery": [
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/muji-oatmeal-beige-heavy-aran-wool-cable-knit-jumper/main/gallery/01.png"
    ],
    "metadata": {
      "price": 7990,
      "priceCurrency": "JPY"
    }
  },

  {
    "id": "muji-slate-blue-lightweight-fine-knit-tee",
    "category": "Shirts",
    "brand": "MUJI",
    "name": "Fine Knit T-Shirt",
    "season": "S/S",
    "colour": "Slate Blue",
    "fabric": "Knit",
    "weight": "Lightweight",
    "size": "XL",
    "measuredDimensions": "Measurements: XL\t72.0cm\t48.0cm\t120.0cm\t118.0cm\t53.0cm\t27.5cm\t51.5cm\t106.0cm\t60.0cm\t59.0cm cm",
    "purchaseDate": "2025-04-07",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/muji-slate-blue-lightweight-fine-knit-tee/1778705268050-cover-edit.png",
    "gallery": [
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/muji-slate-blue-lightweight-fine-knit-tee/main/gallery/01.jpg"
    ],
    "notes": "* Lightweight hemp-blend knit with a dry, breathable hand feel.\n* Knitted from twisted hemp and polyester yarns for improved washability, shape retention, and reduced surface fuzz.\n* Garment-washed to preserve the natural texture of hemp while achieving 90%+ UV protection.\n* Relaxed crew-neck silhouette, suitable for wearing alone or layered over a T-shirt.\n* Slightly sheer, lightweight fabric with an easy, relaxed fit.",
    "metadata": {
      "price": 1990,
      "priceCurrency": "JPY",
      "measurementRows": [
        {
          "label": "Measurements",
          "value": "XL\t72.0cm\t48.0cm\t120.0cm\t118.0cm\t53.0cm\t27.5cm\t51.5cm\t106.0cm\t60.0cm\t59.0cm"
        }
      ]
    }
  },

  {
    "id": "muji-dark-navy-wool-high-gauge-v-neck-cardigan",
    "category": "Mid Layer",
    "brand": "MUJI",
    "name": "High-Gauge V-Neck",
    "season": "A/W",
    "colour": "Navy",
    "fabric": "Wool",
    "weight": "Lightweight",
    "size": "XL",
    "purchaseDate": "2024-12-17",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/muji-dark-navy-wool-high-gauge-v-neck-cardigan/main/cover.png",
    "gallery": [
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/muji-dark-navy-wool-high-gauge-v-neck-cardigan/main/gallery/01.jpg"
    ],
    "notes": "紳士　洗えるウールハイゲージＶネックカーディガン紳士ＸＬ・ダークネイビー",
    "metadata": {
      "price": 4990,
      "priceCurrency": "JPY"
    }
  },

  {
    "id": "muji-cream-wide-leg-jeans",
    "category": "Bottoms",
    "brand": "MUJI",
    "name": "Wide-Leg Jeans",
    "season": "All-season",
    "colour": "Natural Ecru",
    "fabric": "Kapok, Cotton",
    "size": "XL",
    "purchaseDate": "2025-04-21",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/muji-cream-wide-leg-jeans/main/cover.png",
    "gallery": [
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/muji-cream-wide-leg-jeans/main/gallery/01.jpg"
    ],
    "notes": "木の実から作ったカポック混キャンバスワイドパンツ\nカラー：生成\nサイズ：紳士ＸＬ\n商品番号：84218460",
    "metadata": {
      "price": 4990,
      "priceCurrency": "JPY"
    }
  },

  {
    "id": "nicolai-new-york",
    "category": "Day",
    "brand": "NICOLAÏ",
    "name": "New York",
    "season": "All-season",
    "colour": "Bergamot, black pepper, oak moss.",
    "size": "100 ml",
    "purchaseDate": "2025-08-02",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/nicolai-new-york/1778704154934-cover-edit.png",
    "gallery": [
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/nicolai-new-york/main/gallery/01.png"
    ],
    "metadata": {
      "price": 23000,
      "basicColour": "__omit__",
      "priceCurrency": "JPY"
    }
  },

  {
    "id": "paraboot-ferret-lisse-cafe",
    "category": "Footwear",
    "brand": "PARABOOT",
    "name": "Ferret",
    "season": "S/S",
    "colour": "Lisse Café",
    "weight": "Rubber Sole",
    "size": "UK 10",
    "purchaseDate": "2025-08-03",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/paraboot-ferret-lisse-cafe/main/cover.png",
    "gallery": [
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/paraboot-ferret-lisse-cafe/main/gallery/01.jpg",
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/paraboot-ferret-lisse-cafe/main/gallery/02.jpg",
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/paraboot-ferret-lisse-cafe/main/gallery/03.jpg"
    ],
    "metadata": {
      "price": 41696,
      "priceCurrency": "JPY"
    }
  },

  {
    "id": "prl-beige-basket-weave-linen-jacket",
    "category": "Jackets",
    "brand": "POLO RALPH LAUREN",
    "name": "Basket-Weave Linen Jacket",
    "season": "S/S",
    "fabric": "Linen",
    "weight": "~280 gsm",
    "size": "AB8",
    "purchaseDate": "2025-02-01",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/prl-beige-basket-weave-linen-jacket/main/cover.png",
    "gallery": [
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/prl-beige-basket-weave-linen-jacket/main/gallery/01.jpg",
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/prl-beige-basket-weave-linen-jacket/main/gallery/02.jpg",
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/prl-beige-basket-weave-linen-jacket/main/gallery/03.jpg",
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/prl-beige-basket-weave-linen-jacket/main/gallery/04.jpg",
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/prl-beige-basket-weave-linen-jacket/main/gallery/05.jpg",
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/prl-beige-basket-weave-linen-jacket/main/gallery/06.jpg",
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/prl-beige-basket-weave-linen-jacket/main/gallery/07.jpg",
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/prl-beige-basket-weave-linen-jacket/main/gallery/08.jpg",
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/prl-beige-basket-weave-linen-jacket/main/gallery/09.jpg",
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/prl-beige-basket-weave-linen-jacket/main/gallery/10.jpg",
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/prl-beige-basket-weave-linen-jacket/main/gallery/11.jpg",
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/prl-beige-basket-weave-linen-jacket/main/gallery/12.jpg"
    ],
    "notes": "Polo Ralph Lauren Vintage Linen Sport Coat (1990s, Made in Japan)\n\n* Era: 1990s\n* Line: Polo by Ralph Lauren\n* Licensee: Impact 21 Co., Ltd. (Japanese subsidiary of Ralph Lauren)\n* Measurements:\n    * Back Length: 78 cm\n    * Shoulder: 49 cm\n    * Chest: 61 cm\n    * Sleeve Length: 64 cm\n* Colour: Mixed Beige\n* Shell: 100% Linen\n* Lining: Cupro\n* Country of Origin: Made in Japan\n\nNotes:\nA Japanese domestic licensed piece from the 1990s under Impact 21, featuring classic American tailoring details including a 3-roll-2 front, notch lapels, side vents, and breathable linen construction. The relaxed silhouette reflects the softer Ivy / trad tailoring proportions typical of Ralph Lauren’s 1990s tailoring. Suitable as a warm-weather sport coat with strong compatibility for both Ivy and classic American casual wardrobes.",
    "metadata": {
      "price": 10620,
      "basicColour": "brown",
      "priceCurrency": "JPY"
    }
  },

  {
    "id": "prl-wine-polo-bear-wool-cashmere-jumper",
    "category": "Mid Layer",
    "brand": "POLO RALPH LAUREN",
    "name": "Polo Bear Jumper",
    "season": "A/W",
    "colour": "Wine",
    "fabric": "Wool-cashmere",
    "size": "XL",
    "purchaseDate": "2025-01-07",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/prl-wine-polo-bear-wool-cashmere-jumper/main/cover.png",
    "gallery": [
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/prl-wine-polo-bear-wool-cashmere-jumper/main/gallery/01.jpg",
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/prl-wine-polo-bear-wool-cashmere-jumper/main/gallery/02.jpg",
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/prl-wine-polo-bear-wool-cashmere-jumper/main/gallery/03.jpg",
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/prl-wine-polo-bear-wool-cashmere-jumper/main/gallery/04.jpg"
    ],
    "metadata": {
      "price": 28000,
      "priceCurrency": "JPY"
    }
  },

  {
    "id": "prl-washed-wine-cream-rugby-shirt",
    "category": "Mid Layer",
    "brand": "POLO RALPH LAUREN",
    "name": "Washed Rugby Shirt",
    "season": "A/W",
    "colour": "Wine / Cream",
    "fabric": "Cotton",
    "size": "XL",
    "purchaseDate": "2025-01-19",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/prl-washed-wine-cream-rugby-shirt/1778705113968-cover-edit.png",
    "gallery": [
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/prl-washed-wine-cream-rugby-shirt/main/gallery/01.webp",
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/prl-washed-wine-cream-rugby-shirt/main/gallery/02.webp",
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/prl-washed-wine-cream-rugby-shirt/main/gallery/03.webp"
    ],
    "metadata": {
      "price": 6490,
      "basicColour": "red",
      "priceCurrency": "JPY"
    }
  },

  {
    "id": "custom-b5af381a-752a-4e09-a1d5-434ab96efda0",
    "category": "Eyewear",
    "brand": "Ray-Ban",
    "name": "Original Wayfarer Sunglasses",
    "season": "All-season",
    "colour": "Tortoise, G-15 Green",
    "purchaseDate": "2025-08-08",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/custom-b5af381a-752a-4e09-a1d5-434ab96efda0/main/cover.png",
    "gallery": [
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/custom-b5af381a-752a-4e09-a1d5-434ab96efda0/main/gallery/03.jpeg",
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/custom-b5af381a-752a-4e09-a1d5-434ab96efda0/main/gallery/02.jpeg",
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/custom-b5af381a-752a-4e09-a1d5-434ab96efda0/main/gallery/04.jpeg",
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/custom-b5af381a-752a-4e09-a1d5-434ab96efda0/main/gallery/05.jpeg",
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/custom-b5af381a-752a-4e09-a1d5-434ab96efda0/main/gallery/01.jpeg"
    ],
    "metadata": {
      "price": 6490,
      "basicColour": "brown",
      "priceCurrency": "JPY"
    }
  },

  {
    "id": "the-engineer-brown-mixed-fair-isle-wool-vest",
    "category": "Mid Layer",
    "brand": "THE ENGINEER",
    "name": "Fair Isle Vest",
    "season": "A/W",
    "colour": "Brown Mixed",
    "fabric": "Wool",
    "size": "XXL",
    "purchaseDate": "2024-11-03",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/the-engineer-brown-mixed-fair-isle-wool-vest/main/cover.png",
    "gallery": [
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/the-engineer-brown-mixed-fair-isle-wool-vest/main/gallery/01.jpg"
    ],
    "metadata": {
      "price": 357.97,
      "priceCurrency": "CNY"
    }
  },

  {
    "id": "the-engineer-black-cotton-long-sleeve-polo",
    "category": "Shirts",
    "brand": "THE ENGINEER",
    "name": "Knit Long-Sleeve Polo",
    "season": "A/W",
    "colour": "Black",
    "fabric": "Cotton",
    "size": "XXL",
    "purchaseDate": "2024-11-03",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/the-engineer-black-cotton-long-sleeve-polo/main/cover.png",
    "gallery": [
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/the-engineer-black-cotton-long-sleeve-polo/main/gallery/01.jpg"
    ],
    "metadata": {
      "price": 407.82,
      "priceCurrency": "CNY"
    }
  },

  {
    "id": "the-engineer-ecru-linen-safari-jacket",
    "category": "Outerwear",
    "brand": "THE ENGINEER",
    "name": "Linen Safari Jacket",
    "season": "S/S",
    "colour": "Ecru",
    "fabric": "Linen",
    "weight": "~350 gsm",
    "size": "XXL",
    "purchaseDate": "2023-01-28",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/the-engineer-ecru-linen-safari-jacket/1778693942301-cover-edit.png",
    "metadata": {
      "price": 893.32,
      "priceCurrency": "CNY"
    }
  },

  {
    "id": "tissot-prx-quartz-35mm-gold-pvd",
    "category": "Everyday",
    "brand": "TISSOT",
    "name": "PRX Quartz",
    "season": "All-season",
    "colour": "Gold PVD",
    "weight": "T137.210.33.021.00",
    "size": "35 mm",
    "purchaseDate": "2024-08-08",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/tissot-prx-quartz-35mm-gold-pvd/1778711173624-cover-edit.png",
    "gallery": [
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/tissot-prx-quartz-35mm-gold-pvd/main/gallery/01.jpg"
    ],
    "notes": "Movement: ETA F06.115 quartz\nCase: : 35mm YG PVD coating, thckness 9.6mm\nDial: Champagne sunburst\nBracelet: Integrated gold PVD coating\n\n\fNotes:\nPRX 源⾃ 70 年代 integrated-bracelet watch 的設計語⾔ , 與 VC 222 共享類似的造型 ｡ 儘管全錶都是⾦⾊調 , vintage luxury sports watch 的外觀使其仍能作為⼀隻稱職的 everyday watch , 同時作為未來邁向 Rolex 16018 的過渡 ｡",
    "metadata": {
      "price": 11309,
      "basicColour": "gold",
      "priceCurrency": "TWD"
    }
  },

  {
    "id": "custom-207c8109-cc63-4c01-987e-af5b0201df46",
    "category": "Bags",
    "brand": "Tsuchiya Kaban",
    "name": "Cordovan L Zip Wallet Regular price",
    "season": "All-season",
    "colour": "Brown",
    "colourCode": "#7c371b",
    "size": "Cordovan",
    "purchaseDate": "2024-12-26",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/custom-207c8109-cc63-4c01-987e-af5b0201df46/main/cover.png",
    "gallery": [
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/custom-207c8109-cc63-4c01-987e-af5b0201df46/main/gallery/01.jpg",
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/custom-207c8109-cc63-4c01-987e-af5b0201df46/main/gallery/03.webp"
    ],
    "notes": "Crafted from aniline-dyed Japanese cordovan, this minimalist wallet offers sleek design and efficient functionality. The luxuriously smooth leather has striking presence in a streamlined profile that slips effortlessly into any pocket. Over time, it develops a rich, gem-like luster—the perfect companion for an intentional lifestyle.",
    "metadata": {
      "price": 33000,
      "basicColour": "brown",
      "priceCurrency": "JPY"
    }
  },

  {
    "id": "tudor-black-bay-58",
    "category": "Dive watch",
    "brand": "TUDOR",
    "name": "Black Bay 58",
    "season": "All-season",
    "weight": "M79030N",
    "size": "39 mm",
    "purchaseDate": "2024-10-17",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/tudor-black-bay-58/1778717886908-cover-edit.png",
    "gallery": [
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/tudor-black-bay-58/main/gallery/01.jpg",
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/tudor-black-bay-58/main/gallery/02.jpg"
    ],
    "notes": "Movement: MT5402\nCase: 39mm SS, thickness 11.9mm\nLugs: 20mm lug width\nDial: Black domed\nBracelet: Riveted steel bracelet\n\nNotes:\nBB58 的比例與細節承襲 1958 年 Tudor ／ Rolex Submariner (7924 ／ 7922) 的設定, 包括窄外圈與纖薄中殼｡ 12 點紅⾊倒三⾓呼應 6538 ｢Big Crown｣, gilt dial 亦與現有⾦飾相呼應 ｡ 是本收藏裡唯⼀真正意義上的運動錶 ｡",
    "metadata": {
      "price": 82000,
      "basicColour": "silver",
      "priceCurrency": "TWD"
    }
  },

  {
    "id": "uniqlo-jwa-straight-jeans",
    "category": "Bottoms",
    "brand": "UNIQLO",
    "name": "JWA Straight Jeans",
    "season": "All-season",
    "colour": "Light Wash Blue",
    "fabric": "Denim",
    "size": "35inch",
    "purchaseDate": "2026-03-24",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/uniqlo-jwa-straight-jeans/main/cover.png",
    "gallery": [
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/uniqlo-jwa-straight-jeans/main/gallery/01.jpg"
    ],
    "metadata": {
      "price": 1290,
      "basicColour": "blue",
      "priceCurrency": "TWD"
    }
  },

  {
    "id": "uniqlo-beige-kataaze-knit-mock-neck",
    "category": "Shirts",
    "brand": "UNIQLO",
    "name": "Kataaze Knit Mock Neck",
    "season": "A/W",
    "colour": "Beige",
    "fabric": "Acrylic blend",
    "size": "XL",
    "purchaseDate": "2022-02-13",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/uniqlo-beige-kataaze-knit-mock-neck/1778696680155-cover-edit.png",
    "gallery": [
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/uniqlo-beige-kataaze-knit-mock-neck/main/gallery/01.jpg"
    ],
    "metadata": {
      "price": 990,
      "priceCurrency": "TWD"
    }
  },

  {
    "id": "uniqlo-light-blue-linen-camp-collar-shirt",
    "category": "Shirts",
    "brand": "UNIQLO",
    "name": "Linen Camp Collar Shirt",
    "season": "S/S",
    "colour": "Dusty Ice Blue",
    "colourCode": "#B5CDED",
    "fabric": "Linen",
    "size": "XL",
    "purchaseDate": "2025-07-13",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/uniqlo-light-blue-linen-camp-collar-shirt/1778705380735-cover-edit.png",
    "gallery": [
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/uniqlo-light-blue-linen-camp-collar-shirt/main/gallery/01.avif"
    ],
    "notes": "コットンリネンシャツ",
    "metadata": {
      "price": 2990,
      "priceCurrency": "JPY"
    }
  },

  {
    "id": "uniqlo-ocbd-shirt",
    "category": "Shirts",
    "brand": "UNIQLO",
    "name": "OCBD Shirt",
    "season": "All-season",
    "colour": "Blue",
    "colourCode": "#BAC9EF",
    "fabric": "Cotton",
    "size": "XL",
    "purchaseDate": "2020-01-01",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/uniqlo-ocbd-shirt/1778706728073-variant-blue-cover.png",
    "colourVariants": [
      {
        "key": "blue",
        "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/uniqlo-ocbd-shirt/variants/blue/cover.png",
        "label": "Blue",
        "notes": "",
        "colour": "Blue",
        "gallery": [
          "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/uniqlo-ocbd-shirt/main/gallery/01.jpg"
        ],
        "colourCode": "#BAC9EF",
        "previewImage": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/uniqlo-ocbd-shirt/variants/blue/preview.jpg"
      },
      {
        "key": "white",
        "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/uniqlo-ocbd-shirt/variants/white/cover.png",
        "label": "White",
        "notes": "",
        "colour": "White",
        "gallery": [],
        "colourCode": "#F5F5F9",
        "previewImage": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/uniqlo-ocbd-shirt/variants/white/preview.jpg"
      },
      {
        "key": "pink-stripe",
        "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/uniqlo-ocbd-shirt/variants/pink-stripe/cover.png",
        "label": "Pink stripe",
        "notes": "",
        "colour": "Pink stripe",
        "gallery": [],
        "colourCode": "#EEE7E4",
        "previewImage": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/uniqlo-ocbd-shirt/variants/pink-stripe/preview.png"
      },
      {
        "key": "blue-striped",
        "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/uniqlo-ocbd-shirt/variants/blue-striped/cover.png",
        "label": "Blue striped",
        "notes": "",
        "colour": "Blue striped",
        "gallery": [],
        "colourCode": "#DCE1F5",
        "previewImage": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/uniqlo-ocbd-shirt/variants/blue-striped/preview.png"
      }
    ],
    "metadata": {
      "price": 3990,
      "priceCurrency": "JPY",
      "colourVariants": [
        {
          "key": "blue",
          "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/uniqlo-ocbd-shirt/variants/blue/cover.png",
          "label": "Blue",
          "notes": "",
          "colour": "Blue",
          "gallery": [
            "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/uniqlo-ocbd-shirt/main/gallery/01.jpg"
          ],
          "colourCode": "#BAC9EF",
          "previewImage": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/uniqlo-ocbd-shirt/variants/blue/preview.jpg"
        },
        {
          "key": "white",
          "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/uniqlo-ocbd-shirt/variants/white/cover.png",
          "label": "White",
          "notes": "",
          "colour": "White",
          "gallery": [],
          "colourCode": "#F5F5F9",
          "previewImage": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/uniqlo-ocbd-shirt/variants/white/preview.jpg"
        },
        {
          "key": "pink-stripe",
          "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/uniqlo-ocbd-shirt/variants/pink-stripe/cover.png",
          "label": "Pink stripe",
          "notes": "",
          "colour": "Pink stripe",
          "gallery": [],
          "colourCode": "#EEE7E4",
          "previewImage": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/uniqlo-ocbd-shirt/variants/pink-stripe/preview.png"
        },
        {
          "key": "blue-striped",
          "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/uniqlo-ocbd-shirt/variants/blue-striped/cover.png",
          "label": "Blue striped",
          "notes": "",
          "colour": "Blue striped",
          "gallery": [],
          "colourCode": "#DCE1F5",
          "previewImage": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/uniqlo-ocbd-shirt/variants/blue-striped/preview.png"
        }
      ]
    }
  },

  {
    "id": "zara-dark-grey-open-knit-polo",
    "category": "Shirts",
    "brand": "ZARA",
    "name": "Cutwork Knit Polo Shirt",
    "season": "S/S",
    "colour": "Charcoal",
    "fabric": "88% acrylic, 12% polyester",
    "size": "XL",
    "purchaseDate": "2025-07-29",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/zara-dark-grey-open-knit-polo/1778703598602-cover-edit.png",
    "gallery": [
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/zara-dark-grey-open-knit-polo/main/gallery/01.jpg",
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/zara-dark-grey-open-knit-polo/main/gallery/02.jpg"
    ],
    "notes": "Relaxed fit knit polo shirt woven from yarn with an open structure. Lapel collar with front opening. Short sleeves. Ribbed trims.",
    "metadata": {
      "price": 7990,
      "priceCurrency": "JPY"
    }
  },

  {
    "id": "zara-cream-linen-loop-collar-shirt",
    "category": "Shirts",
    "brand": "ZARA",
    "name": "Linen Loop-Collar Shirt",
    "season": "S/S",
    "colour": "Oyster-white",
    "fabric": "Linen",
    "size": "XL",
    "purchaseDate": "2025-08-09",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/zara-cream-linen-loop-collar-shirt/1778706867600-cover-edit.png",
    "gallery": [
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/zara-cream-linen-loop-collar-shirt/main/gallery/01.jpg"
    ],
    "notes": "FLOWING REGULAR FIT SHIRT",
    "metadata": {
      "price": 8590,
      "priceCurrency": "JPY"
    }
  },

  {
    "id": "zara-ecru-purl-knit-t-shirt",
    "category": "Shirts",
    "brand": "ZARA",
    "name": "Purl-Knit T-Shirt",
    "season": "S/S",
    "colour": "Off-White",
    "size": "XL",
    "purchaseDate": "2025-08-05",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/zara-ecru-purl-knit-t-shirt/main/cover.png",
    "gallery": [
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/zara-ecru-purl-knit-t-shirt/main/gallery/01.jpg"
    ],
    "metadata": {
      "price": 5990,
      "basicColour": "white",
      "priceCurrency": "JPY"
    }
  },

  {
    "id": "zara-dusty-ice-blue-ribbed-knit-polo",
    "category": "Shirts",
    "brand": "ZARA",
    "name": "Rib Knit Polo Shirt",
    "season": "S/S",
    "colour": "Dusty Ice Blue",
    "fabric": "Knit",
    "size": "XL",
    "purchaseDate": "2025-12-12",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/zara-dusty-ice-blue-ribbed-knit-polo/1778705220183-cover-edit.png",
    "gallery": [
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/zara-dusty-ice-blue-ribbed-knit-polo/main/gallery/01.jpg"
    ],
    "notes": "ZARA RIB KNIT POLO SHIRT",
    "metadata": {
      "price": 1570,
      "priceCurrency": "TWD"
    }
  },

  {
    "id": "custom-f5c105c7-9ca8-486f-b726-e7aa8b8fd416",
    "category": "Eyewear",
    "brand": "Zoff",
    "name": "Dark Havana / Gold Boston Metal Frames",
    "season": "All-season",
    "colour": "Green Photochromic Lenses",
    "weight": "ZF192014",
    "purchaseDate": "2025-02-28",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/custom-f5c105c7-9ca8-486f-b726-e7aa8b8fd416/main/cover.png",
    "gallery": [
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/custom-f5c105c7-9ca8-486f-b726-e7aa8b8fd416/main/gallery/01.png",
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/custom-f5c105c7-9ca8-486f-b726-e7aa8b8fd416/main/gallery/02.jpg"
    ],
    "notes": "『Zoff CLASSIC』\n\n【デザイン】\nアジアントレンドを意識した今っぽいメタルフレーム。\n柔らかなでおしゃれな印象のボストン型◎\n0.7㎜のリム線を使用することで、顔なじみの良さと快適な掛け心地を実現。\n光沢感のあるメタルフレームはアクセサリー感覚で使用していただけます。\n縦幅があるフレームは、抜け感が出る上に小顔効果も期待でき、ファッションのアクセントに。\n\n【カラー】\nZF192014-14E1：人気のブラック。テンプルのゴールドが抜け感のある印象に\nZF192014-49E1：おしゃれなべっこう柄ブラウン。ゴールドのテンプルがアクセントに。\nZF192014-21E1：柔らかい印象を与えてくれるピンク。フェミニンさをプラス。\nZF192014-56E1：こなれ感のあるゴールド。アクセサリー感覚でお使いいただけます。\n\n【スタイリングポイント】\nカジュアルからキレイめスタイルにも合わせやすい逸品。\nかけるだけでこなれ感をプラスするアイウェアは、普段コンタクトの方にもおすすめ。\nトレンドに左右されず、長くご愛用いただけます。\n\n※柄や色味の出方に個体差があり、画像と異なる場合がございます。\n\nCLASSIC(クラシック) 特集ページをみる\n※アウトレット商品は、販売から一定期間経過した商品などです。キズ、汚れなどがあるB級品ではございません。\n52□20-145\nA 片方のレンズ横幅：52mm\nB ブリッジ(鼻部分)の横幅：20mm\nC テンプル(つる)の長さ：145mm",
    "metadata": {
      "price": 9800,
      "basicColour": "gold",
      "priceCurrency": "JPY"
    }
  },

  // ——— A/W – Country Classics ———,

  {
    "id": "custom-027c1993-57b9-4d7a-9b86-320f76fb7415",
    "pillar": "Clothing",
    "section": "A/W – Country Classics",
    "category": "Jackets",
    "brand": "CULTUM",
    "name": "Glen Check Tweed Jacket",
    "season": "A/W",
    "colour": "Brown",
    "colourCode": "#A07C5C",
    "fabric": "Tweed",
    "weight": "620 gsm",
    "size": "58B",
    "purchaseDate": "2025-11-22",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/custom-027c1993-57b9-4d7a-9b86-320f76fb7415/main/cover.png",
    "gallery": [
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/custom-027c1993-57b9-4d7a-9b86-320f76fb7415/main/gallery/01.png"
    ],
    "metadata": {
      "price": 867,
      "priceCurrency": "CNY"
    }
  },

  {
    "id": "muji-ecru-sherpa-fleece-vest-olive-trim",
    "pillar": "Clothing",
    "section": "A/W – Country Classics",
    "category": "Outerwear",
    "brand": "MUJI",
    "name": "Boa Fleece Vest",
    "season": "A/W",
    "colour": "Ecru (Olive Trim)",
    "fabric": "Sherpa fleece",
    "size": "XL",
    "purchaseDate": "2023-12-09",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/muji-ecru-sherpa-fleece-vest-olive-trim/main/cover.png",
    "gallery": [
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/muji-ecru-sherpa-fleece-vest-olive-trim/main/gallery/01.png"
    ],
    "notes": "紳士 ボアフリースベスト | 無印良品",
    "metadata": {
      "price": 1190,
      "priceCurrency": "TWD"
    }
  },

  {
    "id": "muji-black-fine-knit-wool-ribbed-turtleneck",
    "pillar": "Clothing",
    "section": "A/W – Country Classics",
    "category": "Shirts",
    "brand": "MUJI",
    "name": "Rib Knit Roll-Neck Neck Jumper",
    "season": "A/W",
    "colour": "Black",
    "fabric": "Wool",
    "weight": "Lightweight",
    "size": "XL",
    "purchaseDate": "2024-12-17",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/muji-black-fine-knit-wool-ribbed-turtleneck/main/cover.png",
    "gallery": [
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/muji-black-fine-knit-wool-ribbed-turtleneck/main/gallery/01.jpg"
    ],
    "notes": "紳士 洗えるウールリブタートルネックセーター",
    "metadata": {
      "price": 3990,
      "priceCurrency": "JPY"
    }
  },

  {
    "id": "private-white-vc-midnight-navy-ventile-harrington",
    "pillar": "Clothing",
    "section": "A/W – Country Classics",
    "category": "Outerwear",
    "brand": "Private White VC",
    "name": "Ventile Harrington",
    "season": "A/W",
    "colour": "Midnight Navy",
    "colourCode": "#012142",
    "fabric": "Ventile",
    "size": "6=XL",
    "purchaseDate": "2025-12-26",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/private-white-vc-midnight-navy-ventile-harrington/1778692688799-cover-edit.png",
    "gallery": [
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/private-white-vc-midnight-navy-ventile-harrington/main/gallery/01.webp",
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/private-white-vc-midnight-navy-ventile-harrington/main/gallery/01.jpg",
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/private-white-vc-midnight-navy-ventile-harrington/main/gallery/02.jpg",
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/private-white-vc-midnight-navy-ventile-harrington/main/gallery/03.jpg"
    ],
    "notes": "A jacket with soul. First stitched in the 1950s and still made in Manchester, it has dressed rebels, musicians, and silver-screen legends for generations. With its stand collar, copper zip, and waterproof Ventile shell, the Harrington is as it was meant to be - timeless, understated, and unmistakably British.",
    "metadata": {
      "price": 3377,
      "priceCurrency": "CNY"
    }
  },

  {
    "id": "spier-mackay-camel-hair-polo-coat",
    "pillar": "Clothing",
    "section": "A/W – Country Classics",
    "category": "Outerwear",
    "brand": "SPIER & MACKAY",
    "name": "Camel Hair Polo Coat",
    "season": "A/W",
    "colour": "Golden Camel",
    "fabric": "Camel hair",
    "weight": "760 gsm",
    "size": "46",
    "purchaseDate": "2025-02-16",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/spier-mackay-camel-hair-polo-coat/main/cover.png",
    "gallery": [
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/spier-mackay-camel-hair-polo-coat/main/gallery/01.jpg",
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/spier-mackay-camel-hair-polo-coat/main/gallery/02.jpg"
    ],
    "metadata": {
      "price": 718.2,
      "basicColour": "brown",
      "priceCurrency": "USD"
    }
  },

  {
    "id": "uniqlo-ecru-cricket-cable-knit-jumper-vest",
    "pillar": "Clothing",
    "section": "A/W – Country Classics",
    "category": "Mid Layer",
    "brand": "UNIQLO",
    "name": "Cricket Cable-Knit Jumper Vest",
    "season": "A/W",
    "colour": "Ecru (Navy / Yellow Trim, Cotton-Acrylic)",
    "fabric": "Cotton-acrylic",
    "size": "XL",
    "purchaseDate": "2022-08-08",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/uniqlo-ecru-cricket-cable-knit-jumper-vest/main/cover.png",
    "gallery": [
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/uniqlo-ecru-cricket-cable-knit-jumper-vest/main/gallery/01.webp",
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/uniqlo-ecru-cricket-cable-knit-jumper-vest/main/gallery/02.webp"
    ],
    "notes": "Filename: if slash is problematic on disk, use a variant without “/” in the filename and adjust this path.",
    "metadata": {
      "price": 790,
      "basicColour": "white",
      "priceCurrency": "TWD"
    }
  },

  {
    "id": "custom-11c5213e-a24b-4840-8fcf-8bafccdbde06",
    "pillar": "Clothing",
    "section": "A/W – Country Classics",
    "category": "Bottoms",
    "brand": "UNIQLO",
    "name": "Pleated Trousers",
    "season": "All-season",
    "colour": "Grey",
    "colourCode": "#5F5F62",
    "size": "XL",
    "purchaseDate": "2023-11-20",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/uniqlo-tuck-trousers/1778707777462-variant-grey-cover.png",
    "notes": "Fabric details\nBody: 62% Polyester - Recycled Fiber, 29% Viscose, 5% Polyester, 4% Elastane/ Pocket Lining: 65% Polyester, 35% Cotton\nWashing instructions\nMachine wash up to 40 degrees, gentle cycle, Dry Clean, Not suitable for tumble-drying.",
    "colourVariants": [
      {
        "key": "grey",
        "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/custom-11c5213e-a24b-4840-8fcf-8bafccdbde06/variants/grey/cover.png",
        "label": "Grey",
        "notes": "",
        "colour": "Grey",
        "gallery": [
          "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/custom-11c5213e-a24b-4840-8fcf-8bafccdbde06/main/gallery/01.avif"
        ],
        "colourCode": "#5F5F62",
        "basicColour": "grey",
        "previewImage": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/custom-11c5213e-a24b-4840-8fcf-8bafccdbde06/variants/grey/preview.jpg"
      },
      {
        "key": "beige",
        "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/custom-11c5213e-a24b-4840-8fcf-8bafccdbde06/variants/beige/cover.png",
        "label": "Beige",
        "notes": "",
        "colour": "Beige",
        "gallery": [],
        "colourCode": "#CEBEA6",
        "basicColour": "beige",
        "previewImage": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/custom-11c5213e-a24b-4840-8fcf-8bafccdbde06/variants/beige/preview.jpg"
      }
    ],
    "metadata": {
      "price": 3990,
      "priceCurrency": "JPY",
      "colourVariants": [
        {
          "key": "grey",
          "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/custom-11c5213e-a24b-4840-8fcf-8bafccdbde06/variants/grey/cover.png",
          "label": "Grey",
          "notes": "",
          "colour": "Grey",
          "gallery": [
            "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/custom-11c5213e-a24b-4840-8fcf-8bafccdbde06/main/gallery/01.avif"
          ],
          "colourCode": "#5F5F62",
          "basicColour": "grey",
          "previewImage": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/custom-11c5213e-a24b-4840-8fcf-8bafccdbde06/variants/grey/preview.jpg"
        },
        {
          "key": "beige",
          "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/custom-11c5213e-a24b-4840-8fcf-8bafccdbde06/variants/beige/cover.png",
          "label": "Beige",
          "notes": "",
          "colour": "Beige",
          "gallery": [],
          "colourCode": "#CEBEA6",
          "basicColour": "beige",
          "previewImage": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/custom-11c5213e-a24b-4840-8fcf-8bafccdbde06/variants/beige/preview.jpg"
        }
      ]
    }
  },

  // ——— Accessories ———,

  {
    "id": "custom-85878caf-3b5c-4307-9fa4-4d76d3776d8f",
    "pillar": "Accessories",
    "section": "Accessories",
    "category": "Hats",
    "brand": "Eloy Bernal",
    "name": "Panama Hat",
    "season": "All-season",
    "size": "XL:61cm-1cm",
    "purchaseDate": "2025-05-11",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/custom-85878caf-3b5c-4307-9fa4-4d76d3776d8f/1778710719473-cover-edit.png",
    "gallery": [
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/custom-85878caf-3b5c-4307-9fa4-4d76d3776d8f/main/gallery/01.jpg",
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/custom-85878caf-3b5c-4307-9fa4-4d76d3776d8f/1778711933866-gallery-edit-2.avif",
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/custom-85878caf-3b5c-4307-9fa4-4d76d3776d8f/1778711934146-gallery-edit-3.avif",
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/custom-85878caf-3b5c-4307-9fa4-4d76d3776d8f/1778711935160-gallery-edit-5.avif"
    ],
    "notes": "カラー：ホワイト（ブリーチ）\nリボンの色：ブラック\nブランド：ELOY BERNAL（エロイ ベルナール）／エクアドル\n素材：天然トキヤ草100％\n編み方：Llano（網代編み）\n編み目細かさ（グレード）：スタンダード\nつばの広さ：約6～7cm\n重さ：約80～100g\nエクアドル製 パナマハット\n\n着用シーズン：春～夏\n\n※サイズ調整テープ（長さ30cm）が1個付属します。",
    "metadata": {
      "price": 9600,
      "priceCurrency": "JPY"
    }
  },

  {
    "id": "custom-b1b60797-6d7a-4cc6-b294-b3a82e1c0712",
    "pillar": "Accessories",
    "section": "Accessories",
    "category": "Bags",
    "brand": "L.L.Bean",
    "name": "Boat and Tote",
    "season": "All-season",
    "colour": "Blue Trim",
    "size": "Medium",
    "purchaseDate": "2025-01-01",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/custom-b1b60797-6d7a-4cc6-b294-b3a82e1c0712/main/cover.png",
    "gallery": [
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/custom-b1b60797-6d7a-4cc6-b294-b3a82e1c0712/main/gallery/01.jpg"
    ],
    "notes": "Boat and Tote, Open-Top\nItem No.: TC112636\nType: Medium\nColour: Blue Trim\nHandle: Regular\nMonogram: Yes\nLetter Style: Flare (FT)\nThread Colour: Coastal Gold (120)\nEmbroidered Initials: TLY",
    "metadata": {
      "price": 11880,
      "basicColour": "white",
      "priceCurrency": "JPY"
    }
  },

  {
    "id": "custom-684a379c-0d9f-48a4-ae3a-f098d31ca842",
    "pillar": "Accessories",
    "section": "Accessories",
    "category": "Bags",
    "brand": "Mulberry",
    "name": "Anthony",
    "season": "All-season",
    "colour": "Oak",
    "colourCode": "#A95B32",
    "purchaseDate": "2025-07-27",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/custom-684a379c-0d9f-48a4-ae3a-f098d31ca842/1778720516873-cover-edit.png",
    "gallery": [
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/custom-684a379c-0d9f-48a4-ae3a-f098d31ca842/main/gallery/01.jpg",
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/custom-684a379c-0d9f-48a4-ae3a-f098d31ca842/1778720067339-gallery-edit-6.jpg",
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/custom-684a379c-0d9f-48a4-ae3a-f098d31ca842/1778720066826-gallery-edit-5.jpg",
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/custom-684a379c-0d9f-48a4-ae3a-f098d31ca842/1778720066127-gallery-edit-4.jpg",
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/custom-684a379c-0d9f-48a4-ae3a-f098d31ca842/1778720065697-gallery-edit-3.jpg",
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/custom-684a379c-0d9f-48a4-ae3a-f098d31ca842/1778720064960-gallery-edit-2.jpg"
    ],
    "notes": "Dimensions: 25 × 21 × 7 cm\nStrap Width: 4 cm\n\nNotes:\nPurchased in near-excellent condition, with only one previous use. No visible stains, scratches, or notable signs of wear. Compact everyday messenger proportions with a broad adjustable shoulder strap, consistent with the classic Antony design language.",
    "metadata": {
      "price": 45000,
      "priceCurrency": "JPY"
    }
  },

  {
    "id": "custom-90145ca5-c982-4d0d-8e0e-3a772a21ff53",
    "pillar": "Accessories",
    "section": "Accessories",
    "category": "Hats",
    "brand": "Smathers & Branson",
    "name": "American Flag Hat",
    "season": "All-season",
    "colour": "Steel Blue",
    "colourCode": "#5E829A",
    "purchaseDate": "2026-05-11",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/custom-90145ca5-c982-4d0d-8e0e-3a772a21ff53/main/cover.png",
    "gallery": [
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/custom-90145ca5-c982-4d0d-8e0e-3a772a21ff53/main/gallery/01.jpg",
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/custom-90145ca5-c982-4d0d-8e0e-3a772a21ff53/main/gallery/01.png"
    ],
    "notes": "Size & Fit Information\nCircumference: approximately 22.45'' (adjustable by a nickel slide)\n\nTop to Side: approximately 6.65''\n\nBrim: 2.9'' long\n\nOur six panel cotton twill hats are adorned with our signature 100% hand-stitched needlepoint. Each hat is adjustable by a nickel slide on the back of the hat.\n\n-100% hand-stitched needlepoint\n-Stitched with French cotton thread\n-Six Panel Construction\n-Washed Cotton Twill\n-Adjustable. One size fits most adults.",
    "metadata": {
      "price": 1710,
      "priceCurrency": "TWD"
    }
  },

  {
    "id": "custom-86c016e3-006a-4785-98f2-0f61bd952439",
    "pillar": "Accessories",
    "section": "Accessories",
    "category": "Bags",
    "brand": "UNIQLO : C",
    "name": "Helmet Bag",
    "season": "All-season",
    "colour": "Grey Green",
    "colourCode": "#556469",
    "purchaseDate": "2025-08-12",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/custom-86c016e3-006a-4785-98f2-0f61bd952439/1778720745157-cover-edit.png",
    "gallery": [
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/custom-86c016e3-006a-4785-98f2-0f61bd952439/1778712894508-gallery-edit-2.avif",
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/custom-86c016e3-006a-4785-98f2-0f61bd952439/1778712894182-gallery-edit-1.avif"
    ],
    "notes": "Size\nWidth(Bottom): 34cm, Height: 38cm, Depth: 16cm, Shoulder Strap Length: 61cm～114cm, Bag Capacity: 26Liters\n\nProduct ID: 479880\n\nThe images shown may include colours that are not available.",
    "metadata": {
      "price": 2990,
      "colourCode": "#556469",
      "basicColour": "grey",
      "priceCurrency": "JPY"
    }
  },

  // ——— Future Pieces ———,

  {
    "id": "custom-49cb4503-d1f7-4a7d-b0b2-dc60a5549976",
    "pillar": "Jewellery",
    "section": "Future Pieces",
    "category": "Jewellery",
    "brand": "future piece",
    "name": "Sapphire Three-Stone Ring",
    "season": "All-season",
    "colour": "Blue",
    "fabric": "Platinum",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/custom-49cb4503-d1f7-4a7d-b0b2-dc60a5549976/main/cover.png",
    "gallery": [
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/custom-49cb4503-d1f7-4a7d-b0b2-dc60a5549976/main/gallery/01.jpg",
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/custom-49cb4503-d1f7-4a7d-b0b2-dc60a5549976/main/gallery/01.png",
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/custom-49cb4503-d1f7-4a7d-b0b2-dc60a5549976/main/gallery/02.png",
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/custom-49cb4503-d1f7-4a7d-b0b2-dc60a5549976/main/gallery/03.png"
    ],
    "notes": "Emerald-cut sapphire 6.8×5.1 mm ~1.1 ct; tapered baguette sides; ~1 ct diamonds total. Signed Cartier.  c.1950–65",
    "metadata": {
      "basicColour": "silver"
    }
  },

  {
    "id": "future-sapphire-engagement-ring",
    "pillar": "Jewellery",
    "section": "Future Pieces",
    "category": "Ring",
    "brand": "Planned",
    "name": "Sapphire Engagement Ring (Pt950, diamonds 1.5 mm)",
    "season": "All-season",
    "colour": "Cornflower blue",
    "size": "XL",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/images/Future%20Sapphire%20Engagement%20Ring.png",
    "notes": "Sapphire 8×6 mm (1.3–1.5 ct). Ref: Garrard 1735 sapphire ring."
  },

  // ——— S/S – Mediterranean Resort ———,

  {
    "id": "muji-washed-off-white-breton-boat-neck-tee",
    "pillar": "Clothing",
    "section": "S/S – Mediterranean Resort",
    "category": "Shirts",
    "brand": "MUJI",
    "name": "Washed Breton-Stripe Boat-Neck 3/4 Sleeve T-Shirt",
    "season": "A/W",
    "colour": "Off-White / Navy",
    "fabric": "Cotton",
    "weight": "Midweight",
    "size": "XL",
    "purchaseDate": "2025-01-31",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/muji-washed-off-white-breton-boat-neck-tee/main/cover.png",
    "gallery": [
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/muji-washed-off-white-breton-boat-neck-tee/main/gallery/01.jpg"
    ],
    "notes": "紳士 洗いざらし太番手ボートネック九分袖Ｔシャツ",
    "metadata": {
      "price": 2990,
      "priceCurrency": "JPY"
    }
  },

  {
    "id": "custom-7bdd5e7c-546b-4360-b725-1741c8c274f4",
    "pillar": "Clothing",
    "section": "S/S – Mediterranean Resort",
    "category": "Shirts",
    "brand": "zara",
    "name": "Structured Knit Polo Shirt",
    "season": "S/S",
    "colour": "Grey green",
    "size": "XL",
    "measuredDimensions": "Measurements: Chest 59.5 Front length 71.5 Sleeve length 24 Back width 51.5 Arm width 19.5 cm cm",
    "purchaseDate": "2026-05-14",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/custom-7bdd5e7c-546b-4360-b725-1741c8c274f4/main/cover.png",
    "gallery": [
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/custom-7bdd5e7c-546b-4360-b725-1741c8c274f4/main/gallery/01.jpg"
    ],
    "notes": "STRUCTURED KNIT POLO SHIRT\nNT$ 1,490\nRef 3332/410\nRegular fit knitted polo shirt in spun cotton yarn. Lapel collar with front opening and short sleeve. Ribbed trims.",
    "metadata": {
      "price": 1490,
      "priceCurrency": "TWD",
      "measurementRows": [
        {
          "label": "Measurements",
          "value": "Chest 59.5 Front length 71.5 Sleeve length 24 Back width 51.5 Arm width 19.5 cm"
        }
      ]
    }
  },

  {
    "id": "zara-navy-baker-neck-knitted-t-shirt",
    "pillar": "Clothing",
    "section": "S/S – Mediterranean Resort",
    "category": "Shirts",
    "brand": "ZARA",
    "name": "Baker Neck Knitted T-Shirt",
    "season": "S/S",
    "colour": "Navy",
    "size": "XL",
    "purchaseDate": "2025-08-09",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/zara-navy-baker-neck-knitted-t-shirt/1778700318404-cover-edit.png",
    "gallery": [
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/zara-navy-baker-neck-knitted-t-shirt/main/gallery/01.jpg"
    ],
    "notes": "BUTTON-NECK KNIT T-SHIRT",
    "metadata": {
      "price": 6590,
      "priceCurrency": "JPY"
    }
  },

  {
    "id": "custom-1a53223b-b4fc-4da3-91b1-c4dffdac6b40",
    "pillar": "Clothing",
    "section": "S/S – Mediterranean Resort",
    "category": "Shirts",
    "brand": "ZARA",
    "name": "Rib Knit Polo Shirt",
    "season": "S/S",
    "colour": "Dark Chocolate",
    "size": "XL",
    "measuredDimensions": "Measurements: Chest 59.5 cm · Front length 71.5 cm · Sleeve length 24 cm · Back width 51.5 cm · Arm width 19.5 cm ·  ·  · cm",
    "purchaseDate": "2026-05-14",
    "image": "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/custom-1a53223b-b4fc-4da3-91b1-c4dffdac6b40/main/cover.png",
    "gallery": [
      "https://yyzrzmbsxphlhoqzikjn.supabase.co/storage/v1/object/public/wardrobe-images/custom-1a53223b-b4fc-4da3-91b1-c4dffdac6b40/main/gallery/01.jpg"
    ],
    "notes": "Regular fit knitted polo shirt made from cotton yarn. Lapel collar with front button fastening. Ribbed trims.",
    "metadata": {
      "price": 1490,
      "priceCurrency": "TWD",
      "measurementRows": [
        {
          "label": "Measurements",
          "value": "Chest 59.5 cm · Front length 71.5 cm · Sleeve length 24 cm · Back width 51.5 cm · Arm width 19.5 cm ·  ·  ·"
        }
      ]
    }
  }
];
