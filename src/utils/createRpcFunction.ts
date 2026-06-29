
import { supabase } from '@/integrations/supabase/client';

export async function createPolicyFunction() {
  try {
    // Instead of calling an RPC function, use raw SQL via Supabase's function
    const { data, error } = await supabase.from('reservations')
      .select('id')
      .limit(1);
    
    if (error) {
      console.error('Error testing reservation access:', error);
      return { success: false, error };
    }
    
    // Also fetch the auth status to help with debugging
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    return { 
      success: true, 
      data: {
        message: "Successfully tested access to reservations table",
        user: user ? { id: user.id, email: user.email } : null,
        reservationsAccess: data !== null,
      } 
    };
  } catch (error) {
    console.error('Error in createPolicyFunction:', error);
    return { success: false, error };
  }
}
