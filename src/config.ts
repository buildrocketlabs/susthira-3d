/**
 * Product facts, copy and label coordinates. Everything the client reads in the
 * interface lives here so it can be checked in one place.
 * Copy rules: no hyphens or dashes, "helps" and "supports" only, no invented claims.
 */
export type ProductKey = 'banana' | 'psb' | 'jeeva'
export type SceneKey = 'studio' | 'field' | 'soil'

export interface Product {
  key: ProductKey
  name: string
  kannada: string
  range: string
  color: string
  ink: string
}

export const PRODUCTS: Product[] = [
  { key: 'banana', name: 'Banana Special', kannada: 'ಬಾಳೆ ವಿಶೇಷ', range: 'Micronutrients', color: '#F2C230', ink: '#10261C' },
  { key: 'psb', name: 'PSB Liquid', kannada: 'ರಂಜಕ ಕರಗಿಸುವ ಬ್ಯಾಕ್ಟೀರಿಯಾ', range: 'Biofertilizers', color: '#0E6F6B', ink: '#FFFFFF' },
  { key: 'jeeva', name: 'Jeevamrutha Culture', kannada: 'ಜೀವಾಮೃತ ಕಲ್ಚರ್', range: 'Ancient wisdom', color: '#B5532E', ink: '#FFFFFF' },
]
export const productOf = (k: ProductKey) => PRODUCTS.find((p) => p.key === k)!

export const SCENES: { key: SceneKey; name: string; swatch: string }[] = [
  { key: 'studio', name: 'Studio', swatch: '#D9CDB8' },
  { key: 'field', name: 'Banana field', swatch: '#6FA644' },
  { key: 'soil', name: 'Red soil', swatch: '#9A4326' },
]

/** Panels of the 5000 px wide label master, as u ranges. */
export const PANELS = [
  { key: 'en', name: 'English back', u0: 0, u1: 0.24 },
  { key: 'rao', name: 'Dr. Rao panel', u0: 0.24, u1: 0.42 },
  { key: 'front', name: 'Front', u0: 0.42, u1: 0.76 },
  { key: 'kn', name: 'Kannada back', u0: 0.76, u1: 1 },
] as const

export interface Hotspot {
  key: string
  /** where the gold dot sits on the label: u across, v from the top edge */
  u: number
  v: number
  /** where the bottle turns to and the camera looks when the dot is tapped */
  focusU: number
  focusV: number
  zoom: number
  title: string
  line: string
  kannada: string
}

// NEW KANNADA: every `kannada` string below was written for this site and is
// listed in the final report for Prajwal to verify with a native reader.
export const HOTSPOTS: Hotspot[] = [
  {
    key: 'rao', u: 0.258, v: 0.55, focusU: 0.33, focusV: 0.5, zoom: 1.55,
    title: 'Your face on every bottle.',
    line: 'The trust no competitor can copy.',
    kannada: 'ಪ್ರತಿ ಬಾಟಲಿಯ ಮೇಲೂ ನಿಮ್ಮ ಮುಖ, ನಿಮ್ಮ ಹೆಸರು.',
  },
  {
    key: 'tiles', u: 0.7, v: 0.742, focusU: 0.59, focusV: 0.8, zoom: 2.1,
    title: 'What is inside, clear at one glance.',
    line: 'The farmer and the dealer read the science first.',
    kannada: 'ಒಳಗೆ ಏನಿದೆ ಎಂಬುದು ಒಂದೇ ನೋಟದಲ್ಲಿ ಸ್ಪಷ್ಟ.',
  },
  {
    key: 'kannada', u: 0.94, v: 0.09, focusU: 0.88, focusV: 0.4, zoom: 1.9,
    title: 'Every instruction in Kannada.',
    line: 'The farmer reads it in the language of the field.',
    kannada: 'ರೈತರಿಗೆ ಅವರದೇ ಭಾಷೆಯಲ್ಲಿ ಸಂಪೂರ್ಣ ಮಾಹಿತಿ.',
  },
  {
    key: 'scan', u: 0.362, v: 0.852, focusU: 0.375, focusV: 0.86, zoom: 2.6,
    title: 'One scan to meet Dr. Rao.',
    line: 'The code takes the farmer to the scientist behind the bottle.',
    kannada: 'ಸ್ಕ್ಯಾನ್ ಮಾಡಿ, ಡಾ. ರಾವ್ ಅವರನ್ನು ಭೇಟಿ ಮಾಡಿ.',
  },
]

export const COPY = {
  dedication: 'For Dr. M. S. Rao',
  dedicationKn: 'ಡಾ. ಎಂ. ಎಸ್. ರಾವ್ ಅವರಿಗೆ',
  hint: 'Turn the bottle with your finger',
  hintKn: 'ಬೆರಳಿನಿಂದ ಬಾಟಲಿಯನ್ನು ತಿರುಗಿಸಿ', // NEW KANNADA
  closingTitle: 'This is the first look.',
  closingLine: 'Next, all 83 Susthira products.',
  closingKn: 'ಧನ್ಯವಾದಗಳು', // NEW KANNADA
  whatsapp: 'Reply to Prajwal on WhatsApp',
  whatsappUrl: 'https://wa.me/916362121439?text=Namaskara%20Prajwal%2C%20I%20saw%20the%20Susthira%20bottles.',
  credit: 'Prepared by BuildRocket Labs for Susthira Bio Organics. With thanks to Dr. Santhosh for the product material.',
  ar: 'See it on your table',
}
