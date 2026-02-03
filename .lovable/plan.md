
# Update Availability Text Format

## Changes Required

Update the availability text output to:
1. Include the date in parentheses after the day name (e.g., "Thursday (2/5)")
2. Move the timezone to appear only once at the very end of the text

## Current vs New Format

| Current | New |
|---------|-----|
| `I'm available Thursday 9am–11am ET or Friday 2pm–4pm ET.` | `I'm available Thursday (2/5) 9am–11am or Friday (2/6) 2pm–4pm ET.` |

## File to Modify

| File | Change |
|------|--------|
| `src/hooks/useAvailabilityText.ts` | Update text formatting logic |

## Implementation Details

### 1. Add Date to Day Name

Change the day formatting to include the date in parentheses:

```typescript
// Current
const dayName = format(sortedDaySlots[0].start, 'EEEE');

// New - includes date like "Thursday (2/5)"
const dayName = format(sortedDaySlots[0].start, 'EEEE');
const dateStr = format(sortedDaySlots[0].start, 'M/d');
const dayWithDate = `${dayName} (${dateStr})`;
```

### 2. Remove Timezone from Each Part

Remove the timezone from each individual part:

```typescript
// Current
parts.push(`${dayName} ${formatTimeRange(slot.start, slot.end)} ${timezone}`);

// New - no timezone per part
parts.push(`${dayWithDate} ${formatTimeRange(slot.start, slot.end)}`);
```

### 3. Add Timezone Once at the End

Append the timezone only at the very end of the final sentence:

```typescript
// Current
if (parts.length === 1) return `I'm available ${parts[0]}.`;

// New - timezone added at end
if (parts.length === 1) return `I'm available ${parts[0]} ${timezone}.`;
if (parts.length === 2) return `I'm available ${parts[0]} or ${parts[1]} ${timezone}.`;

const lastPart = parts.pop();
return `I'm available ${parts.join(', ')}, or ${lastPart} ${timezone}.`;
```

## Example Outputs

- Single day: `I'm available Thursday (2/5) 9am–11am ET.`
- Two days: `I'm available Thursday (2/5) 9am–11am or Friday (2/6) 2pm–4pm ET.`
- Multiple days: `I'm available Thursday (2/5) 9am–11am, Friday (2/6) 2pm–4pm, or Monday (2/9) 10am–12pm ET.`
