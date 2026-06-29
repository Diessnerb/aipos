
import React, { useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useQueryClient } from '@tanstack/react-query';
import { useUltraFastDataPrefetch } from '@/hooks/useUltraFastDataPrefetch';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useAuth } from '@/components/AuthProvider';
import {
  CalendarDays,
  Users2,
  LayoutGrid,
  BarChart3,
  MoreHorizontal,
  MenuSquare,
  Settings,
  LogOut,
  HelpCircle
} from 'lucide-react';

interface TabItem {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  path: string;
  badge?: number;
  action?: () => void;
}

interface MoreMenuItem {
  label: string;
  icon: React.ComponentType<any>;
  path?: string;
  action?: () => void;
  variant?: 'default' | 'destructive';
}

export const BottomTabBar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { pinUser, signOut, signOutPin } = useAuth();
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);
  const queryClient = useQueryClient();
  const { prefetchTodayInstant } = useUltraFastDataPrefetch();

  // Pre-warm data on hover/touch for instant loading
  const handleReservationsHover = useCallback(() => {
    prefetchTodayInstant();
  }, [prefetchTodayInstant]);

  const handleFloorNavigation = () => {
    navigate('/reservations', { state: { viewMode: 'timeline' } });
  };

  const tabs: TabItem[] = [
    {
      id: 'reservations',
      label: 'Reservations',
      icon: CalendarDays,
      path: '/reservations'
    },
    {
      id: 'customers',
      label: 'Customers',
      icon: Users2,
      path: '/customers'
    },
    {
      id: 'floor',
      label: 'Floor',
      icon: LayoutGrid,
      path: '#',
      action: handleFloorNavigation
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: BarChart3,
      path: '/analytics'
    },
    {
      id: 'more',
      label: 'More',
      icon: MoreHorizontal,
      path: '#'
    }
  ];

  const moreMenuItems: MoreMenuItem[] = [
    {
      label: 'Menu',
      icon: MenuSquare,
      path: '/menu-items'
    },
    {
      label: 'Company Settings',
      icon: Settings,
      path: '/settings'
    },
    {
      label: 'Support',
      icon: HelpCircle,
      action: () => {
        // Add support functionality here
        console.log('Support clicked');
      }
    },
    {
      label: 'Logout',
      icon: LogOut,
      action: async () => {
        // Always do PIN-only logout (keep Supabase session for data preloading)
        signOutPin();
        navigate('/login');
      },
      variant: 'destructive'
    }
  ];

  const handleTabClick = (tab: TabItem) => {
    if (tab.id === 'more') {
      setMoreSheetOpen(true);
    } else if (tab.action) {
      tab.action();
    } else {
      navigate(tab.path);
    }
  };

  const handleMoreItemClick = (item: MoreMenuItem) => {
    if (item.action) {
      item.action();
    } else if (item.path) {
      navigate(item.path);
    }
    setMoreSheetOpen(false);
  };

  const isActiveTab = (path: string, tabId: string) => {
    if (path === '#') {
      if (tabId === 'floor') {
        // Floor tab is active when we're on reservations page in timeline mode
        return location.pathname === '/reservations' && location.state?.viewMode === 'timeline';
      }
      return false;
    }
    
    if (tabId === 'reservations') {
      // Reservations tab is active when we're on reservations page BUT NOT in timeline mode
      return location.pathname === '/reservations' && location.state?.viewMode !== 'timeline';
    }
    
    return location.pathname === path || 
           (path === '/reservations' && location.pathname === '/');
  };

  return (
    <>
      {/* Bottom Tab Bar with Frosted Glass Effect */}
      <div className="fixed bottom-0 left-0 right-0 z-50">
        {/* Frosted Glass Background */}
        <div 
          className="bg-white/70 dark:bg-gray-900/70 backdrop-blur-[12px] rounded-t-2xl shadow-[0_-2px_10px_rgba(0,0,0,0.05)] dark:shadow-[0_-2px_10px_rgba(0,0,0,0.2)]"
          style={{
            borderTop: '1px solid rgba(255,255,255,0.2)'
          }}
        >
          <div className="flex items-center justify-around px-3 py-4 max-w-screen-xl mx-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = isActiveTab(tab.path, tab.id);
              
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab)}
                  onMouseEnter={tab.id === 'reservations' ? handleReservationsHover : undefined}
                  onTouchStart={tab.id === 'reservations' ? handleReservationsHover : undefined}
                  className="flex flex-col items-center justify-center py-2 px-3 transition-all duration-300 ease-out min-w-0 flex-1 relative group"
                >
                  <div className="relative mb-1">
                    <Icon 
                      className={`h-7 w-7 transition-all duration-300 ease-out ${
                        isActive 
                          ? 'text-blue-600 dark:text-blue-400 scale-105' 
                          : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300 group-hover:scale-105'
                      }`}
                      strokeWidth={1.5}
                    />
                    {tab.badge && (
                      <Badge 
                        variant="destructive" 
                        className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs backdrop-blur-sm"
                      >
                        {tab.badge}
                      </Badge>
                    )}
                  </div>
                  <span 
                    className={`text-xs font-medium truncate w-full text-center transition-all duration-300 ease-out ${
                      isActive 
                        ? 'text-blue-600 dark:text-blue-400' 
                        : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300'
                    }`}
                  >
                    {tab.label}
                  </span>
                  {/* Active indicator - thin underline with enhanced styling */}
                  <div 
                    className={`absolute bottom-0 left-1/2 transform -translate-x-1/2 h-0.5 bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-400 dark:to-blue-500 rounded-full transition-all duration-300 ease-out ${
                      isActive ? 'w-8 opacity-100 shadow-sm' : 'w-0 opacity-0'
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* More Menu Sheet with Enhanced Backdrop */}
      <Sheet open={moreSheetOpen} onOpenChange={setMoreSheetOpen}>
        <SheetContent side="bottom" className="h-auto rounded-t-2xl bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-t border-white/20">
          <SheetHeader className="pb-4">
            <SheetTitle className="text-left">More Options</SheetTitle>
          </SheetHeader>
          <div className="grid gap-2 pb-6">
            {moreMenuItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <Button
                  key={index}
                  variant={item.variant === 'destructive' ? 'destructive' : 'ghost'}
                  onClick={() => handleMoreItemClick(item)}
                  className="justify-start h-12 text-left transition-all duration-200 hover:bg-white/50 dark:hover:bg-gray-800/50"
                >
                  <Icon className="h-5 w-5 mr-3" strokeWidth={1.5} />
                  {item.label}
                </Button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};
