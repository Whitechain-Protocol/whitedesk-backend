import { SafeSecureStore } from '../storageService';

export interface ButtonThemeItem {
  bg: string;
  text: string;
  border: string;
}

export interface ButtonTheme {
  id: number;
  name: string;
  ticket: ButtonThemeItem;
  disc: ButtonThemeItem;
  radio: ButtonThemeItem;
}

export const BUTTON_THEME_PALETTES: ButtonTheme[] = [
  {
    id: 1,
    name: 'Parlament / İndigo (Katı)',
    ticket: { bg: '#2563EB', text: '#FFFFFF', border: 'transparent' },
    disc:   { bg: '#EA580C', text: '#FFFFFF', border: 'transparent' },
    radio:  { bg: '#16A34A', text: '#FFFFFF', border: 'transparent' }
  },
  {
    id: 2,
    name: 'Derin İndigo-Mavi',
    ticket: { bg: '#2F6FED', text: '#FFFFFF', border: 'transparent' },
    disc:   { bg: '#EB8538', text: '#FFFFFF', border: 'transparent' },
    radio:  { bg: '#2BAE78', text: '#FFFFFF', border: 'transparent' }
  },
  {
    id: 3,
    name: 'Safir Pastel',
    ticket: { bg: '#3B79C9', text: '#FFFFFF', border: 'transparent' },
    disc:   { bg: '#E07A5F', text: '#FFFFFF', border: 'transparent' },
    radio:  { bg: '#4E9B78', text: '#FFFFFF', border: 'transparent' }
  },
  {
    id: 4,
    name: 'Canlı Tech Mavi',
    ticket: { bg: '#3B82F6', text: '#FFFFFF', border: 'transparent' },
    disc:   { bg: '#F97316', text: '#FFFFFF', border: 'transparent' },
    radio:  { bg: '#10B981', text: '#FFFFFF', border: 'transparent' }
  },
  {
    id: 5,
    name: 'Klasik Dengeli Mavi',
    ticket: { bg: '#4A90E2', text: '#FFFFFF', border: 'transparent' },
    disc:   { bg: '#F38240', text: '#FFFFFF', border: 'transparent' },
    radio:  { bg: '#38A169', text: '#FFFFFF', border: 'transparent' }
  },
  {
    id: 6,
    name: 'Kobalt Pastel',
    ticket: { bg: '#4C82E6', text: '#FFFFFF', border: 'transparent' },
    disc:   { bg: '#E88452', text: '#FFFFFF', border: 'transparent' },
    radio:  { bg: '#3FA87E', text: '#FFFFFF', border: 'transparent' }
  },
  {
    id: 7,
    name: 'Gök / Azure Mavi',
    ticket: { bg: '#3A8FC4', text: '#FFFFFF', border: 'transparent' },
    disc:   { bg: '#DC7B62', text: '#FFFFFF', border: 'transparent' },
    radio:  { bg: '#559E84', text: '#FFFFFF', border: 'transparent' }
  },
  {
    id: 8,
    name: 'Buz Mavisi & Amber',
    ticket: { bg: '#5188A6', text: '#FFFFFF', border: 'transparent' },
    disc:   { bg: '#E07A5F', text: '#FFFFFF', border: 'transparent' },
    radio:  { bg: '#4D9078', text: '#FFFFFF', border: 'transparent' }
  },
  {
    id: 9,
    name: 'Dumanlı Slate Mavisi',
    ticket: { bg: '#5D7A88', text: '#FFFFFF', border: 'transparent' },
    disc:   { bg: '#DE8F6E', text: '#FFFFFF', border: 'transparent' },
    radio:  { bg: '#6BA292', text: '#FFFFFF', border: 'transparent' }
  },
  {
    id: 10,
    name: 'Vintage Mat Mavi',
    ticket: { bg: '#557A95', text: '#FFFFFF', border: 'transparent' },
    disc:   { bg: '#D9834F', text: '#FFFFFF', border: 'transparent' },
    radio:  { bg: '#608871', text: '#FFFFFF', border: 'transparent' }
  },
  {
    id: 11,
    name: 'Pastel Şeker Mavisi',
    ticket: { bg: '#639FAB', text: '#FFFFFF', border: 'transparent' },
    disc:   { bg: '#E28456', text: '#FFFFFF', border: 'transparent' },
    radio:  { bg: '#5BA88E', text: '#FFFFFF', border: 'transparent' }
  },
  {
    id: 12,
    name: 'Puslu Mineral Mavi',
    ticket: { bg: '#6C8299', text: '#FFFFFF', border: 'transparent' },
    disc:   { bg: '#D38260', text: '#FFFFFF', border: 'transparent' },
    radio:  { bg: '#5B9279', text: '#FFFFFF', border: 'transparent' }
  },
  {
    id: 13,
    name: 'Çerçeveli Saf Mavi (Ghost)',
    ticket: { bg: '#FFFFFF', text: '#2B6CB0', border: '#2B6CB0' },
    disc:   { bg: '#FFFFFF', text: '#DD6B20', border: '#DD6B20' },
    radio:  { bg: '#FFFFFF', text: '#2F855A', border: '#2F855A' }
  },
  {
    id: 14,
    name: 'Açık Göl Mavisi Dolgu',
    ticket: { bg: '#DCEAF4', text: '#2C5282', border: 'transparent' },
    disc:   { bg: '#FEE8D8', text: '#9C4221', border: 'transparent' },
    radio:  { bg: '#DBEFE2', text: '#22543D', border: 'transparent' }
  },
  {
    id: 15,
    name: 'Buzul Tint (En Açık Zemin)',
    ticket: { bg: '#EBF3FC', text: '#1D54B2', border: '#BDD8F8' },
    disc:   { bg: '#FEF0E7', text: '#A84315', border: '#FCD2BC' },
    radio:  { bg: '#EAF7EF', text: '#166A44', border: '#BBE8CD' }
  }
];

const STORAGE_KEY = 'whitedesk_button_theme_id';
const listeners = new Set<(theme: ButtonTheme) => void>();

export const buttonThemeService = {
  getDefaultTheme(): ButtonTheme {
    return BUTTON_THEME_PALETTES[0];
  },

  getThemeById(id: number): ButtonTheme {
    return BUTTON_THEME_PALETTES.find(p => p.id === id) || BUTTON_THEME_PALETTES[0];
  },

  async getSavedTheme(): Promise<ButtonTheme> {
    try {
      const saved = await SafeSecureStore.getItemAsync(STORAGE_KEY);
      if (saved) {
        const id = parseInt(saved, 10);
        if (!isNaN(id)) {
          return this.getThemeById(id);
        }
      }
    } catch (e) {
      console.warn('[buttonThemeService] getSavedTheme error:', e);
    }
    return this.getDefaultTheme();
  },

  async saveTheme(id: number): Promise<ButtonTheme> {
    const theme = this.getThemeById(id);
    try {
      await SafeSecureStore.setItemAsync(STORAGE_KEY, String(id));
      listeners.forEach(fn => fn(theme));
    } catch (e) {
      console.warn('[buttonThemeService] saveTheme error:', e);
    }
    return theme;
  },

  subscribe(callback: (theme: ButtonTheme) => void): () => void {
    listeners.add(callback);
    return () => {
      listeners.delete(callback);
    };
  }
};
