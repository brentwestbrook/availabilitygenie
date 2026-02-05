# availabilitygenie

A calendar availability sharing tool that converts your free time into natural language.

## What it does

Connect your Google Calendar or Outlook, select open time slots by dragging across a week view, and get shareable text like:

> "I'm available Wednesday 2pm–5pm EST, Thursday 9am–12pm EST, or Friday 1pm–4pm EST."

Built because scheduling back-and-forth over email wastes time. This makes it faster.

## Stack

- React + TypeScript
- Vite for build
- Supabase for auth and calendar OAuth
- shadcn/ui + Tailwind for components
- date-fns for time manipulation

## Setup

```sh
git clone https://github.com/brentwestbrook/availabilitygenie.git
cd availabilitygenie
npm install
npm run dev
```

### Environment variables

Create a `.env` file with:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

You'll need Supabase configured with Google and Microsoft OAuth providers for calendar integration.

## How it works

1. OAuth flow authenticates with Google/Microsoft
2. Calendar events fetch via their respective APIs
3. Week view shows busy blocks
4. Click-drag selects free time (30-minute increments)
5. Natural language generator merges adjacent slots and formats readable text
6. Copy to clipboard, paste in email

The core logic lives in:
- `useCalendarConnections.ts` - OAuth + event fetching
- `useCalendarSelection.ts` - Drag selection state
- `useAvailabilityText.ts` - Time slot → natural language conversion

## Deploy

Build the static files and deploy to any hosting service:

```sh
npm run build
```

Static output in `/dist` can be hosted on:
- Azure Static Web Apps
- Netlify
- Vercel
- Any static file host

## License

MIT
