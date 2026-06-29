import { Clock } from "lucide-react";

interface TimeSlot {
  time: string;
  isPastMidnight?: boolean;
}

interface TimelineHeaderProps {
  timeSlots: Array<string | TimeSlot>;
  londonTime: Date;
  selectedDate: Date;
}

export function TimelineHeader({ timeSlots, londonTime, selectedDate }: TimelineHeaderProps) {
  return (
    <div className="sticky top-0 z-10 bg-background border-b">
      <div className="flex">
        {/* Table names column */}
        <div className="w-32 flex-shrink-0 p-4 border-r bg-muted/30">
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm">Tables</span>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {londonTime.toLocaleTimeString('en-GB', { 
                hour: '2-digit', 
                minute: '2-digit',
                timeZone: 'Europe/London'
              })}
            </div>
          </div>
        </div>

        {/* Time slots */}
        <div className="flex-1 flex bg-background">
          {timeSlots.map((slot, index) => {
            const timeStr = typeof slot === 'string' ? slot : slot.time;
            const isPastMidnight = typeof slot === 'object' && slot.isPastMidnight;
            
            return (
              <div
                key={`${timeStr}-${index}`}
                className="flex-1 min-w-0 p-2 border-r border-border/50 text-center"
              >
                <span className="text-xs font-medium text-muted-foreground">
                  {timeStr}
                  {isPastMidnight && (
                    <span className="ml-1 text-[10px] opacity-60">+1</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}