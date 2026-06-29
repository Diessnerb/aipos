import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { usePermissionCheck } from '@/hooks/usePermissionCheck';
import { toast } from 'sonner';

interface PermissionAwareNavLinkProps {
  to: string;
  children: React.ReactNode;
  className?: string | ((props: { isActive: boolean }) => string);
  requiredPermission?: 'view' | 'growth' | 'edit' | 'admin';
}

export const PermissionAwareNavLink: React.FC<PermissionAwareNavLinkProps> = ({
  to,
  children,
  className,
  requiredPermission = 'view'
}) => {
  const { checkPermission, isOwner } = usePermissionCheck();
  const navigate = useNavigate();
  const canAccess = checkPermission(to, requiredPermission);
  
  // Debug log for this specific navigation item
  console.log('🔗 NavLink Debug:', { to, canAccess, isOwner, requiredPermission });

  const handleClick = (e: React.MouseEvent) => {
    if (!canAccess) {
      e.preventDefault();
      toast.error('You don\'t have permission to access this page');
      return;
    }
  };

  if (!canAccess) {
    // Render as a disabled div with similar styling
    return (
      <div
        className={typeof className === 'function' 
          ? className({ isActive: false }) + ' opacity-50 cursor-not-allowed' 
          : `${className} opacity-50 cursor-not-allowed`
        }
        onClick={handleClick}
      >
        {children}
      </div>
    );
  }

  // Render normal NavLink if user has permission
  return (
    <NavLink to={to} className={className}>
      {children}
    </NavLink>
  );
};