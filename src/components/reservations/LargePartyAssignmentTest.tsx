import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { toast } from 'sonner';

interface TestResult {
  group_name: string;
  group_capacity: number;
  can_combine: boolean;
  all_tables: number[];
  out_of_service: number[];
  contiguous_selection: {
    table_numbers: number[];
    total_seats: number;
    strategy: string;
  } | null;
  selection_error?: string;
  test_reservation?: any;
  assigned_table?: number;
  assigned_tables?: number[];
  message?: string;
}

export const LargePartyAssignmentTest: React.FC = () => {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const { currentUser } = useCurrentUser();

  const runTest = async (includeReservation = false) => {
    if (!currentUser?.company_id) {
      toast.error('No company ID found');
      return;
    }

    setTesting(true);
    setResults([]);

    try {
      const { data, error } = await supabase.functions.invoke('test-large-party-assignment', {
        body: {
          company_id: currentUser.company_id,
          test_scenario: includeReservation ? 'create_reservation' : 'analysis_only'
        }
      });

      if (error) throw error;

      if (data.success) {
        setResults(data.test_results);
        toast.success('Large party assignment test completed');
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Test error:', error);
      toast.error(`Test failed: ${error.message}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Large Party Assignment Test</CardTitle>
        <CardDescription>
          Test the contiguous priority table assignment for parties of 20 people
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button 
              onClick={() => runTest(false)} 
              disabled={testing}
              variant="outline"
            >
              {testing ? 'Testing...' : 'Test Assignment Logic'}
            </Button>
            <Button 
              onClick={() => runTest(true)} 
              disabled={testing}
            >
              {testing ? 'Testing...' : 'Test with Reservation Creation'}
            </Button>
          </div>

          {results.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Test Results:</h3>
              {results.map((result, index) => (
                <Card key={index} className="p-4">
                  <div className="space-y-3">
                    {result.group_name && (
                      <>
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">Group: {result.group_name}</h4>
                          <Badge variant={result.can_combine ? 'default' : 'destructive'}>
                            {result.can_combine ? 'Available' : 'Unavailable'}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="font-medium">Capacity:</span> {result.group_capacity}
                          </div>
                          <div>
                            <span className="font-medium">All Tables:</span> {result.all_tables?.join(', ')}
                          </div>
                          {result.out_of_service?.length > 0 && (
                            <div className="col-span-2">
                              <span className="font-medium text-destructive">Out of Service:</span> {result.out_of_service.join(', ')}
                            </div>
                          )}
                        </div>

                        {result.contiguous_selection ? (
                          <div className="bg-muted p-3 rounded">
                            <div className="font-medium text-sm mb-2">Contiguous Selection:</div>
                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div>
                                <span className="font-medium">Tables:</span> {result.contiguous_selection.table_numbers?.join(', ')}
                              </div>
                              <div>
                                <span className="font-medium">Seats:</span> {result.contiguous_selection.total_seats}
                              </div>
                              <div>
                                <span className="font-medium">Strategy:</span> 
                                <Badge variant="secondary" className="ml-1">
                                  {result.contiguous_selection.strategy}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        ) : result.selection_error ? (
                          <div className="bg-destructive/10 text-destructive p-3 rounded text-sm">
                            Error: {result.selection_error}
                          </div>
                        ) : (
                          <div className="bg-muted p-3 rounded text-sm text-muted-foreground">
                            No contiguous selection possible for this group
                          </div>
                        )}
                      </>
                    )}

                    {result.test_reservation && (
                      <div className="bg-primary/10 p-3 rounded">
                        <div className="font-medium text-sm mb-2">Test Reservation Created:</div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="font-medium">Assigned Table:</span> {result.assigned_table || 'None'}
                          </div>
                          <div>
                            <span className="font-medium">Assigned Tables:</span> {result.assigned_tables?.join(', ') || 'None'}
                          </div>
                          <div className="col-span-2">
                            <span className="font-medium">Customer:</span> {result.test_reservation.customer_name}
                          </div>
                        </div>
                        {result.message && (
                          <div className="mt-2 text-sm text-muted-foreground">
                            {result.message}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};