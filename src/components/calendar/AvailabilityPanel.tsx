import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { TimeSlot } from '@/types/calendar';
import { Copy, Trash2, X } from 'lucide-react';
import { format } from 'date-fns';

interface AvailabilityPanelProps {
  selectedSlots: TimeSlot[];
  availabilityText: string;
  onCopy: () => void;
  onClear: () => void;
  onRemoveSlot: (id: string) => void;
}

export function AvailabilityPanel({
  selectedSlots,
  availabilityText,
  onCopy,
  onClear,
  onRemoveSlot,
}: AvailabilityPanelProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Handle Enter key for copying
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && document.activeElement !== textareaRef.current) {
        e.preventDefault();
        onCopy();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCopy]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Your Availability</CardTitle>
        <CardDescription>
          Drag on empty calendar slots to select free time
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Selected slots list */}
        {selectedSlots.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">Selected times:</div>
            <div className="space-y-1">
              {selectedSlots.map(slot => (
                <div
                  key={slot.id}
                  className="flex items-center justify-between bg-selection/10 rounded px-2 py-1 text-sm"
                >
                  <span>
                    {format(slot.start, 'EEE, MMM d')} • {format(slot.start, 'h:mm a')} – {format(slot.end, 'h:mm a')}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => onRemoveSlot(slot.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Generated text */}
        <Textarea
          ref={textareaRef}
          value={availabilityText}
          readOnly
          placeholder="Select time slots on the calendar to generate availability text..."
          className="min-h-[80px] resize-none"
        />

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            onClick={onCopy}
            className="flex-1 bg-selection hover:bg-selection/90"
            disabled={selectedSlots.length === 0}
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy availability
          </Button>
          <Button
            variant="outline"
            onClick={onClear}
            disabled={selectedSlots.length === 0}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Press <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Enter</kbd> to copy
        </p>
      </CardContent>
    </Card>
  );
}
