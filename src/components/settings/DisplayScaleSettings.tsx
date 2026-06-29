import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useDisplayScale, ScalePreference } from '@/contexts/DisplayScaleContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Button } from '@/components/ui/button';
import { Monitor, Tablet, Smartphone, Sparkles, ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';

const scaleOptions = [
  {
    value: 'auto' as ScalePreference,
    label: 'Auto (Recommended)',
    description: 'Automatically scales based on your screen size',
    icon: Sparkles,
    color: 'text-primary',
  },
  {
    value: 'large' as ScalePreference,
    label: 'Large (100%)',
    description: 'Best for laptops and large screens',
    icon: Monitor,
    color: 'text-blue-600',
  },
  {
    value: 'medium' as ScalePreference,
    label: 'Medium (85%)',
    description: 'Optimized for medium tablets',
    icon: Tablet,
    color: 'text-purple-600',
  },
  {
    value: 'small' as ScalePreference,
    label: 'Small (75%)',
    description: 'Compact view for smaller tablets',
    icon: Smartphone,
    color: 'text-green-600',
  },
];

export default function DisplayScaleSettings() {
  const navigate = useNavigate();
  const { preference, setPreference, scale } = useDisplayScale();

  const handleReset = () => {
    setPreference('auto');
  };

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/settings')}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Settings
        </Button>
      </div>

      {/* Page header */}
      <PageHeader 
        title="Display & Scaling"
        subtitle="Adjust how content is displayed on your device"
      />

      {/* Content - left-aligned with max-width */}
      <div className="space-y-6 max-w-4xl">
        {/* Current Scale Info */}
        <Card>
          <CardHeader>
            <CardTitle>Current Display Scale</CardTitle>
            <CardDescription>
              Your interface is currently scaled at {(scale * 100).toFixed(0)}%
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Screen Width</p>
                <p className="font-semibold">{window.innerWidth}px</p>
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Active Scale</p>
                <p className="font-semibold">{(scale * 100).toFixed(0)}%</p>
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Mode</p>
                <p className="font-semibold capitalize">{preference}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Scale Options */}
        <Card>
          <CardHeader>
            <CardTitle>Scale Preference</CardTitle>
            <CardDescription>
              Choose how you want the interface to be displayed on your device
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={preference}
              onValueChange={(value) => setPreference(value as ScalePreference)}
              className="space-y-3"
            >
              {scaleOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <div
                    key={option.value}
                    className={`flex items-start gap-4 p-4 rounded-lg border-2 transition-colors ${
                      preference === option.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <RadioGroupItem value={option.value} id={option.value} className="mt-1" />
                    <div className="flex-1">
                      <Label
                        htmlFor={option.value}
                        className="flex items-center gap-2 cursor-pointer text-base font-medium"
                      >
                        <Icon className={`h-5 w-5 ${option.color}`} />
                        {option.label}
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        {option.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </RadioGroup>

            <div className="mt-6 pt-6 border-t flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Changes are applied immediately
              </div>
              {preference !== 'auto' && (
                <Button onClick={handleReset} variant="outline" size="sm">
                  Reset to Auto
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tips */}
        <Card>
          <CardHeader>
            <CardTitle>Tips</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex gap-2">
              <span className="text-primary">•</span>
              <p>
                <strong>Auto mode</strong> automatically adjusts the scale based on your screen
                size, ensuring optimal viewing on any device.
              </p>
            </div>
            <div className="flex gap-2">
              <span className="text-primary">•</span>
              <p>
                If text appears too large or small, try switching to a different scale option.
              </p>
            </div>
            <div className="flex gap-2">
              <span className="text-primary">•</span>
              <p>
                The scale setting is saved per device, so you can use different settings on
                different devices.
              </p>
            </div>
            <div className="flex gap-2">
              <span className="text-primary">•</span>
              <p>
                Rotating your device (portrait ↔ landscape) will automatically recalculate the
                optimal scale in Auto mode.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
