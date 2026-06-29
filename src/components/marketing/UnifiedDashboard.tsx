import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/hooks/use-toast';
import { useCompanyId } from '@/hooks/useCompanyId';
import { useQueryClient } from '@tanstack/react-query';
import { useMarketingKPIs, useTodaysQueue } from '@/hooks/useMarketingData';
import { Mail, MessageSquare, Instagram, Facebook, CheckCircle, Calendar, AlertCircle, Sparkles, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { SocialPostsModal } from './SocialPostsModal';
import { EmailCampaignsModal } from './EmailCampaignsModal';
import { SMSCampaignsModal } from './SMSCampaignsModal';
import { useState } from 'react';

interface UnifiedDashboardProps {
  onCreateCampaign?: () => void;
}

export function UnifiedDashboard({ onCreateCampaign }: UnifiedDashboardProps) {
  const { currentUser } = useCurrentUser();
  const { companyId: effectiveCompanyId } = useCompanyId();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dateRange] = useState({ start: new Date(new Date().setDate(new Date().getDate() - 30)), end: new Date() });
  const [syncing, setSyncing] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [smsModalOpen, setSmsModalOpen] = useState(false);
  const [instagramModalOpen, setInstagramModalOpen] = useState(false);
  const [facebookModalOpen, setFacebookModalOpen] = useState(false);
  const { data: kpis, isLoading: kpisLoading } = useMarketingKPIs(dateRange);
  const { data: queue, isLoading: queueLoading } = useTodaysQueue();

  const syncInstagramData = async () => {
    if (!effectiveCompanyId) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('marketing-sync', {
        body: { company_id: effectiveCompanyId, platform: 'instagram', data_type: 'all' }
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['marketing-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['social-media-posts'] });
      toast({ title: "Synced", description: `${data?.synced_records || 0} records` });
    } catch (error) {
      toast({ title: "Sync failed", description: error instanceof Error ? error.message : "Failed", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  if (kpisLoading || queueLoading) return <div className="space-y-6"><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">{[1,2,3,4].map(i => <Card key={i} className="animate-pulse"><CardHeader className="h-24 bg-muted"/><CardContent className="h-32 bg-muted/50"/></Card>)}</div></div>;
  if (!kpis) return null;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setEmailModalOpen(true)}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Email</CardTitle>
            <Mail className="h-4 w-4 text-green-600"/>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.email_sent.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{kpis.email_open_rate}% open · {kpis.email_click_rate}% click</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSmsModalOpen(true)}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">SMS</CardTitle>
            <MessageSquare className="h-4 w-4 text-red-600"/>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.sms_sent.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{kpis.sms_click_rate}% click rate</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setInstagramModalOpen(true)}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Instagram</CardTitle>
            <div className="flex gap-1"><Instagram className="h-4 w-4 text-pink-600"/><Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); syncInstagramData(); }} disabled={syncing}><RefreshCw className={`h-3 w-3 ${syncing?'animate-spin':''}`}/></Button></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.instagram_posts}</div>
            <p className="text-xs text-muted-foreground">{kpis.instagram_engagement_rate}% engagement</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFacebookModalOpen(true)}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Facebook</CardTitle>
            <Facebook className="h-4 w-4 text-blue-600"/>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.facebook_posts}</div>
            <p className="text-xs text-muted-foreground">{kpis.facebook_engagement_rate}% engagement</p>
          </CardContent>
        </Card>
      </div>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5"/>Today's Queue</CardTitle></CardHeader><CardContent><div className="grid gap-4 md:grid-cols-3"><div className="p-4 border rounded-lg"><AlertCircle className="h-4 w-4 text-orange-600 mb-2"/><div className="text-2xl font-bold">{queue?.pendingApprovals||0}</div><p className="text-xs">Pending</p></div><div className="p-4 border rounded-lg"><CheckCircle className="h-4 w-4 text-green-600 mb-2"/><div className="text-2xl font-bold">{queue?.scheduledToday||0}</div><p className="text-xs">Scheduled</p></div><div className="p-4 border rounded-lg"><AlertCircle className="h-4 w-4 text-red-600 mb-2"/><div className="text-2xl font-bold">{queue?.automationErrors||0}</div><p className="text-xs">Errors</p></div></div></CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-purple-600"/>AI Opportunities</CardTitle></CardHeader><CardContent><div className="space-y-3">{[{t:"Re-engage Inactive",d:"142 customers inactive 60+ days",p:"high"},{t:"Promote Top Items",d:"3 trending items",p:"medium"},{t:"Birthday Campaign",d:"28 birthdays this week",p:"medium"}].map((o,i)=><div key={i} className="flex justify-between p-4 border rounded-lg"><div><h4 className="font-medium flex items-center gap-2">{o.t}<Badge variant={o.p==='high'?'destructive':'secondary'} className="text-xs">{o.p==='high'?'High':'Med'}</Badge></h4><p className="text-sm text-muted-foreground">{o.d}</p></div><Button size="sm" onClick={onCreateCampaign}>Create</Button></div>)}</div></CardContent></Card>
      <EmailCampaignsModal isOpen={emailModalOpen} onClose={()=>setEmailModalOpen(false)}/>
      <SMSCampaignsModal isOpen={smsModalOpen} onClose={()=>setSmsModalOpen(false)}/>
      <SocialPostsModal isOpen={instagramModalOpen} onClose={()=>setInstagramModalOpen(false)} platform="instagram"/>
      <SocialPostsModal isOpen={facebookModalOpen} onClose={()=>setFacebookModalOpen(false)} platform="facebook"/>
    </div>
  );
}
