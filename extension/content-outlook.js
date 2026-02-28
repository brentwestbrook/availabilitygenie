/**
 * ISOLATED WORLD content script — injected into Outlook Web App tabs.
 *
 * Reads calendar events directly from the rendered DOM. No API calls or tokens
 * needed — content scripts have full read access to the page's DOM elements,
 * including the aria-label attributes Outlook uses for accessibility.
 *
 * When the background worker sends { type: 'FETCH_CALENDAR_EVENTS' }, this
 * script scrapes the currently visible calendar view and returns the events.
 *
 * Best results with Outlook's Week or Month view open on the calendar page.
 */

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'FETCH_CALENDAR_EVENTS') {
    try {
      const events = readCalendarFromDom();
      if (events.length === 0) {
        chrome.runtime.sendMessage({
          type: 'OUTLOOK_FETCH_ERROR',
          error:
            'No calendar events found on the Outlook page. ' +
            'Make sure you are on the Calendar view (not Mail) and that events are visible on screen.',
        });
      } else {
        // Derive the week being viewed from the earliest event that has an
        // explicit ISO date. This is sent to the Genie app so it can
        // auto-navigate to the correct week.
        const dates = events.map((e) => e.date).filter(Boolean).sort();
        const weekOf = dates[0] ?? null;
        chrome.runtime.sendMessage({ type: 'OUTLOOK_EVENTS_READY', events, weekOf });
      }
    } catch (err) {
      chrome.runtime.sendMessage({
        type: 'OUTLOOK_FETCH_ERROR',
        error: err?.message || 'Unknown error reading Outlook calendar.',
      });
    }
  }
});

// ---------------------------------------------------------------------------
// DOM scraper
// ---------------------------------------------------------------------------

function readCalendarFromDom() {
  const results = [];
  const seen = new Set();

  // Time range pattern: "9:30 AM – 10:00 AM" or "9:30 AM to 10:00 AM" (handles -, –, —, "to")
  const TIME_RANGE_FULL = /(\d{1,2}:\d{2}\s*[AP]M)\s*(?:[-\u2013\u2014]+|\bto\b)\s*(\d{1,2}:\d{2}\s*[AP]M)/i;
  const SINGLE_TIME = /\d{1,2}:\d{2}\s*[AP]M/i;

  // Day name pattern used to find dates in labels
  const DAY_NAMES = 'Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday';
  const DAY_DATE_INLINE = new RegExp(
    `\\b(${DAY_NAMES})[,\\s]+([A-Za-z]+\\.?\\s+\\d{1,2}(?:[,\\s]+\\d{4})?)`,
    'i'
  );
  // Numeric date patterns like "2/24/2026" or "2026-02-24"
  const NUMERIC_DATE = /\b(\d{4}-\d{2}-\d{2})\b|\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/;

  // Find all elements whose aria-label contains a time (AM/PM)
  const allLabelled = document.querySelectorAll('[aria-label]');

  for (const el of allLabelled) {
    const label = el.getAttribute('aria-label') || '';
    if (!SINGLE_TIME.test(label)) continue;

    // Must have a full time range to determine start + end
    const rangeMatch = TIME_RANGE_FULL.exec(label);
    if (!rangeMatch) continue;

    const startStr = rangeMatch[1];
    const endStr = rangeMatch[2];
    const start = to24h(startStr);
    const end = to24h(endStr);
    if (!start || !end) continue;

    // --- Extract title ---
    // Strip the time range from textContent first — if the matched element is a
    // time-only child span its textContent would otherwise become the title.
    const rawText = (el.textContent || '').replace(/\s+/g, ' ').trim();
    const visibleTitle = rawText.replace(TIME_RANGE_FULL, '').replace(SINGLE_TIME, '').replace(/\s+/g, ' ').trim();
    let title = visibleTitle || stripTimeDateFromLabel(label, rangeMatch[0]);
    title = title.slice(0, 120) || 'Busy'; // guard against pathologically long strings

    // --- Extract date ---
    let date = null;
    let day = null;

    // Strategy A: date embedded in the aria-label itself
    const inlineDate = DAY_DATE_INLINE.exec(label);
    if (inlineDate) {
      day = capitalise(inlineDate[1]);
      const parsed = parseLooseDate(inlineDate[2]);
      if (parsed) date = toISODate(parsed);
    }

    // Strategy B: numeric date in aria-label
    if (!date) {
      const numMatch = NUMERIC_DATE.exec(label);
      if (numMatch) {
        const parsed = new Date(numMatch[1] || numMatch[2]);
        if (!isNaN(parsed)) {
          date = toISODate(parsed);
          day = day || DAY_NAMES.split('|')[parsed.getDay()];
        }
      }
    }

    // Strategy C: walk up the DOM tree looking for a dated ancestor
    if (!date) {
      const ancestor = findDateAncestor(el, DAY_DATE_INLINE, NUMERIC_DATE, DAY_NAMES);
      if (ancestor) {
        date = ancestor.date;
        day = day || ancestor.day;
      }
    }

    // Deduplicate
    const key = `${date ?? day ?? '?'}-${start}-${end}-${title.slice(0, 40)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    results.push({ title, start, end, date: date ?? null, day: day ?? null });
  }

  return results;
}

/**
 * Walk up the DOM looking for an ancestor element that has date information
 * in its aria-label, data-date, or datetime attribute.
 */
function findDateAncestor(el, dayDatePattern, numericDatePattern, dayNames) {
  let node = el.parentElement;
  let depth = 0;
  while (node && depth < 12) {
    // Check data-date / datetime attributes first (most explicit)
    const dataDate = node.getAttribute('data-date') || node.getAttribute('datetime') || '';
    if (dataDate) {
      const parsed = new Date(dataDate);
      if (!isNaN(parsed)) {
        return {
          date: toISODate(parsed),
          day: dayNames.split('|')[parsed.getDay()],
        };
      }
    }

    // Check aria-label of ancestor
    const ancestorLabel = node.getAttribute('aria-label') || '';
    const inlineDate = dayDatePattern.exec(ancestorLabel);
    if (inlineDate) {
      const parsed = parseLooseDate(inlineDate[2]);
      if (parsed) {
        return {
          date: toISODate(parsed),
          day: capitalise(inlineDate[1]),
        };
      }
    }

    const numMatch = numericDatePattern.exec(ancestorLabel);
    if (numMatch) {
      const parsed = new Date(numMatch[1] || numMatch[2]);
      if (!isNaN(parsed)) {
        return {
          date: toISODate(parsed),
          day: dayNames.split('|')[parsed.getDay()],
        };
      }
    }

    node = node.parentElement;
    depth++;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert "9:30 AM" or "10:00 PM" → "09:30" / "22:00" */
function to24h(timeStr) {
  const m = /(\d{1,2}):(\d{2})\s*([AP]M)/i.exec(timeStr);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = m[2];
  const ampm = m[3].toUpperCase();
  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${min}`;
}

/** Parse loose date strings like "February 24", "Feb 24, 2026", "Feb. 24 2026" */
function parseLooseDate(str) {
  // Append current year if missing so JS Date can parse it
  const withYear = /\d{4}/.test(str) ? str : `${str} ${new Date().getFullYear()}`;
  const d = new Date(withYear);
  return isNaN(d) ? null : d;
}

/** Format a Date as "YYYY-MM-DD" */
function toISODate(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Remove the matched time range and date fragments from an aria-label to isolate the title */
function stripTimeDateFromLabel(label, timeRangeStr) {
  return label
    .replace(timeRangeStr, '')
    .replace(/(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)[^,]*/i, '')
    .replace(/[A-Za-z]+\.?\s+\d{1,2}(?:,\s*\d{4})?/g, '')
    .replace(/[,\s]+/g, ' ')
    .trim();
}

function capitalise(str) {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
