

# Calendar Availability Sharing App

A clean, minimal web app that merges your Google and Microsoft calendars and lets you quickly share your availability in natural language.

---

## Core Features

### 1. Calendar Connections
- **Google Calendar OAuth** - Securely connect your Google account to pull events
- **Microsoft Outlook OAuth** - Securely connect your Microsoft account (using Graph API)
- Connection status indicators showing which calendars are linked
- Easy disconnect/reconnect options

### 2. Merged Calendar View
- **Full 7-day week view** with hours on the vertical axis and days on the horizontal
- Events from both calendars merged and displayed with distinct visual styling (e.g., Google events in blue, Outlook events in purple)
- Overlapping events from different calendars both respected—any busy time from either source blocks that slot
- Fetch and display events for the next **14 days**
- Dark mode and light mode support (follows system preference)

### 3. Drag-to-Select Free Time
- Click and drag on empty (free) areas to select available time ranges
- Selected ranges highlighted in green for clear visibility
- Support for **selecting multiple separate ranges** across different days
- "Clear selection" button to reset all selections

### 4. Natural Language Availability Generator
- Press **Enter** or click **"Copy availability"** button to generate text
- Produces concise, professional sentences like:
  - *"I'm available Tuesday 2–4pm ET, Wednesday 10am–12pm ET, or Thursday after 3pm ET."*
- Groups ranges by day and merges adjacent/overlapping ranges
- Auto-detects browser timezone and includes abbreviation (e.g., ET, PT, CT)
- Auto-copies to clipboard
- Shows generated text in an editable text box so you can tweak before pasting

### 5. User Experience
- **Instructions banner** at the top explaining the flow:
  1. Connect calendars
  2. Wait for events to load
  3. Drag to select free time slots
  4. Press Enter or click button to copy availability
- If no time slots selected and Enter pressed → friendly prompt to select at least one range
- Error handling with clear messages and retry buttons if calendar data fails to load
- Loading states while fetching calendar data

---

## Technical Architecture

### Backend (Lovable Cloud)
- **Edge function for Google OAuth** - Handle token exchange and secure storage
- **Edge function for Microsoft OAuth** - Handle token exchange via Microsoft Graph
- **Edge function for calendar fetching** - Retrieve events from both providers and merge them
- Secure token storage so credentials never exposed in frontend

### Frontend (React)
- **Calendar component** - Week view with event display and selection capability
- **Selection state manager** - Track multiple selected time ranges
- **Availability text generator** - Convert selections to natural language
- **Theme provider** - Dark/light mode based on system preference
- **Connection manager UI** - OAuth buttons and status display

---

## User Flow

1. **First Visit**: See empty calendar with prompts to connect calendars
2. **Connect Google**: Click button → OAuth flow → return with Google events loaded
3. **Connect Microsoft**: Click button → OAuth flow → return with Outlook events loaded
4. **View Merged Calendar**: See all your events combined, busy times clearly blocked
5. **Select Free Time**: Drag across empty slots to highlight your availability
6. **Generate Text**: Press Enter or click button → availability sentence copied to clipboard
7. **Use It**: Paste into email, Slack, or wherever you need to share

---

## Design

- **Clean, minimal interface** with focus on the calendar
- **Dark mode support** that follows system preference
- Busy events shown with semi-transparent overlays
- Selected free time highlighted in green
- Clear visual distinction between Google (blue) and Outlook (purple) events
- Responsive design that works on desktop browsers

