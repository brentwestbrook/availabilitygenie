import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarConnection } from '@/types/calendar';
import { Loader2, Plus, X } from 'lucide-react';

interface ConnectionPanelProps {
  googleConnections: CalendarConnection[];
  microsoftConnections: CalendarConnection[];
  loadingProvider: 'google' | 'microsoft' | null;
  onConnectGoogle: () => void;
  onConnectMicrosoft: () => void;
  onDisconnect: (connectionId: string) => void;
}

export function ConnectionPanel({
  googleConnections,
  microsoftConnections,
  loadingProvider,
  onConnectGoogle,
  onConnectMicrosoft,
  onDisconnect,
}: ConnectionPanelProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Calendar Connections</CardTitle>
        <CardDescription>
          Connect your calendars to view busy times
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Google Calendar Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Google Calendar</div>
            <Button
              size="sm"
              variant="outline"
              onClick={onConnectGoogle}
              disabled={loadingProvider !== null}
              className="h-7 gap-1"
            >
              {loadingProvider === 'google' ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Plus className="h-3 w-3" />
              )}
              Add Account
            </Button>
          </div>
          
          {googleConnections.length > 0 ? (
            <div className="space-y-1">
              {googleConnections.map((conn) => (
                <div
                  key={conn.id}
                  className="flex items-center justify-between py-1.5 px-2 bg-google/10 rounded-md"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-google" />
                    <span className="text-sm truncate max-w-[180px]">{conn.email}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => onDisconnect(conn.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No accounts connected</p>
          )}
        </div>

        {/* Microsoft Calendar Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Microsoft Outlook</div>
            <Button
              size="sm"
              variant="outline"
              onClick={onConnectMicrosoft}
              disabled={loadingProvider !== null}
              className="h-7 gap-1"
            >
              {loadingProvider === 'microsoft' ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Plus className="h-3 w-3" />
              )}
              Add Account
            </Button>
          </div>
          
          {microsoftConnections.length > 0 ? (
            <div className="space-y-1">
              {microsoftConnections.map((conn) => (
                <div
                  key={conn.id}
                  className="flex items-center justify-between py-1.5 px-2 bg-microsoft/10 rounded-md"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-microsoft" />
                    <span className="text-sm truncate max-w-[180px]">{conn.email}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => onDisconnect(conn.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No accounts connected</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
