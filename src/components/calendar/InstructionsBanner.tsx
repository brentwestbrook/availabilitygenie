import { Card, CardContent } from '@/components/ui/card';
import { Calendar, MousePointerClick, Keyboard, Copy } from 'lucide-react';

export function InstructionsBanner() {
  return (
    <Card className="bg-muted/30 border-dashed">
      <CardContent className="py-4">
        <div className="flex items-center justify-center gap-8 text-sm">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
              1
            </div>
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>Connect calendars</span>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
              2
            </div>
            <MousePointerClick className="h-4 w-4 text-muted-foreground" />
            <span>Drag to select free time</span>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
              3
            </div>
            <Keyboard className="h-4 w-4 text-muted-foreground" />
            <span>Press Enter or click Copy</span>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
              4
            </div>
            <Copy className="h-4 w-4 text-muted-foreground" />
            <span>Paste anywhere!</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
