import { useMemo } from 'react';
import { format, addDays, isSameDay } from 'date-fns';
import { CalendarEvent, TimeSlot, START_HOUR, END_HOUR, SLOT_DURATION_MINUTES, SLOTS_PER_HOUR } from '@/types/calendar';
import { cn } from '@/lib/utils';

interface CalendarGridProps {
  weekStart: Date;
  events: CalendarEvent[];
  selectedSlots: TimeSlot[];
  selectionRange: { day: number; startSlotIndex: number; endSlotIndex: number } | null;
  onMouseDown: (day: number, slotIndex: number) => void;
  onMouseMove: (day: number, slotIndex: number) => void;
  onMouseUp: () => void;
}

const TOTAL_SLOTS = (END_HOUR - START_HOUR) * SLOTS_PER_HOUR;
const SLOTS = Array.from({ length: TOTAL_SLOTS }, (_, i) => i);
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

  const getSlotTime = (slotIndex: number) => {
    const hour = START_HOUR + Math.floor(slotIndex / SLOTS_PER_HOUR);
    const minutes = (slotIndex % SLOTS_PER_HOUR) * SLOT_DURATION_MINUTES;
    return { hour, minutes };
  };

  const getEventsForSlot = (dayIndex: number, slotIndex: number) => {
    const slotDate = dayDates[dayIndex];
    const { hour, minutes } = getSlotTime(slotIndex);
    const slotStartMinutes = hour * 60 + minutes;
    const slotEndMinutes = slotStartMinutes + SLOT_DURATION_MINUTES;

    return events.filter(event => {
      if (!isSameDay(event.start, slotDate)) return false;
      const eventStartMinutes = event.start.getHours() * 60 + event.start.getMinutes();
      const eventEndMinutes = event.end.getHours() * 60 + event.end.getMinutes();
      return slotStartMinutes < eventEndMinutes && slotEndMinutes > eventStartMinutes;
    });
  };

  const isSlotSelected = (dayIndex: number, slotIndex: number) => {
    const slotDate = dayDates[dayIndex];
    const { hour, minutes } = getSlotTime(slotIndex);
    const slotStartMinutes = hour * 60 + minutes;
    const slotEndMinutes = slotStartMinutes + SLOT_DURATION_MINUTES;

    return selectedSlots.some(slot => {
      if (!isSameDay(slot.start, slotDate)) return false;
      const selStartMinutes = slot.start.getHours() * 60 + slot.start.getMinutes();
      const selEndMinutes = slot.end.getHours() * 60 + slot.end.getMinutes();
      return slotStartMinutes < selEndMinutes && slotEndMinutes > selStartMinutes;
    });
  };

  const isInCurrentSelection = (dayIndex: number, slotIndex: number) => {
    if (!selectionRange || selectionRange.day !== dayIndex) return false;
    return slotIndex >= selectionRange.startSlotIndex && slotIndex <= selectionRange.endSlotIndex;
  };

  const isHourBoundary = (slotIndex: number) => slotIndex % SLOTS_PER_HOUR === 0;

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
        {SLOTS.map(slotIndex => {
          const { hour, minutes } = getSlotTime(slotIndex);
          const isHourStart = isHourBoundary(slotIndex);

          return (
            <div 
              key={slotIndex} 
              className={cn(
                "flex",
                isHourStart ? "border-t border-grid-line" : "border-t border-grid-line/30"
              )}
            >
              {/* Time label - only show on hour boundaries */}
              <div className="w-16 flex-shrink-0 py-1 px-2 text-right text-xs text-time-label border-r border-grid-line">
                {isHourStart && format(new Date().setHours(hour, 0, 0, 0), 'h a')}
              </div>
              
              {/* Day cells */}
              {DAYS.map(dayIndex => {
                const slotEvents = getEventsForSlot(dayIndex, slotIndex);
                const isSelected = isSlotSelected(dayIndex, slotIndex);
                const isSelecting = isInCurrentSelection(dayIndex, slotIndex);
                const hasEvent = slotEvents.length > 0;

                // For event rendering, only render on first slot of the event
                const shouldRenderEvent = slotEvents.some(event => {
                  const eventStartMinutes = event.start.getHours() * 60 + event.start.getMinutes();
                  const { hour: slotHour, minutes: slotMinutes } = getSlotTime(slotIndex);
                  const slotStartMinutes = slotHour * 60 + slotMinutes;
                  return eventStartMinutes >= slotStartMinutes && eventStartMinutes < slotStartMinutes + SLOT_DURATION_MINUTES;
                });

                return (
                  <div
                    key={dayIndex}
                    className={cn(
                      "flex-1 min-h-[24px] border-l border-grid-line relative cursor-pointer transition-colors",
                      !hasEvent && !isSelected && !isSelecting && "hover:bg-muted/50",
                      isSelected && "bg-selection/20",
                      isSelecting && "bg-selection/40",
                    )}
                    onMouseDown={() => !hasEvent && onMouseDown(dayIndex, slotIndex)}
                    onMouseMove={() => onMouseMove(dayIndex, slotIndex)}
                  >
                    {/* Event display - only on first slot */}
                    {shouldRenderEvent && slotEvents.map((event, eventIndex) => {
                      const eventStartMinutes = event.start.getHours() * 60 + event.start.getMinutes();
                      const { hour: slotHour, minutes: slotMinutes } = getSlotTime(slotIndex);
                      const slotStartMinutes = slotHour * 60 + slotMinutes;
                      
                      if (eventStartMinutes < slotStartMinutes || eventStartMinutes >= slotStartMinutes + SLOT_DURATION_MINUTES) {
                        return null;
                      }

                      const eventDurationMinutes = (event.end.getHours() * 60 + event.end.getMinutes()) - eventStartMinutes;
                      const slotsSpanned = Math.ceil(eventDurationMinutes / SLOT_DURATION_MINUTES);
                      
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
                            height: `calc(${slotsSpanned * 100}% - 2px)`,
                            top: '1px'
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
                        <div className="w-1.5 h-1.5 rounded-full bg-selection" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
