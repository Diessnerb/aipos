import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const AccessLevelCard = () => {
  const navigate = useNavigate();

  return (
    <Card className="cursor-pointer transition-all duration-200 hover:shadow-md hover:shadow-primary/10 border-2 hover:border-primary/20 group h-full flex flex-col">
      <CardHeader className="flex-1 flex flex-col justify-center items-center text-center p-6">
        <div className="flex flex-col items-center gap-4 w-full">
          <div className="flex-shrink-0 text-primary group-hover:scale-110 transition-transform duration-200">
            <Shield className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
              Access Level Settings
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Configure page permissions for different user roles
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <Button 
          onClick={() => navigate('/settings/access-levels')}
          className="w-full"
        >
          Manage Access Levels
        </Button>
      </CardContent>
    </Card>
  );
};

export default AccessLevelCard;