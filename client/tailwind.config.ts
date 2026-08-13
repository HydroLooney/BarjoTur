import type { Config } from 'tailwindcss';

// Charte token-driven : toutes les couleurs pointent vers des variables CSS (ui/tokens.css),
// jamais une valeur hex en dur (regle R03, pre-requis du darkmode). darkMode par classe .dark.
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        primary: { DEFAULT: 'var(--primary)', foreground: 'var(--primary-foreground)' },
        secondary: { DEFAULT: 'var(--secondary)', foreground: 'var(--secondary-foreground)' },
        muted: { DEFAULT: 'var(--muted)', foreground: 'var(--muted-foreground)' },
        accent: { DEFAULT: 'var(--accent)', foreground: 'var(--accent-foreground)' },
        destructive: { DEFAULT: 'var(--destructive)', foreground: 'var(--destructive-foreground)' },
        card: { DEFAULT: 'var(--card)', foreground: 'var(--card-foreground)' },
        popover: { DEFAULT: 'var(--popover)', foreground: 'var(--popover-foreground)' },
        // Accents de charte, utilisables directement (bg-ocre, text-glacier...).
        ocre: 'var(--ocre)',
        glacier: 'var(--glacier)',
        granite: 'var(--granite)',
        vert: 'var(--vert)',
        rouge: 'var(--rouge)',
        // Tiers TSAB, source unique.
        tier: {
          T: 'var(--tier-T)',
          S: 'var(--tier-S)',
          A: 'var(--tier-A)',
          B: 'var(--tier-B)',
        },
      },
      fontFamily: {
        sans: ['var(--sans)'],
        serif: ['var(--serif)'],
      },
      borderRadius: {
        lg: 'var(--rayon)',
        md: 'var(--rayon-s)',
        sm: '4px',
      },
      boxShadow: {
        charte: 'var(--ombre)',
      },
      minHeight: {
        tactile: 'var(--cible-tactile)',
      },
      minWidth: {
        tactile: 'var(--cible-tactile)',
      },
    },
  },
  plugins: [],
} satisfies Config;
