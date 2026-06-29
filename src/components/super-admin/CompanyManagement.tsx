import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Building2, Users, MoreHorizontal, Trash2, Edit, AlertTriangle, Key } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCompanies } from '@/hooks/useCompanies';
import { useCompanyFeatures } from '@/hooks/useCompanyFeatures';
import { supabase } from '@/integrations/supabase/client';
import { CreateCompanyModal } from './CreateCompanyModal';
import { EditCompanyModal } from './EditCompanyModal';
import { ApiAccessManagement } from './ApiAccessManagement';
import { FeatureManagementModal } from './FeatureManagementModal';
import { ErrorBoundaryWrapper } from '@/components/ErrorBoundaryWrapper';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface CompanyManagementProps {
  onCompanyChange?: () => void;
}

export const CompanyManagement = ({ onCompanyChange }: CompanyManagementProps = {}) => {
  const { companies, loading, updateCompanyStatus, deleteCompany, refetch } = useCompanies();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<string | null>(null);
  const [deletingCompanies, setDeletingCompanies] = useState<Set<string>>(new Set());
  const [featureManagementCompany, setFeatureManagementCompany] = useState<{ id: string; name: string } | null>(null);
  const [selectedCompanyForApi, setSelectedCompanyForApi] = useState<string | null>(null);

  // Removed CompanyFeatureToggler - now using FeatureManagementModal

  const handleStatusToggle = async (companyId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    await updateCompanyStatus(companyId, newStatus);
  };

  const handleDeleteCompany = async (companyId: string) => {
    // Prevent multiple simultaneous deletions
    if (deletingCompanies.has(companyId)) {
      toast.error('Deletion already in progress');
      return;
    }

    // Close dialog immediately to keep UI interactive
    setDeleteDialogOpen(null);
    
    // Add company to deleting state
    setDeletingCompanies(prev => new Set([...prev, companyId]));
    
    // Show toast to indicate deletion started
    toast.info('Deleting company... This may take a moment');
    
    // Run deletion with timeout protection
    const timeoutId = setTimeout(() => {
      toast.error('Deletion timeout - please refresh and try again');
      setDeletingCompanies(prev => {
        const newSet = new Set(prev);
        newSet.delete(companyId);
        return newSet;
      });
    }, 30000); // 30 second timeout

    try {
      const result = await deleteCompany(companyId);
      clearTimeout(timeoutId);
      
      if (result.success) {
        // Refresh the company list after successful deletion
        await refetch();
        onCompanyChange?.();
      }
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('Delete company error:', error);
      toast.error('Failed to delete company - see console for details');
    } finally {
      // Remove from deleting state regardless of success/failure
      setDeletingCompanies(prev => {
        const newSet = new Set(prev);
        newSet.delete(companyId);
        return newSet;
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading companies...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Company Management</h2>
          <p className="text-muted-foreground">
            Manage restaurant tenants and their access
          </p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Company
        </Button>
      </div>

{companies.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No companies yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first restaurant tenant to get started
            </p>
            <Button onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add First Company
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.map((company) => {
                const isDeleting = deletingCompanies.has(company.id);
                return (
                  <React.Fragment key={company.id}>
                    <TableRow className={isDeleting ? "opacity-60" : ""}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {company.name}
                          {isDeleting && (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-destructive"></div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{company.default_admin_email || 'Not set'}</TableCell>
                      <TableCell>{new Date(company.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>{new Date(company.updated_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge variant={company.status === 'active' ? 'default' : 'secondary'}>
                          {company.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" disabled={isDeleting}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-background">
                            <DropdownMenuItem 
                              onClick={() => setEditingCompany(company)}
                              disabled={isDeleting}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Edit & Manage Users
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => setFeatureManagementCompany({ id: company.id, name: company.name })}
                              disabled={isDeleting}
                            >
                              Manage Features
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => setSelectedCompanyForApi(
                                selectedCompanyForApi === company.id ? null : company.id
                              )}
                              disabled={isDeleting}
                            >
                              <Key className="mr-2 h-4 w-4" />
                              {selectedCompanyForApi === company.id ? 'Hide' : 'API'} Access
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleStatusToggle(company.id, company.status)}
                              disabled={isDeleting}
                            >
                              {company.status === 'active' ? 'Deactivate' : 'Activate'}
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => setDeleteDialogOpen(company.id)}
                              className="text-destructive"
                              disabled={isDeleting}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                    
                    {selectedCompanyForApi === company.id && (
                      <TableRow>
                        <TableCell colSpan={6} className="bg-muted/30">
                          <div className="p-4">
                            <ErrorBoundaryWrapper
                              onError={(error) => {
                                console.error('ApiAccessManagement error:', error);
                                toast.error('API access management component encountered an error');
                              }}
                            >
                              <ApiAccessManagement companyId={company.id} companyName={company.name} />
                            </ErrorBoundaryWrapper>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <CreateCompanyModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        onCompanyCreated={() => {
          refetch();
          onCompanyChange?.();
        }}
      />

      <EditCompanyModal
        company={editingCompany}
        isOpen={!!editingCompany}
        onClose={() => setEditingCompany(null)}
        onUpdate={() => {
          refetch();
          setEditingCompany(null);
        }}
      />

      {/* Feature Management Modal */}
      {featureManagementCompany && (
        <FeatureManagementModal
          isOpen={true}
          onClose={() => setFeatureManagementCompany(null)}
          companyId={featureManagementCompany.id}
          companyName={featureManagementCompany.name}
        />
      )}

      <AlertDialog open={!!deleteDialogOpen} onOpenChange={() => setDeleteDialogOpen(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Company</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this company? This action cannot be undone and will remove all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDialogOpen && handleDeleteCompany(deleteDialogOpen)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};