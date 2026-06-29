import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, Power, Clock } from "lucide-react";
import { useTableServiceSchedules } from "@/hooks/useTableServiceSchedules";
import { formatDistanceToNow } from "date-fns";

const TableServiceNotifications = () => {
  const { tablesRequiringAttention, loading, resolveServiceSchedule } = useTableServiceSchedules();

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Service Notifications
          </CardTitle>
          <CardDescription>Loading notifications...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (tablesRequiringAttention.length === 0) {
    return null;
  }

  return (
    <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-900 dark:text-amber-100">
          <Bell className="h-5 w-5" />
          Tables Requiring Attention
        </CardTitle>
        <CardDescription className="text-amber-700 dark:text-amber-300">
          {tablesRequiringAttention.length} {tablesRequiringAttention.length === 1 ? 'table needs' : 'tables need'} your attention
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {tablesRequiringAttention.map((table) => (
          <div
            key={table.schedule_id}
            className="flex items-center justify-between gap-4 p-4 rounded-lg border bg-card"
          >
            <div className="flex-1">
              <div className="font-semibold">
                Table {table.table_number}
                {table.table_name && <span className="text-muted-foreground ml-2">({table.table_name})</span>}
              </div>
              <div className="text-sm text-muted-foreground">
                Out of service for {formatDistanceToNow(new Date(table.scheduled_at), { addSuffix: false })}
                {table.scheduled_end && (
                  <span> • Expected back: {formatDistanceToNow(new Date(table.scheduled_end), { addSuffix: true })}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => resolveServiceSchedule(table.schedule_id, 'turn_on')}
                className="gap-2"
              >
                <Power className="h-4 w-4" />
                Turn On
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => resolveServiceSchedule(table.schedule_id, 'extend', 1)}
                className="gap-2"
              >
                <Clock className="h-4 w-4" />
                +1 Day
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => resolveServiceSchedule(table.schedule_id, 'extend', 3)}
                className="gap-2"
              >
                <Clock className="h-4 w-4" />
                +3 Days
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => resolveServiceSchedule(table.schedule_id, 'extend', 7)}
                className="gap-2"
              >
                <Clock className="h-4 w-4" />
                +7 Days
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default TableServiceNotifications;
