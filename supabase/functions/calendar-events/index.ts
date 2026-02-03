import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decryptToken, isEncryptedFormat } from "../_shared/encryption.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub;

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

    // Fetch the user's calendar connection from the database
    const { data: connection, error: connError } = await supabase
      .from('calendar_connections')
      .select('access_token, access_token_iv, access_token_tag, refresh_token, token_expires_at')
      .eq('user_id', userId)
      .eq('provider', provider)
      .single();

    if (connError || !connection) {
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
      // Fallback for existing plain text tokens (migration period)
      accessToken = connection.access_token;
    }

    let events = [];

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

async function fetchGoogleEvents(accessToken: string, startDate: string, endDate: string) {
  const calendarId = 'primary';
  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`);
  url.searchParams.set('timeMin', startDate);
  url.searchParams.set('timeMax', endDate);
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');
  url.searchParams.set('maxResults', '100');

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch Google events');
  }

  const data = await response.json();

  return (data.items || []).map((event: any) => ({
    id: event.id,
    title: event.summary || 'Busy',
    start: event.start?.dateTime || event.start?.date,
    end: event.end?.dateTime || event.end?.date,
    source: 'google',
  }));
}

async function fetchMicrosoftEvents(accessToken: string, startDate: string, endDate: string) {
  const url = new URL('https://graph.microsoft.com/v1.0/me/calendarView');
  url.searchParams.set('startDateTime', startDate);
  url.searchParams.set('endDateTime', endDate);
  url.searchParams.set('$top', '100');
  url.searchParams.set('$select', 'id,subject,start,end');
  url.searchParams.set('$orderby', 'start/dateTime');

  const response = await fetch(url.toString(), {
    headers: { 
      Authorization: `Bearer ${accessToken}`,
      'Prefer': 'outlook.timezone="UTC"',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch Microsoft events');
  }

  const data = await response.json();

  return (data.value || []).map((event: any) => ({
    id: event.id,
    title: event.subject || 'Busy',
    start: event.start?.dateTime,
    end: event.end?.dateTime,
    source: 'microsoft',
  }));
}
