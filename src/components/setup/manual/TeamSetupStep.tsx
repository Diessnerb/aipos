import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Users, CheckCircle, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getBoundCompany } from '@/utils/deviceBinding';

interface TeamSetupStepProps {
  onComplete: () => void;
  isCompleted: boolean;
}

interface TeamMember {
  fullName: string;
  email: string;
  role: 'manager' | 'staff' | 'host';
  pinCode?: string;
}

export const TeamSetupStep: React.FC<TeamSetupStepProps> = ({ onComplete, isCompleted }) => {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  const addTeamMember = () => {
    setTeamMembers([...teamMembers, {
      fullName: '',
      email: '',
      role: 'staff'
    }]);
  };

  const removeTeamMember = (index: number) => {
    setTeamMembers(teamMembers.filter((_, i) => i !== index));
  };

  const updateTeamMember = (index: number, field: keyof TeamMember, value: string) => {
    const updated = [...teamMembers];
    updated[index] = { ...updated[index], [field]: value };
    setTeamMembers(updated);
  };

  const generatePinCode = () => {
    return Math.floor(1000 + Math.random() * 9000).toString();
  };

  const createTeamMembers = async () => {
    const boundCompany = getBoundCompany();
    if (!boundCompany) {
      toast({
        title: 'Error',
        description: 'No company found. Please try logging in again.',
        variant: 'destructive'
      });
      return;
    }

    setIsCreating(true);
    try {
      const membersToCreate = teamMembers.map(member => ({
        company_id: boundCompany.company_id,
        full_name: member.fullName,
        email: member.email,
        role: member.role,
        pin_code: generatePinCode(),
        is_company_admin: false
      }));

      const { error } = await supabase
        .from('users')
        .insert(membersToCreate);

      if (error) throw error;

      toast({
        title: 'Team members added successfully',
        description: `Added ${teamMembers.length} team member(s) to your restaurant.`
      });

      onComplete();
    } catch (error: any) {
      console.error('Error creating team members:', error);
      toast({
        title: 'Error adding team members',
        description: error.message || 'Failed to add team members',
        variant: 'destructive'
      });
    } finally {
      setIsCreating(false);
    }
  };

  const skipStep = () => {
    toast({
      title: 'Step skipped',
      description: 'You can add team members later in Settings.'
    });
    onComplete();
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'manager': return 'default';
      case 'host': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-xl font-semibold flex items-center justify-center gap-2">
          {isCompleted && <CheckCircle className="h-5 w-5 text-green-500" />}
          Team Setup
        </h3>
        <p className="text-muted-foreground">
          Add your staff members to give them access to the system
        </p>
      </div>

      {/* Info Card */}
      <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Users className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Team Member Access
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                Each team member will get a unique 4-digit PIN code for secure access to the system.
                They'll be able to take reservations, manage tables, and view relevant information based on their role.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Team Members List */}
      {teamMembers.length > 0 && (
        <div className="space-y-4">
          {teamMembers.map((member, index) => (
            <Card key={index}>
              <CardContent className="pt-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  <div>
                    <Label htmlFor={`name-${index}`}>Full Name</Label>
                    <Input
                      id={`name-${index}`}
                      placeholder="John Doe"
                      value={member.fullName}
                      onChange={(e) => updateTeamMember(index, 'fullName', e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor={`email-${index}`}>Email</Label>
                    <Input
                      id={`email-${index}`}
                      type="email"
                      placeholder="john@restaurant.com"
                      value={member.email}
                      onChange={(e) => updateTeamMember(index, 'email', e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor={`role-${index}`}>Role</Label>
                    <Select
                      value={member.role}
                      onValueChange={(value) => updateTeamMember(index, 'role', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="staff">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">Staff</Badge>
                            <span className="text-xs text-muted-foreground">Basic access</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="host">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">Host</Badge>
                            <span className="text-xs text-muted-foreground">Reservations & seating</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="manager">
                          <div className="flex items-center gap-2">
                            <Badge variant="default">Manager</Badge>
                            <span className="text-xs text-muted-foreground">Full access</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge variant={getRoleBadgeVariant(member.role)}>
                      {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeTeamMember(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Team Member Button */}
      <div className="flex justify-center">
        <Button 
          variant="outline" 
          onClick={addTeamMember}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Team Member
        </Button>
      </div>

      {/* Role Descriptions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Role Permissions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Badge variant="default">Manager</Badge>
            <span className="text-sm text-muted-foreground">
              Full system access, settings, reports, staff management
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary">Host</Badge>
            <span className="text-sm text-muted-foreground">
              Reservations, table management, customer check-in
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline">Staff</Badge>
            <span className="text-sm text-muted-foreground">
              Basic reservations, table status updates
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-center gap-4 pt-4">
        <Button 
          variant="outline"
          onClick={skipStep}
        >
          Skip for Now
        </Button>
        <Button 
          onClick={createTeamMembers}
          disabled={isCreating || teamMembers.length === 0 || teamMembers.some(m => !m.fullName || !m.email)}
          size="lg"
        >
          {isCreating ? 'Adding Team Members...' : `Add ${teamMembers.length} Team Member${teamMembers.length === 1 ? '' : 's'}`}
        </Button>
      </div>

      {teamMembers.length === 0 && (
        <div className="text-center space-y-4">
          <div className="h-32 flex items-center justify-center">
            <div className="text-center space-y-2">
              <UserPlus className="h-12 w-12 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">
                No team members added yet. Click "Add Team Member" to get started.
              </p>
            </div>
          </div>
          <Button onClick={skipStep} variant="ghost">
            Skip this step - I'll add team members later
          </Button>
        </div>
      )}
    </div>
  );
};