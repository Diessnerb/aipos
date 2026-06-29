import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  Menu, 
  Home, 
  Calendar, 
  Users, 
  ChefHat, 
  BarChart3, 
  Settings,
  ClipboardList,
  MessageSquare,
  ShoppingCart,
  UserCheck,
  FileText,
  Utensils,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavigationItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const navigationItems: NavigationItem[] = [
  {
    name: 'Dashboard',
    path: '/',
    icon: Home,
    description: 'Overview and analytics'
  },
  {
    name: 'Reservations',
    path: '/reservations',
    icon: Calendar,
    description: 'Manage bookings'
  },
  {
    name: 'Customers',
    path: '/customers',
    icon: Users,
    description: 'Customer management'
  },
  {
    name: 'Menu',
    path: '/menu-items',
    icon: Utensils,
    description: 'Menu configuration'
  },
  {
    name: 'Marketing',
    path: '/marketing',
    icon: MessageSquare,
    description: 'Marketing campaigns'
  },
  {
    name: 'Analytics',
    path: '/analytics',
    icon: BarChart3,
    description: 'Business insights'
  },
  {
    name: 'Settings',
    path: '/settings',
    icon: Settings,
    description: 'App configuration'
  }
];

export const NavigationSidebar: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  const handleNavigate = (path: string) => {
    navigate(path);
  };

  const isActivePath = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div
      className={cn(
        "fixed left-0 top-0 h-full z-40 bg-background border-r border-border transition-all duration-300 ease-in-out",
        isCollapsed ? "w-14" : "w-64"
      )}
    >
      {/* Toggle Button */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        {!isCollapsed && (
          <h2 className="text-sm font-semibold text-foreground">Navigation</h2>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          className="h-8 w-8 p-0 hover:bg-accent"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Navigation Items */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="space-y-1">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = isActivePath(item.path);
            
            return (
              <Button
                key={item.path}
                variant="ghost"
                className={cn(
                  "w-full transition-all duration-200",
                  isCollapsed 
                    ? "h-10 w-10 p-0 justify-center" 
                    : "h-auto p-3 justify-start",
                  isActive 
                    ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                    : "hover:bg-accent hover:text-accent-foreground"
                )}
                onClick={() => handleNavigate(item.path)}
                title={isCollapsed ? item.name : undefined}
              >
                {isCollapsed ? (
                  <Icon className={cn(
                    "h-5 w-5",
                    isActive ? "text-primary-foreground" : "text-muted-foreground"
                  )} />
                ) : (
                  <div className="flex items-center space-x-3 w-full">
                    <Icon className={cn(
                      "h-5 w-5 flex-shrink-0",
                      isActive ? "text-primary-foreground" : "text-muted-foreground"
                    )} />
                    <div className="flex-1 min-w-0 text-left">
                      <div className={cn(
                        "font-medium text-sm",
                        isActive ? "text-primary-foreground" : "text-foreground"
                      )}>
                        {item.name}
                      </div>
                      <div className={cn(
                        "text-xs",
                        isActive ? "text-primary-foreground/80" : "text-muted-foreground"
                      )}>
                        {item.description}
                      </div>
                    </div>
                  </div>
                )}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      {!isCollapsed && (
        <div className="p-3 border-t border-border">
          <div className="text-xs text-muted-foreground text-center">
            Restaurant Management System
          </div>
        </div>
      )}
    </div>
  );
};