import React from 'react';
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
import type { Table } from '@/types/table';

interface DeleteTableConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  table: Table | null;
}

export const DeleteTableConfirmModal: React.FC<DeleteTableConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  table,
}) => {
  if (!table) return null;

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Table</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to remove <strong>Table {table.table_number}</strong>
            {table.table_name && <span> ({table.table_name})</span>}?
            <br /><br />
            This action will hide the table from your restaurant layout. You can reactivate it later if needed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-destructive hover:bg-destructive/90">
            Remove Table
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};