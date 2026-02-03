
# Fix Microsoft OAuth "Refused to Connect" Error

## Problem

Microsoft's login page (`login.microsoftonline.com`) refuses to load because:
- The Lovable preview runs inside an **iframe**
- Microsoft blocks their login page from being embedded in iframes for security (X-Frame-Options header)
- Current code uses `window.location.href = url` which tries to redirect within the iframe

## Solution

Open the OAuth URL in a **popup window** instead of redirecting within the iframe. This is the standard approach for OAuth flows in embedded environments.

### How It Works

1. When user clicks "Connect", open a popup window with the Microsoft OAuth URL
2. User completes authentication in the popup (not blocked since it's a top-level window)
3. Microsoft redirects to callback, which redirects back with success/error
4. Main window detects the redirect and closes the popup
5. Calendar connections are refreshed

## Files to Modify

| File | Change |
|------|--------|
| `src/hooks/useCalendarConnections.ts` | Use `window.open()` popup instead of `window.location.href` for OAuth |

## Technical Details

### Current Code (Blocked)
```typescript
if (data?.url) {
  window.location.href = data.url;  // Tries to redirect within iframe - BLOCKED
}
```

### New Code (Works)
```typescript
if (data?.url) {
  // Open popup for OAuth (bypasses iframe restrictions)
  const popup = window.open(
    data.url,
    'oauth-popup',
    'width=600,height=700,left=100,top=100'
  );
  
  // Monitor popup for completion
  const pollInterval = setInterval(() => {
    try {
      if (popup?.closed) {
        clearInterval(pollInterval);
        setLoadingProvider(null);
        loadConnections();
      } else if (popup?.location?.href?.includes(window.location.origin)) {
        popup.close();
        clearInterval(pollInterval);
        loadConnections();
      }
    } catch (e) {
      // Cross-origin access blocked until redirect back to our domain
    }
  }, 500);
}
```

### Changes Apply to Both Providers
- `connectGoogle()` function
- `connectMicrosoft()` function

## Why This Works

- Popup windows are **top-level browser windows**, not iframes
- Microsoft (and Google) allow their login pages in top-level windows
- After authentication, the callback redirects back to your origin
- The main window detects this and refreshes the connection state

## Testing Notes

- Popup blockers may interfere - users may need to allow popups
- The popup should automatically close after successful authentication
- Both Google and Microsoft OAuth will use the same popup approach for consistency
