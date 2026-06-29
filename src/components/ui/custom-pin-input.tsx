import React, { useRef, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface CustomPinInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  maxLength?: number;
  className?: string;
}

export const CustomPinInput = ({ 
  value, 
  onChange, 
  disabled = false, 
  maxLength = 4,
  className 
}: CustomPinInputProps) => {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  // Ensure value is padded to maxLength
  const paddedValue = value.padEnd(maxLength, '');

  useEffect(() => {
    // Initialize refs array
    inputRefs.current = inputRefs.current.slice(0, maxLength);
  }, [maxLength]);

  const handleInputChange = (index: number, inputValue: string) => {
    if (disabled) return;

    // Only allow digits
    const digit = inputValue.replace(/[^0-9]/g, '');
    
    if (digit.length > 1) {
      // If multiple digits are pasted, handle sequential input
      const digits = digit.slice(0, maxLength - index).split('');
      let newValue = paddedValue.split('');
      
      digits.forEach((d, i) => {
        if (index + i < maxLength) {
          newValue[index + i] = d;
        }
      });
      
      const finalValue = newValue.join('').replace(/\s/g, '');
      onChange(finalValue);
      
      // Focus next available input or last input
      const nextIndex = Math.min(index + digits.length, maxLength - 1);
      setTimeout(() => {
        inputRefs.current[nextIndex]?.focus();
      }, 0);
    } else {
      // Single digit input
      const newValue = paddedValue.split('');
      newValue[index] = digit;
      const finalValue = newValue.join('').replace(/\s/g, '');
      onChange(finalValue);
      
      // Move to next input if digit was entered
      if (digit && index < maxLength - 1) {
        setTimeout(() => {
          inputRefs.current[index + 1]?.focus();
        }, 0);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (e.key === 'Backspace') {
      const newValue = paddedValue.split('');
      
      if (newValue[index] && newValue[index] !== ' ') {
        // Clear current digit
        newValue[index] = '';
        const finalValue = newValue.join('').replace(/\s/g, '');
        onChange(finalValue);
      } else if (index > 0) {
        // Move to previous input and clear it
        newValue[index - 1] = '';
        const finalValue = newValue.join('').replace(/\s/g, '');
        onChange(finalValue);
        setTimeout(() => {
          inputRefs.current[index - 1]?.focus();
        }, 0);
      }
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
      e.preventDefault();
    } else if (e.key === 'ArrowRight' && index < maxLength - 1) {
      inputRefs.current[index + 1]?.focus();
      e.preventDefault();
    }
  };

  const handleFocus = (index: number) => {
    setFocusedIndex(index);
    // Select the content when focusing
    setTimeout(() => {
      inputRefs.current[index]?.select();
    }, 0);
  };

  const handleBlur = () => {
    setFocusedIndex(null);
  };

  return (
    <div className={cn("flex items-center gap-2 has-[:disabled]:opacity-50", className)}>
      {Array.from({ length: maxLength }, (_, index) => (
        <input
          key={index}
          ref={(el) => {
            inputRefs.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={paddedValue[index] === ' ' ? '' : paddedValue[index]}
          onChange={(e) => handleInputChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onFocus={() => handleFocus(index)}
          onBlur={handleBlur}
          disabled={disabled}
          className={cn(
            "relative flex h-10 w-10 items-center justify-center border-y border-r border-input text-sm transition-all first:rounded-l-md first:border-l last:rounded-r-md text-center font-mono",
            focusedIndex === index && "z-10 ring-2 ring-ring ring-offset-background",
            disabled && "cursor-not-allowed opacity-50"
          )}
        />
      ))}
    </div>
  );
};