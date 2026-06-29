import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MetricCard } from '@/components/ui/metric-card';
import { MetricCardSkeleton } from '@/components/ui/metric-card-skeleton';
import { Button } from '@/components/ui/button';
import { Building2, Users, Shield, Activity, LogOut, PoundSterling, RefreshCw, Zap, AlertTriangle, RotateCcw } from 'lucide-react';
import { RevenueModal } from '@/components/super-admin/RevenueModal';
import { CompanyManagement } from '@/components/super-admin/CompanyManagement';
import { OptimizedCompaniesModal } from '@/components/super-admin/OptimizedCompaniesModal';
import { OptimizedUsersModal } from '@/components/super-admin/OptimizedUsersModal';
import { SystemHealthModal } from '@/components/super-admin/SystemHealthModal';
import { EditCompanyModal } from '@/components/super-admin/EditCompanyModal';
import { CompanyViewDetailsModal } from '@/components/super-admin/CompanyViewDetailsModal';
import { TypewriterLoading } from '@/components/ui/typewriter-loading';
import { useSuperAdmin } from '@/hooks/useSuperAdmin';
import { useSuperAdminDashboardEnhanced } from '@/hooks/useSuperAdminDashboardEnhanced';
import { useCompanies } from '@/hooks/useCompanies';
import { formatCurrency } from '@/utils/currencyFormatter';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

const SuperAdminDashboard = () => {
  const { isSuperAdmin, loading: authLoading, resetAuthState } = useSuperAdmin();
  const {
    detailedMetrics,
    companies,
    users,
    systemHealth,
    loading,
    isRefreshing,
    error,
    forceRefresh,
    requestErrors
  } = useSuperAdminDashboardEnhanced();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { updateCompanyStatus } = useCompanies();

  // Modal states with reset mechanism
  const [companiesModalOpen, setCompaniesModalOpen] = useState(false);
  const [usersModalOpen, setUsersModalOpen] = useState(false);
  const [systemHealthModalOpen, setSystemHealthModalOpen] = useState(false);
  const [revenueModalOpen, setRevenueModalOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [editingCompany, setEditingCompany] = useState<any>(null);
  const [viewingCompany, setViewingCompany] = useState<any>(null);
  const [operationInProgress, setOperationInProgress] = useState(false);

  const handleSignOut = async () => {
    try {
      setOperationInProgress(true);
      await supabase.auth.signOut();
      navigate('/super-admin-login'); // Fixed: Redirect to super admin login instead of owner login
      toast({
        title: "Signed out",
        description: "You have been signed out successfully",
      });
    } catch (error) {
      console.error('Error signing out:', error);
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive",
      });
    } finally {
      setOperationInProgress(false);
    }
  };

  // Reset all modal states when critical operations occur
  const resetModalStates = () => {
    setCompaniesModalOpen(false);
    setUsersModalOpen(false);
    setSystemHealthModalOpen(false);
    setRevenueModalOpen(false);
    setSelectedCompany(null);
  };

  // Simplified company change handler - no heavy operations needed for modal updates
  const handleCompanyChange = () => {
    resetModalStates();
    // Just refresh data, no need for auth state reset
    forceRefresh();
  };

  // Emergency reset function
  const handleEmergencyReset = () => {
    setOperationInProgress(true);
    resetModalStates();
    forceRefresh();
    
    setTimeout(() => {
      setOperationInProgress(false);
      toast({
        title: "Dashboard Reset",
        description: "All data has been refreshed and cache cleared",
      });
    }, 100);
  };

  const handleEditCompany = (company: any) => {
    setCompaniesModalOpen(false);
    setEditingCompany(company);
  };

  const handleToggleStatus = async (company: any) => {
    const newStatus = company.status === 'active' ? 'inactive' : 'active';
    await updateCompanyStatus(company.id, newStatus);
    forceRefresh();
  };

  const handleViewCompany = (company: any) => {
    setViewingCompany(company);
  };

  // Performance indicator
  const performanceStatus = useMemo(() => {
    const hasErrors = Object.values(requestErrors).some(Boolean);
    if (hasErrors) return { status: 'degraded', color: 'text-yellow-600' };
    return { status: 'healthy', color: 'text-green-600' };
  }, [requestErrors]);

  // Show loading skeletons instead of blocking the entire UI
  const showSkeletons = loading && !detailedMetrics;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <TypewriterLoading />
      </div>
    );
  }

  if (!user || !isSuperAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <Shield className="h-12 w-12 text-muted-foreground mx-auto" />
              <h2 className="text-xl font-semibold">Access Denied</h2>
              <p className="text-muted-foreground">
                You don't have permission to access this area.
              </p>
              <Button onClick={() => navigate('/')}>
                Return to Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Shield className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold">Super Admin Dashboard</h1>
                <p className="text-sm text-muted-foreground">
                  Platform management console
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <div className="text-sm font-medium">{user.email}</div>
                <div className="text-xs text-muted-foreground">Super Administrator</div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Stats Overview */}
          {error && (
            <Card className="border-destructive">
              <CardContent className="pt-6">
                <div className="text-center space-y-2">
                  <p className="text-destructive">Failed to load dashboard metrics</p>
                  <Button variant="outline" size="sm" onClick={forceRefresh}>
                    Retry
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Action buttons and status */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={forceRefresh}
                disabled={loading || operationInProgress}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing || operationInProgress ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleEmergencyReset}
                disabled={operationInProgress}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset Dashboard
              </Button>
              
              {detailedMetrics && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Zap className="h-4 w-4" />
                  <span>Last updated: {new Date(detailedMetrics.timestamp).toLocaleTimeString()}</span>
                </div>
              )}
            </div>
            
            {/* Performance status indicator */}
            <div className="flex items-center gap-2">
              <div className={`flex items-center gap-2 text-sm ${performanceStatus.color}`}>
                <div className="w-2 h-2 rounded-full bg-current"></div>
                <span className="capitalize">{performanceStatus.status}</span>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            {showSkeletons ? (
              <>
                <MetricCardSkeleton />
                <MetricCardSkeleton />
                <MetricCardSkeleton />
                <MetricCardSkeleton />
              </>
            ) : (
              <>
                <MetricCard
                  title="Total Companies"
                  value={detailedMetrics?.companies.total ?? 0}
                  description={detailedMetrics ? 
                    `${detailedMetrics.companies.active} active, ${detailedMetrics.companies.inactive} inactive` :
                    'Active companies in platform'
                  }
                  clickText="Click to view details →"
                  icon={<Building2 className="h-4 w-4 text-muted-foreground" />}
                  onClick={() => !operationInProgress && setCompaniesModalOpen(true)}
                  isLoading={loading && !detailedMetrics}
                  isRefreshing={isRefreshing}
                  disabled={operationInProgress}
                  className="group"
                />
                
                <MetricCard
                  title="Active Users"
                  value={detailedMetrics?.users.active ?? 0}
                  description={detailedMetrics ? 
                    `${detailedMetrics.users.company_admins} admins, ${detailedMetrics.users.regular_users} staff` :
                    'Total registered users'
                  }
                  clickText="Click to manage users →"
                  icon={<Users className="h-4 w-4 text-muted-foreground" />}
                  onClick={() => !operationInProgress && setUsersModalOpen(true)}
                  isLoading={loading && !detailedMetrics}
                  isRefreshing={isRefreshing}
                  disabled={operationInProgress}
                  className="group"
                />
                
                <MetricCard
                  title="System Health"
                  value={`${detailedMetrics?.system_health.uptime_percent ?? '99.9'}%`}
                  description={detailedMetrics ? 
                    `${detailedMetrics.system_health.errors_24h} errors, ${detailedMetrics.system_health.avg_response_ms}ms avg` :
                    'All systems operational'
                  }
                  clickText="Click for full report →"
                  icon={<Activity className="h-4 w-4 text-muted-foreground" />}
                  onClick={() => !operationInProgress && setSystemHealthModalOpen(true)}
                  isLoading={loading && !detailedMetrics}
                  isRefreshing={isRefreshing}
                  disabled={operationInProgress}
                  className="group"
                />
                
                <MetricCard
                  title="Monthly Revenue"
                  value={formatCurrency(detailedMetrics?.revenue.monthly || 0)}
                  description={detailedMetrics ? 
                    `${detailedMetrics.orders.monthly} orders, avg ${formatCurrency(detailedMetrics.orders.avg_value)}` :
                    'Current month orders total'
                  }
                  clickText="Click for analytics →"
                  icon={<PoundSterling className="h-4 w-4 text-muted-foreground" />}
                  onClick={() => !operationInProgress && setRevenueModalOpen(true)}
                  isLoading={loading && !detailedMetrics}
                  isRefreshing={isRefreshing}
                  disabled={operationInProgress}
                  className="group"
                />
              </>
            )}
          </div>

          {/* Company Management */}
          <CompanyManagement onCompanyChange={handleCompanyChange} />
        </div>
      </main>

      {/* Interactive Modals */}
      <OptimizedCompaniesModal
        isOpen={companiesModalOpen}
        onClose={() => setCompaniesModalOpen(false)}
        companies={companies}
        onCompanyClick={(company) => {
          setSelectedCompany(company);
          setCompaniesModalOpen(false);
        }}
        onEditCompany={handleEditCompany}
        onToggleStatus={handleToggleStatus}
        onViewCompany={handleViewCompany}
        loading={loading}
      />

      <OptimizedUsersModal
        isOpen={usersModalOpen}
        onClose={() => setUsersModalOpen(false)}
        users={users}
        loading={loading}
      />

      <SystemHealthModal
        isOpen={systemHealthModalOpen}
        onClose={() => setSystemHealthModalOpen(false)}
        systemHealth={systemHealth}
        loading={loading}
      />

      <RevenueModal
        isOpen={revenueModalOpen}
        onClose={() => setRevenueModalOpen(false)}
        detailedMetrics={detailedMetrics}
        companies={companies}
        loading={loading}
      />

      <EditCompanyModal
        company={editingCompany}
        isOpen={!!editingCompany}
        onClose={() => setEditingCompany(null)}
        onUpdate={() => {
          forceRefresh();
          setEditingCompany(null);
        }}
      />

      <CompanyViewDetailsModal
        company={viewingCompany}
        isOpen={!!viewingCompany}
        onClose={() => setViewingCompany(null)}
        onPasswordReset={forceRefresh}
      />
    </div>
  );
};

export default SuperAdminDashboard;