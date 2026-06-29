import React from 'react';
import { TimelineDimensions } from '@/utils/timelineDimensionCalculator';

interface TimelineSkeletonGridProps {
  dimensions: TimelineDimensions;
}

/**
 * Renders a skeleton timeline grid with exact dimensions.
 * This ensures smooth transition from skeleton to real timeline without visual jumps.
 */
export const TimelineSkeletonGrid: React.FC<TimelineSkeletonGridProps> = ({ dimensions }) => {
  const {
    TABLE_COLUMN_WIDTH,
    SEATS_COLUMN_WIDTH,
    COLUMN_WIDTH,
    ROW_HEIGHT,
    totalWidth,
    totalGridHeight,
    tableCount,
    timeSlotCount,
  } = dimensions;

  const HEADER_HEIGHT = 45;

  return (
    <div
      className="overflow-hidden rounded-lg border border-border bg-background"
      style={{
        width: `${totalWidth}px`,
        height: `${totalGridHeight}px`,
      }}
    >
      {/* Header */}
      <div
        className="flex border-b border-border bg-muted/50"
        style={{ height: `${HEADER_HEIGHT}px` }}
      >
        <div
          className="flex items-center justify-center border-r border-border"
          style={{ width: `${TABLE_COLUMN_WIDTH}px` }}
        >
          <div className="h-4 w-12 animate-pulse rounded bg-muted" />
        </div>
        <div
          className="flex items-center justify-center border-r border-border"
          style={{ width: `${SEATS_COLUMN_WIDTH}px` }}
        >
          <div className="h-4 w-8 animate-pulse rounded bg-muted" />
        </div>
        <div className="flex flex-1">
          {Array.from({ length: timeSlotCount }).map((_, idx) => (
            <div
              key={idx}
              className="flex items-center justify-center border-r border-border last:border-r-0"
              style={{ width: `${COLUMN_WIDTH}px` }}
            >
              <div className="h-3 w-10 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>

      {/* Rows */}
      <div>
        {Array.from({ length: tableCount }).map((_, rowIdx) => {
          // Distribute ROW_REMAINDER evenly across all rows
          const extraPixelsPerRow = tableCount > 0 ? Math.floor(dimensions.ROW_REMAINDER / tableCount) : 0;
          const remainingPixels = dimensions.ROW_REMAINDER % tableCount;
          const getsExtraPixel = rowIdx < remainingPixels ? 1 : 0;
          const effectiveRowHeight = ROW_HEIGHT + extraPixelsPerRow + getsExtraPixel;

          return (
            <div
              key={rowIdx}
              className="flex border-b border-border last:border-b-0"
              style={{ height: `${effectiveRowHeight}px` }}
            >
              <div
                className="flex items-center justify-center border-r border-border"
                style={{ width: `${TABLE_COLUMN_WIDTH}px` }}
              >
                <div className="h-3 w-8 animate-pulse rounded bg-muted" />
              </div>
              <div
                className="flex items-center justify-center border-r border-border"
                style={{ width: `${SEATS_COLUMN_WIDTH}px` }}
              >
                <div className="h-3 w-6 animate-pulse rounded bg-muted" />
              </div>
              <div className="flex flex-1">
                {Array.from({ length: timeSlotCount }).map((_, colIdx) => (
                  <div
                    key={colIdx}
                    className="border-r border-border last:border-r-0"
                    style={{ width: `${COLUMN_WIDTH}px` }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
