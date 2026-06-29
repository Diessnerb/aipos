import React from 'react';
import { cn } from '@/lib/utils';

interface PrivateInfoProps {
  type: 'phone' | 'email';
  value: string;
  isVisible: boolean;
  className?: string;
}

const PrivateInfo: React.FC<PrivateInfoProps> = ({ type, value, isVisible, className }) => {

  const maskValue = (value: string, type: 'phone' | 'email'): string => {
    if (!value) return '';
    
    if (type === 'phone') {
      // Show first 2 digits, mask middle with asterisks, show last 3 digits
      if (value.length <= 5) return value; // Don't mask very short numbers
      const first = value.slice(0, 2);
      const last = value.slice(-3);
      const middle = '*'.repeat(Math.max(0, value.length - 5));
      return `${first}${middle}${last}`;
    } else if (type === 'email') {
      // Show first 2 characters, mask middle with dots, show domain
      const [localPart, domain] = value.split('@');
      if (!domain || localPart.length <= 2) return value; // Don't mask invalid emails or very short local parts
      const first = localPart.slice(0, 2);
      const maskedLocal = `${first}....`;
      return `${maskedLocal}@${domain}`;
    }
    
    return value;
  };

  const displayValue = isVisible ? value : maskValue(value, type);

  if (!value) return null;

  return (
    <div className={cn("", className)}>{displayValue}</div>
  );
};

export { PrivateInfo };