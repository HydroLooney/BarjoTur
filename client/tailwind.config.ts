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
      // Echelle de 4 rayons en tokens (CHARTE v3 §2) : plus de 4px litteral (violation R03 levee).
      borderRadius: {
        sm: 'var(--rayon-xs)',
        md: 'var(--rayon-s)',
        lg: 'var(--rayon)',
        full: 'var(--rayon-plein)',
      },
      // 3 niveaux d'elevation (CHARTE v3 §4).
      boxShadow: {
        posee: 'var(--ombre-posee)',
        charte: 'var(--ombre)',
        flottante: 'var(--ombre-flottante)',
      },
      // Echelle typographique nommee (CHARTE v3 §5) : cesser d'utiliser text-lg/sm/xs au juge.
      fontSize: {
        hero: 'var(--t-hero)',
        carte: 'var(--t-carte)',
        titre: 'var(--t-titre)',
        section: 'var(--t-section)',
        corps: 'var(--t-corps)',
        meta: 'var(--t-meta)',
        micro: 'var(--t-micro)',
        'nav-bas': 'var(--t-nav-bas)',
      },
      // Motion tokens (CHARTE v3 §6) : durees et courbes nommees, coupees en reduced-motion (tokens a 0ms).
      transitionDuration: {
        instant: 'var(--anim-instant)',
        court: 'var(--anim-court)',
        moyen: 'var(--anim-moyen)',
        long: 'var(--anim-long)',
      },
      transitionTimingFunction: {
        doux: 'var(--easing-doux)',
        entree: 'var(--easing-entree)',
        sortie: 'var(--easing-sortie)',
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
