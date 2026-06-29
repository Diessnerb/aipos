import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Eye, EyeOff, RefreshCw, Users, Save } from 'lucide-react';
import { CompanyUsersManagement } from './CompanyUsersManagement';
import { useCompanies } from '@/hooks/useCompanies';

interface Company {
  id: string;
  name: string;
  subdomain: string;
  default_admin_email: string;
  default_admin_password: string;
  status: string;
}

interface EditCompanyModalProps {
  company: Company | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export const EditCompanyModal: React.FC<EditCompanyModalProps> = ({
  company,
  isOpen,
  onClose,
  onUpdate
}) => {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    subdomain: '',
    admin_email: '',
    admin_password: '',
    phone: ''
  });
  const { toast } = useToast();
  const { updateCompanyName } = useCompanies();

  React.useEffect(() => {
    if (company) {
      setFormData({
        name: company.name || '',
        subdomain: company.subdomain || '',
        admin_email: company.default_admin_email || '',
        admin_password: company.default_admin_password || '',
        phone: ''
      });
      fetchCompanyPhone();
    }
  }, [company]);

  const fetchCompanyPhone = async () => {
    if (!company) return;
    
    const { data } = await supabase
      .from('company_settings')
      .select('phone')
      .eq('company_id', company.id)
      .maybeSingle();
    
    if (data?.phone) {
      setFormData(prev => ({ ...prev, phone: data.phone }));
    }
  };

  const handleUpdateCredentials = async () => {
    if (!company) return;
    
    try {
      setLoading(true);
      
      // First, find the owner/admin user for this company
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('auth_user_id')
        .eq('company_id', company.id)
        .eq('is_owner', true)
        .single();
      
      if (userError || !userData?.auth_user_id) {
        throw new Error('Could not find company owner');
      }
      
      // Call the edge function to update credentials
      const { data, error } = await supabase.functions.invoke('update-admin-credentials', {
        body: {
          userId: userData.auth_user_id,
          newEmail: formData.admin_email,
          newPassword: formData.admin_password
        }
      });
      
      if (error) throw error;
      
      if (data && !data.success) {
        throw new Error(data.error || 'Failed to update credentials');
      }
      
      toast({
        title: "Success",
        description: "Admin credentials updated successfully"
      });
      
      // Trigger lightweight refresh instead of heavy auth reset
      onUpdate();
    } catch (error) {
      console.error('Error updating credentials:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update credentials",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const generateNewPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let result = '';
    for (let i = 0; i < 12; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData(prev => ({ ...prev, admin_password: result }));
  };

  const handleUpdateCompanyName = async () => {
    if (!company) return;
    
    try {
      setLoading(true);
      await updateCompanyName(company.id, formData.name);
      onUpdate();
    } catch (error) {
      console.error('Error updating company name:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePhone = async () => {
    if (!company) return;
    
    try {
      setLoading(true);
      
      // Check if company_settings exists for this company
      const { data: existingSettings } = await supabase
        .from('company_settings')
        .select('id')
        .eq('company_id', company.id)
        .maybeSingle();
      
      if (existingSettings) {
        // UPDATE existing record
        const { error } = await supabase
          .from('company_settings')
          .update({ phone: formData.phone })
          .eq('company_id', company.id);
        
        if (error) throw error;
      } else {
        // INSERT new record with phone
        const { error } = await supabase
          .from('company_settings')
          .insert({ 
            company_id: company.id, 
            phone: formData.phone,
            auto_assign_tables: false,
            optimization_enabled: false,
            pin_idle_timeout_seconds: 900
          });
        
        if (error) throw error;
      }
      
      toast({
        title: "Success",
        description: "Phone number updated successfully"
      });
      
      onUpdate();
    } catch (error) {
      console.error('Error updating phone:', error);
      toast({
        title: "Error",
        description: "Failed to update phone number",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNewAdminCredentials = async () => {
    if (!company) return;
    
    try {
      setLoading(true);
      
      // Generate new email and password
      const newEmail = `admin-${Date.now()}@${company.subdomain || 'restaurant'}.com`;
      const newPassword = Array.from({ length: 12 }, () => 
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'.charAt(
          Math.floor(Math.random() * 70)
        )
      ).join('');
      
      const { data, error } = await supabase.rpc('create_company_admin_for_existing_company', {
        p_company_id: company.id,
        p_email: newEmail,
        p_password: newPassword,
        p_full_name: `${company.name} Admin`
      });
      
      if (error) throw error;
      
      if (data && typeof data === 'object' && 'success' in data && !(data as any).success) {
        throw new Error((data as any).error);
      }
      
      // Update form with new credentials
      setFormData(prev => ({
        ...prev,
        admin_email: newEmail,
        admin_password: newPassword
      }));
      
      toast({
        title: "Success",
        description: `New admin credentials created:\nEmail: ${newEmail}\nPassword: ${newPassword}`,
        duration: 2000
      });
      
      onUpdate();
    } catch (error) {
      console.error('Error creating new admin credentials:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create new admin credentials",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (!company) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Company: {company.name}</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">Company Details</TabsTrigger>
            <TabsTrigger value="users">
              <Users className="mr-2 h-4 w-4" />
              Users & PINs
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="details" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Company Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Company Name</Label>
                    <div className="flex gap-2">
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      />
                      <Button
                        onClick={handleUpdateCompanyName}
                        disabled={loading || formData.name === company.name}
                        size="sm"
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="subdomain">Subdomain</Label>
                    <Input
                      id="subdomain"
                      value={formData.subdomain}
                      onChange={(e) => setFormData(prev => ({ ...prev, subdomain: e.target.value }))}
                      disabled
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="phone">Phone Number (Agent)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="Not configured"
                    />
                    <Button
                      onClick={handleUpdatePhone}
                      disabled={loading || !formData.phone.trim()}
                      size="sm"
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    The phone number linked to this restaurant's agent
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Owner Access Management</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                  <p className="text-sm font-medium">Privacy Notice</p>
                  <p className="text-xs text-muted-foreground">
                    For security and privacy, actual passwords and PINs are never displayed. 
                    You can only reset them to new temporary values.
                  </p>
                </div>
                
                <div>
                  <Label htmlFor="admin_email">Owner Email</Label>
                  <Input
                    id="admin_email"
                    type="email"
                    value={formData.admin_email}
                    onChange={(e) => setFormData(prev => ({ ...prev, admin_email: e.target.value }))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Owner Password</Label>
                  <Button
                    onClick={generateNewPassword}
                    variant="outline"
                    className="w-full"
                    disabled={loading}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Reset to Temporary Password
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Generates a new temporary password. Owner must change it on next login.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Owner PIN</Label>
                  <Button
                    onClick={async () => {
                      try {
                        const { data, error } = await supabase.rpc('reset_owner_pin' as any, {
                          p_company_id: company.id
                        });
                        
                        if (error) throw error;
                        
                        toast({
                          title: "PIN Reset Successful",
                          description: "Owner PIN has been reset to 1234",
                          duration: 5000
                        });
                      } catch (error) {
                        toast({
                          title: "Error",
                          description: error instanceof Error ? error.message : "Failed to reset PIN",
                          variant: "destructive"
                        });
                      }
                    }}
                    variant="outline"
                    className="w-full"
                    disabled={loading}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Reset Owner PIN to "1234"
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Resets the owner PIN to "1234". Owner should change it in their settings after logging in.
                  </p>
                </div>

                <Button
                  onClick={handleUpdateCredentials}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? 'Updating...' : 'Update Owner Email'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="users">
            <CompanyUsersManagement companyId={company.id} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};