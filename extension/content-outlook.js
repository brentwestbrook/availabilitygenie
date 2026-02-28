/**
 * Content script injected into the Outlook Web App tab.
 *
 * When the background worker sends { type: 'FETCH_CALENDAR_EVENTS' }, this
 * script queries Microsoft Graph API for calendar events. Because the user is
 * already authenticated in this browser session, the request goes out with
 * valid credentials (cookies + Bearer token extracted from the page's in-memory
 * token cache via the OWA bootstrap data).
 *
 * Event window: current week start (Sunday) through 4 weeks out (28 days),
 * matching what Availability Genie natively fetches via OAuth.
 *
 * Events are returned in the ExternalCalendarEvent format expected by
 * useExternalCalendar.ts with full ISO date strings for accurate multi-week
 * placement.
 */

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'FETCH_CALENDAR_EVENTS') {
    fetchCalendarEvents()
      .then((events) => {
        chrome.runtime.sendMessage({ type: 'OUTLOOK_EVENTS_READY', events });
      })
      .catch((err) => {
        chrome.runtime.sendMessage({
          type: 'OUTLOOK_FETCH_ERROR',
          error: err?.message || 'Unknown error fetching Outlook events.',
        });
      });
  }
});

async function fetchCalendarEvents() {
  const token = await getAccessToken();

  const now = new Date();
  // Start of the current week (Sunday midnight local time)
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 28);

  const params = new URLSearchParams({
    startDateTime: weekStart.toISOString(),
    endDateTime: weekEnd.toISOString(),
    $select: 'subject,start,end,showAs',
    $top: '100',
    $orderby: 'start/dateTime',
  });

  const resp = await fetch(
    `https://graph.microsoft.com/v1.0/me/calendarView?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Graph API error ${resp.status}: ${body}`);
  }

  const data = await resp.json();
  const graphEvents = data.value || [];

  // Handle pagination (@odata.nextLink)
  let nextLink = data['@odata.nextLink'];
  while (nextLink) {
    const pageResp = await fetch(nextLink, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    if (!pageResp.ok) break;
    const pageData = await pageResp.json();
    graphEvents.push(...(pageData.value || []));
    nextLink = pageData['@odata.nextLink'];
  }

  return graphEvents
    .filter((e) => e.showAs !== 'free') // skip free/transparent events
    .map((e) => {
      const startDt = new Date(e.start.dateTime + (e.start.timeZone === 'UTC' ? 'Z' : ''));
      const endDt = new Date(e.end.dateTime + (e.end.timeZone === 'UTC' ? 'Z' : ''));

      const pad = (n) => String(n).padStart(2, '0');
      const toHHmm = (dt) => `${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
      const toISODate = (dt) =>
        `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;

      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

      return {
        title: e.subject || 'Busy',
        start: toHHmm(startDt),
        end: toHHmm(endDt),
        date: toISODate(startDt),
        day: dayNames[startDt.getDay()],
      };
    });
}

/**
 * Retrieves a Microsoft Graph access token from the Outlook Web App session.
 *
 * Outlook Web App stores its access tokens in `window.__boot__` / OWA's
 * global boot data, which is accessible from a content script running in the
 * page's execution context. We inject a small inline script to extract it,
 * then receive it back via a custom DOM event.
 *
 * If that fails (Microsoft changes the internal structure), we fall back to
 * requesting a token via the OWA /owa/auth/oauthtoken endpoint, which works
 * as long as the user is authenticated.
 */
function getAccessToken() {
  return new Promise((resolve, reject) => {
    const eventName = 'OUTLOOK_BRIDGE_TOKEN_' + Date.now();

    // Listen for the token event from the injected script
    window.addEventListener(
      eventName,
      (e) => {
        if (e.detail?.token) {
          resolve(e.detail.token);
        } else {
          // Fall back to OWA token endpoint
          fetchTokenFromOwa().then(resolve).catch(reject);
        }
      },
      { once: true }
    );

    // Inject a script into the page's real execution context to read boot data
    const script = document.createElement('script');
    script.textContent = `
      (function() {
        try {
          // OWA stores Graph tokens in the global boot config under various keys
          const boot = window.__boot__ || window.OWA || {};
          const accessToken =
            boot?.accessToken ||
            boot?.sessionSettings?.accessToken ||
            (window.Microsoft && window.Microsoft.Exchange && window.Microsoft.Exchange.bootData &&
              window.Microsoft.Exchange.bootData.accessToken) ||
            null;

          window.dispatchEvent(new CustomEvent(${JSON.stringify(eventName)}, {
            detail: { token: accessToken }
          }));
        } catch (err) {
          window.dispatchEvent(new CustomEvent(${JSON.stringify(eventName)}, {
            detail: { token: null }
          }));
        }
      })();
    `;
    (document.head || document.documentElement).appendChild(script);
    script.remove();
  });
}

async function fetchTokenFromOwa() {
  // OWA exposes an authenticated token endpoint at /owa/auth/oauthtoken
  // that returns a Graph-scoped token for the current session.
  const origin = window.location.origin; // e.g. https://outlook.office.com
  const resp = await fetch(`${origin}/owa/auth/oauthtoken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      resource: 'https://graph.microsoft.com',
    }),
    credentials: 'include',
  });

  if (!resp.ok) {
    throw new Error(
      'Could not retrieve an access token from Outlook. Make sure you are signed in to Outlook Web App.'
    );
  }

  const data = await resp.json();
  const token = data.access_token || data.accessToken || data.token;
  if (!token) {
    throw new Error('OWA token endpoint returned no token. Try reloading the Outlook tab.');
  }
  return token;
}
