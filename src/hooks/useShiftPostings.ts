import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/AuthProvider';
import { offlineAwareUpdate, offlineAwareInsert } from '@/utils/offlineAwareSupabase';

interface ShiftPosting {
  id: string;
  original_user_id: string;
  shift_date: string;
  shift_start_time: string;
  shift_finish_time: string;
  day_of_week: string;
  status: string;
  request_type: string;
  requested_by_user_id: string | null;
  accepted_by_user_id: string | null;
  created_at: string;
  users?: {
    full_name: string;
  };
  requested_by?: {
    full_name: string;
  };
  accepted_by?: {
    full_name: string;
  };
}

export const useShiftPostings = () => {
  const [shiftPostings, setShiftPostings] = useState<ShiftPosting[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user, pinUser } = useAuth();

  // New: fetch only postings that require approval and are in 'pending_approval' status
  const fetchShiftApprovals = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('shift_swap_requests')
        .select(`
          *,
          users!shift_swap_requests_original_user_id_fkey (
            full_name
          ),
          requested_by:users!shift_swap_requests_requested_by_user_id_fkey (
            full_name
          ),
          accepted_by:users!shift_swap_requests_accepted_by_user_id_fkey (
            full_name
          )
        `)
        .eq('status', 'pending_approval')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setShiftPostings(data || []);
    } catch (error) {
      console.error('Error fetching shift requests pending approval:', error);
      toast({
        title: "Error",
        description: "Failed to fetch pending approvals",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchShiftPostings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('shift_swap_requests')
        .select(`
          *,
          users!shift_swap_requests_original_user_id_fkey (
            full_name
          ),
          requested_by:users!shift_swap_requests_requested_by_user_id_fkey (
            full_name
          ),
          accepted_by:users!shift_swap_requests_accepted_by_user_id_fkey (
            full_name
          )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setShiftPostings(data || []);
    } catch (error) {
      console.error('Error fetching shift postings:', error);
      toast({
        title: "Error",
        description: "Failed to fetch shift postings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // New: approval actions
  const approveShift = async (requestId: string) => {
    try {
      // Determine the effective user context (manager/admin approving)
      let effectiveUserId: string | null = null;

      if (pinUser && pinUser.user_id) {
        effectiveUserId = pinUser.user_id;
      } else if (user && user.id) {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id')
          .eq('auth_user_id', user.id)
          .single();
        if (userError || !userData?.id) {
          toast({
            title: "Error",
            description: "Could not resolve your user account to approve.",
            variant: "destructive",
          });
          return;
        }
        effectiveUserId = userData.id;
      }

      if (!effectiveUserId) {
        toast({
          title: "Error",
          description: "You must be logged in to approve shifts.",
          variant: "destructive",
        });
        return;
      }

      const now = new Date().toISOString();

      const { error } = await offlineAwareUpdate('shift_swap_requests', requestId, {
        status: 'approved',
        approved_by_user_id: effectiveUserId,
        approved_at: now,
      });

      if (error) throw error;

      toast({
        title: "Approved",
        description: "Shift request approved.",
      });

      fetchShiftApprovals();
    } catch (error) {
      console.error('Error approving shift:', error);
      toast({
        title: "Error",
        description: "Failed to approve shift.",
        variant: "destructive",
      });
    }
  };

  const rejectShift = async (requestId: string) => {
    try {
      let effectiveUserId: string | null = null;

      if (pinUser && pinUser.user_id) {
        effectiveUserId = pinUser.user_id;
      } else if (user && user.id) {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id')
          .eq('auth_user_id', user.id)
          .single();
        if (userError || !userData?.id) {
          toast({
            title: "Error",
            description: "Could not resolve your user account to reject.",
            variant: "destructive",
          });
          return;
        }
        effectiveUserId = userData.id;
      }

      if (!effectiveUserId) {
        toast({
          title: "Error",
          description: "You must be logged in to reject shifts.",
          variant: "destructive",
        });
        return;
      }

      const now = new Date().toISOString();

      const { error } = await offlineAwareUpdate('shift_swap_requests', requestId, {
        status: 'rejected',
        approved_by_user_id: effectiveUserId,
        approved_at: now,
      });

      if (error) throw error;

      toast({
        title: "Rejected",
        description: "Shift request rejected.",
      });

      fetchShiftApprovals();
    } catch (error) {
      console.error('Error rejecting shift:', error);
      toast({
        title: "Error",
        description: "Failed to reject shift.",
        variant: "destructive",
      });
    }
  };

  const createApprovalRequest = async ({
    shift_swap_request_id,
    requester_user_id,
    reason,
    day_of_week,
    shift_date,
    requested_hours,
  }: {
    shift_swap_request_id: string;
    requester_user_id: string;
    reason: 'overlap' | 'overtime';
    day_of_week: string;
    shift_date: string;
    requested_hours: number;
  }) => {
    // Always check before creating an approval request
    await offlineAwareInsert("shift_approval_requests", {
      shift_swap_request_id,
      requester_user_id,
      reason,
      day_of_week,
      shift_date,
      requested_hours
    });
  };

  const postShift = async (shiftData: {
    original_user_id: string;
    shift_date: string;
    shift_start_time: string;
    shift_finish_time: string;
    day_of_week: string;
    request_type: string;
  }) => {
    try {
      // Determine the effective user context
      let effectiveUserId: string | null = null;

      if (pinUser && pinUser.user_id) {
        effectiveUserId = pinUser.user_id;
      } else if (user && user.id) {
        // Look up the app user_id for this supabase auth user
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id')
          .eq('auth_user_id', user.id)
          .single();

        if (userError || !userData?.id) {
          toast({
            title: "Error",
            description: "Could not resolve your application user account.",
            variant: "destructive",
          });
          return;
        }
        effectiveUserId = userData.id;
      }

      if (!effectiveUserId) {
        toast({
          title: "Error",
          description: "You must be logged in to post a shift.",
          variant: "destructive",
        });
        return;
      }

      // Compute shift length for over-10-hour check (assuming finish_time > start_time, in decimal hours)
      const parseTime = (time: string) => {
        if (!time || typeof time !== "string") return 0;
        if (time.includes(".")) {
          const [h, m] = time.split(".");
          return parseInt(h) + (parseInt(m) || 0) / 60;
        }
        return parseInt(time) || 0;
      };
      const hours = parseTime(shiftData.shift_finish_time) - parseTime(shiftData.shift_start_time);
      const isOvertime = hours > 10;

      // Check for overlap: query accepted/approved shifts for the same user/date that intersect
      let isOverlap = false;
      {
        const { data: existingShifts } = await supabase
          .from("shift_swap_requests")
          .select("id, shift_start_time, shift_finish_time, shift_date, status")
          .eq("original_user_id", shiftData.original_user_id)
          .eq("shift_date", shiftData.shift_date)
          .in("status", ["approved", "accepted"]);

        if (existingShifts && existingShifts.length > 0) {
          for (const s of existingShifts) {
            const sStart = parseTime(s.shift_start_time);
            const sEnd = parseTime(s.shift_finish_time);
            // Overlap if start < other_end && finish > other_start
            if (
              (parseTime(shiftData.shift_start_time) < sEnd) &&
              (parseTime(shiftData.shift_finish_time) > sStart)
            ) {
              isOverlap = true;
              break;
            }
          }
        }
      }

      // Insert posted shift (goes to pending_approval)
      const { data: inserted, error } = await supabase
        .from('shift_swap_requests')
        .insert({
          ...shiftData,
          requested_by_user_id: null, // No specific requester for posted shifts
          status: 'pending_approval',
          requires_approval: true,
        })
        .select()
        .single();
      if (error) throw error;

      // If overlap or overtime, add approval request
      if (inserted) {
        const reasons: Array<'overlap' | 'overtime'> = [];
        if (isOverlap) reasons.push("overlap");
        if (isOvertime) reasons.push("overtime");
        for (const reason of reasons) {
          await createApprovalRequest({
            shift_swap_request_id: inserted.id,
            requester_user_id: shiftData.original_user_id,
            reason,
            day_of_week: shiftData.day_of_week,
            shift_date: shiftData.shift_date,
            requested_hours: hours,
          });
        }
      }

      toast({
        title: "Success",
        description: isOverlap || isOvertime
          ? "Shift posted, manager approval required."
          : "Shift posted for manager approval.",
      });

      fetchShiftPostings();
    } catch (error) {
      console.error('Error posting shift:', error);
      toast({
        title: "Error",
        description: "Failed to post shift",
        variant: "destructive",
      });
    }
  };

  const acceptShift = async (shiftId: string) => {
    try {
      // Determine the effective user context
      let effectiveUserId: string | null = null;

      if (pinUser && pinUser.user_id) {
        effectiveUserId = pinUser.user_id;
      } else if (user && user.id) {
        // Look up the app user_id for this supabase auth user
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id')
          .eq('auth_user_id', user.id)
          .single();

        if (userError || !userData?.id) {
          toast({
            title: "Error",
            description: "Could not resolve your application user account.",
            variant: "destructive",
          });
          return;
        }
        effectiveUserId = userData.id;
      }

      if (!effectiveUserId) {
        toast({
          title: "Error",
          description: "You must be logged in to accept a shift.",
          variant: "destructive",
        });
        return;
      }

      // Fetch the shift to be accepted
      const { data: shiftToAccept, error: loadShiftError } = await supabase
        .from('shift_swap_requests')
        .select('shift_date, shift_start_time, shift_finish_time, original_user_id')
        .eq('id', shiftId)
        .single();
      if (loadShiftError || !shiftToAccept) {
        toast({
          title: "Error",
          description: "Could not load the shift to accept.",
          variant: "destructive",
        });
        return;
      }

      // Fetch user's already accepted or approved shifts on the same day
      const { data: existingShifts, error: fetchUserShiftsError } = await supabase
        .from('shift_swap_requests')
        .select('id, shift_start_time, shift_finish_time, shift_date')
        .or(`accepted_by_user_id.eq.${effectiveUserId},original_user_id.eq.${effectiveUserId}`)
        .in('status', ['approved', 'accepted'])
        .eq('shift_date', shiftToAccept.shift_date);

      if (fetchUserShiftsError) {
        toast({
          title: "Error",
          description: "Failed to check for shift conflicts.",
          variant: "destructive",
        });
        return;
      }

      // Utility to parse time as decimal number
      const parseTime = (time: string) => {
        if (!time || typeof time !== "string") return 0;
        if (time.includes(".")) {
          const [h, m] = time.split(".");
          return parseInt(h) + (parseInt(m) || 0) / 60;
        }
        return parseInt(time) || 0;
      };

      const newStart = parseTime(shiftToAccept.shift_start_time);
      const newEnd = parseTime(shiftToAccept.shift_finish_time);

      // Check for overlap
      let hasOverlap = false;
      if (existingShifts) {
        for (const s of existingShifts) {
          if (s.id === shiftId) continue; // Skip the same shift (shouldn't happen for new acceptances)
          const sStart = parseTime(s.shift_start_time);
          const sEnd = parseTime(s.shift_finish_time);
          // Overlap logic: start < other_end && finish > other_start
          if (newStart < sEnd && newEnd > sStart) {
            hasOverlap = true;
            break;
          }
        }
      }

      if (hasOverlap) {
        toast({
          title: "Overlap Detected",
          description: "You already have a shift on this day that overlaps. You cannot accept overlapping shifts.",
          variant: "destructive",
        });
        return;
      }

      // No overlap, proceed to accept
      const { error } = await offlineAwareUpdate('shift_swap_requests', shiftId, { 
        status: 'accepted',
        accepted_by_user_id: effectiveUserId
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Shift accepted successfully",
      });

      fetchShiftPostings();
    } catch (error) {
      console.error('Error accepting shift:', error);
      toast({
        title: "Error",
        description: "Failed to accept shift",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchShiftPostings();
  }, []);

  // Expose approval fetch/actions, plus normal posting actions
  return {
    shiftPostings,
    loading,
    postShift,
    acceptShift,
    refetch: fetchShiftPostings,
    fetchApprovals: fetchShiftApprovals,
    approveShift,
    rejectShift,
  };
};
