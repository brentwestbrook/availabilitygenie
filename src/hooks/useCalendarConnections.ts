import { useState, useCallback, useEffect } from 'react';
import { CalendarConnection, CalendarEvent } from '@/types/calendar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function useCalendarConnections() {
  const { user, session } = useAuth();
  const [connections, setConnections] = useState<CalendarConnection[]>([
    { provider: 'google', connected: false },
    { provider: 'microsoft', connected: false },
  ]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loadingProvider, setLoadingProvider] = useState<'google' | 'microsoft' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load connections from database when user is authenticated
  const loadConnections = useCallback(async () => {
    if (!user) return;

    try {
      // Use the safe view that excludes sensitive token columns
      const { data, error: dbError } = await supabase
        .from('calendar_connections_safe')
        .select('provider, email')
        .eq('user_id', user.id);

      if (dbError) {
        console.error('Failed to load connections:', dbError);
        return;
      }

      setConnections(prev =>
        prev.map(c => {
          const match = data?.find(d => d.provider === c.provider);
          if (match) {
            return { ...c, connected: true, email: match.email ?? undefined };
          }
          return { ...c, connected: false, email: undefined };
        })
      );

      // Fetch events for connected calendars
      if (data && data.length > 0) {
        for (const conn of data) {
          await fetchEventsForProvider(conn.provider as 'google' | 'microsoft');
        }
      }
    } catch (e) {
      console.error('Failed to load connections:', e);
    }
  }, [user]);

  // Check for OAuth callback on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    
    const oauthSuccess = params.get('oauth_success');
    const oauthError = params.get('oauth_error');

    if (oauthError) {
      setError(decodeURIComponent(oauthError));
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    if (oauthSuccess) {
      // Reload connections from database after successful OAuth
      loadConnections();
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [loadConnections]);

  // Load connections when user changes
  useEffect(() => {
    if (user) {
      loadConnections();
    }
  }, [user, loadConnections]);

  const fetchEventsForProvider = useCallback(async (provider: 'google' | 'microsoft') => {
    if (!session) return;

    setLoadingProvider(provider);
    try {
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 7);

      const { data, error } = await supabase.functions.invoke('calendar-events', {
        body: {
          provider,
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
        source: provider,
      }));

      setEvents(prev => {
        const filtered = prev.filter(e => e.source !== provider);
        return [...filtered, ...newEvents];
      });
    } catch (e) {
      console.error(`Failed to fetch ${provider} events:`, e);
      setError(`Failed to fetch ${provider} events`);
    } finally {
      setLoadingProvider(null);
    }
  }, [session]);

  const connectGoogle = useCallback(async () => {
    if (!session) {
      setError('Please sign in first');
      return;
    }

    setLoadingProvider('google');
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
      setLoadingProvider(null);
    }
  }, [session]);

  const connectMicrosoft = useCallback(async () => {
    if (!session) {
      setError('Please sign in first');
      return;
    }

    setLoadingProvider('microsoft');
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
      setLoadingProvider(null);
    }
  }, [session]);

  const disconnectProvider = useCallback(async (provider: 'google' | 'microsoft') => {
    if (!user) return;

    try {
      const { error: dbError } = await supabase
        .from('calendar_connections')
        .delete()
        .eq('user_id', user.id)
        .eq('provider', provider);

      if (dbError) {
        console.error('Failed to disconnect:', dbError);
        setError('Failed to disconnect calendar');
        return;
      }

      setConnections(prev =>
        prev.map(c =>
          c.provider === provider
            ? { ...c, connected: false, email: undefined }
            : c
        )
      );
      setEvents(prev => prev.filter(e => e.source !== provider));
    } catch (e) {
      console.error('Failed to disconnect:', e);
      setError('Failed to disconnect calendar');
    }
  }, [user]);

  const refreshEvents = useCallback(async () => {
    if (!user) return;

    setError(null);

    try {
      const connectedProviders = connections
        .filter(c => c.connected)
        .map(c => c.provider);

      // Note: This will set loading for each provider sequentially
      for (const provider of connectedProviders) {
        await fetchEventsForProvider(provider);
      }
    } catch (err) {
      setError('Failed to refresh events. Please try again.');
    }
  }, [user, connections, fetchEventsForProvider]);

  const isGoogleConnected = connections.find(c => c.provider === 'google')?.connected ?? false;
  const isMicrosoftConnected = connections.find(c => c.provider === 'microsoft')?.connected ?? false;

  return {
    connections,
    events,
    loadingProvider,
    error,
    connectGoogle,
    connectMicrosoft,
    disconnectProvider,
    refreshEvents,
    isGoogleConnected,
    isMicrosoftConnected,
  };
}
