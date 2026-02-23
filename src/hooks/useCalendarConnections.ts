import { useState, useCallback, useEffect } from 'react';
import { CalendarConnection, CalendarEvent } from '@/types/calendar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function useCalendarConnections() {
  const { user, session } = useAuth();
  const [connections, setConnections] = useState<CalendarConnection[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loadingProvider, setLoadingProvider] = useState<'google' | 'microsoft' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load connections from database when user is authenticated
  const loadConnections = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error: dbError } = await supabase
        .from('calendar_connections_safe')
        .select('id, provider, email')
        .eq('user_id', user.id);

      if (dbError) {
        console.error('Failed to load connections:', dbError);
        return;
      }

      const loadedConnections: CalendarConnection[] = (data || []).map(d => ({
        id: d.id!,
        provider: d.provider as 'google' | 'microsoft',
        email: d.email!,
      }));

      setConnections(loadedConnections);

      // Fetch events for all connected calendars
      if (loadedConnections.length > 0) {
        await fetchAllEvents(loadedConnections);
      }
    } catch (e) {
      console.error('Failed to load connections:', e);
    }
  }, [user]);

  // Fetch events for all connections
  const fetchAllEvents = useCallback(async (conns: CalendarConnection[]) => {
    if (!session) return;

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const endDate = new Date(startOfWeek);
    endDate.setDate(startOfWeek.getDate() + 28);

    const allNewEvents: CalendarEvent[] = [];

    const expiredConnections: string[] = [];

    for (const conn of conns) {
      try {
        const { data, error } = await supabase.functions.invoke('calendar-events', {
          body: {
            provider: conn.provider,
            connectionId: conn.id,
            startDate: startOfWeek.toISOString(),
            endDate: endDate.toISOString(),
          },
        });

        if (error) {
          // Check if it's a token expiration error
          try {
            const errorData = JSON.parse(error.message || '{}');
            if (errorData.code === 'TOKEN_EXPIRED') {
              expiredConnections.push(conn.email);
              continue;
            }
          } catch {}
          console.error(`Failed to fetch events for ${conn.email}:`, error);
          continue;
        }

        if (data?.code === 'TOKEN_EXPIRED') {
          expiredConnections.push(conn.email);
          continue;
        }

        const newEvents: CalendarEvent[] = (data.events || []).map((e: any) => ({
          id: `${conn.id}-${e.id}`,
          title: e.title,
          start: new Date(e.start),
          end: new Date(e.end),
          source: conn.provider,
        }));

        allNewEvents.push(...newEvents);
      } catch (e) {
        console.error(`Failed to fetch events for ${conn.email}:`, e);
      }
    }

    if (expiredConnections.length > 0) {
      setError(`Token expired for: ${expiredConnections.join(', ')}. Please disconnect and reconnect these accounts.`);
    }

    setEvents(allNewEvents);
  }, [session]);

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
      loadConnections();
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [loadConnections]);

  // Load connections when user changes
  useEffect(() => {
    if (user) {
      loadConnections();
    } else {
      setConnections([]);
      setEvents([]);
    }
  }, [user, loadConnections]);

  const openOAuthPopup = useCallback((url: string, provider: 'google' | 'microsoft') => {
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    
    const popup = window.open(
      url,
      'oauth-popup',
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
    );

    if (!popup) {
      setError('Popup blocked. Please allow popups for this site.');
      setLoadingProvider(null);
      return;
    }

    const pollInterval = setInterval(() => {
      try {
        if (popup.closed) {
          clearInterval(pollInterval);
          setLoadingProvider(null);
          loadConnections();
        } else if (popup.location?.href?.includes(window.location.origin)) {
          const url = new URL(popup.location.href);
          const oauthError = url.searchParams.get('oauth_error');
          if (oauthError) {
            setError(decodeURIComponent(oauthError));
          }
          popup.close();
          clearInterval(pollInterval);
          setLoadingProvider(null);
          loadConnections();
        }
      } catch (e) {
        // Cross-origin access blocked until redirect back to our domain
      }
    }, 500);

    setTimeout(() => {
      clearInterval(pollInterval);
      if (!popup.closed) {
        popup.close();
      }
      setLoadingProvider(null);
    }, 5 * 60 * 1000);
  }, [loadConnections]);

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
        openOAuthPopup(data.url, 'google');
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      console.error('Failed to start Google OAuth:', e);
      setError(`Failed to connect to Google Calendar: ${errorMessage}`);
      setLoadingProvider(null);
    }
  }, [session, openOAuthPopup]);

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
        openOAuthPopup(data.url, 'microsoft');
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      console.error('Failed to start Microsoft OAuth:', e);
      setError(`Failed to connect to Microsoft Outlook: ${errorMessage}`);
      setLoadingProvider(null);
    }
  }, [session, openOAuthPopup]);

  const disconnectConnection = useCallback(async (connectionId: string) => {
    if (!user) return;

    try {
      const { error: dbError } = await supabase
        .from('calendar_connections')
        .delete()
        .eq('id', connectionId)
        .eq('user_id', user.id);

      if (dbError) {
        console.error('Failed to disconnect:', dbError);
        setError('Failed to disconnect calendar');
        return;
      }

      setConnections(prev => prev.filter(c => c.id !== connectionId));
      setEvents(prev => prev.filter(e => !e.id.startsWith(`${connectionId}-`)));
    } catch (e) {
      console.error('Failed to disconnect:', e);
      setError('Failed to disconnect calendar');
    }
  }, [user]);

  const refreshEvents = useCallback(async () => {
    if (!user || connections.length === 0) return;

    setError(null);
    setLoadingProvider('google'); // Show loading state

    try {
      await fetchAllEvents(connections);
    } catch (err) {
      setError('Failed to refresh events. Please try again.');
    } finally {
      setLoadingProvider(null);
    }
  }, [user, connections, fetchAllEvents]);

  // Computed values for convenience
  const googleConnections = connections.filter(c => c.provider === 'google');
  const microsoftConnections = connections.filter(c => c.provider === 'microsoft');

  return {
    connections,
    googleConnections,
    microsoftConnections,
    events,
    loadingProvider,
    error,
    connectGoogle,
    connectMicrosoft,
    disconnectConnection,
    refreshEvents,
  };
}
