
export const CATEGORY_COLORS = {
  'Sides': {
    background: 'bg-amber-50',
    hoverBackground: 'hover:bg-amber-100',
    accent: 'text-amber-800',
    border: 'border-amber-200'
  },
  'Mains': {
    background: 'bg-sky-50',
    hoverBackground: 'hover:bg-sky-100',
    accent: 'text-sky-800',
    border: 'border-sky-200'
  },
  'Desserts': {
    background: 'bg-pink-50',
    hoverBackground: 'hover:bg-pink-100',
    accent: 'text-pink-800',
    border: 'border-pink-200'
  },
  'Drinks': {
    background: 'bg-emerald-50',
    hoverBackground: 'hover:bg-emerald-100',
    accent: 'text-emerald-800',
    border: 'border-emerald-200'
  }
} as const;

export const getCategoryColors = (category: string) => {
  return CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS] || {
    background: 'bg-gray-50',
    hoverBackground: 'hover:bg-gray-100',
    accent: 'text-gray-800',
    border: 'border-gray-200'
  };
};
