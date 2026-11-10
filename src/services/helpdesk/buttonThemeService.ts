import { SafeSecureStore } from '../storageService';

export interface ButtonThemeItem {
  bg: string;
  text: string;
  border: string;
}

export interface ButtonTheme {
  id: number;
  group?: number;
  name: string;
  ticket: ButtonThemeItem;
  disc: ButtonThemeItem;
  radio: ButtonThemeItem;
}

/**
 * 1. Grup (20 Palet - Dinamik & Zengin Spektrum)
 */
export const BUTTON_THEME_PALETTES_G1: ButtonTheme[] = [
  {
    id: 1,
    group: 1,
    name: 'Parlament / İndigo (Katı)',
    ticket: { bg: '#2563EB', text: '#FFFFFF', border: 'transparent' },
    disc:   { bg: '#EA580C', text: '#FFFFFF', border: 'transparent' },
    radio:  { bg: '#16A34A', text: '#FFFFFF', border: 'transparent' }
  },
  {
    id: 2,
    group: 1,
    name: 'Derin İndigo-Mavi',
    ticket: { bg: '#2F6FED', text: '#FFFFFF', border: 'transparent' },
    disc:   { bg: '#EB8538', text: '#FFFFFF', border: 'transparent' },
    radio:  { bg: '#2BAE78', text: '#FFFFFF', border: 'transparent' }
  },
  {
    id: 3,
    group: 1,
    name: 'Safir Pastel',
    ticket: { bg: '#3B79C9', text: '#FFFFFF', border: 'transparent' },
    disc:   { bg: '#E07A5F', text: '#FFFFFF', border: 'transparent' },
    radio:  { bg: '#4E9B78', text: '#FFFFFF', border: 'transparent' }
  },
  {
    id: 4,
    group: 1,
    name: 'Canlı Tech Mavi',
    ticket: { bg: '#3B82F6', text: '#FFFFFF', border: 'transparent' },
    disc:   { bg: '#F97316', text: '#FFFFFF', border: 'transparent' },
    radio:  { bg: '#10B981', text: '#FFFFFF', border: 'transparent' }
  },
  {
    id: 5,
    group: 1,
    name: 'Klasik Dengeli Mavi',
    ticket: { bg: '#4A90E2', text: '#FFFFFF', border: 'transparent' },
    disc:   { bg: '#F38240', text: '#FFFFFF', border: 'transparent' },
    radio:  { bg: '#38A169', text: '#FFFFFF', border: 'transparent' }
  },
  {
    id: 6,
    group: 1,
    name: 'Kobalt Pastel',
    ticket: { bg: '#4C82E6', text: '#FFFFFF', border: 'transparent' },
    disc:   { bg: '#E88452', text: '#FFFFFF', border: 'transparent' },
    radio:  { bg: '#3FA87E', text: '#FFFFFF', border: 'transparent' }
  },
  {
    id: 7,
    group: 1,
    name: 'Kurumsal Mavi & Bakır',
    ticket: { bg: '#2E75D8', text: '#FFFFFF', border: 'transparent' },
    disc:   { bg: '#C85A32', text: '#FFFFFF', border: 'transparent' },
    radio:  { bg: '#269B69', text: '#FFFFFF', border: 'transparent' }
  },
  {
    id: 8,
    group: 1,
    name: 'Gök / Azure Mavi',
    ticket: { bg: '#3A8FC4', text: '#FFFFFF', border: 'transparent' },
    disc:   { bg: '#DC7B62', text: '#FFFFFF', border: 'transparent' },
    radio:  { bg: '#559E84', text: '#FFFFFF', border: 'transparent' }
  },
  {
    id: 9,
    group: 1,
    name: 'Duru Gök Pasteli',
    ticket: { bg: '#4293C3', text: '#FFFFFF', border: 'transparent' },
    disc:   { bg: '#DD8066', text: '#FFFFFF', border: 'transparent' },
    radio:  { bg: '#54A086', text: '#FFFFFF', border: 'transparent' }
  },
  {
    id: 10,
    group: 1,
    name: 'Uçuk Buzul Mavisi',
    ticket: { bg: '#4D96BD', text: '#FFFFFF', border: 'transparent' },
    disc:   { bg: '#DE866D', text: '#FFFFFF', border: 'transparent' },
    radio:  { bg: '#5AA389', text: '#FFFFFF', border: 'transparent' }
  },
  {
    id: 11,
    group: 1,
    name: 'Sisli Göl Pasteli',
    ticket: { bg: '#5394B1', text: '#FFFFFF', border: 'transparent' },
    disc:   { bg: '#DD8972', text: '#FFFFFF', border: 'transparent' },
    radio:  { bg: '#5C9E86', text: '#FFFFFF', border: 'transparent' }
  },
  {
    id: 12,
    group: 1,
    name: 'Durgun Kıyı Pasteli',
    ticket: { bg: '#4F8DA6', text: '#FFFFFF', border: 'transparent' },
    disc:   { bg: '#DE8369', text: '#FFFFFF', border: 'transparent' },
    radio:  { bg: '#53977F', text: '#FFFFFF', border: 'transparent' }
  },
  {
    id: 13,
    group: 1,
    name: 'Buz Mavisi & Amber',
    ticket: { bg: '#5188A6', text: '#FFFFFF', border: 'transparent' },
    disc:   { bg: '#E07A5F', text: '#FFFFFF', border: 'transparent' },
    radio:  { bg: '#4D9078', text: '#FFFFFF', border: 'transparent' }
  },
  {
    id: 14,
    group: 1,
    name: 'Dumanlı Slate Mavisi',
    ticket: { bg: '#5D7A88', text: '#FFFFFF', border: 'transparent' },
    disc:   { bg: '#DE8F6E', text: '#FFFFFF', border: 'transparent' },
    radio:  { bg: '#6BA292', text: '#FFFFFF', border: 'transparent' }
  },
  {
    id: 15,
    group: 1,
    name: 'Vintage Mat Mavi',
    ticket: { bg: '#557A95', text: '#FFFFFF', border: 'transparent' },
    disc:   { bg: '#D9834F', text: '#FFFFFF', border: 'transparent' },
    radio:  { bg: '#608871', text: '#FFFFFF', border: 'transparent' }
  },
  {
    id: 16,
    group: 1,
    name: 'Pastel Şeker Mavisi',
    ticket: { bg: '#639FAB', text: '#FFFFFF', border: 'transparent' },
    disc:   { bg: '#E28456', text: '#FFFFFF', border: 'transparent' },
    radio:  { bg: '#5BA88E', text: '#FFFFFF', border: 'transparent' }
  },
  {
    id: 17,
    group: 1,
    name: 'Puslu Mineral Mavi',
    ticket: { bg: '#6C8299', text: '#FFFFFF', border: 'transparent' },
    disc:   { bg: '#D38260', text: '#FFFFFF', border: 'transparent' },
    radio:  { bg: '#5B9279', text: '#FFFFFF', border: 'transparent' }
  },
  {
    id: 18,
    group: 1,
    name: 'Çerçeveli Saf Mavi (Ghost)',
    ticket: { bg: '#FFFFFF', text: '#2B6CB0', border: '#2B6CB0' },
    disc:   { bg: '#FFFFFF', text: '#DD6B20', border: '#DD6B20' },
    radio:  { bg: '#FFFFFF', text: '#2F855A', border: '#2F855A' }
  },
  {
    id: 19,
    group: 1,
    name: 'Açık Göl Mavisi Dolgu',
    ticket: { bg: '#DCEAF4', text: '#2C5282', border: 'transparent' },
    disc:   { bg: '#FEE8D8', text: '#9C4221', border: 'transparent' },
    radio:  { bg: '#DBEFE2', text: '#22543D', border: 'transparent' }
  },
  {
    id: 20,
    group: 1,
    name: 'Buzul Tint (En Açık Zemin)',
    ticket: { bg: '#EBF3FC', text: '#1D54B2', border: '#BDD8F8' },
    disc:   { bg: '#FEF0E7', text: '#A84315', border: '#FCD2BC' },
    radio:  { bg: '#EAF7EF', text: '#166A44', border: '#BBE8CD' }
  }
];

/**
 * 2. Grup (20 Palet - WhiteDesk Öz Mavi & Tondaş Armoni)
 * 1-10: Cesurdan yumuşak pastele geçiş (öz mavi bazlı, asla yabancılaşmayan)
 * 11-20: Gri karışımlı / slate & muted tondaş tonlar
 */
export const BUTTON_THEME_PALETTES_G2: ButtonTheme[] = [
  // 1-10: Cesurdan Yumuşak Pastele (Öz Mavi Ailesi)
  {
    id: 21,
    group: 2,
    name: 'Derin Kurumsal Mavi',
    ticket: { bg: '#1D4ED8', text: '#FFFFFF', border: 'transparent' },
    disc:   { bg: '#C2410C', text: '#FFFFFF', border: 'transparent' },
    radio:  { bg: '#15803D', text: '#FFFFFF', border: 'transparent' }
  },
  {
    id: 22,
    group: 2,
    name: 'WhiteDesk Öz Mavi',
    ticket: { bg: '#2563EB', text: '#FFFFFF', border: 'transparent' },
    disc:   { bg: '#D97706', text: '#FFFFFF', border: 'transparent' },
    radio:  { bg: '#059669', text: '#FFFFFF', border: 'transparent' }
  },
  {
    id: 23,
    group: 2,
    name: 'Asil Safir Mavi',
    ticket: { bg: '#215BD6', text: '#FFFFFF', border: 'transparent' },
    disc:   { bg: '#CA521B', text: '#FFFFFF', border: 'transparent' },
    radio:  { bg: '#1B8749', text: '#FFFFFF', border: 'transparent' }
  },
  {
    id: 24,
    group: 2,
    name: 'Prestij Mavi',
    ticket: { bg: '#2B66E2', text: '#FFFFFF', border: 'transparent' },
    disc:   { bg: '#CF5A24', text: '#FFFFFF', border: 'transparent' },
    radio:  { bg: '#228B52', text: '#FFFFFF', border: 'transparent' }
  },
  {
    id: 25,
    group: 2,
    name: 'Modern Kurumsal Mavi',
    ticket: { bg: '#326EE6', text: '#FFFFFF', border: 'transparent' },
    disc:   { bg: '#C8632E', text: '#FFFFFF', border: 'transparent' },
    radio:  { bg: '#25965C', text: '#FFFFFF', border: 'transparent' }
  },
  {
    id: 26,
    group: 2,
    name: 'Parlak İş Mavisi',
    ticket: { bg: '#3B7DF0', text: '#FFFFFF', border: 'transparent' },
    disc:   { bg: '#D26D34', text: '#FFFFFF', border: 'transparent' },
    radio:  { bg: '#2CA366', text: '#FFFFFF', border: 'transparent' }
  },
  {
    id: 27,
    group: 2,
    name: 'Canlı Tondaş Mavi',
    ticket: { bg: '#4185F5', text: '#FFFFFF', border: 'transparent' },
    disc:   { bg: '#D7743E', text: '#FFFFFF', border: 'transparent' },
    radio:  { bg: '#32AC70', text: '#FFFFFF', border: 'transparent' }
  },
  {
    id: 28,
    group: 2,
    name: 'Duru Kurumsal Mavi',
    ticket: { bg: '#4F8DF5', text: '#FFFFFF', border: 'transparent' },
    disc:   { bg: '#DB7D4A', text: '#FFFFFF', border: 'transparent' },
    radio:  { bg: '#39B57B', text: '#FFFFFF', border: 'transparent' }
  },
  {
    id: 29,
    group: 2,
    name: 'İpeksi Tondaş Mavi',
    ticket: { bg: '#5C96F7', text: '#FFFFFF', border: 'transparent' },
    disc:   { bg: '#E08757', text: '#FFFFFF', border: 'transparent' },
    radio:  { bg: '#43BD85', text: '#FFFFFF', border: 'transparent' }
  },
  {
    id: 30,
    group: 2,
    name: 'Yumuşak Gökyüzü Mavisi',
    ticket: { bg: '#6B9FF8', text: '#FFFFFF', border: 'transparent' },
    disc:   { bg: '#E49064', text: '#FFFFFF', border: 'transparent' },
    radio:  { bg: '#4DC590', text: '#FFFFFF', border: 'transparent' }
  },

  // 11-20: Gri Karışımlı / Slate & Muted Tondaş Tonlar
  {
    id: 31,
    group: 2,
    name: 'Dumanlı Kurumsal Slate',
    ticket: { bg: '#3B5B8C', text: '#FFFFFF', border: 'transparent' },
    disc:   { bg: '#B25732', text: '#FFFFFF', border: 'transparent' },
    radio:  { bg: '#3A7359', text: '#FFFFFF', border: 'transparent' }
  },
  {
    id: 32,
    group: 2,
    name: 'Grafit Mavi Tondaş',
    ticket: { bg: '#38547C', text: '#FFFFFF', border: 'transparent' },
    disc:   { bg: '#A8502D', text: '#FFFFFF', border: 'transparent' },
    radio:  { bg: '#346850', text: '#FFFFFF', border: 'transparent' }
  },
  {
    id: 33,
    group: 2,
    name: 'Çelik Kurumsal Mavi',
    ticket: { bg: '#42618F', text: '#FFFFFF', border: 'transparent' },
    disc:   { bg: '#B65F3A', text: '#FFFFFF', border: 'transparent' },
    radio:  { bg: '#3E795E', text: '#FFFFFF', border: 'transparent' }
  },
  {
    id: 34,
    group: 2,
    name: 'Sisli Lacivert Slate',
    ticket: { bg: '#3F587A', text: '#FFFFFF', border: 'transparent' },
    disc:   { bg: '#A45B3A', text: '#FFFFFF', border: 'transparent' },
    radio:  { bg: '#386551', text: '#FFFFFF', border: 'transparent' }
  },
  {
    id: 35,
    group: 2,
    name: 'Mat Mineral Mavi',
    ticket: { bg: '#4B678E', text: '#FFFFFF', border: 'transparent' },
    disc:   { bg: '#B36949', text: '#FFFFFF', border: 'transparent' },
    radio:  { bg: '#467862', text: '#FFFFFF', border: 'transparent' }
  },
  {
    id: 36,
    group: 2,
    name: 'Puslu İş Mavisi',
    ticket: { bg: '#557199', text: '#FFFFFF', border: 'transparent' },
    disc:   { bg: '#B87355', text: '#FFFFFF', border: 'transparent' },
    radio:  { bg: '#4D826C', text: '#FFFFFF', border: 'transparent' }
  },
  {
    id: 37,
    group: 2,
    name: 'İnce Gri Kurumsal Tint',
    ticket: { bg: '#607B9E', text: '#FFFFFF', border: 'transparent' },
    disc:   { bg: '#BC7E62', text: '#FFFFFF', border: 'transparent' },
    radio:  { bg: '#558B75', text: '#FFFFFF', border: 'transparent' }
  },
  {
    id: 38,
    group: 2,
    name: 'Çerçeveli Kurumsal Slate (Ghost)',
    ticket: { bg: '#FFFFFF', text: '#3B5B8C', border: '#3B5B8C' },
    disc:   { bg: '#FFFFFF', text: '#B25732', border: '#B25732' },
    radio:  { bg: '#FFFFFF', text: '#3A7359', border: '#3A7359' }
  },
  {
    id: 39,
    group: 2,
    name: 'Açık Slate Mavi Dolgu',
    ticket: { bg: '#E2E8F0', text: '#1E3A8A', border: 'transparent' },
    disc:   { bg: '#FFEDD5', text: '#9A3412', border: 'transparent' },
    radio:  { bg: '#DCFCE7', text: '#166534', border: 'transparent' }
  },
  {
    id: 40,
    group: 2,
    name: 'İnce Kurumsal Haze',
    ticket: { bg: '#EEF2F6', text: '#1E3A8A', border: '#CBD5E1' },
    disc:   { bg: '#FFF7ED', text: '#9A3412', border: '#FED7AA' },
    radio:  { bg: '#F0FDF4', text: '#166534', border: '#BBF7D0' }
  }
];

export const BUTTON_THEME_PALETTES: ButtonTheme[] = [
  ...BUTTON_THEME_PALETTES_G1,
  ...BUTTON_THEME_PALETTES_G2
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
