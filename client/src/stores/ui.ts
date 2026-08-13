import { create } from 'zustand';

export type Theme = 'clair' | 'sombre';

interface EtatUi {
  theme: Theme;
  panneauOuvert: string | null;
  basculerTheme: () => void;
  setTheme: (theme: Theme) => void;
  setPanneau: (id: string | null) => void;
}

// Theme initial : preference systeme, surchargeable ensuite par l'utilisateur.
function themeInitial(): Theme {
  if (typeof window === 'undefined') return 'clair';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'sombre' : 'clair';
}

// Applique le theme au DOM de façon SYNCHRONE (classe .dark sur <html>), et NON dans un effet React.
// Ainsi tout code qui lit un jeton en phase de rendu (ex. couleurs des couches MapLibre via charte())
// voit deja le bon theme : pas de « flash » d'un frame a l'ancien theme lors d'une bascule.
function appliquerThemeAuDom(theme: Theme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', theme === 'sombre');
}

const themeDepart = themeInitial();
appliquerThemeAuDom(themeDepart);

// Etat UI/local SEULEMENT (theme, panneaux, filtres...). Le cache serveur, lui, vit dans react-query :
// on ne stocke jamais de donnees de voyage ici (frontiere reseau etanche, A06/C11).
export const useUi = create<EtatUi>((set) => ({
  theme: themeDepart,
  panneauOuvert: null,
  basculerTheme: () =>
    set((s) => {
      const theme: Theme = s.theme === 'clair' ? 'sombre' : 'clair';
      appliquerThemeAuDom(theme);
      return { theme };
    }),
  setTheme: (theme) => {
    appliquerThemeAuDom(theme);
    set({ theme });
  },
  setPanneau: (panneauOuvert) => set({ panneauOuvert }),
}));
