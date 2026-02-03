import { useState, useCallback } from 'react';
import { CalendarConnection, CalendarEvent } from '@/types/calendar';

// Mock events for demonstration - will be replaced with real OAuth integration
const generateMockEvents = (): CalendarEvent[] => {
  const now = new Date();
  const events: CalendarEvent[] = [];

  // Generate some mock Google events
  for (let i = 0; i < 5; i++) {
    const dayOffset = Math.floor(Math.random() * 7);
    const startHour = 9 + Math.floor(Math.random() * 8);
    const duration = 1 + Math.floor(Math.random() * 2);

    const start = new Date(now);
    start.setDate(start.getDate() + dayOffset);
    start.setHours(startHour, 0, 0, 0);

    const end = new Date(start);
    end.setHours(startHour + duration);

    events.push({
      id: `google-${i}`,
      title: ['Team Standup', 'Project Review', '1:1 Meeting', 'Planning Session', 'Client Call'][i],
      start,
      end,
      source: 'google',
    });
  }

  // Generate some mock Microsoft events
  for (let i = 0; i < 4; i++) {
    const dayOffset = Math.floor(Math.random() * 7);
    const startHour = 10 + Math.floor(Math.random() * 6);
    const duration = 1 + Math.floor(Math.random() * 2);

    const start = new Date(now);
    start.setDate(start.getDate() + dayOffset);
    start.setHours(startHour, 0, 0, 0);

    const end = new Date(start);
    end.setHours(startHour + duration);

    events.push({
      id: `microsoft-${i}`,
      title: ['Budget Review', 'All Hands', 'Training', 'Strategy Meeting'][i],
      start,
      end,
      source: 'microsoft',
    });
  }

  return events;
};

export function useCalendarConnections() {
  const [connections, setConnections] = useState<CalendarConnection[]>([
    { provider: 'google', connected: false },
    { provider: 'microsoft', connected: false },
  ]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connectGoogle = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    // Simulate OAuth flow - will be replaced with real implementation
    await new Promise(resolve => setTimeout(resolve, 1000));

    setConnections(prev =>
      prev.map(c =>
        c.provider === 'google'
          ? { ...c, connected: true, email: 'user@gmail.com' }
          : c
      )
    );

    // Load mock events
    const mockEvents = generateMockEvents().filter(e => e.source === 'google');
    setEvents(prev => [...prev, ...mockEvents]);
    setIsLoading(false);
  }, []);

  const connectMicrosoft = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    // Simulate OAuth flow - will be replaced with real implementation
    await new Promise(resolve => setTimeout(resolve, 1000));

    setConnections(prev =>
      prev.map(c =>
        c.provider === 'microsoft'
          ? { ...c, connected: true, email: 'user@outlook.com' }
          : c
      )
    );

    // Load mock events
    const mockEvents = generateMockEvents().filter(e => e.source === 'microsoft');
    setEvents(prev => [...prev, ...mockEvents]);
    setIsLoading(false);
  }, []);

  const disconnectProvider = useCallback((provider: 'google' | 'microsoft') => {
    setConnections(prev =>
      prev.map(c =>
        c.provider === provider
          ? { ...c, connected: false, email: undefined }
          : c
      )
    );
    setEvents(prev => prev.filter(e => e.source !== provider));
  }, []);

  const refreshEvents = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      // In real implementation, this would fetch fresh events from connected calendars
    } catch (err) {
      setError('Failed to refresh events. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const isGoogleConnected = connections.find(c => c.provider === 'google')?.connected ?? false;
  const isMicrosoftConnected = connections.find(c => c.provider === 'microsoft')?.connected ?? false;

  return {
    connections,
    events,
    isLoading,
    error,
    connectGoogle,
    connectMicrosoft,
    disconnectProvider,
    refreshEvents,
    isGoogleConnected,
    isMicrosoftConnected,
  };
}
