import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { format, addWeeks, subWeeks } from 'date-fns';

interface CalendarHeaderProps {
  weekStart: Date;
  onWeekChange: (date: Date) => void;
  onRefresh: () => void;
  isLoading: boolean;
}

export function CalendarHeader({
  weekStart,
  onWeekChange,
  onRefresh,
  isLoading,
}: CalendarHeaderProps) {
  const weekEnd = addWeeks(weekStart, 1);
  const dateRangeText = `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d, yyyy')}`;

  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => onWeekChange(subWeeks(weekStart, 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => onWeekChange(addWeeks(weekStart, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold ml-2">{dateRangeText}</h2>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onRefresh}
        disabled={isLoading}
      >
        <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
        Refresh
      </Button>
    </div>
  );
}
