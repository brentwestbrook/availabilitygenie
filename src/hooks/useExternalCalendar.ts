import { useState, useEffect, useCallback } from 'react';
import { CalendarEvent, ExternalCalendarEvent } from '@/types/calendar';
import { startOfWeek, parseISO, setHours, setMinutes, getDay } from 'date-fns';

/**
 * Hook to receive calendar events from browser extension
 * Listens for postMessage events from the Outlook Bridge extension
 */
export function useExternalCalendar() {
  const [externalEvents, setExternalEvents] = useState<CalendarEvent[]>([]);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const convertExternalEvent = useCallback((event: ExternalCalendarEvent, currentWeekStart: Date): CalendarEvent | null => {
    try {
      // Parse time strings (format: "HH:mm")
      const [startHour, startMinute] = event.start.split(':').map(Number);
      const [endHour, endMinute] = event.end.split(':').map(Number);

      // Determine which day of week this event is on
      let dayOffset = 0;
      if (event.day) {
        const dayMap: Record<string, number> = {
          'Sunday': 0,
          'Monday': 1,
          'Tuesday': 2,
          'Wednesday': 3,
          'Thursday': 4,
          'Friday': 5,
          'Saturday': 6
        };
        dayOffset = dayMap[event.day] ?? 0;
      }

      // Create date objects relative to the current week
      const startDate = new Date(currentWeekStart);
      startDate.setDate(startDate.getDate() + dayOffset);
      startDate.setHours(startHour, startMinute, 0, 0);

      const endDate = new Date(currentWeekStart);
      endDate.setDate(endDate.getDate() + dayOffset);
      endDate.setHours(endHour, endMinute, 0, 0);

      return {
        id: `outlook-bridge-${startDate.getTime()}-${event.title}`,
        title: event.title || 'Busy',
        start: startDate,
        end: endDate,
        source: 'outlook-bridge'
      };
    } catch (error) {
      console.error('Failed to convert external event:', error, event);
      return null;
    }
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Verify message is from our extension
      if (event.data?.type === 'OUTLOOK_EVENTS_IMPORTED' && event.data?.source === 'availabilitygenie-bridge') {
        console.log('Received events from Outlook Bridge:', event.data.events);
        
        const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 0 });
        
        const convertedEvents = event.data.events
          .map((e: ExternalCalendarEvent) => convertExternalEvent(e, currentWeekStart))
          .filter((e: CalendarEvent | null): e is CalendarEvent => e !== null);
        
        console.log('Converted to calendar events:', convertedEvents);
        
        setExternalEvents(convertedEvents);
        setLastSync(new Date());
      }
    };

    window.addEventListener('message', handleMessage);
    
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [convertExternalEvent]);

  const clearExternalEvents = useCallback(() => {
    setExternalEvents([]);
    setLastSync(null);
  }, []);

  return {
    externalEvents,
    lastSync,
    clearExternalEvents
  };
}
