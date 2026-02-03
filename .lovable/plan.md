
# Expand Calendar Event Import to 4 Weeks

## Problem Summary

Not all Google Calendar events are being imported because:
1. The frontend only requests 7 days of events (current week only)
2. The API has a limit of 100 events per request with no pagination handling
3. Events are not re-fetched when navigating to different weeks

## Solution Overview

Expand the date range to fetch 4 weeks (current week + 3 following weeks) and add pagination support to handle more than 100 events.

## Files to Modify

| File | Change |
|------|--------|
| `src/hooks/useCalendarConnections.ts` | Expand date range from 7 days to 28 days |
| `supabase/functions/calendar-events/index.ts` | Add pagination support for both Google and Microsoft APIs |

## Detailed Changes

### 1. Frontend: Expand Date Range

**File:** `src/hooks/useCalendarConnections.ts`

Change the `fetchEventsForProvider` function to request 28 days instead of 7:

```typescript
// Current: Only 7 days
const endOfWeek = new Date(startOfWeek);
endOfWeek.setDate(startOfWeek.getDate() + 7);

// New: 28 days (4 weeks)
const endDate = new Date(startOfWeek);
endDate.setDate(startOfWeek.getDate() + 28);
```

This ensures events for the current week and the following 3 weeks are always loaded.

### 2. Backend: Add Google API Pagination

**File:** `supabase/functions/calendar-events/index.ts`

Update `fetchGoogleEvents` to handle pagination using `nextPageToken`:

```typescript
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
      throw new Error('Failed to fetch Google events');
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
```

### 3. Backend: Add Microsoft API Pagination

Update `fetchMicrosoftEvents` to handle pagination using `@odata.nextLink`:

```typescript
async function fetchMicrosoftEvents(accessToken: string, startDate: string, endDate: string) {
  let allEvents: any[] = [];
  let nextLink: string | undefined = undefined;

  // Initial URL
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
      throw new Error('Failed to fetch Microsoft events');
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
```

## Technical Notes

- **Google API**: Increased `maxResults` from 100 to 250 (maximum allowed) to reduce API calls
- **Pagination Safety**: Both implementations loop until no more pages exist
- **28-day range**: Well within the 365-day limit already enforced by the edge function
- **No UI changes needed**: The calendar grid already filters events by visible week

## Testing Notes

After implementation:
1. Connect Google Calendar
2. Navigate through weeks using the arrow buttons
3. Verify events appear for all 4 weeks
4. If you have many events (100+), verify pagination works correctly
