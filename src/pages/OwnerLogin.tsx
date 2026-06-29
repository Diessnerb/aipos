import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { setBoundCompany } from '@/utils/deviceBinding';
import { clearPinUser } from '@/utils/pinAuth';
import { useDeviceBindingPrefetch } from '@/hooks/useDeviceBindingPrefetch';
import { PrefetchProgress } from '@/components/ui/prefetch-progress';
import { createDeviceProfile } from '@/utils/deviceDetection';
import { stabilizeBinding } from '@/utils/bindingStabilization';

const OwnerLogin: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const [showPrefetch, setShowPrefetch] = useState(false);
  const { comprehensivePrefetch, progress } = useDeviceBindingPrefetch();

  useEffect(() => {
    document.title = 'Owner Login | Restaurant Access';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', 'Restaurant owner login to bind this device and manage your locations.');
  }, []);

  const handleTitleClick = () => {
    setClickCount((prev) => prev + 1);
    if (clickCount === 6) {
      navigate('/super-admin-login');
      setClickCount(0);
    }
    setTimeout(() => setClickCount(0), 3000);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Clear any existing PIN session FIRST, before auth state changes
    clearPinUser();
    console.log('🧹 Cleared existing PIN session');
    
    try {
      console.log('🔐 Starting owner login process for:', email);
      
      // Normalize email to avoid case-sensitivity issues in company lookup
      const normalizedEmail = email.trim().toLowerCase();

      // Step 1: Authenticate with Supabase
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ 
        email: normalizedEmail, 
        password 
      });
      
      if (authError) {
        console.error('❌ Auth failed:', authError);
        throw authError;
      }
      console.log('✅ Auth successful for user:', authData.user?.id);

      // Check if temporary password was used
      if (password === 'Password') {
        sessionStorage.setItem('requiresPasswordChange', 'true');
        console.log('🔐 Temporary password detected - will require password change');
      }

      // CRITICAL: Wait for session to propagate to database connection
      // The RPC function uses SECURITY DEFINER which needs the auth context
      await new Promise(resolve => setTimeout(resolve, 300));

      // Step 2: Look up company by admin email using proper function
      console.log('🏢 Looking up company for email:', normalizedEmail);
      console.log('🔍 Auth session check:', {
        hasUser: !!authData.user,
        userId: authData.user?.id,
        userEmail: authData.user?.email
      });

      const { data: companyResults, error: companyErr } = await supabase
        .rpc('find_company_by_admin_email', { admin_email: normalizedEmail });

      console.log('📊 RPC Response:', {
        success: !companyErr,
        error: companyErr,
        resultsType: typeof companyResults,
        isArray: Array.isArray(companyResults),
        resultsLength: companyResults?.length,
        firstResult: companyResults?.[0]
      });
      
      const company = companyResults?.[0] || null;
      
      if (companyErr) {
        console.error('❌ Company lookup failed:', companyErr);
        throw new Error(`Company lookup failed: ${companyErr.message}`);
      }
      
      if (!company) {
        console.error('❌ No company found for email:', normalizedEmail);
        throw new Error('No company found with this admin email');
      }
      
      if (company.status !== 'active') {
        console.error('❌ Company not active:', company);
        throw new Error('Company account is not active');
      }
      console.log('✅ Company found:', company);

      // Step 3: Bind device to company with screen profile
      console.log('📱 Binding device to company with screen profile...');
      
      // Capture permanent device characteristics
      const deviceProfile = createDeviceProfile();
      if (!deviceProfile) {
        throw new Error('Failed to create device profile');
      }
      
      // Pre-calculate all layout dimensions based on screen size
      const viewportWidth = deviceProfile.screenWidth;
      const viewportHeight = deviceProfile.screenHeight;
      
      // Calculate container padding based on device type
      let containerPadding: number;
      if (deviceProfile.isTablet) {
        containerPadding = deviceProfile.orientation === 'landscape' ? 12 : 16;
      } else if (deviceProfile.isMobile) {
        containerPadding = 8;
      } else {
        containerPadding = 32;
      }
      
      // Pre-calculate column widths - optimized for tablet fit
      let tableColumnWidth: number;
      let seatsColumnWidth: number;
      if (deviceProfile.isTablet) {
        // Increased for better readability without clipping
        tableColumnWidth = deviceProfile.orientation === 'portrait' ? 80 : 90;
        seatsColumnWidth = deviceProfile.orientation === 'portrait' ? 60 : 70;
      } else if (deviceProfile.isMobile) {
        tableColumnWidth = 70;
        seatsColumnWidth = 50;
      } else {
        tableColumnWidth = 90;
        seatsColumnWidth = 70;
      }
      
      // Pre-calculate minimum dimensions - increased for better fit
      let minColumnWidth: number;
      if (deviceProfile.isTablet) {
        // Increased from 12/18 to 15/20 for better visibility
        minColumnWidth = deviceProfile.orientation === 'portrait' ? 15 : 20;
      } else {
        minColumnWidth = 15;
      }
      
      const headerHeight = deviceProfile.isTablet ? 42 : 45;
      
      let minRowHeight: number;
      if (deviceProfile.isTablet) {
        // Increased from 16/18 to 20/22 to prevent text clipping
        minRowHeight = deviceProfile.orientation === 'portrait' ? 20 : 22;
      } else if (deviceProfile.isMobile) {
        minRowHeight = 20;
      } else {
        minRowHeight = 24;
      }
      
      const precalculatedLayouts = {
        containerPadding,
        tableColumnWidth,
        seatsColumnWidth,
        minColumnWidth,
        headerHeight,
        minRowHeight
      };
      
      setBoundCompany({ 
        company_id: company.id as string, 
        company_name: company.name as string,
        device_profile: deviceProfile,
        precalculated_layouts: precalculatedLayouts
      });
      
      // Cache PIN users for offline authentication
      const { OfflinePinCacheService } = await import('@/device/OfflinePinCache');
      await OfflinePinCacheService.cacheCompanyPinUsers(company.id);
      
      console.log('✅ Device bound successfully with pre-calculated dimensions');

      // Step 4: Create/update user profile linked to this company for RLS
      console.log('👤 Ensuring user profile is linked to company...');
      try {
        const { error: profileError } = await supabase
          .from('users')
          .upsert([{
            auth_user_id: authData.user.id,
            email: normalizedEmail,
            full_name: 'Restaurant Owner',
            role: 'admin',
            company_id: company.id,
            is_company_admin: true
          }], { 
            onConflict: 'auth_user_id',
            ignoreDuplicates: false 
          });

        if (profileError) {
          console.warn('⚠️ Profile creation failed:', profileError);
        } else {
          console.log('✅ User profile linked to company');
        }
      } catch (profileErr) {
        console.warn('⚠️ Profile creation exception:', profileErr);
      }

      // Step 5: Comprehensive data prefetch for instant page access
      console.log('🚀 Starting comprehensive restaurant data prefetch...');
      setShowPrefetch(true);
      
      try {
        await comprehensivePrefetch(company.id);
        console.log('✅ Comprehensive data prefetch completed');
      } catch (prefetchError) {
        console.warn('⚠️ Comprehensive data prefetch failed:', prefetchError);
        // Continue anyway - app will still work, just slower
      }

      toast({ 
        title: 'Device bound', 
        description: `This device is now linked to ${company.name}. All restaurant data is preloaded and ready.` 
      });
      // Prefetch will handle navigation via useEffect below
      
    } catch (err: any) {
      console.error('❌ Login process failed:', err);
      toast({ 
        title: 'Login failed', 
        description: err?.message || 'Invalid credentials', 
        variant: 'destructive' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle navigation when prefetch completes
  useEffect(() => {
    if (showPrefetch && progress.isComplete) {
      const checkSetupAndNavigate = async () => {
        try {
          // Get company ID from localStorage
          const companyId = JSON.parse(localStorage.getItem('boundCompany') || '{}').company_id;
          if (!companyId) {
            console.error('❌ No company ID found in localStorage');
            navigate('/owner-login');
            return;
          }

          // CRITICAL: Run stabilization phase before navigation
          console.log('🔒 Running binding stabilization phase...');
          const stabilization = await stabilizeBinding(companyId);
          
          if (!stabilization.success) {
            console.warn('⚠️ Stabilization incomplete, but proceeding:', stabilization.errors);
            // Continue anyway - defensive programming
          } else {
            console.log('✅ Binding fully stabilized and verified');
          }

          // Check if setup wizard should be shown
          const { data: companySetup } = await supabase
            .from('companies')
            .select('setup_completed, first_admin_login_at')
            .eq('id', companyId)
            .single();

          const shouldShowSetup = !companySetup?.setup_completed;
          
          // Navigate immediately after stabilization (no additional delay needed)
          if (shouldShowSetup) {
            navigate('/setup-wizard');
          } else {
            navigate('/login');
          }
        } catch (error) {
          console.error('❌ Error during setup check or stabilization:', error);
          // Fallback to login with small delay
          setTimeout(() => navigate('/login'), 1000);
        }
      };

      checkSetupAndNavigate();
    }
  }, [showPrefetch, progress.isComplete, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 via-background to-secondary/20 p-4">
      <Card className="w-full max-w-md bg-background/80 backdrop-blur-sm border shadow-2xl rounded-3xl">
        <CardHeader className="text-center pb-6 pt-8">
          <CardTitle
            className="text-2xl font-bold tracking-tight cursor-pointer select-none"
            onClick={handleTitleClick}
          >
            Restaurant Owner Login
          </CardTitle>
          <p className="text-sm text-muted-foreground">Bind this device to your restaurant</p>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          {showPrefetch ? (
            <PrefetchProgress
              total={progress.total}
              completed={progress.completed}
              currentTask={progress.currentTask}
              isComplete={progress.isComplete}
              errors={progress.errors}
            />
          ) : (
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OwnerLogin;