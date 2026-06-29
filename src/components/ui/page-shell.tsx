import { cn } from "@/lib/utils";

interface PageShellProps {
  children: React.ReactNode;
  className?: string;
}

export const PageShell = ({ children, className }: PageShellProps) => {
  return (
    <div className={cn("space-y-4 p-4", className)}>
      {children}
    </div>
  );
};