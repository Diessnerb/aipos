export const getNextServiceStatus = (currentStatus: string): string | null => {
  const progressionMap: Record<string, string> = {
    'starters-ready-in-kitchen': 'starters-served',
    'starters-served': 'eating-starters',
    'eating-starters': 'clear-starters',
    'clear-starters': 'waiting-for-mains',
    
    'mains-ready-in-kitchen': 'mains-served',
    'mains-served': 'eating-mains',
    'eating-mains': 'clear-mains',
    'clear-mains': 'waiting-for-desserts',
    
    'desserts-ready-in-kitchen': 'desserts-served',
    'desserts-served': 'eating-dessert',
    'eating-dessert': 'clear-desserts',
    'clear-desserts': 'table-cleared',
  };
  
  return progressionMap[currentStatus] || null;
};

export const getCourseFromStatus = (status: string): 'starter' | 'main' | 'dessert' | null => {
  if (status?.includes('starter')) return 'starter';
  if (status?.includes('main')) return 'main';
  if (status?.includes('dessert')) return 'dessert';
  return null;
};
