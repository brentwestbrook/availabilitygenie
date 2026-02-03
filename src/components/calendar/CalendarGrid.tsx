import { useMemo } from 'react';
import { format, addDays, isSameDay, isWithinInterval } from 'date-fns';
import { CalendarEvent, TimeSlot } from '@/types/calendar';
import { cn } from '@/lib/utils';

interface CalendarGridProps {
  weekStart: Date;
  events: CalendarEvent[];
  selectedSlots: TimeSlot[];
  selectionRange: { day: number; startHour: number; endHour: number } | null;
  onMouseDown: (day: number, hour: number) => void;
  onMouseMove: (day: number, hour: number) => void;
  onMouseUp: () => void;
}

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7 AM to 8 PM
const DAYS = Array.from({ length: 7 }, (_, i) => i);

export function CalendarGrid({
  weekStart,
  events,
  selectedSlots,
  selectionRange,
  onMouseDown,
  onMouseMove,
  onMouseUp,
}: CalendarGridProps) {
  const dayDates = useMemo(() => 
    DAYS.map(dayOffset => addDays(weekStart, dayOffset)),
    [weekStart]
  );

  const getEventsForSlot = (dayIndex: number, hour: number) => {
    const slotDate = dayDates[dayIndex];
    return events.filter(event => {
      if (!isSameDay(event.start, slotDate)) return false;
      const eventStartHour = event.start.getHours();
      const eventEndHour = event.end.getHours();
      return hour >= eventStartHour && hour < eventEndHour;
    });
  };

  const isSlotSelected = (dayIndex: number, hour: number) => {
    const slotDate = dayDates[dayIndex];
    return selectedSlots.some(slot => {
      if (!isSameDay(slot.start, slotDate)) return false;
      const startHour = slot.start.getHours();
      const endHour = slot.end.getHours();
      return hour >= startHour && hour < endHour;
    });
  };

  const isInCurrentSelection = (dayIndex: number, hour: number) => {
    if (!selectionRange || selectionRange.day !== dayIndex) return false;
    return hour >= selectionRange.startHour && hour <= selectionRange.endHour;
  };

  return (
    <div 
      className="flex flex-col border border-grid-line rounded-lg overflow-hidden select-none"
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      {/* Day headers */}
      <div className="flex border-b border-grid-line">
        <div className="w-16 flex-shrink-0 bg-muted/30" />
        {dayDates.map((date, index) => (
          <div
            key={index}
            className="flex-1 py-3 px-2 text-center border-l border-grid-line bg-muted/30"
          >
            <div className="text-xs text-muted-foreground uppercase">
              {format(date, 'EEE')}
            </div>
            <div className="text-lg font-semibold">{format(date, 'd')}</div>
          </div>
        ))}
      </div>

      {/* Time grid */}
      <div className="flex-1 overflow-y-auto max-h-[600px]">
        {HOURS.map(hour => (
          <div key={hour} className="flex border-b border-grid-line last:border-b-0">
            {/* Time label */}
            <div className="w-16 flex-shrink-0 py-2 px-2 text-right text-xs text-time-label border-r border-grid-line">
              {format(new Date().setHours(hour, 0, 0, 0), 'h a')}
            </div>
            
            {/* Day cells */}
            {DAYS.map(dayIndex => {
              const slotEvents = getEventsForSlot(dayIndex, hour);
              const isSelected = isSlotSelected(dayIndex, hour);
              const isSelecting = isInCurrentSelection(dayIndex, hour);
              const hasEvent = slotEvents.length > 0;

              return (
                <div
                  key={dayIndex}
                  className={cn(
                    "flex-1 min-h-[48px] border-l border-grid-line relative cursor-pointer transition-colors",
                    !hasEvent && !isSelected && !isSelecting && "hover:bg-muted/50",
                    isSelected && "bg-selection/20",
                    isSelecting && "bg-selection/40",
                  )}
                  onMouseDown={() => !hasEvent && onMouseDown(dayIndex, hour)}
                  onMouseMove={() => onMouseMove(dayIndex, hour)}
                >
                  {/* Event display */}
                  {slotEvents.map((event, eventIndex) => {
                    const isFirstHour = event.start.getHours() === hour;
                    if (!isFirstHour) return null;
                    
                    const duration = event.end.getHours() - event.start.getHours();
                    
                    return (
                      <div
                        key={event.id}
                        className={cn(
                          "absolute inset-x-1 rounded px-1 py-0.5 text-xs overflow-hidden z-10",
                          event.source === 'google' 
                            ? "bg-google text-google-foreground" 
                            : "bg-microsoft text-microsoft-foreground",
                          eventIndex > 0 && "left-1/2"
                        )}
                        style={{ 
                          height: `calc(${duration * 100}% - 4px)`,
                          top: '2px'
                        }}
                      >
                        <div className="font-medium truncate">{event.title}</div>
                        <div className="truncate opacity-80">
                          {format(event.start, 'h:mm a')}
                        </div>
                      </div>
                    );
                  })}

                  {/* Selection indicator */}
                  {(isSelected || isSelecting) && !hasEvent && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-selection" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
