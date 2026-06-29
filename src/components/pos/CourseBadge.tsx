import React from 'react';

export type CourseType = 'drinks' | 'starter' | 'main' | 'dessert';

interface CourseBadgeProps {
  courseType: CourseType;
  onClick: (e: React.MouseEvent) => void;
  size?: 'sm' | 'md';
}

export const CourseBadge = ({ courseType, onClick, size = 'sm' }: CourseBadgeProps) => {
  const config = {
    drinks: { 
      bg: 'bg-blue-100 dark:bg-blue-900/30', 
      text: 'text-blue-800 dark:text-blue-200', 
      label: 'Drinks', 
      icon: '🔵' 
    },
    starter: { 
      bg: 'bg-green-100 dark:bg-green-900/30', 
      text: 'text-green-800 dark:text-green-200', 
      label: 'Starter', 
      icon: '🟢' 
    },
    main: { 
      bg: 'bg-orange-100 dark:bg-orange-900/30', 
      text: 'text-orange-800 dark:text-orange-200', 
      label: 'Main', 
      icon: '🟠' 
    },
    dessert: { 
      bg: 'bg-purple-100 dark:bg-purple-900/30', 
      text: 'text-purple-800 dark:text-purple-200', 
      label: 'Dessert', 
      icon: '🟣' 
    },
  };
  
  const c = config[courseType];
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';
  
  return (
    <button
      onClick={onClick}
      className={`${c.bg} ${c.text} ${sizeClasses} rounded-full font-medium hover:opacity-80 transition-opacity`}
      type="button"
    >
      {c.icon} {c.label}
    </button>
  );
};
