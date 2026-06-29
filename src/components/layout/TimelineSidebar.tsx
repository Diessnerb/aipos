import React, { useState, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Separator } from '@/components/ui/separator';
import { PermissionAwareNavLink } from '@/components/ui/permission-aware-nav-link';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar
} from '@/components/ui/sidebar';
import CompanyLogo from './CompanyLogo';
import SidebarToggle from './SidebarToggle';
import { SearchTrigger } from '@/components/search/SearchTrigger';
import { CommandPalette } from '@/components/search/CommandPalette';
import { useAuth } from '@/components/AuthProvider';
import { useDisplayName } from '@/hooks/useDisplayName';
import { navigationItems } from '@/config/navigation';
import { useIsMobile } from '@/hooks/use-mobile';
import { useClickOutside } from '@/hooks/useClickOutside';
import {
  Settings,
  LogOut,
  Search,
} from 'lucide-react';

interface TimelineSidebarProps {
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
}

const TimelineSidebar = ({ searchOpen, setSearchOpen }: TimelineSidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { state, setOpen, open } = useSidebar();
  const { signOutPin } = useAuth();
  const { displayName } = useDisplayName();
  const isMobile = useIsMobile();
  const isCollapsed = state === 'collapsed';
  const sidebarRef = useRef<HTMLDivElement>(null);

  const handleLogout = async () => {
    // Always do PIN-only logout (keep Supabase session for data preloading)
    signOutPin();
    navigate('/login', { replace: true });
  };

  // Auto-close sidebar on navigation (mobile only)
  React.useEffect(() => {
    if (isMobile) {
      setOpen(false);
    }
  }, [location.pathname, isMobile, setOpen]);

  // Click outside to close
  useClickOutside(
    sidebarRef,
    () => setOpen(false),
    open
  );

  // Keyboard shortcut for opening search
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);


  return (
    <Sidebar 
      ref={sidebarRef}
      collapsible="offcanvas"
      variant="floating"
      className="fixed left-0 top-0 z-50 transition-transform duration-300 bg-white border-r border-gray-200"
    >
      {/* Header Section */}
      <SidebarHeader className="border-b border-gray-100 p-0 bg-white">
        {/* Expanded Layout: Horizontal arrangement */}
        <div className="flex items-center justify-between h-16 px-4 gap-4 bg-white">
          {/* Logo Container */}
          <div className="flex items-center flex-1 min-w-0">
            <CompanyLogo />
          </div>
          
          {/* Toggle Button - Absolute positioned */}
          <div className="flex-shrink-0">
            <SidebarToggle />
          </div>
        </div>
        
        {/* User Info */}
        <div className="px-4 pb-3 border-t border-gray-100 bg-white">
          <p className="text-sm text-gray-500 font-medium pt-3">
            {displayName}
          </p>
        </div>
      </SidebarHeader>

      {/* Main Content */}
      <SidebarContent className="flex flex-col justify-between h-full py-4 bg-white">
        <div className="flex-1">
          {/* Main Navigation Section */}
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1 px-3">
                {navigationItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild className="w-full">
                      <PermissionAwareNavLink 
                        to={item.url} 
                        className={({ isActive }) => 
                          `flex items-center px-3 py-3 rounded-lg transition-all duration-200 group space-x-3 ${
                            isActive 
                              ? 'bg-gray-100 text-gray-900 font-medium' 
                              : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                          }`
                        }
                      >
                        <item.icon 
                          className="h-6 w-6 flex-shrink-0 text-gray-700 mr-3" 
                          strokeWidth={1.5} 
                        />
                        <span className="font-medium">{item.title}</span>
                      </PermissionAwareNavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </div>

        {/* Footer Section */}
        <SidebarFooter className="flex-shrink-0 px-3 bg-white">
          <Separator className="mb-4 bg-gray-200" />
          
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                {/* Search */}
                <SidebarMenuItem>
                  <SidebarMenuButton asChild className="w-full">
                    <Button
                      variant="ghost"
                      onClick={() => setSearchOpen(true)}
                      className="flex items-center px-3 py-3 rounded-lg transition-all duration-200 text-gray-700 hover:bg-gray-50 hover:text-gray-900 group w-full h-auto justify-start"
                    >
                      <Search 
                        className="h-6 w-6 flex-shrink-0 text-gray-700 mr-3" 
                        strokeWidth={1.5} 
                      />
                      <span className="font-medium">Search</span>
                    </Button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                
                {/* Company Settings */}
                <SidebarMenuItem>
                  <SidebarMenuButton asChild className="w-full">
                    <PermissionAwareNavLink 
                      to="/settings" 
                      requiredPermission="edit"
                      className={({ isActive }) => 
                        `flex items-center px-3 py-3 rounded-lg transition-all duration-200 group justify-start ${
                          isActive 
                            ? 'bg-gray-100 text-gray-900 font-medium' 
                            : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                        }`
                      }
                    >
                      <Settings 
                        className="h-6 w-6 flex-shrink-0 text-gray-700 mr-3" 
                        strokeWidth={1.5} 
                      />
                      <span className="font-medium">Company Settings</span>
                    </PermissionAwareNavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                
                {/* Logout */}
                <SidebarMenuItem>
                  <SidebarMenuButton asChild className="w-full">
                    <Button
                      variant="ghost"
                      onClick={handleLogout}
                      className="flex items-center w-full px-3 py-3 rounded-lg transition-all duration-200 text-gray-700 hover:bg-red-50 hover:text-red-600 group h-auto justify-start"
                    >
                      <LogOut 
                        className="h-6 w-6 flex-shrink-0 mr-3" 
                        strokeWidth={1.5} 
                      />
                      <span className="font-medium">Logout</span>
                    </Button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarFooter>
      </SidebarContent>
    </Sidebar>
  );
};

export default TimelineSidebar;