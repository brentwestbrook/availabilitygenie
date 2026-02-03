import { useState, useCallback, useEffect } from 'react';
import { CalendarConnection, CalendarEvent } from '@/types/calendar';
import { supabase } from '@/integrations/supabase/client';

interface StoredConnection {
  provider: 'google' | 'microsoft';
  access_token: string;
  refresh_token?: string;
  token_expires_at?: string;
  email: string;
}

export function useCalendarConnections() {
  const [connections, setConnections] = useState<CalendarConnection[]>([
    { provider: 'google', connected: false },
    { provider: 'microsoft', connected: false },
  ]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check for OAuth callback on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    
    const googleConnection = params.get('google_connection');
    const microsoftConnection = params.get('microsoft_connection');
    const errorParam = params.get('error');

    if (errorParam) {
      setError(decodeURIComponent(errorParam));
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    if (googleConnection) {
      try {
        const data: StoredConnection = JSON.parse(atob(googleConnection));
        handleConnectionComplete(data);
      } catch (e) {
        setError('Failed to process Google connection');
      }
      window.history.replaceState({}, '', window.location.pathname);
    }

    if (microsoftConnection) {
      try {
        const data: StoredConnection = JSON.parse(atob(microsoftConnection));
        handleConnectionComplete(data);
      } catch (e) {
        setError('Failed to process Microsoft connection');
      }
      window.history.replaceState({}, '', window.location.pathname);
    }

    // Load stored connections from localStorage
    loadStoredConnections();
  }, []);

  const loadStoredConnections = useCallback(() => {
    const stored = localStorage.getItem('calendar_connections');
    if (stored) {
      try {
        const storedConnections: StoredConnection[] = JSON.parse(stored);
        setConnections(prev =>
          prev.map(c => {
            const match = storedConnections.find(s => s.provider === c.provider);
            if (match) {
              return { ...c, connected: true, email: match.email };
            }
            return c;
          })
        );
        // Fetch events for connected calendars
        storedConnections.forEach(conn => {
          fetchEventsForProvider(conn);
        });
      } catch (e) {
        console.error('Failed to load stored connections:', e);
      }
    }
  }, []);

  const handleConnectionComplete = useCallback(async (data: StoredConnection) => {
    // Store connection in localStorage (in production, store in database with user auth)
    const stored = localStorage.getItem('calendar_connections');
    let connections: StoredConnection[] = stored ? JSON.parse(stored) : [];
    connections = connections.filter(c => c.provider !== data.provider);
    connections.push(data);
    localStorage.setItem('calendar_connections', JSON.stringify(connections));

    setConnections(prev =>
      prev.map(c =>
        c.provider === data.provider
          ? { ...c, connected: true, email: data.email }
          : c
      )
    );

    // Fetch events
    await fetchEventsForProvider(data);
  }, []);

  const fetchEventsForProvider = useCallback(async (connection: StoredConnection) => {
    setIsLoading(true);
    try {
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 7);

      const { data, error } = await supabase.functions.invoke('calendar-events', {
        body: {
          provider: connection.provider,
          accessToken: connection.access_token,
          startDate: startOfWeek.toISOString(),
          endDate: endOfWeek.toISOString(),
        },
      });

      if (error) throw error;

      const newEvents: CalendarEvent[] = (data.events || []).map((e: any) => ({
        id: e.id,
        title: e.title,
        start: new Date(e.start),
        end: new Date(e.end),
        source: connection.provider,
      }));

      setEvents(prev => {
        const filtered = prev.filter(e => e.source !== connection.provider);
        return [...filtered, ...newEvents];
      });
    } catch (e) {
      console.error(`Failed to fetch ${connection.provider} events:`, e);
      setError(`Failed to fetch ${connection.provider} events`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const connectGoogle = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.functions.invoke('google-oauth-start', {
        body: { origin: window.location.origin },
      });

      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (e) {
      console.error('Failed to start Google OAuth:', e);
      setError('Failed to connect to Google Calendar');
      setIsLoading(false);
    }
  }, []);

  const connectMicrosoft = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.functions.invoke('microsoft-oauth-start', {
        body: { origin: window.location.origin },
      });

      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (e) {
      console.error('Failed to start Microsoft OAuth:', e);
      setError('Failed to connect to Microsoft Outlook');
      setIsLoading(false);
    }
  }, []);

  const disconnectProvider = useCallback((provider: 'google' | 'microsoft') => {
    // Remove from localStorage
    const stored = localStorage.getItem('calendar_connections');
    if (stored) {
      const connections: StoredConnection[] = JSON.parse(stored);
      const filtered = connections.filter(c => c.provider !== provider);
      localStorage.setItem('calendar_connections', JSON.stringify(filtered));
    }

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
      const stored = localStorage.getItem('calendar_connections');
      if (stored) {
        const storedConnections: StoredConnection[] = JSON.parse(stored);
        await Promise.all(storedConnections.map(conn => fetchEventsForProvider(conn)));
      }
    } catch (err) {
      setError('Failed to refresh events. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [fetchEventsForProvider]);

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
