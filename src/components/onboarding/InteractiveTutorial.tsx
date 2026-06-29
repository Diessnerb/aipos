import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Play, 
  Pause, 
  SkipForward, 
  CheckCircle, 
  ArrowRight, 
  ArrowLeft,
  X,
  Book,
  Target,
  Users,
  Settings,
  BarChart3,
  Lightbulb
} from 'lucide-react';
import { toast } from 'sonner';

export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  targetElement?: string;
  content: React.ReactNode;
  action?: () => void;
  validation?: () => boolean;
  category: 'basic' | 'intermediate' | 'advanced';
  estimatedTime: number; // in minutes
}

interface InteractiveTutorialProps {
  isOpen: boolean;
  onClose: () => void;
  tutorialType: 'table-management' | 'reservations' | 'analytics' | 'full-system';
}

export const InteractiveTutorial: React.FC<InteractiveTutorialProps> = ({
  isOpen,
  onClose,
  tutorialType
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [isPlaying, setIsPlaying] = useState(false);
  const [tutorialSteps, setTutorialSteps] = useState<TutorialStep[]>([]);

  useEffect(() => {
    const steps = getTutorialSteps(tutorialType);
    setTutorialSteps(steps);
  }, [tutorialType]);

  const getTutorialSteps = (type: string): TutorialStep[] => {
    const commonSteps = {
      'table-management': [
        {
          id: 'welcome',
          title: 'Welcome to Table Management',
          description: 'Learn how to set up and manage your restaurant tables effectively',
          category: 'basic' as const,
          estimatedTime: 2,
          content: (
            <div className="space-y-4">
              <div className="text-center">
                <Users className="h-12 w-12 mx-auto mb-4 text-primary" />
                <p className="text-muted-foreground">
                  This tutorial will guide you through creating table layouts, managing groups, 
                  and optimizing seating arrangements for maximum efficiency.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="p-3 border rounded-lg">
                  <Target className="h-6 w-6 mb-2 text-green-500" />
                  <h4 className="font-medium">Create Tables</h4>
                  <p className="text-sm text-muted-foreground">Set up your seating layout</p>
                </div>
                <div className="p-3 border rounded-lg">
                  <Settings className="h-6 w-6 mb-2 text-blue-500" />
                  <h4 className="font-medium">Group Management</h4>
                  <p className="text-sm text-muted-foreground">Organize tables efficiently</p>
                </div>
              </div>
            </div>
          )
        },
        {
          id: 'creating-tables',
          title: 'Creating Your First Table',
          description: 'Learn how to add tables to your restaurant layout',
          category: 'basic' as const,
          estimatedTime: 3,
          targetElement: '[data-tutorial="create-table-button"]',
          content: (
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2">Step 1: Click "Add Table"</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Find the "Add Table" button in the tables management section.
                </p>
                <div className="flex items-center gap-2 text-sm">
                  <ArrowRight className="h-4 w-4" />
                  <span>This will open the table creation form</span>
                </div>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2">Step 2: Fill Table Details</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Table number (must be unique)</li>
                  <li>• Maximum capacity</li>
                  <li>• Table type and features</li>
                  <li>• Location and accessibility options</li>
                </ul>
              </div>
            </div>
          ),
          validation: () => {
            // Check if user has created at least one table
            return document.querySelectorAll('[data-testid="table-item"]').length > 0;
          }
        },
        {
          id: 'table-groups',
          title: 'Organizing Tables into Groups',
          description: 'Group related tables for better management',
          category: 'intermediate' as const,
          estimatedTime: 5,
          content: (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <Settings className="h-10 w-10 mx-auto mb-2 text-primary" />
                <p className="text-muted-foreground">
                  Table groups help you organize your seating areas and manage reservations more efficiently.
                </p>
              </div>
              
              <div className="space-y-3">
                <div className="p-3 border-l-4 border-blue-500 bg-blue-50/50">
                  <h5 className="font-medium">Patio Section</h5>
                  <p className="text-sm text-muted-foreground">Tables 1-8 for outdoor dining</p>
                </div>
                <div className="p-3 border-l-4 border-green-500 bg-green-50/50">
                  <h5 className="font-medium">Main Dining</h5>
                  <p className="text-sm text-muted-foreground">Tables 9-20 for regular service</p>
                </div>
                <div className="p-3 border-l-4 border-purple-500 bg-purple-50/50">
                  <h5 className="font-medium">Private Dining</h5>
                  <p className="text-sm text-muted-foreground">Tables 21-24 for special events</p>
                </div>
              </div>

              <div className="mt-4 p-3 bg-amber-50/50 border border-amber-200 rounded-lg">
                <Lightbulb className="h-5 w-5 text-amber-600 mb-2" />
                <p className="text-sm">
                  <strong>Pro Tip:</strong> Groups can have different assignment rules and priorities 
                  to optimize table utilization during peak hours.
                </p>
              </div>
            </div>
          )
        },
        {
          id: 'visual-arrangement',
          title: 'Visual Table Arrangement',
          description: 'Design your restaurant layout visually',
          category: 'advanced' as const,
          estimatedTime: 8,
          content: (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <BarChart3 className="h-10 w-10 mx-auto mb-2 text-primary" />
                <p className="text-muted-foreground">
                  Create a visual layout of your restaurant to optimize traffic flow and service efficiency.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h5 className="font-medium">Drag & Drop</h5>
                  <p className="text-sm text-muted-foreground">
                    Position tables by dragging them around the canvas
                  </p>
                  <div className="p-3 bg-muted/30 rounded border-2 border-dashed">
                    <div className="w-8 h-8 bg-primary/20 rounded border-2 border-primary/40 mx-auto"></div>
                    <p className="text-xs text-center mt-1">Table</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h5 className="font-medium">Seat Configuration</h5>
                  <p className="text-sm text-muted-foreground">
                    Arrange seats around each table for optimal capacity
                  </p>
                  <div className="flex justify-center">
                    <div className="relative">
                      <div className="w-8 h-8 bg-primary/20 rounded border-2 border-primary/40"></div>
                      <div className="absolute -top-2 -left-2 w-3 h-3 bg-green-500 rounded-full"></div>
                      <div className="absolute -top-2 -right-2 w-3 h-3 bg-green-500 rounded-full"></div>
                      <div className="absolute -bottom-2 -left-2 w-3 h-3 bg-green-500 rounded-full"></div>
                      <div className="absolute -bottom-2 -right-2 w-3 h-3 bg-green-500 rounded-full"></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3 bg-green-50/50 border border-green-200 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600 mb-2" />
                <p className="text-sm">
                  <strong>Benefits:</strong> Visual layouts help staff understand table locations, 
                  optimize service routes, and provide better customer experience.
                </p>
              </div>
            </div>
          )
        }
      ],
      'reservations': [
        {
          id: 'reservation-basics',
          title: 'Understanding Reservations',
          description: 'Learn the fundamentals of reservation management',
          category: 'basic' as const,
          estimatedTime: 3,
          content: (
            <div className="space-y-4">
              <div className="text-center">
                <Book className="h-12 w-12 mx-auto mb-4 text-primary" />
                <p className="text-muted-foreground">
                  Master reservation management to provide excellent customer service 
                  and optimize table utilization.
                </p>
              </div>
            </div>
          )
        }
        // Add more reservation steps...
      ],
      'analytics': [
        {
          id: 'analytics-overview',
          title: 'Restaurant Analytics Overview',
          description: 'Understand your restaurant performance metrics',
          category: 'basic' as const,
          estimatedTime: 4,
          content: (
            <div className="space-y-4">
              <div className="text-center">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 text-primary" />
                <p className="text-muted-foreground">
                  Learn how to interpret analytics data to make informed business decisions.
                </p>
              </div>
            </div>
          )
        }
        // Add more analytics steps...
      ]
    };

    return commonSteps[type] || commonSteps['table-management'];
  };

  const handleNext = () => {
    if (currentStep < tutorialSteps.length - 1) {
      // Mark current step as completed
      const currentStepData = tutorialSteps[currentStep];
      if (currentStepData.validation) {
        if (currentStepData.validation()) {
          setCompletedSteps(prev => new Set([...prev, currentStepData.id]));
          setCurrentStep(prev => prev + 1);
          toast.success(`Completed: ${currentStepData.title}`);
        } else {
          toast.warning('Please complete the current step before proceeding');
          return;
        }
      } else {
        setCompletedSteps(prev => new Set([...prev, currentStepData.id]));
        setCurrentStep(prev => prev + 1);
      }
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    const currentStepData = tutorialSteps[currentStep];
    setCompletedSteps(prev => new Set([...prev, currentStepData.id]));
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleComplete = () => {
    const currentStepData = tutorialSteps[currentStep];
    setCompletedSteps(prev => new Set([...prev, currentStepData.id]));
    toast.success('Tutorial completed! Great job!');
    onClose();
  };

  const progress = ((currentStep + 1) / tutorialSteps.length) * 100;
  const currentStepData = tutorialSteps[currentStep];
  const totalTime = tutorialSteps.reduce((sum, step) => sum + step.estimatedTime, 0);

  if (!isOpen || !currentStepData) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Play className="h-5 w-5" />
              Interactive Tutorial
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                Step {currentStep + 1} of {tutorialSteps.length}
              </Badge>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Progress</span>
              <span className="text-muted-foreground">
                ~{totalTime} min total • {currentStepData.estimatedTime} min this step
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Current Step */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {currentStepData.title}
                    <Badge variant={
                      currentStepData.category === 'basic' ? 'default' :
                      currentStepData.category === 'intermediate' ? 'secondary' : 'destructive'
                    }>
                      {currentStepData.category}
                    </Badge>
                  </CardTitle>
                  <p className="text-muted-foreground mt-1">
                    {currentStepData.description}
                  </p>
                </div>
                {completedSteps.has(currentStepData.id) && (
                  <CheckCircle className="h-6 w-6 text-green-500" />
                )}
              </div>
            </CardHeader>
            <CardContent>
              {currentStepData.content}
            </CardContent>
          </Card>

          <Separator />

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentStep === 0}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>
              <Button
                variant="ghost"
                onClick={handleSkip}
                disabled={currentStep === tutorialSteps.length - 1}
              >
                <SkipForward className="h-4 w-4 mr-2" />
                Skip
              </Button>
            </div>

            <div className="flex items-center gap-2">
              {currentStep === tutorialSteps.length - 1 ? (
                <Button onClick={handleComplete}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Complete Tutorial
                </Button>
              ) : (
                <Button onClick={handleNext}>
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          </div>

          {/* Step Navigation Dots */}
          <div className="flex justify-center gap-2">
            {tutorialSteps.map((step, index) => (
              <button
                key={step.id}
                onClick={() => setCurrentStep(index)}
                className={`w-3 h-3 rounded-full transition-colors ${
                  index === currentStep
                    ? 'bg-primary'
                    : completedSteps.has(step.id)
                    ? 'bg-green-500'
                    : 'bg-muted-foreground/30'
                }`}
                title={step.title}
              />
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};