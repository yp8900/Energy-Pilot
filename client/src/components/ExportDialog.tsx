import { useState, useEffect } from "react";
import { Download, FileSpreadsheet, Calendar, Clock, CalendarDays, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateRangePicker } from "./DateRangePicker";

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (options: ExportOptions) => void;
}

export interface ExportOptions {
  timeRange: 'daily' | 'weekly' | 'monthly' | 'custom';
  startDate?: string;
  endDate?: string;
  format: 'csv' | 'excel';
}

export function ExportDialog({ isOpen, onClose, onExport }: ExportDialogProps) {
  const [timeRange, setTimeRange] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>('weekly');
  const [format, setFormat] = useState<'csv' | 'excel'>('csv');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customDates, setCustomDates] = useState<{ startDate: string; endDate: string } | null>(null);

  const handleExport = () => {
    const options: ExportOptions = {
      timeRange,
      format,
      ...(timeRange === 'custom' && customDates ? customDates : {})
    };
    onExport(options);
    onClose();
  };

  const handleCustomDateConfirm = (dateRange: { startDate: string; endDate: string }) => {
    setCustomDates(dateRange);
    setShowDatePicker(false); // Explicitly close the date picker
  };

  const handleTimeRangeChange = (value: string) => {
    setTimeRange(value as any);
    if (value === 'custom' && !customDates) {
      // Automatically open date picker for custom selection
      setShowDatePicker(true);
    } else if (value !== 'custom') {
      // Clear custom dates if not custom
      setCustomDates(null);
      setShowDatePicker(false);
    }
  };

  const handleDialogClose = () => {
    // Reset all states when closing the main dialog
    setShowDatePicker(false);
    onClose();
  };

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      // Reset states when dialog closes
      setShowDatePicker(false);
    }
  }, [isOpen]);

  const timeRangeOptions = [
    {
      value: 'daily',
      label: 'Today',
      icon: Clock,
      description: 'Export today\'s consumption data'
    },
    {
      value: 'weekly',
      label: 'This Week',
      icon: Calendar,
      description: 'Export last 7 days of data'
    },
    {
      value: 'monthly',
      label: 'This Month',
      icon: CalendarDays,
      description: 'Export last 30 days of data'
    },
    {
      value: 'custom',
      label: 'Custom Range',
      icon: BarChart3,
      description: 'Select specific date range'
    }
  ];

  const formatOptions = [
    {
      value: 'csv',
      label: 'CSV File',
      description: 'Comma-separated values (Excel compatible)'
    },
    {
      value: 'excel',
      label: 'Excel File',
      description: 'Microsoft Excel (.xlsx) format'
    }
  ];

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Export Energy Consumption Data
            </DialogTitle>
            <DialogDescription>
              Export kWh consumption data with detailed metrics for analysis.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-6 pr-2">
            {/* Time Range Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Time Range</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {timeRangeOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    <div
                      key={option.value}
                      className={`p-3 border rounded-lg cursor-pointer transition-all ${
                        timeRange === option.value
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50 hover:bg-secondary/50'
                      }`}
                      onClick={() => handleTimeRangeChange(option.value)}
                    >
                      <div className="flex items-start gap-3">
                        <Icon className={`h-5 w-5 mt-0.5 ${
                          timeRange === option.value ? 'text-primary' : 'text-muted-foreground'
                        }`} />
                        <div className="flex-1">
                          <div className={`font-medium ${
                            timeRange === option.value ? 'text-primary' : 'text-foreground'
                          }`}>
                            {option.label}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {option.description}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Custom Date Range Summary */}
              {timeRange === 'custom' && customDates && (
                <div className="text-sm bg-secondary/50 p-3 rounded-md">
                  <strong>Selected Range:</strong><br/>
                  {new Date(customDates.startDate).toLocaleDateString()} to {new Date(customDates.endDate).toLocaleDateString()}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-2 h-auto p-1 text-xs"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowDatePicker(true);
                    }}
                  >
                    Change
                  </Button>
                </div>
              )}
            </div>

            {/* Format Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Export Format</Label>
              <Select value={format} onValueChange={(value) => setFormat(value as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {formatOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-3">
                        <FileSpreadsheet className="h-4 w-4" />
                        <div>
                          <div className="font-medium">{option.label}</div>
                          <div className="text-xs text-muted-foreground">
                            {option.description}
                          </div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Export Preview */}
            <div className="bg-secondary/20 p-4 rounded-lg border">
              <h4 className="font-medium text-sm mb-2">Export Will Include:</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Device-wise energy consumption (kWh)</li>
                <li>• Daily power usage averages (kW)</li>
                <li>• Estimated costs based on current rates</li>
                <li>• Date/time stamps for all readings</li>
                <li>• Device location and type information</li>
              </ul>
            </div>
          </div>

          <DialogFooter className="flex-shrink-0">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleExport}
              disabled={timeRange === 'custom' && !customDates}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Export Data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Date Range Picker */}
      <DateRangePicker
        key={`date-picker-${showDatePicker}`}
        isOpen={showDatePicker}
        onClose={() => {
          setShowDatePicker(false);
        }}
        onConfirm={handleCustomDateConfirm}
        title="Select Custom Date Range"
        description="Choose the specific date range for your consumption export."
      />
    </>
  );
}