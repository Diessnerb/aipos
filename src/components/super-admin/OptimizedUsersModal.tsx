import React, { useState, useMemo, memo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Shield, ShieldCheck, UserCheck, UserX, Edit, MoreVertical } from 'lucide-react';

interface UserDetail {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_company_admin: boolean;
  is_active: boolean;
  company_id: string;
  company_name: string;
  pin_code: string;
  created_at: string;
  updated_at: string;
  last_login: string;
  remaining_holiday_days: number;
}

interface OptimizedUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: UserDetail[];
  loading: boolean;
}

const UserRow = memo(({ 
  user,
  getRoleIcon,
  getRoleBadgeColor 
}: { 
  user: UserDetail;
  getRoleIcon: (role: string, isCompanyAdmin: boolean) => React.ReactNode;
  getRoleBadgeColor: (role: string, isCompanyAdmin: boolean) => string;
}) => (
  <TableRow key={user.id}>
    <TableCell>
      <div>
        <div className="font-medium">{user.full_name}</div>
        <div className="text-sm text-muted-foreground">{user.email}</div>
      </div>
    </TableCell>
    <TableCell>{user.company_name || 'No Company'}</TableCell>
    <TableCell>
      <div className="flex items-center gap-2">
        {getRoleIcon(user.role, user.is_company_admin)}
        <Badge variant="secondary" className={getRoleBadgeColor(user.role, user.is_company_admin)}>
          {user.is_company_admin ? 'Company Admin' : user.role}
        </Badge>
      </div>
    </TableCell>
    <TableCell>
      <Badge variant={user.is_active ? 'default' : 'secondary'}>
        {user.is_active ? 'Active' : 'Inactive'}
      </Badge>
    </TableCell>
    <TableCell className="text-sm">
      {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
    </TableCell>
    <TableCell className="font-mono text-sm">{user.pin_code || 'N/A'}</TableCell>
    <TableCell>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>
            <Edit className="h-4 w-4 mr-2" />
            Edit User
          </DropdownMenuItem>
          <DropdownMenuItem>
            {user.is_active ? (
              <>
                <UserX className="h-4 w-4 mr-2" />
                Deactivate
              </>
            ) : (
              <>
                <UserCheck className="h-4 w-4 mr-2" />
                Reactivate
              </>
            )}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </TableCell>
  </TableRow>
));

UserRow.displayName = 'UserRow';

export const OptimizedUsersModal: React.FC<OptimizedUsersModalProps> = memo(({
  isOpen,
  onClose,
  users,
  loading
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('name');

  const getRoleIcon = useMemo(() => (role: string, isCompanyAdmin: boolean) => {
    if (isCompanyAdmin) return <ShieldCheck className="h-4 w-4 text-blue-600" />;
    switch (role) {
      case 'admin': return <Shield className="h-4 w-4 text-red-600" />;
      case 'manager': return <UserCheck className="h-4 w-4 text-green-600" />;
      default: return <UserCheck className="h-4 w-4 text-gray-600" />;
    }
  }, []);

  const getRoleBadgeColor = useMemo(() => (role: string, isCompanyAdmin: boolean) => {
    if (isCompanyAdmin) return 'text-blue-600 bg-blue-100';
    switch (role) {
      case 'admin': return 'text-red-600 bg-red-100';
      case 'manager': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  }, []);

  const uniqueCompanies = useMemo(() => {
    const companies = Array.from(new Set(users.map(user => user.company_name).filter(Boolean)));
    return companies.sort();
  }, [users]);

  const filteredUsers = useMemo(() => {
    return users
      .filter(user => {
        const matchesSearch = user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            user.email.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesRole = roleFilter === 'all' || 
                           (roleFilter === 'company_admin' && user.is_company_admin) ||
                           (roleFilter !== 'company_admin' && user.role === roleFilter);
        const matchesCompany = companyFilter === 'all' || user.company_name === companyFilter;
        const matchesStatus = statusFilter === 'all' || 
                            (statusFilter === 'active' && user.is_active) ||
                            (statusFilter === 'inactive' && !user.is_active);
        return matchesSearch && matchesRole && matchesCompany && matchesStatus;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'name':
            return a.full_name.localeCompare(b.full_name);
          case 'email':
            return a.email.localeCompare(b.email);
          case 'company':
            return (a.company_name || '').localeCompare(b.company_name || '');
          case 'role':
            return a.role.localeCompare(b.role);
          case 'created':
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          default:
            return 0;
        }
      });
  }, [users, searchTerm, roleFilter, companyFilter, statusFilter, sortBy]);

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-7xl">
          <DialogHeader>
            <DialogTitle>Users</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center py-8">
            <LoadingSpinner size="lg" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl">
        <DialogHeader>
          <DialogTitle>Users ({filteredUsers.length})</DialogTitle>
        </DialogHeader>
        
        <div className="flex gap-4 mb-4 flex-wrap">
          <Input
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 min-w-[200px]"
          />
          
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="company_admin">Company Admin</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="manager">Manager</SelectItem>
              <SelectItem value="staff">Staff</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={companyFilter} onValueChange={setCompanyFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by company" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Companies</SelectItem>
              {uniqueCompanies.map((company) => (
                <SelectItem key={company} value={company}>
                  {company}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="company">Company</SelectItem>
              <SelectItem value="role">Role</SelectItem>
              <SelectItem value="created">Created Date</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="max-h-96 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name & Email</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead>PIN</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    getRoleIcon={getRoleIcon}
                    getRoleBadgeColor={getRoleBadgeColor}
                  />
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No users found matching your criteria.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
});

OptimizedUsersModal.displayName = 'OptimizedUsersModal';