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

echo "✅ INIT TERMINÉ !"
echo "Connecte-toi avec Alex@admin.com / Ammimmer27 / PIN 1201"
