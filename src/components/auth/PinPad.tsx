import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { authenticateWithPin } from '@/utils/pinAuth';
import { useToast } from "@/hooks/use-toast";
import { getBoundCompany } from '@/utils/deviceBinding';
import { Delete } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface PinPadProps {
  onSuccess: (user: any) => void;
  onFirstDigit?: () => void; // Callback when first PIN digit is entered
}

export const PinPad = ({ onSuccess, onFirstDigit }: PinPadProps) => {
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [completed, setCompleted] = useState(false);
  const [firstDigitTriggered, setFirstDigitTriggered] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();


  const handleNumberClick = (number: string) => {
    if (pin.length < 4 && !isLoading) {
      const newPin = pin + number;
      setPin(newPin);
      setError('');
      
      // Trigger data fetch on first digit
      if (newPin.length === 1 && !firstDigitTriggered && onFirstDigit) {
        console.log('🎯 First PIN digit entered, triggering data fetch');
        setFirstDigitTriggered(true);
        onFirstDigit();
      }
    }
  };

  const handleClear = () => {
    if (!isLoading) {
      setPin('');
      setError('');
    }
  };

  const handleDelete = () => {
    if (!isLoading) {
      setPin(prev => prev.slice(0, -1));
      setError('');
    }
  };

  const handleSubmit = async () => {
    if (pin.length !== 4 || isLoading || completed) return;

    setIsLoading(true);
    setError('');

    try {
      const bound = getBoundCompany();
      if (!bound) {
        setError('Device not properly configured');
        navigate('/owner-login');
        return;
      }

      const user = await authenticateWithPin(pin, bound.company_id);

      if (user) {
        console.info('🔐 PIN authentication successful for user:', user.user_id);
        setCompleted(true);
        setPin('');
        
        onSuccess(user);
      } else {
        setError('Invalid PIN. Please try again.');
        setPin('');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      setError('Invalid PIN. Please try again.');
      setPin('');
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-submit when PIN reaches 4 digits
  useEffect(() => {
    if (pin.length === 4 && !isLoading && !completed) {
      handleSubmit();
    }
  }, [pin, isLoading, completed]);

  const gridItems = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['delete', '0', 'clear']
  ];

  return (
    <div className="h-[100dvh] w-screen bg-white flex flex-col overflow-hidden tablet-pin-container">
      {/* Header Section */}
      <div className="flex-none pt-16 md:pt-12 lg:pt-16 pb-8 text-center tablet-pin-header">
        <h1 className="text-4xl md:text-3xl lg:text-4xl font-bold text-slate-800 mb-2">
          Enter PIN
        </h1>
        
        {/* PIN Display */}
        <div className="flex justify-center gap-4 mt-8">
          {[0, 1, 2, 3].map((index) => (
            <div
              key={index}
              className={`w-8 h-8 rounded-full border-2 transition-all duration-300 ease-out ${
                index < pin.length 
                  ? 'bg-slate-700 border-slate-700 shadow-sm scale-110' 
                  : 'border-slate-300 bg-white'
              }`}
            />
          ))}
        </div>

        {/* Error Message */}
        {error && (
          <div className="text-center text-base text-destructive mt-6 p-3 bg-destructive/10 rounded-lg mx-8">
            {error}
          </div>
        )}
      </div>

      {/* Main PIN Pad - 4x3 Grid */}
      <div className="flex-1 flex flex-col pt-8 px-8 md:px-6 pb-12 md:pb-8 min-h-0">
        <div className="grid grid-cols-3 gap-1.5 max-w-3xl mx-auto tablet-pin-grid">
          {gridItems.map((row, rowIndex) => 
            row.map((item, colIndex) => {
              if (item === 'delete') {
                return (
                  <Button
                    key={`${rowIndex}-${colIndex}`}
                    variant="ghost"
                    className="aspect-square w-full min-h-[140px] text-2xl font-bold bg-white border-2 border-slate-200 hover:bg-red-50 hover:border-red-300 transition-all duration-200 active:scale-95 shadow-lg disabled:opacity-50 tablet-pin-button"
                    onClick={handleDelete}
                    disabled={isLoading || pin.length === 0 || completed}
                  >
                    <Delete className="w-8 md:w-6 lg:w-7 h-8 md:h-6 lg:h-7 text-slate-600" />
                  </Button>
                );
              }
              
              if (item === 'clear') {
                return (
                  <Button
                    key={`${rowIndex}-${colIndex}`}
                    variant="ghost"
                    className="aspect-square w-full min-h-[140px] text-2xl font-bold bg-white border-2 border-slate-200 text-slate-700 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 active:scale-95 shadow-lg disabled:opacity-50 tablet-pin-button"
                    onClick={handleClear}
                    disabled={isLoading || pin.length === 0 || completed}
                  >
                    Clear
                  </Button>
                );
              }
              
              return (
                <Button
                  key={`${rowIndex}-${colIndex}`}
                  variant="ghost"
                  className="aspect-square w-full min-h-[140px] text-2xl font-bold bg-white border-2 border-slate-200 text-slate-700 transition-all duration-200 active:scale-95 shadow-lg hover:bg-gray-50 hover:border-gray-300 hover:shadow-xl tablet-pin-button"
                  onClick={() => handleNumberClick(item)}
                  disabled={isLoading || completed}
                >
                  {item}
                </Button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};