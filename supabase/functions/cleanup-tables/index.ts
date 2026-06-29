import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          persistSession: false,
        },
      }
    );

    const { tableNumbers, companyId } = await req.json();

    console.log(`Cleaning up tables: ${tableNumbers} for company: ${companyId}`);

    // First, get the table IDs
    const { data: existingTables, error: checkError } = await supabase
      .from("tables")
      .select("id, table_number")
      .eq("company_id", companyId)
      .in("table_number", tableNumbers);

    console.log("Existing tables before delete:", JSON.stringify(existingTables));
    
    if (checkError) {
      console.error("Check error:", checkError);
      throw checkError;
    }

    if (!existingTables || existingTables.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No tables found to delete",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const tableIds = existingTables.map(t => t.id);

    // Try deleting using IDs
    const { data: deleteData, error: deleteError, count } = await supabase
      .from("tables")
      .delete({ count: 'exact' })
      .in("id", tableIds)
      .select();

    console.log("Delete result:", { 
      deleteData: JSON.stringify(deleteData), 
      deleteError: JSON.stringify(deleteError),
      count 
    });

    if (deleteError) {
      console.error("Delete error:", deleteError);
      throw deleteError;
    }

    // Verify deletion
    const { data: remainingTables } = await supabase
      .from("tables")
      .select("id, table_number")
      .eq("company_id", companyId)
      .in("table_number", tableNumbers);

    console.log("Remaining tables after delete:", JSON.stringify(remainingTables));

    return new Response(
      JSON.stringify({
        success: true,
        message: `Deleted ${count || 0} tables: ${tableNumbers.join(", ")}`,
        deletedTables: deleteData,
        remainingTables: remainingTables,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
