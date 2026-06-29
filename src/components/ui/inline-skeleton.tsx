import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface InlineSkeletonProps {
  className?: string;
  lines?: number;
  width?: string;
  height?: string;
}

export const InlineSkeleton = ({ 
  className, 
  lines = 3, 
  width = "w-full", 
  height = "h-4" 
}: InlineSkeletonProps) => {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton 
          key={index} 
          className={cn(
            height, 
            index === lines - 1 ? "w-3/4" : width
          )} 
        />
      ))}
    </div>
  );
};