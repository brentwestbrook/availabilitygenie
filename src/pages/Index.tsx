import { useState, useMemo, useEffect, useCallback } from 'react';
import { startOfWeek, addDays } from 'date-fns';
import { CalendarHeader } from '@/components/calendar/CalendarHeader';
import { CalendarGrid } from '@/components/calendar/CalendarGrid';
import { ConnectionPanel } from '@/components/calendar/ConnectionPanel';
import { AvailabilityPanel } from '@/components/calendar/AvailabilityPanel';
import { InstructionsBanner } from '@/components/calendar/InstructionsBanner';
import { useCalendarSelection } from '@/hooks/useCalendarSelection';
import { useCalendarConnections } from '@/hooks/useCalendarConnections';
import { useExternalCalendar } from '@/hooks/useExternalCalendar';
import { useAvailabilityText } from '@/hooks/useAvailabilityText';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle } from 'lucide-react';

const Index = () => {
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 0 })
  );

  const {
    googleConnections,
    microsoftConnections,
    events,
    loadingProvider,
    error,
    connectGoogle,
    connectMicrosoft,
    disconnectConnection,
    refreshEvents,
  } = useCalendarConnections();

  // Get events from browser extension
  const { externalEvents, lastSync, requestEvents, targetWeekDate } = useExternalCalendar();

  // When a sync completes, auto-navigate to the week that was viewed in Outlook
  useEffect(() => {
    if (targetWeekDate) {
      setWeekStart(targetWeekDate);
    }
  }, [targetWeekDate]);

  // Combine OAuth events with external events
  const allEvents = useMemo(() => {
    return [...events, ...externalEvents];
  }, [events, externalEvents]);

  const {
    selectedSlots,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    clearSelections,
    removeSelection,
    getSelectionRange,
  } = useCalendarSelection(weekStart);

  const {
    availabilityText,
    copyToClipboard,
  } = useAvailabilityText(selectedSlots);

  // Copy text to clipboard first, then clear slots/text only on success
  const handleCopy = useCallback(async () => {
    const success = await copyToClipboard();
    if (success) {
      clearSelections();
    }
  }, [copyToClipboard, clearSelections]);

  const selectionRange = getSelectionRange();

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Calendar Availability
          </h1>
          <p className="text-muted-foreground">
            Share your free time in natural language
          </p>
        </div>

        {/* Instructions */}
        <InstructionsBanner />

        {/* External calendar sync status */}
        {lastSync && externalEvents.length > 0 && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Synced {externalEvents.length} events from Outlook Bridge at {lastSync.toLocaleTimeString()}
            </AlertDescription>
          </Alert>
        )}

        {/* Error state */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Main content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            <ConnectionPanel
              googleConnections={googleConnections}
              microsoftConnections={microsoftConnections}
              loadingProvider={loadingProvider}
              onConnectGoogle={connectGoogle}
              onConnectMicrosoft={connectMicrosoft}
              onDisconnect={disconnectConnection}
              outlookBridgeLastSync={lastSync}
              outlookBridgeEventCount={externalEvents.length}
              onReadOutlookCalendar={requestEvents}
            />
            <AvailabilityPanel
              selectedSlots={selectedSlots}
              availabilityText={availabilityText}
              onCopy={handleCopy}
              onClear={clearSelections}
              onRemoveSlot={removeSelection}
            />
          </div>

          {/* Calendar */}
          <div className="lg:col-span-3">
            <CalendarHeader
              weekStart={weekStart}
              onWeekChange={setWeekStart}
              onRefresh={refreshEvents}
              isLoading={loadingProvider !== null}
            />
            <CalendarGrid
              weekStart={weekStart}
              events={allEvents}
              selectedSlots={selectedSlots}
              selectionRange={selectionRange}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
            />

            {/* Legend */}
            <div className="flex items-center gap-6 mt-4 text-sm text-muted-foreground justify-center flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-google" />
                <span>Google Calendar</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-microsoft" />
                <span>Microsoft Outlook</span>
              </div>
              {externalEvents.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-gray-300" />
                  <span>Outlook Bridge</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-selection" />
                <span>Selected free time</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
