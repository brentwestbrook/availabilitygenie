import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarConnection } from '@/types/calendar';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';

interface ConnectionPanelProps {
  connections: CalendarConnection[];
  isLoading: boolean;
  onConnectGoogle: () => void;
  onConnectMicrosoft: () => void;
  onDisconnect: (provider: 'google' | 'microsoft') => void;
}

export function ConnectionPanel({
  connections,
  isLoading,
  onConnectGoogle,
  onConnectMicrosoft,
  onDisconnect,
}: ConnectionPanelProps) {
  const googleConnection = connections.find(c => c.provider === 'google');
  const microsoftConnection = connections.find(c => c.provider === 'microsoft');

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Calendar Connections</CardTitle>
        <CardDescription>
          Connect your calendars to view busy times
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Google Calendar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {googleConnection?.connected ? (
              <CheckCircle2 className="h-4 w-4 text-google" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground" />
            )}
            <div>
              <div className="text-sm font-medium">Google Calendar</div>
              {googleConnection?.email && (
                <div className="text-xs text-muted-foreground">{googleConnection.email}</div>
              )}
            </div>
          </div>
          {googleConnection?.connected ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDisconnect('google')}
            >
              Disconnect
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={onConnectGoogle}
              disabled={isLoading}
              className="bg-google hover:bg-google/90"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Connect'}
            </Button>
          )}
        </div>

        {/* Microsoft Calendar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {microsoftConnection?.connected ? (
              <CheckCircle2 className="h-4 w-4 text-microsoft" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground" />
            )}
            <div>
              <div className="text-sm font-medium">Microsoft Outlook</div>
              {microsoftConnection?.email && (
                <div className="text-xs text-muted-foreground">{microsoftConnection.email}</div>
              )}
            </div>
          </div>
          {microsoftConnection?.connected ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDisconnect('microsoft')}
            >
              Disconnect
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={onConnectMicrosoft}
              disabled={isLoading}
              className="bg-microsoft hover:bg-microsoft/90"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Connect'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
