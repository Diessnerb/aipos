
export const ORDER_TYPE_COLORS = {
  dine_in: {
    primary: '#377dff',
    light: '#e3f2fd',
    text: '#1565c0'
  },
  takeaway: {
    primary: '#f7c948',
    light: '#fff8e1',
    text: '#f57f17'
  },
  delivery: {
    primary: '#38b2ac',
    light: '#e0f2f1',
    text: '#00695c'
  },
  room_service: {
    primary: '#9f7aea',
    light: '#f3e5f5',
    text: '#7b1fa2'
  }
} as const;

export const getOrderTypeColor = (orderType: 'dine_in' | 'takeaway' | 'delivery' | 'room_service') => {
  return ORDER_TYPE_COLORS[orderType] || ORDER_TYPE_COLORS.dine_in;
};

export const getOrderTypeLabel = (orderType: 'dine_in' | 'takeaway' | 'delivery' | 'room_service') => {
  const labels = {
    dine_in: 'Dine In',
    takeaway: 'Takeaway',
    delivery: 'Delivery',
    room_service: 'Room Service'
  };
  return labels[orderType] || 'Dine In';
};
