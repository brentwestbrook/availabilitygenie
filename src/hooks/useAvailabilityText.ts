import { useMemo, useCallback } from 'react';
import { TimeSlot } from '@/types/calendar';
import { format, isSameDay, isAfter, isBefore } from 'date-fns';
import { toast } from '@/hooks/use-toast';

function getTimezoneAbbreviation(): string {
  const date = new Date();
  const timeZoneString = date.toLocaleTimeString('en-US', { timeZoneName: 'short' });
  const match = timeZoneString.match(/[A-Z]{2,4}$/);
  return match ? match[0] : 'local';
}

function formatTimeRange(start: Date, end: Date): string {
  const formatTime = (date: Date): string => {
    const hour = date.getHours();
    const minutes = date.getMinutes();
    const period = hour >= 12 ? 'pm' : 'am';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    
    if (minutes === 0) {
      return `${displayHour}${period}`;
    }
    return `${displayHour}:${minutes.toString().padStart(2, '0')}${period}`;
  };

  return `${formatTime(start)}–${formatTime(end)}`;
}

function mergeOverlappingSlots(slots: TimeSlot[]): TimeSlot[] {
  if (slots.length === 0) return [];

  const sorted = [...slots].sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: TimeSlot[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];

    // Check if slots are on the same day and overlap or are adjacent
    if (
      isSameDay(current.start, last.start) &&
      (isBefore(current.start, last.end) || current.start.getTime() === last.end.getTime())
    ) {
      // Merge by extending the end time if needed
      if (isAfter(current.end, last.end)) {
        merged[merged.length - 1] = {
          ...last,
          end: current.end,
        };
      }
    } else {
      merged.push(current);
    }
  }

  return merged;
}

function groupSlotsByDay(slots: TimeSlot[]): Map<string, TimeSlot[]> {
  const grouped = new Map<string, TimeSlot[]>();
  
  for (const slot of slots) {
    const dayKey = format(slot.start, 'yyyy-MM-dd');
    const existing = grouped.get(dayKey) || [];
    grouped.set(dayKey, [...existing, slot]);
  }

  return grouped;
}

export function useAvailabilityText(selectedSlots: TimeSlot[]) {
  const availabilityText = useMemo(() => {
    if (selectedSlots.length === 0) return '';

    const timezone = getTimezoneAbbreviation();
    const mergedSlots = mergeOverlappingSlots(selectedSlots);
    const groupedByDay = groupSlotsByDay(mergedSlots);

    const parts: string[] = [];

    groupedByDay.forEach((daySlots, _dayKey) => {
      // Sort slots by start time within the day
      const sortedDaySlots = daySlots.sort((a, b) => a.start.getTime() - b.start.getTime());
      
      const dayName = format(sortedDaySlots[0].start, 'EEEE');
      const dateStr = format(sortedDaySlots[0].start, 'M/d');
      const dayWithDate = `${dayName} (${dateStr})`;
      
      if (sortedDaySlots.length === 1) {
        const slot = sortedDaySlots[0];
        parts.push(`${dayWithDate} ${formatTimeRange(slot.start, slot.end)}`);
      } else {
        const ranges = sortedDaySlots.map(slot => formatTimeRange(slot.start, slot.end)).join(' and ');
        parts.push(`${dayWithDate} ${ranges}`);
      }
    });

    if (parts.length === 0) return '';
    if (parts.length === 1) return `I'm available ${parts[0]} ${timezone}.`;
    if (parts.length === 2) return `I'm available ${parts[0]} or ${parts[1]} ${timezone}.`;
    
    const lastPart = parts.pop();
    return `I'm available ${parts.join(', ')}, or ${lastPart} ${timezone}.`;
  }, [selectedSlots]);

  const copyToClipboard = useCallback(async () => {
    if (!availabilityText) {
      toast({
        title: "No time slots selected",
        description: "Please select at least one free time range on the calendar.",
        variant: "destructive",
      });
      return false;
    }

    try {
      await navigator.clipboard.writeText(availabilityText);
      toast({
        title: "Copied to clipboard!",
        description: "Your availability has been copied.",
      });
      return true;
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Please try again or copy the text manually.",
        variant: "destructive",
      });
      return false;
    }
  }, [availabilityText]);

  return {
    availabilityText,
    copyToClipboard,
  };
}
