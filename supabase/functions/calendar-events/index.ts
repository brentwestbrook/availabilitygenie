import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decryptToken, encryptToken, isEncryptedFormat } from "../_shared/encryption.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate user authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Use getUser() instead of getClaims() - this is the correct API
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('Auth error:', userError?.message || 'No user found');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;

    const { provider, startDate, endDate } = await req.json();

    // Validate provider
    if (!provider || !['google', 'microsoft'].includes(provider)) {
      return new Response(
        JSON.stringify({ error: 'Invalid provider' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate date format (ISO 8601)
    const dateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/;
    if (startDate && !dateRegex.test(startDate)) {
      return new Response(
        JSON.stringify({ error: 'Invalid startDate format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (endDate && !dateRegex.test(endDate)) {
      return new Response(
        JSON.stringify({ error: 'Invalid endDate format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate date range (max 365 days to prevent DoS)
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
      const MAX_DAYS = 365;
      
      if (daysDiff > MAX_DAYS || daysDiff < 0) {
        return new Response(
          JSON.stringify({ error: 'Invalid date range. Maximum range is 365 days.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Use service role client to fetch connection (bypasses RLS)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Fetch the user's calendar connection from the database
    const { data: connection, error: connError } = await supabaseAdmin
      .from('calendar_connections')
      .select('id, access_token, access_token_iv, access_token_tag, refresh_token, refresh_token_iv, refresh_token_tag, token_expires_at')
      .eq('user_id', userId)
      .eq('provider', provider)
      .single();

    if (connError || !connection) {
      console.error('Connection fetch error:', connError?.message || 'No connection found');
      return new Response(
        JSON.stringify({ error: 'Calendar not connected' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Decrypt access token
    let accessToken: string;
    if (isEncryptedFormat(connection.access_token_iv)) {
      accessToken = await decryptToken({
        encrypted: connection.access_token,
        iv: connection.access_token_iv!,
        tag: connection.access_token_tag!,
      });
    } else {
      accessToken = connection.access_token;
    }

    // Check if token is expired or will expire soon (5 minute buffer)
    const tokenExpiresAt = connection.token_expires_at ? new Date(connection.token_expires_at) : null;
    const now = new Date();
    const bufferMs = 5 * 60 * 1000; // 5 minutes

    if (tokenExpiresAt && (tokenExpiresAt.getTime() - now.getTime() < bufferMs)) {
      console.log('Token expired or expiring soon, attempting refresh...');
      
      // Decrypt refresh token if available
      let refreshToken: string | null = null;
      if (connection.refresh_token) {
        if (isEncryptedFormat(connection.refresh_token_iv)) {
          refreshToken = await decryptToken({
            encrypted: connection.refresh_token,
            iv: connection.refresh_token_iv!,
            tag: connection.refresh_token_tag!,
          });
        } else {
          refreshToken = connection.refresh_token;
        }
      }

      if (refreshToken) {
        const newTokens = provider === 'google' 
          ? await refreshGoogleToken(refreshToken)
          : await refreshMicrosoftToken(refreshToken);

        if (newTokens) {
          // Encrypt and store new tokens
          const encryptedAccessToken = await encryptToken(newTokens.access_token);
          const newExpiresAt = new Date(Date.now() + newTokens.expires_in * 1000).toISOString();

          await supabaseAdmin
            .from('calendar_connections')
            .update({
              access_token: encryptedAccessToken.encrypted,
              access_token_iv: encryptedAccessToken.iv,
              access_token_tag: encryptedAccessToken.tag,
              token_expires_at: newExpiresAt,
              updated_at: new Date().toISOString(),
            })
            .eq('id', connection.id);

          accessToken = newTokens.access_token;
          console.log('Token refreshed successfully');
        } else {
          console.error('Failed to refresh token');
        }
      }
    }

    let events: any[] = [];

    if (provider === 'google') {
      events = await fetchGoogleEvents(accessToken, startDate, endDate);
    } else if (provider === 'microsoft') {
      events = await fetchMicrosoftEvents(accessToken, startDate, endDate);
    }

    return new Response(
      JSON.stringify({ events }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch calendar events' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function refreshGoogleToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
} | null> {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
  
  if (!clientId || !clientSecret) {
    console.error('Missing Google OAuth credentials');
    return null;
  }

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Google token refresh error: ${response.status} - ${errorBody}`);
      return null;
    }

    return response.json();
  } catch (error) {
    console.error('Google token refresh exception:', error);
    return null;
  }
}

async function refreshMicrosoftToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
} | null> {
  const clientId = Deno.env.get('MICROSOFT_CLIENT_ID');
  const clientSecret = Deno.env.get('MICROSOFT_CLIENT_SECRET');
  
  if (!clientId || !clientSecret) {
    console.error('Missing Microsoft OAuth credentials');
    return null;
  }

  try {
    const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        scope: 'openid profile email offline_access Calendars.Read',
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Microsoft token refresh error: ${response.status} - ${errorBody}`);
      return null;
    }

    return response.json();
  } catch (error) {
    console.error('Microsoft token refresh exception:', error);
    return null;
  }
}

async function fetchGoogleEvents(accessToken: string, startDate: string, endDate: string) {
  const calendarId = 'primary';
  let allEvents: any[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`);
    url.searchParams.set('timeMin', startDate);
    url.searchParams.set('timeMax', endDate);
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');
    url.searchParams.set('maxResults', '250');
    if (pageToken) {
      url.searchParams.set('pageToken', pageToken);
    }

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Google Calendar API error: ${response.status} - ${errorBody}`);
      throw new Error(`Failed to fetch Google events: ${response.status}`);
    }

    const data = await response.json();
    allEvents = allEvents.concat(data.items || []);
    pageToken = data.nextPageToken;
  } while (pageToken);

  return allEvents.map((event: any) => ({
    id: event.id,
    title: event.summary || 'Busy',
    start: event.start?.dateTime || event.start?.date,
    end: event.end?.dateTime || event.end?.date,
    source: 'google',
  }));
}

async function fetchMicrosoftEvents(accessToken: string, startDate: string, endDate: string) {
  let allEvents: any[] = [];
  let nextLink: string | undefined = undefined;

  const initialUrl = new URL('https://graph.microsoft.com/v1.0/me/calendarView');
  initialUrl.searchParams.set('startDateTime', startDate);
  initialUrl.searchParams.set('endDateTime', endDate);
  initialUrl.searchParams.set('$top', '100');
  initialUrl.searchParams.set('$select', 'id,subject,start,end');
  initialUrl.searchParams.set('$orderby', 'start/dateTime');

  let currentUrl: string = initialUrl.toString();

  do {
    const response = await fetch(currentUrl, {
      headers: { 
        Authorization: `Bearer ${accessToken}`,
        'Prefer': 'outlook.timezone="UTC"',
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Microsoft Graph API error: ${response.status} - ${errorBody}`);
      throw new Error(`Failed to fetch Microsoft events: ${response.status}`);
    }

    const data = await response.json();
    allEvents = allEvents.concat(data.value || []);
    nextLink = data['@odata.nextLink'];
    if (nextLink) {
      currentUrl = nextLink;
    }
  } while (nextLink);

  return allEvents.map((event: any) => ({
    id: event.id,
    title: event.subject || 'Busy',
    start: event.start?.dateTime,
    end: event.end?.dateTime,
    source: 'microsoft',
  }));
}
