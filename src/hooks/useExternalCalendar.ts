import { useState, useEffect, useCallback } from 'react';
import { CalendarEvent, ExternalCalendarEvent } from '@/types/calendar';
import { startOfWeek } from 'date-fns';

/**
 * Hook to receive calendar events from browser extension
 * Listens for postMessage events from the Outlook Bridge extension
 */
export function useExternalCalendar() {
  const [externalEvents, setExternalEvents] = useState<CalendarEvent[]>([]);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const convertExternalEvent = useCallback((event: ExternalCalendarEvent, currentWeekStart: Date): CalendarEvent | null => {
    try {
      console.log('Converting event:', event);
      console.log('Current week start:', currentWeekStart);
      
      // Parse time strings (format: "HH:mm")
      const [startHour, startMinute] = event.start.split(':').map(Number);
      const [endHour, endMinute] = event.end.split(':').map(Number);
      
      console.log('Parsed times:', { startHour, startMinute, endHour, endMinute });

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
        console.log('Day offset for', event.day, ':', dayOffset);
      }

      // Create date objects relative to the current week
      const startDate = new Date(currentWeekStart);
      startDate.setDate(startDate.getDate() + dayOffset);
      startDate.setHours(startHour, startMinute, 0, 0);
      
      console.log('Start date created:', startDate);

      const endDate = new Date(currentWeekStart);
      endDate.setDate(endDate.getDate() + dayOffset);
      endDate.setHours(endHour, endMinute, 0, 0);
      
      console.log('End date created:', endDate);

      const converted = {
        id: `outlook-bridge-${startDate.getTime()}-${event.title}`,
        title: event.title || 'Busy',
        start: startDate,
        end: endDate,
        source: 'outlook-bridge' as const
      };
      
      console.log('Successfully converted event:', converted);
      return converted;
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
        console.log('Total events received:', event.data.events.length);
        
        const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 0 });
        console.log('Week start for conversion:', currentWeekStart);
        
        const convertedEvents: CalendarEvent[] = [];
        
        for (let i = 0; i < event.data.events.length; i++) {
          console.log(`\n--- Converting event ${i + 1}/${event.data.events.length} ---`);
          const converted = convertExternalEvent(event.data.events[i], currentWeekStart);
          if (converted) {
            convertedEvents.push(converted);
          } else {
            console.warn('Event conversion returned null for event:', event.data.events[i]);
          }
        }
        
        console.log('\n=== CONVERSION COMPLETE ===');
        console.log('Total converted:', convertedEvents.length);
        console.log('Converted events:', convertedEvents);
        
        setExternalEvents(convertedEvents);
        setLastSync(new Date());
        
        console.log('State updated with', convertedEvents.length, 'events');
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
