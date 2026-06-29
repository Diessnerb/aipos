import React, { useState } from 'react';
import { SidebarProvider, SidebarInset, useSidebar } from '@/components/ui/sidebar';
import TimelineSidebarWrapper from './TimelineSidebarWrapper';
import { DataAccessErrorBanner } from '@/components/DataAccessErrorBanner';
import { CommandPalette } from '@/components/search/CommandPalette';

interface TimelineLayoutProps {
  children: React.ReactNode;
}

const TimelineLayoutContent = ({ children }: TimelineLayoutProps) => {
  return (
    <div className="flex-1 flex flex-col w-full h-full">
      <DataAccessErrorBanner />
      <main className="flex-1 min-h-0 overflow-hidden">
        {children}
      </main>
    </div>
  );
};

const TimelineLayout = ({ children }: TimelineLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
      <div className="relative h-screen w-full bg-background overflow-hidden">
        {/* Timeline content - always full width */}
        <div className="w-full h-full">
          <TimelineLayoutContent>{children}</TimelineLayoutContent>
        </div>
        
        {/* Sidebar - floating overlay */}
        <TimelineSidebarWrapper searchOpen={searchOpen} setSearchOpen={setSearchOpen} />
        
        {/* Backdrop when sidebar is open */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/20 z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </div>
      <CommandPalette open={searchOpen} setOpen={setSearchOpen} />
    </SidebarProvider>
  );
};

export default TimelineLayout;