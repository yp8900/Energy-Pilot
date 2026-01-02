import { useState, useEffect } from "react";
import { Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface DateRange {
  startDate: string;
  endDate: string;
}

interface DateRangePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (dateRange: DateRange) => void;
  title?: string;
  description?: string;
}

export function DateRangePicker({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = "Select Date Range",
  description = "Choose start and end dates for your custom range."
}: DateRangePickerProps) {
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date.toISOString().split('T')[0];
  });
  
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Reset to default values when dialog opens
  useEffect(() => {
    if (isOpen) {
      const endDateDefault = new Date().toISOString().split('T')[0];
      const startDateDefault = new Date();
      startDateDefault.setDate(startDateDefault.getDate() - 7);
      
      setStartDate(startDateDefault.toISOString().split('T')[0]);
      setEndDate(endDateDefault);
    }
  }, [isOpen]);

  const handleConfirm = () => {
    if (startDate && endDate) {
      onConfirm({ startDate, endDate });
      onClose();
    }
  };

  const handleQuickSelect = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {/* Quick Select Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickSelect(7)}
              className="text-xs"
            >
              Last 7 days
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickSelect(30)}
              className="text-xs"
            >
              Last 30 days
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickSelect(90)}
              className="text-xs"
            >
              Last 90 days
            </Button>
          </div>

          {/* Date Inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate" className="text-sm font-medium">
                Start Date
              </Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                max={endDate}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate" className="text-sm font-medium">
                End Date
              </Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>

          {/* Date Range Summary */}
          {startDate && endDate && (
            <div className="text-sm text-muted-foreground bg-secondary/50 p-3 rounded-md">
              <strong>Selected Range:</strong><br/>
              {new Date(startDate).toLocaleDateString()} to {new Date(endDate).toLocaleDateString()}
              <br/>
              <span className="text-xs">
                ({Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1} days)
              </span>
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={!startDate || !endDate || new Date(startDate) > new Date(endDate)}
          >
            Apply Range
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}