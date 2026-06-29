
import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Reservation } from '@/types/reservation';
import { useStatusConfig } from '@/contexts/StatusConfigContext';

interface ReservationStatusPillProps {
  status: Reservation['status'];
  onStatusChange: (status: Reservation['status']) => void;
  isEditable?: boolean;
}

export const ReservationStatusPill: React.FC<ReservationStatusPillProps> = ({
  status,
  onStatusChange,
  isEditable = true,
}) => {
  const { statusConfig } = useStatusConfig();
  const config = statusConfig[status] || statusConfig.pending;

  if (!isEditable) {
    return (
      <Badge className={`${config.color} border font-medium`}>
        {config.label}
      </Badge>
    );
  }

  return (
    <Select value={status} onValueChange={onStatusChange}>
      <SelectTrigger className={`w-auto border-0 h-auto p-1 ${config.color} font-medium`}>
        <SelectValue>
          <Badge className={`${config.color} border-0`}>
            {config.label}
          </Badge>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {Object.entries(statusConfig).map(([key, { label, color }]) => (
          <SelectItem key={key} value={key}>
            <Badge className={`${color} border font-medium`}>
              {label}
            </Badge>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
