
import React from 'react';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import AppSidebar from './Sidebar';
import { DataAccessErrorBanner } from '@/components/DataAccessErrorBanner';
import { useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { AlishaOrb } from '@/components/ai/AlishaOrb';

interface LayoutProps {
  children: React.ReactNode;
}

const LayoutContent = ({ children, isTimelineView, isPOSPage }: LayoutProps & { isTimelineView: boolean; isPOSPage: boolean }) => {
  const location = useLocation();
  const isSettingsRoot = location.pathname === "/settings";
  
  // Use plain container for timeline view to avoid sidebar spacing
  if (isTimelineView) {
    return (
      <div className="flex-1 flex flex-col bg-white">
        <DataAccessErrorBanner />
        <main className={cn("flex-1 p-0", isSettingsRoot ? "overflow-hidden" : "overflow-y-auto overflow-x-hidden")}>
          {children}
        </main>
      </div>
    );
  }
  
  return (
    <SidebarInset className="flex-1 flex flex-col w-full">
      <DataAccessErrorBanner />
      <main className={cn("flex-1 w-full", !isPOSPage && "p-6", isSettingsRoot ? "overflow-hidden" : "overflow-y-auto", "overflow-x-hidden")}>
        {children}
      </main>
    </SidebarInset>
  );
};

const Layout = ({ children }: LayoutProps) => {
  const location = useLocation();
  
  // Check if we're on reservations page
  const isReservationsPage = location.pathname === '/reservations';
  
  // Check if we're on POS page
  const isPOSPage = location.pathname === '/pos';
  
  // Get view parameter from URL (defaults to 'timeline' if not present)
  const searchParams = new URLSearchParams(location.search);
  const viewMode = searchParams.get('view') || 'timeline';
  
  // Only hide sidebar for timeline view, show it for list view
  const isTimelineView = isReservationsPage && viewMode === 'timeline';

  return (
    <SidebarProvider
      style={
        {
          ["--sidebar-width-icon" as any]: "4.5rem" // 72px
        } as React.CSSProperties
      }
    >
      <div className="h-screen w-full flex bg-white overflow-hidden">
        {!isTimelineView && <AppSidebar />}
        <LayoutContent isTimelineView={isTimelineView} isPOSPage={isPOSPage}>{children}</LayoutContent>
      </div>
      {/* Alisha AI Assistant - Global floating orb */}
      <AlishaOrb />
    </SidebarProvider>
  );
};

export default Layout;
