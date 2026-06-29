import React, { useState, useMemo, memo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Eye, Edit, ToggleLeft, ToggleRight } from 'lucide-react';

interface CompanyDetail {
  id: string;
  name: string;
  subdomain: string;
  status: string;
  default_admin_email: string;
  created_at: string;
  updated_at: string;
  user_count: number;
  active_user_count: number;
  order_count: number;
  monthly_revenue: number;
  last_activity: string;
}

interface OptimizedCompaniesModalProps {
  isOpen: boolean;
  onClose: () => void;
  companies: CompanyDetail[];
  onCompanyClick: (company: CompanyDetail) => void;
  onEditCompany?: (company: CompanyDetail) => void;
  onToggleStatus?: (company: CompanyDetail) => void;
  onViewCompany?: (company: CompanyDetail) => void;
  loading: boolean;
}

const CompanyRow = memo(({ 
  company, 
  onCompanyClick,
  onEditCompany,
  onToggleStatus,
  onViewCompany,
  getStatusColor 
}: { 
  company: CompanyDetail; 
  onCompanyClick: (company: CompanyDetail) => void;
  onEditCompany?: (company: CompanyDetail) => void;
  onToggleStatus?: (company: CompanyDetail) => void;
  onViewCompany?: (company: CompanyDetail) => void;
  getStatusColor: (status: string) => string;
}) => (
  <TableRow 
    key={company.id}
    className="cursor-pointer hover:bg-muted/50"
    onClick={() => onCompanyClick(company)}
  >
    <TableCell className="font-medium">{company.name}</TableCell>
    <TableCell>
      <Badge variant="secondary" className={getStatusColor(company.status)}>
        {company.status}
      </Badge>
    </TableCell>
    <TableCell>
      {company.active_user_count}/{company.user_count}
    </TableCell>
    <TableCell>${company.monthly_revenue?.toFixed(2) || '0.00'}</TableCell>
    <TableCell>
      {company.last_activity ? new Date(company.last_activity).toLocaleDateString() : 'N/A'}
    </TableCell>
    <TableCell>
      <div className="flex space-x-2">
        <Button 
          size="sm" 
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            onViewCompany?.(company);
          }}
        >
          <Eye className="h-4 w-4" />
        </Button>
        <Button 
          size="sm" 
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            onEditCompany?.(company);
          }}
        >
          <Edit className="h-4 w-4" />
        </Button>
        <Button 
          size="sm" 
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            onToggleStatus?.(company);
          }}
        >
          {company.status === 'active' ? (
            <ToggleRight className="h-4 w-4 text-green-600" />
          ) : (
            <ToggleLeft className="h-4 w-4 text-gray-400" />
          )}
        </Button>
      </div>
    </TableCell>
  </TableRow>
));

CompanyRow.displayName = 'CompanyRow';

export const OptimizedCompaniesModal: React.FC<OptimizedCompaniesModalProps> = memo(({
  isOpen,
  onClose,
  companies,
  onCompanyClick,
  onEditCompany,
  onToggleStatus,
  onViewCompany,
  loading
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('name');

  const getStatusColor = useMemo(() => (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100';
      case 'inactive': return 'text-red-600 bg-red-100';
      case 'suspended': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  }, []);

  const filteredCompanies = useMemo(() => {
    return companies
      .filter(company => {
        const matchesSearch = company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            company.subdomain?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            company.default_admin_email?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'all' || company.status === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'name':
            return a.name.localeCompare(b.name);
          case 'users':
            return b.user_count - a.user_count;
          case 'revenue':
            return b.monthly_revenue - a.monthly_revenue;
          case 'created':
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          default:
            return 0;
        }
      });
  }, [companies, searchTerm, statusFilter, sortBy]);

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>Companies</DialogTitle>
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
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle>Companies ({filteredCompanies.length})</DialogTitle>
        </DialogHeader>
        
        <div className="flex gap-4 mb-4">
          <Input
            placeholder="Search companies..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1"
          />
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="users">User Count</SelectItem>
              <SelectItem value="revenue">Revenue</SelectItem>
              <SelectItem value="created">Created Date</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="max-h-96 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Users</TableHead>
                <TableHead>Monthly Revenue</TableHead>
                <TableHead>Last Activity</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCompanies.length > 0 ? (
                filteredCompanies.map((company) => (
                  <CompanyRow
                    key={company.id}
                    company={company}
                    onCompanyClick={onCompanyClick}
                    onEditCompany={onEditCompany}
                    onToggleStatus={onToggleStatus}
                    onViewCompany={onViewCompany}
                    getStatusColor={getStatusColor}
                  />
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No companies found matching your criteria.
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

OptimizedCompaniesModal.displayName = 'OptimizedCompaniesModal';