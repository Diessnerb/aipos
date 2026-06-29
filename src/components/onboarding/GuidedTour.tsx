import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, ArrowRight, Target, Lightbulb, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';

export interface TourStep {
  id: string;
  target: string;
  title: string;
  content: string;
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
  showNext?: boolean;
  showPrev?: boolean;
  action?: {
    type: 'click' | 'hover' | 'focus';
    element?: string;
    description: string;
  };
}

interface GuidedTourProps {
  isActive: boolean;
  steps: TourStep[];
  onComplete: () => void;
  onSkip: () => void;
  tourName: string;
}

export const GuidedTour: React.FC<GuidedTourProps> = ({
  isActive,
  steps,
  onComplete,
  onSkip,
  tourName
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isActive && steps.length > 0) {
      setIsVisible(true);
      updateTooltipPosition();
    } else {
      setIsVisible(false);
    }
  }, [isActive, currentStep, steps]);

  useEffect(() => {
    const handleResize = () => {
      if (isActive) {
        updateTooltipPosition();
      }
    };

    const handleScroll = () => {
      if (isActive) {
        updateTooltipPosition();
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [isActive, currentStep]);

  const updateTooltipPosition = () => {
    if (!steps[currentStep]) return;

    const targetElement = document.querySelector(steps[currentStep].target) as HTMLElement;
    if (!targetElement) {
      console.warn(`Target element not found: ${steps[currentStep].target}`);
      return;
    }

    const targetRect = targetElement.getBoundingClientRect();
    const tooltipElement = tooltipRef.current;
    if (!tooltipElement) return;

    const tooltipRect = tooltipElement.getBoundingClientRect();
    const position = steps[currentStep].position;

    let x = 0;
    let y = 0;

    switch (position) {
      case 'top':
        x = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
        y = targetRect.top - tooltipRect.height - 10;
        break;
      case 'bottom':
        x = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
        y = targetRect.bottom + 10;
        break;
      case 'left':
        x = targetRect.left - tooltipRect.width - 10;
        y = targetRect.top + targetRect.height / 2 - tooltipRect.height / 2;
        break;
      case 'right':
        x = targetRect.right + 10;
        y = targetRect.top + targetRect.height / 2 - tooltipRect.height / 2;
        break;
      case 'center':
        x = window.innerWidth / 2 - tooltipRect.width / 2;
        y = window.innerHeight / 2 - tooltipRect.height / 2;
        break;
    }

    // Ensure tooltip stays within viewport
    x = Math.max(10, Math.min(x, window.innerWidth - tooltipRect.width - 10));
    y = Math.max(10, Math.min(y, window.innerHeight - tooltipRect.height - 10));

    setTooltipPosition({ x, y });

    // Highlight target element
    highlightElement(targetElement);
  };

  const highlightElement = (element: HTMLElement) => {
    // Remove existing highlights
    document.querySelectorAll('.tour-highlight').forEach(el => {
      el.classList.remove('tour-highlight');
    });

    // Add highlight to current element
    element.classList.add('tour-highlight');
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleComplete = () => {
    setIsVisible(false);
    // Remove all highlights
    document.querySelectorAll('.tour-highlight').forEach(el => {
      el.classList.remove('tour-highlight');
    });
    toast.success(`${tourName} tour completed!`);
    onComplete();
  };

  const handleSkipTour = () => {
    setIsVisible(false);
    // Remove all highlights
    document.querySelectorAll('.tour-highlight').forEach(el => {
      el.classList.remove('tour-highlight');
    });
    onSkip();
  };

  const executeAction = () => {
    const step = steps[currentStep];
    if (step.action) {
      const targetElement = step.action.element 
        ? document.querySelector(step.action.element) as HTMLElement
        : document.querySelector(step.target) as HTMLElement;

      if (targetElement) {
        switch (step.action.type) {
          case 'click':
            targetElement.click();
            break;
          case 'hover':
            targetElement.dispatchEvent(new MouseEvent('mouseenter'));
            break;
          case 'focus':
            targetElement.focus();
            break;
        }
        toast.info(step.action.description);
      }
    }
  };

  if (!isActive || !isVisible || !steps[currentStep]) {
    return null;
  }

  const currentStepData = steps[currentStep];

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 z-40" />
      
      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="fixed z-50 max-w-sm"
        style={{
          left: tooltipPosition.x,
          top: tooltipPosition.y
        }}
      >
        <Card className="shadow-lg border-2 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm">{currentStepData.title}</h3>
              </div>
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="text-xs">
                  {currentStep + 1}/{steps.length}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSkipTour}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <p className="text-sm text-muted-foreground mb-4">
              {currentStepData.content}
            </p>

            {currentStepData.action && (
              <div className="mb-4 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-blue-600" />
                  <span className="text-xs font-medium text-blue-800">Try it:</span>
                </div>
                <p className="text-xs text-blue-700 mt-1">
                  {currentStepData.action.description}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={executeAction}
                  className="mt-2 h-6 text-xs"
                >
                  {currentStepData.action.type === 'click' ? 'Click' : 
                   currentStepData.action.type === 'hover' ? 'Hover' : 'Focus'}
                </Button>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                {currentStepData.showPrev !== false && currentStep > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrevious}
                    className="h-7 px-2 text-xs"
                  >
                    Previous
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSkipTour}
                  className="h-7 px-2 text-xs"
                >
                  Skip Tour
                </Button>
                {currentStepData.showNext !== false && (
                  <Button
                    size="sm"
                    onClick={handleNext}
                    className="h-7 px-2 text-xs"
                  >
                    {currentStep === steps.length - 1 ? 'Finish' : 'Next'}
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Arrow pointer */}
        <div
          className={`absolute w-3 h-3 bg-background border rotate-45 ${
            currentStepData.position === 'top' ? 'bottom-[-6px] left-1/2 transform -translate-x-1/2 border-r border-b' :
            currentStepData.position === 'bottom' ? 'top-[-6px] left-1/2 transform -translate-x-1/2 border-l border-t' :
            currentStepData.position === 'left' ? 'right-[-6px] top-1/2 transform -translate-y-1/2 border-t border-r' :
            currentStepData.position === 'right' ? 'left-[-6px] top-1/2 transform -translate-y-1/2 border-b border-l' :
            'hidden'
          }`}
        />
      </div>

      {/* Progress dots */}
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
        <div className="flex items-center gap-2 bg-background/90 backdrop-blur-sm border rounded-full px-3 py-2">
          {steps.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentStep(index)}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === currentStep ? 'bg-primary' : 
                index < currentStep ? 'bg-green-500' : 'bg-muted-foreground/30'
              }`}
              title={`Step ${index + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Help button */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          variant="outline"
          size="sm"
          onClick={() => toast.info('Use the guided tour to learn about key features!')}
          className="rounded-full h-10 w-10 p-0"
        >
          <HelpCircle className="h-4 w-4" />
        </Button>
      </div>

      <style>{`
        .tour-highlight {
          position: relative;
          z-index: 45;
          box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.3), 0 0 20px rgba(34, 197, 94, 0.2);
          border-radius: 4px;
          transition: all 0.3s ease;
        }
      `}</style>
    </>
  );
};