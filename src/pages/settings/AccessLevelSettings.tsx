import React, { useEffect } from 'react';
// Layout is now handled by MainLayout - no need to import
import OwnerPinManagement from '@/components/settings/OwnerPinManagement';
import PagePermissionsMatrix from '@/components/settings/PagePermissionsMatrix';
import PermissionGuard from '@/components/PermissionGuard';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { useNavigate } from 'react-router-dom';

const AccessLevelSettings = () => {
  const navigate = useNavigate();
  // Basic SEO for this settings page
  useEffect(() => {
    document.title = 'Access Level Settings | Company Settings';

    const metaDescId = 'meta-access-levels-desc';
    let meta = document.querySelector(`meta[name="description"]`);
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', 'Manage access level permissions matrix for staff, managers, and admins.');

    const canonicalId = 'canonical-access-levels';
    let link: HTMLLinkElement | null = document.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', window.location.href);
  }, []);

  return (
    <PermissionGuard route="/settings/access-levels" requiredPermission="admin">
      <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/settings')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Settings
            </Button>
          </div>

          <PageHeader 
            title="Access Level Settings" 
            subtitle="Configure page permissions for different user roles and manage owner PIN" 
          />

          {/* Owner Access Notice */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-2 h-2 bg-primary rounded-full mt-1.5" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-foreground mb-1">
                  Owner Access
                </h3>
                <p className="text-sm text-muted-foreground">
                  Users with the <span className="font-medium text-foreground">Owner</span> role have unrestricted access to all pages and features, regardless of the settings below. Owner permissions cannot be limited.
                </p>
              </div>
            </div>
          </div>

          <OwnerPinManagement />

          <main>
            <PagePermissionsMatrix />
        </main>
      </div>
    </PermissionGuard>
  );
};

export default AccessLevelSettings;