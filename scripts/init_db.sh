#!/bin/bash
# ════════════════════════════════════════
#  INIT DB — OrderGenieSolution
#  Exécuter APRÈS npx supabase start
# ════════════════════════════════════════

SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

echo "1/3 Création du compte admin..."
python3 -c "
import urllib.request, json
key = '$SERVICE_KEY'
data = json.dumps({'email':'Alex@admin.com','password':'Ammimmer27','email_confirm':True,'user_metadata':{'full_name':'Alex Admin','role':'admin'}}).encode()
req = urllib.request.Request('http://127.0.0.1:54321/auth/v1/admin/users', data=data, headers={'apikey':key,'Authorization':'Bearer '+key,'Content-Type':'application/json'})
try:
    resp = urllib.request.urlopen(req)
    print('  OK:', resp.read().decode()[:50])
except Exception as e:
    print('  Note:', e)
"

echo "2/3 Création de la société..."
CID=$(docker exec supabase_db_blsrpowvuxcvhqkeykyi psql -U postgres -d postgres -t -A -c "
INSERT INTO public.companies (name, subdomain, status, owner_pin, default_admin_email)
VALUES ('Restaurant Demo', 'demo', 'active', '1201', 'Alex@admin.com')
RETURNING id;
" 2>/dev/null)

echo "  Société créée: $CID"

echo "3/3 Liaison de l'utilisateur..."
docker exec supabase_db_blsrpowvuxcvhqkeykyi psql -U postgres -d postgres -c "
INSERT INTO public.users (auth_user_id, company_id, email, full_name, role, is_company_admin, is_owner, pin_code)
SELECT id, '$CID', 'Alex@admin.com', 'Alex Admin', 'admin', true, true, '1201'
FROM auth.users WHERE email = 'alex@admin.com';
" 2>/dev/null

echo "4/3 Correction de la fonction get_tables_requiring_attention..."
docker exec supabase_db_blsrpowvuxcvhqkeykyi psql -U postgres -d postgres -c "
DROP FUNCTION IF EXISTS public.get_tables_requiring_attention(uuid);
CREATE FUNCTION public.get_tables_requiring_attention(p_company_id uuid)
 RETURNS TABLE(schedule_id uuid, table_id uuid, table_number integer, table_name text, service_status text, scheduled_at timestamp with time zone, scheduled_end text, duration_days integer)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS \\$\\$\nBEGIN
  RETURN QUERY
  SELECT tss.id, t.id, t.table_number, t.table_name, tss.service_status, tss.scheduled_at, tss.scheduled_end, tss.duration_days
  FROM public.table_service_schedules tss
  JOIN public.tables t ON tss.table_id = t.id
  WHERE tss.company_id = p_company_id AND tss.requires_attention = true AND tss.resolved_at IS NULL
  ORDER BY tss.scheduled_end ASC NULLS LAST;
END;
\\$\\$\$\$;" 2>/dev/null && echo "  OK"

echo "5/3 Création du bucket de stockage..."
docker exec supabase_db_blsrpowvuxcvhqkeykyi psql -U postgres -d postgres -c "
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('company-assets', 'company-assets', true, 5242880, '{image/jpeg,image/png,image/webp,image/svg+xml}')
ON CONFLICT (id) DO NOTHING;
" 2>/dev/null && echo "  OK"

# Politiques RLS storage
docker exec supabase_db_blsrpowvuxcvhqkeykyi psql -U postgres -d postgres -c "
CREATE POLICY IF NOT EXISTS select_public_buckets ON storage.buckets FOR SELECT TO public USING (public = true);
CREATE POLICY IF NOT EXISTS all_authenticated_buckets ON storage.buckets FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS select_objects ON storage.objects FOR SELECT TO public USING (bucket_id IN (SELECT id FROM storage.buckets WHERE public = true));
CREATE POLICY IF NOT EXISTS insert_objects ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id IN (SELECT id FROM storage.buckets WHERE public = true));
CREATE POLICY IF NOT EXISTS update_objects ON storage.objects FOR UPDATE TO authenticated USING (bucket_id IN (SELECT id FROM storage.buckets WHERE public = true));
CREATE POLICY IF NOT EXISTS delete_objects ON storage.objects FOR DELETE TO authenticated USING (bucket_id IN (SELECT id FROM storage.buckets WHERE public = true));
" 2>/dev/null && echo "  OK"

echo ""
echo "═══════════════════════════════════════"
echo "  ✅ INIT TERMINÉ !"
echo "═══════════════════════════════════════"
echo ""
echo "Connecte-toi sur http://localhost:8080"
echo "  Email : Alex@admin.com"
echo "  Pass  : Ammimmer27"
echo "  PIN   : 1201"
