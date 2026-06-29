import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SmartAutoAssignmentService } from '@/services/smartAutoAssignmentService';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function ManualAssignmentTest() {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const testAutoAssignment = async () => {
    setTesting(true);
    console.log('🔧 Testing auto-assignment for John Dingleby...');
    
    try {
      // Test the smart auto-assignment service
      const assignmentResult = await SmartAutoAssignmentService.assignBestTable(
        'e95d96dd-fbd6-4606-a7de-4ce9a6c3a731', // company ID
        '2025-09-06', // date
        '19:00:00', // time
        3, // party size
        'Window seat requested' // notes
      );
      
      console.log('🎯 Assignment result:', assignmentResult);
      
      if (assignmentResult.success && assignmentResult.assignedTable) {
        // Update the reservation with the assigned table
        const { error: updateError } = await supabase
          .from('reservations')
          .update({ 
            table_number: assignmentResult.assignedTable 
          })
          .eq('id', '74d0a2ca-89e7-4e5d-9ef2-34bc1b92aec9');
        
        if (updateError) {
          console.error('Error updating reservation:', updateError);
          toast.error('Failed to update reservation with assigned table');
        } else {
          toast.success(`Successfully assigned table ${assignmentResult.assignedTable} to John Dingleby`);
        }
      }
      
      setResult(assignmentResult);
      
    } catch (error) {
      console.error('Auto-assignment test failed:', error);
      toast.error('Auto-assignment test failed');
      setResult({ error: error.message });
    } finally {
      setTesting(false);
    }
  };

  const testTimelineOptimization = async () => {
    setTesting(true);
    console.log('🚀 Testing timeline optimization...');
    
    try {
      // Use the continuous-optimizer edge function instead
      const response = await supabase.functions.invoke('continuous-optimizer', {
        body: {
          companyId: 'e95d96dd-fbd6-4606-a7de-4ce9a6c3a731',
          mode: 'immediate',
          isAuthenticatedAdmin: true
        }
      });

      const optimizationResult = response.data || { success: false, movesCount: 0 };
      
      console.log('⚡ Optimization result:', optimizationResult);
      
      if (optimizationResult.success && optimizationResult.movesCount > 0) {
        toast.success(`Timeline optimized! Made ${optimizationResult.movesCount} improvements`);
      } else if (optimizationResult.success) {
        toast.info('Timeline is already optimized - no changes needed');
      } else {
        toast.error(`Timeline optimization failed: ${optimizationResult.reason || 'Unknown error'}`);
      }
      
      setResult(optimizationResult);
      
    } catch (error) {
      console.error('Timeline optimization test failed:', error);
      toast.error('Timeline optimization test failed');
      setResult({ error: error.message });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>🔧 Auto-Assignment Debug Tools</CardTitle>
        <CardDescription>
          Test the auto-assignment and timeline optimization services
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            onClick={testAutoAssignment}
            disabled={testing}
            variant="outline"
          >
            {testing ? 'Testing...' : '🎯 Test Auto-Assignment'}
          </Button>
          
          <Button 
            onClick={testTimelineOptimization}
            disabled={testing}
            variant="outline"
          >
            {testing ? 'Testing...' : '⚡ Test Timeline Optimization'}
          </Button>
        </div>
        
        {result && (
          <div className="mt-4">
            <h4 className="font-semibold mb-2">Test Result:</h4>
            <pre className="bg-muted p-3 rounded text-sm overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
        
        <div className="text-sm text-muted-foreground">
          <p><strong>Target Reservation:</strong> John Dingleby</p>
          <p><strong>Date:</strong> 2025-09-06 19:00</p>
          <p><strong>Party Size:</strong> 3 people</p>
          <p><strong>Notes:</strong> Window seat requested</p>
          <p><strong>Current Status:</strong> No table assigned</p>
        </div>
      </CardContent>
    </Card>
  );
}