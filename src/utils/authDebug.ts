
import { supabase } from '../integrations/supabase/client';

export const checkAuthStatus = async () => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      console.error("=== DEBUG: Error getting auth user ===", userError);
      return { 
        authenticated: false, 
        userId: null, 
        userEmail: null,
        error: userError.message
      };
    }
    
    if (!user) {
      console.log("=== DEBUG: No authenticated user found ===");
      return { 
        authenticated: false, 
        userId: null, 
        userEmail: null,
        error: "No authenticated user"
      };
    }
    
    console.log("=== DEBUG: Authenticated user ===", {
      id: user.id,
      email: user.email
    });
    
    // Try to get the user's role from the users table
    const { data: userData, error: roleError } = await supabase
      .from('users')
      .select('role, email, full_name, auth_user_id')
      .eq('auth_user_id', user.id)
      .single();
      
    if (roleError) {
      console.log("=== DEBUG: Error getting user role ===", roleError);
    }
    
    // Test if we can access the reservations table
    const { data: reservationsTestData, error: reservationsError } = await supabase
      .from('reservations')
      .select('count')
      .limit(1);
    
    if (reservationsError) {
      console.error("=== DEBUG: Cannot access reservations table ===", reservationsError);
    } else {
      console.log("=== DEBUG: Successfully accessed reservations table ===");
      console.log("=== DEBUG: Reservation test data ===", reservationsTestData);
    }
    
    // Try another approach - attempt to get a specific reservation
    const { data: singleReservation, error: singleResError } = await supabase
      .from('reservations')
      .select('*')
      .limit(1)
      .single();
      
    const reservationDetails = singleResError 
      ? { error: singleResError.message } 
      : { available: true, sample: singleReservation };
    
    return {
      authenticated: true,
      userId: user.id,
      userEmail: user.email,
      role: userData?.role || null,
      auth_user_id: userData?.auth_user_id || null,
      email_in_db: userData?.email || null,
      can_access_reservations: !reservationsError,
      reservationTest: reservationDetails
    };
  } catch (error) {
    console.error("=== DEBUG: Unexpected error in checkAuthStatus ===", error);
    return { 
      authenticated: false, 
      userId: null, 
      userEmail: null,
      error: String(error)
    };
  }
};
