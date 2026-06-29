import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Clock, Calendar, Infinity } from "lucide-react";
import { Table } from "@/types/table";

interface OutOfServiceDurationModalProps {
  isOpen: boolean;
  onClose: () => void;
  table: Table;
  onDurationSelected: (days: number | null) => Promise<void>;
}

const OutOfServiceDurationModal = ({
  isOpen,
  onClose,
  table,
  onDurationSelected,
}: OutOfServiceDurationModalProps) => {
  const handleSelection = async (days: number | null) => {
    await onDurationSelected(days);
    onClose();
  };

  const durationOptions = [
    { days: 1, label: "1 Day", icon: Clock },
    { days: 3, label: "3 Days", icon: Clock },
    { days: 7, label: "7 Days", icon: Calendar },
    { days: null, label: "Undetermined", icon: Infinity },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleSelection(null)}>
      <DialogContent className="sm:max-w-[600px] p-0 gap-0 overflow-hidden [&>button]:hidden">
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-2">
            How long will Table {table.table_number} be out of service?
          </h3>
          <p className="text-sm text-muted-foreground mb-6">
            Select a duration or choose undetermined if you're unsure.
          </p>
          
          <div className="grid grid-cols-2 gap-4">
            {durationOptions.map(({ days, label, icon: Icon }) => (
              <button
                key={label}
                onClick={() => handleSelection(days)}
                className="group relative flex flex-col items-center justify-center gap-3 p-8 rounded-lg border-2 border-border bg-card hover:border-primary hover:bg-accent transition-all duration-200 min-h-[140px]"
              >
                <Icon className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors" />
                <span className="text-lg font-semibold">{label}</span>
                {days !== null && (
                  <span className="text-xs text-muted-foreground">
                    We'll remind you in {days} {days === 1 ? 'day' : 'days'}
                  </span>
                )}
                {days === null && (
                  <span className="text-xs text-muted-foreground">
                    No automatic reminder
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OutOfServiceDurationModal;
