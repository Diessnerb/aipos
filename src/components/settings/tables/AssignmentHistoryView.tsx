import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, Users, MapPin, CheckCircle, XCircle, AlertTriangle, Search, Filter } from 'lucide-react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { format } from 'date-fns';

interface AssignmentHistoryEntry {
  id: string;
  reservation_id: string;
  assigned_tables: number[];
  assignment_strategy: string;
  success: boolean;
  conflict_detected: boolean;
  rule_applied: string | null;
  created_at: string;
  // Reservation details (if available via join)
  customer_name?: string;
  party_size?: number;
  reservation_time?: string;
  reservation_date?: string;
}

export function AssignmentHistoryView() {
  const { currentUser } = useCurrentUser();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [ruleFilter, setRuleFilter] = useState<string>('all');

  const { data: history = [], isLoading } = useQuery({
    queryKey: ['assignment-history', currentUser?.company_id, statusFilter, ruleFilter],
    queryFn: async () => {
      if (!currentUser?.company_id) return [];

      let query = supabase
        .from('assignment_history')
        .select(`
          *,
          reservations:reservation_id (
            customer_name,
            party_size,
            time,
            date
          )
        `)
        .eq('company_id', currentUser.company_id)
        .order('created_at', { ascending: false })
        .limit(50);

      // Apply filters
      if (statusFilter !== 'all') {
        if (statusFilter === 'success') {
          query = query.eq('success', true);
        } else if (statusFilter === 'failed') {
          query = query.eq('success', false);
        } else if (statusFilter === 'conflicts') {
          query = query.eq('conflict_detected', true);
        }
      }

      if (ruleFilter !== 'all') {
        if (ruleFilter === 'no_rule') {
          query = query.is('rule_applied', null);
        } else {
          query = query.eq('rule_applied', ruleFilter);
        }
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching assignment history:', error);
        return [];
      }

      return data as any[];
    },
    enabled: !!currentUser?.company_id
  });

  // Get unique rules for filter dropdown
  const { data: availableRules = [] } = useQuery({
    queryKey: ['assignment-rules-for-filter', currentUser?.company_id],
    queryFn: async () => {
      if (!currentUser?.company_id) return [];

      const { data, error } = await supabase
        .from('assignment_rules')
        .select('rule_name')
        .eq('company_id', currentUser.company_id);

      if (error) return [];
      return data.map(r => r.rule_name);
    },
    enabled: !!currentUser?.company_id
  });

  // Filter by search term
  const filteredHistory = history.filter(entry => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    const customerName = (entry.reservations as any)?.customer_name?.toLowerCase() || '';
    const ruleName = entry.rule_applied?.toLowerCase() || '';
    const tables = entry.assigned_tables?.join(', ') || '';
    
    return (
      customerName.includes(searchLower) ||
      ruleName.includes(searchLower) ||
      tables.includes(searchLower)
    );
  });

  const getStatusIcon = (entry: AssignmentHistoryEntry) => {
    if (entry.conflict_detected) {
      return <AlertTriangle className="h-4 w-4 text-orange-500" />;
    }
    return entry.success ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    );
  };

  const getStatusLabel = (entry: AssignmentHistoryEntry) => {
    if (entry.conflict_detected) return 'Conflict Detected';
    return entry.success ? 'Success' : 'Failed';
  };

  const getStatusColor = (entry: AssignmentHistoryEntry) => {
    if (entry.conflict_detected) return 'bg-orange-100 text-orange-800';
    return entry.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading assignment history...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Assignment History
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            See how your rules have been applied to recent reservations
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by customer name, rule, or table..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Assignments</SelectItem>
                <SelectItem value="success">Successful</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="conflicts">With Conflicts</SelectItem>
              </SelectContent>
            </Select>

            <Select value={ruleFilter} onValueChange={setRuleFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by rule" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Rules</SelectItem>
                <SelectItem value="no_rule">No Rule Applied</SelectItem>
                {availableRules.map(rule => (
                  <SelectItem key={rule} value={rule}>{rule}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* History Entries */}
          {filteredHistory.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No Assignment History</h3>
              <p className="text-muted-foreground">
                {history.length === 0 
                  ? "Start making reservations to see assignment history here"
                  : "No assignments match your current filters"
                }
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredHistory.map((entry) => {
                const reservation = entry.reservations as any;
                return (
                  <div key={entry.id} className="p-4 rounded-lg border hover:bg-muted/20 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(entry)}
                        <div>
                          <h4 className="font-medium">
                            {reservation?.customer_name || 'Unknown Customer'}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(entry.created_at), 'MMM dd, yyyy at h:mm a')}
                          </p>
                        </div>
                      </div>
                      
                      <Badge className={getStatusColor(entry)}>
                        {getStatusLabel(entry)}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {reservation?.party_size || '?'} people
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {reservation?.date} at {reservation?.time}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {entry.assigned_tables?.length > 0 
                            ? `Table${entry.assigned_tables.length > 1 ? 's' : ''} ${entry.assigned_tables.join(', ')}`
                            : 'No tables assigned'
                          }
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {entry.rule_applied || 'Default assignment'}
                        </span>
                      </div>
                    </div>

                    {/* Additional Details */}
                    <div className="text-xs text-muted-foreground">
                      <span>Strategy: {entry.assignment_strategy}</span>
                      {entry.conflict_detected && (
                        <span className="ml-4 text-orange-600">⚠️ Conflict was detected during assignment</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Load More */}
          {filteredHistory.length >= 50 && (
            <div className="text-center">
              <Button variant="outline">Load More History</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}