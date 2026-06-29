import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Edit, RefreshCw } from 'lucide-react';

interface User {
  id: string;
  full_name: string;
  email: string;
  role: string;
  pin_code: string | null;
  is_company_admin: boolean;
}

interface CompanyUsersManagementProps {
  companyId: string;
}

export const CompanyUsersManagement: React.FC<CompanyUsersManagementProps> = ({ companyId }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPin, setEditingPin] = useState<{ userId: string; currentPin: string } | null>(null);
  const [newPin, setNewPin] = useState('');
  const [newUser, setNewUser] = useState({
    full_name: '',
    role: 'staff',
    pin_code: ''
  });
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const { toast } = useToast();

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('company_id', companyId)
        .order('full_name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: "Error",
        description: "Failed to fetch users",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (companyId) {
      fetchUsers();
    }
  }, [companyId]);

  const generatePin = async () => {
    try {
      const { data, error } = await supabase.rpc('generate_unique_pin');
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error generating PIN:', error);
      return Math.floor(1000 + Math.random() * 9000).toString();
    }
  };

  const handleUpdatePin = async (userId: string, pin: string) => {
    try {
      const { data, error } = await supabase.rpc('update_user_pin', {
        p_user_id: userId,
        p_new_pin: pin
      });

      if (error) throw error;

      if (data && typeof data === 'object' && 'success' in data && !data.success) {
        throw new Error((data as any).error);
      }

      toast({
        title: "Success",
        description: "PIN updated successfully"
      });

      fetchUsers();
      setEditingPin(null);
      setNewPin('');
    } catch (error) {
      console.error('Error updating PIN:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update PIN",
        variant: "destructive"
      });
    }
  };

  const handleCreateUser = async () => {
    try {
      setIsCreatingUser(true);
      
      let pin = newUser.pin_code;
      if (!pin) {
        pin = await generatePin();
      }

      // Type assertion until Supabase types regenerate after migration
      const { data, error } = await supabase.rpc('create_pin_user_with_role' as any, {
        p_full_name: newUser.full_name,
        p_role: newUser.role,
        p_pin_code: pin,
        p_company_id: companyId
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "User created successfully"
      });

      setNewUser({ full_name: '', role: 'staff', pin_code: '' });
      fetchUsers();
    } catch (error) {
      console.error('Error creating user:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create user",
        variant: "destructive"
      });
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleGenerateNewPin = async () => {
    const pin = await generatePin();
    setNewPin(pin);
  };

  if (loading) {
    return <div className="p-4">Loading users...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Company Users</CardTitle>
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="full_name">Full Name</Label>
                  <Input
                    id="full_name"
                    value={newUser.full_name}
                    onChange={(e) => setNewUser(prev => ({ ...prev, full_name: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="role">Role</Label>
                  <Select value={newUser.role} onValueChange={(value) => setNewUser(prev => ({ ...prev, role: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="owner" disabled>Owner (Cannot create additional owners)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="pin_code">PIN Code (4 digits)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="pin_code"
                      value={newUser.pin_code}
                      onChange={(e) => setNewUser(prev => ({ ...prev, pin_code: e.target.value }))}
                      placeholder="Leave empty to auto-generate"
                      maxLength={4}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={async () => {
                        const pin = await generatePin();
                        setNewUser(prev => ({ ...prev, pin_code: pin }));
                      }}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Button onClick={handleCreateUser} disabled={isCreatingUser || !newUser.full_name} className="w-full">
                  {isCreatingUser ? 'Creating...' : 'Create User'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>PIN</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    {user.full_name}
                    {user.role === 'owner' && (
                      <Badge variant="default" className="ml-2">👑 Owner</Badge>
                    )}
                    {user.is_company_admin && user.role !== 'owner' && (
                      <Badge variant="secondary" className="ml-2">Admin</Badge>
                    )}
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{user.role}</Badge>
                  </TableCell>
                  <TableCell>
                    {user.pin_code ? (
                      <Badge variant="secondary" className="gap-1">
                        <span className="text-green-600">✓</span> PIN Set
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1">
                        <span className="text-muted-foreground">○</span> No PIN
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingPin({ userId: user.id, currentPin: user.pin_code || '' });
                            setNewPin(user.pin_code || '');
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Edit PIN for {user.full_name}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="bg-amber-50 dark:bg-amber-950/20 p-3 rounded-lg">
                            <p className="text-sm text-amber-800 dark:text-amber-200">
                              ⚠️ This will generate a new PIN for {user.full_name}. 
                              The PIN will only be shown once - make sure to save it!
                            </p>
                          </div>
                          <div>
                            <Label htmlFor="new_pin">New PIN (4 digits)</Label>
                            <div className="flex gap-2">
                              <Input
                                id="new_pin"
                                value={newPin}
                                onChange={(e) => setNewPin(e.target.value)}
                                maxLength={4}
                                pattern="[0-9]{4}"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                onClick={handleGenerateNewPin}
                              >
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <Button
                            onClick={() => {
                              handleUpdatePin(user.id, newPin);
              toast({
                title: "PIN Updated",
                description: `New PIN for ${user.full_name}: ${newPin}. Copy this now!`,
                duration: 2000
              });
                            }}
                            disabled={!newPin || newPin.length !== 4}
                            className="w-full"
                          >
                            Update PIN (Show Once)
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};