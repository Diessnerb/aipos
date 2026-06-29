import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RotateCcw, Key, Shield, User, Crown, PenTool } from 'lucide-react';
import { format } from 'date-fns';

interface DeletedTeamMember {
  id: string;
  full_name: string;
  email: string;
  role: string;
  created_at: string;
  auth_user_id: string | null;
  pin_code: string | null;
  is_active: boolean;
  deleted_at: string | null;
}

interface DeletedUsersTableProps {
  members: DeletedTeamMember[];
  onReactivateMember: (memberId: string) => void;
  loading: boolean;
}

const DeletedUsersTable = ({ 
  members, 
  onReactivateMember, 
  loading
}: DeletedUsersTableProps) => {
  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Crown className="w-4 h-4" />;
      case 'manager':
        return <PenTool className="w-4 h-4" />;
      case 'staff':
        return <User className="w-4 h-4" />;
      default:
        return <User className="w-4 h-4" />;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'manager':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'staff':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getAccessTypeInfo = (member: DeletedTeamMember) => {
    if (member.pin_code && !member.auth_user_id) {
      return {
        type: 'PIN Only',
        icon: <Key className="w-4 h-4" />,
        color: 'bg-purple-100 text-purple-800 border-purple-200'
      };
    } else if (member.auth_user_id) {
      return {
        type: 'Full Access',
        icon: <Shield className="w-4 h-4" />,
        color: 'bg-green-100 text-green-800 border-green-200'
      };
    } else {
      return {
        type: 'No Access',
        icon: <User className="w-4 h-4" />,
        color: 'bg-gray-100 text-gray-800 border-gray-200'
      };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Loading deleted team members...</p>
        </div>
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="text-center p-8">
        <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No deleted team members</h3>
        <p className="text-gray-500">All your team members are currently active.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Access Type</TableHead>
            <TableHead>Deleted On</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((member) => {
            const accessInfo = getAccessTypeInfo(member);
            
            return (
              <TableRow key={member.id} className="opacity-60">
                <TableCell className="font-medium">
                  {member.full_name}
                  <Badge variant="outline" className="ml-2 bg-red-50 text-red-600 border-red-200">
                    Deleted
                  </Badge>
                </TableCell>
                <TableCell className="text-gray-600">
                  {member.email}
                </TableCell>
                <TableCell>
                  <Badge 
                    variant="outline" 
                    className={`flex items-center gap-1 w-fit ${getRoleBadgeColor(member.role)}`}
                  >
                    {getRoleIcon(member.role)}
                    {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge 
                    variant="outline" 
                    className={`flex items-center gap-1 w-fit ${accessInfo.color}`}
                  >
                    {accessInfo.icon}
                    {accessInfo.type}
                  </Badge>
                </TableCell>
                <TableCell className="text-gray-600">
                  {member.deleted_at ? format(new Date(member.deleted_at), 'MMM d, yyyy') : 'Unknown'}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onReactivateMember(member.id)}
                    className="text-green-600 hover:text-green-700"
                  >
                    <RotateCcw className="w-4 h-4 mr-1" />
                    Reactivate
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

export default DeletedUsersTable;