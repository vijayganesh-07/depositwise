export const colors = {
  // Canvas & Backgrounds
  bgBase: '#eef1f4ff',      // Light grey canvas
  bgElevated: '#FFFFFF',  // Pure white cards
  bgTertiary: '#E8E8E8',  // Neutral grey for borders/chips

  // Text
  text1: '#0E0F0C',       // Deep charcoal black (primary text)
  text2: '#2C2D2A',       // Dark secondary text
  text3: '#8A8A82',       // Muted olive-gray (helper/meta text)
  text4: '#B0AFA8',       // Very muted for placeholders
  separator: '#E8E8E8',   // Neutral border color

  // Accent Colors (Figma neon palette)
  mint: '#D7FE47',        // Neon lime-yellow (primary accent)
  mintDim: '#C4EB3A',     // Slightly darker lime
  mintSoft: '#F0FCC0',    // Light lime tint
  mintBg: '#E8FD8A',      // Lime background wash


  // Secondary Accent
  lavender: '#FF5A1F',    // Neon orange-red (secondary accent)
  lavenderDim: '#E04A10', // Darker orange
  lavenderSoft: '#FFE8DF',// Light orange tint
  lavenderBg: '#FFC8B0',  // Orange background wash

  // Utility
  gold: '#F59E0B',
  goldSoft: '#FEF3C7',

  blue: '#0E0F0C',        // Reuse charcoal for FD badges
  blueSoft: '#E8E8E8',    // Grey for FD badge bg

  error: '#FF5A1F',       // Error uses the orange-red accent

  black: '#0E0F0C',
  white: '#FFFFFF',
};

export const typography = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};

export const radius = {
  xs: 8,
  sm: 12,
  md: 14,
  card: 16,
  lg: 18,
  xl: 22,
  bento: 24,
  pill: 100,
};

export const shadows = {
  sm: {
    shadowColor: '#0E0F0C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  md: {
    shadowColor: '#0E0F0C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
};

export const BANKS = [
  'SBI',
  'HDFC Bank',
  'ICICI Bank',
  'Axis Bank',
];

export const COMPOUNDING_OPTIONS = ['Monthly', 'Quarterly', 'Half-Yearly', 'Annually'];
export const INTEREST_PAYOUT_OPTIONS = ['Cumulative (At Maturity)', 'Monthly', 'Quarterly'];
