
import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster as ReactHotToast } from "react-hot-toast";
import { AuthProvider } from "./components/AuthProvider";
import { DeviceLiveLayerProvider } from "./providers/DeviceLiveLayerProvider";
import { AlishaProvider } from "./providers/AlishaProvider";
import { StatusConfigProvider } from "./contexts/StatusConfigContext";
import { OrderBasketProvider } from "./contexts/OrderBasketContext";
import ProtectedRoute from "./components/ProtectedRoute";
import SuperAdminProtectedRoute from "./components/SuperAdminProtectedRoute";
import { IdleLockProvider } from "./components/security/IdleLockProvider";
import { PrefetchOnAuth } from "./components/security/PrefetchOnAuth";
import { DeviceBootstrap } from "./components/bootstrap/DeviceBootstrap";

import { ErrorBoundary } from "./components/ErrorBoundary";
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useModulePrefetch } from './hooks/useModulePrefetch';
import MainLayout from './components/layout/MainLayout';
import { BrandingThemeApplier } from './components/BrandingThemeApplier';
import { OrientationProvider } from './components/orientation/OrientationProvider';
import { LandscapeLock } from './components/orientation/LandscapeLock';
import { PageInteractivityGuard } from './components/PageInteractivityGuard';
import { OrdersRealtimeProvider } from './components/realtime/OrdersRealtimeProvider';
import { WastageRealtimeProvider } from './components/realtime/WastageRealtimeProvider';
import { DisplayScaleProvider } from './contexts/DisplayScaleContext';

// Frequently accessed pages - direct imports for instant loading
import Index from "./pages/Index";
import Login from "./pages/Login";
import ReservationLogs from "./pages/ReservationLogs";
import CustomerCRM from "./pages/CustomerCRM";
import Analytics from "./pages/Analytics";
import MenuItems from "./pages/MenuItems";
import POS from "./pages/POS";
import Kitchen from "./pages/Kitchen";
import Orders from "./pages/Orders";
import Deals from "./pages/Deals";
import MarketingHub from "./pages/MarketingHub";
import Settings from "./pages/Settings";
const SuperAdminDashboard = lazy(() => import("./pages/SuperAdminDashboard"));
const SuperAdminLogin = lazy(() => import("./pages/SuperAdminLogin"));
const OwnerLogin = lazy(() => import("./pages/OwnerLogin"));
const SetupWizardPage = lazy(() => import("./pages/SetupWizardPage"));
const DeliveryPage = lazy(() => import("./pages/DeliveryPage"));
const SuppliersPage = lazy(() => import("./pages/SuppliersPage"));
const WastagePage = lazy(() => import("./pages/WastagePage"));
const DeviceLocationSetup = lazy(() => import("./pages/DeviceLocationSetup"));
const CompanyDetailsSettings = lazy(() => import("./pages/settings/CompanyDetailsSettings"));
const TeamMembersSettings = lazy(() => import("./pages/settings/TeamMembersSettings"));
const BrandingSettings = lazy(() => import("./pages/settings/BrandingSettings"));
const LegalPolicySettings = lazy(() => import("./pages/settings/LegalPolicySettings"));
const IntegrationsSettings = lazy(() => import("./pages/settings/IntegrationsSettings"));
const MenuSettings = lazy(() => import("./pages/settings/MenuSettings"));
const AccessLevelSettings = lazy(() => import("./pages/settings/AccessLevelSettings"));
const TableAssignmentSettings = lazy(() => import("./pages/settings/TableAssignmentSettings"));
const OpeningHoursSettings = lazy(() => import("./pages/settings/OpeningHoursSettings"));
const DeviceSettings = lazy(() => import("./pages/DeviceSettings"));
const HardwareSettings = lazy(() => import("./pages/HardwareSettings"));
const DevicePermissionsSetup = lazy(() => import("./pages/DevicePermissionsSetup"));
const DisplayScaleSettings = lazy(() => import("./components/settings/DisplayScaleSettings"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const NotFound = lazy(() => import("./pages/NotFound"));

// App component to handle module prefetching
const AppContent = () => {
  useModulePrefetch();
  
  return (
    <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/login" element={<Login />} />
        <Route path="/owner-login" element={<Suspense fallback={<div className="flex items-center justify-center min-h-screen"><LoadingSpinner size="lg" /></div>}><OwnerLogin /></Suspense>} />
        <Route path="/device-location-setup" element={<Suspense fallback={<div className="flex items-center justify-center min-h-screen"><LoadingSpinner size="lg" /></div>}><DeviceLocationSetup /></Suspense>} />
        <Route path="/setup-wizard" element={<Suspense fallback={<div className="flex items-center justify-center min-h-screen"><LoadingSpinner size="lg" /></div>}><SetupWizardPage /></Suspense>} />
        <Route path="/super-admin-login" element={<Suspense fallback={<div className="flex items-center justify-center min-h-screen"><LoadingSpinner size="lg" /></div>}><SuperAdminLogin /></Suspense>} />
        <Route path="/super-admin" element={
          <SuperAdminProtectedRoute>
            <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><LoadingSpinner size="lg" /></div>}>
              <SuperAdminDashboard />
            </Suspense>
          </SuperAdminProtectedRoute>
        } />
        
        {/* Protected routes with persistent layout */}
        <Route path="/" element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }>
          <Route path="reservations" element={<ReservationLogs />} />
          <Route path="customers" element={<CustomerCRM />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="menu-items" element={<MenuItems />} />
          <Route path="pos" element={<POS />} />
          <Route path="kitchen" element={<Kitchen />} />
          <Route path="orders" element={<Orders />} />
          <Route path="deals" element={<Deals />} />
          <Route path="marketing" element={<MarketingHub />} />
          <Route path="delivery" element={<Suspense fallback={<LoadingSpinner />}><DeliveryPage /></Suspense>} />
          <Route path="suppliers" element={<Suspense fallback={<LoadingSpinner />}><SuppliersPage /></Suspense>} />
          <Route path="wastage" element={<Suspense fallback={<LoadingSpinner />}><WastagePage /></Suspense>} />
          <Route path="settings" element={<Settings />} />
          <Route path="settings/company-details" element={<Suspense fallback={<LoadingSpinner />}><CompanyDetailsSettings /></Suspense>} />
          <Route path="settings/team-members" element={<Suspense fallback={<LoadingSpinner />}><TeamMembersSettings /></Suspense>} />
          <Route path="settings/branding" element={<Suspense fallback={<LoadingSpinner />}><BrandingSettings /></Suspense>} />
          <Route path="settings/legal-policy" element={<Suspense fallback={<LoadingSpinner />}><LegalPolicySettings /></Suspense>} />
          <Route path="settings/integrations" element={<Suspense fallback={<LoadingSpinner />}><IntegrationsSettings /></Suspense>} />
          <Route path="settings/menu" element={<Suspense fallback={<LoadingSpinner />}><MenuSettings /></Suspense>} />
          <Route path="settings/access-levels" element={<Suspense fallback={<LoadingSpinner />}><AccessLevelSettings /></Suspense>} />
          <Route path="settings/table-assignment" element={<Suspense fallback={<LoadingSpinner />}><TableAssignmentSettings /></Suspense>} />
          <Route path="settings/opening-hours" element={<Suspense fallback={<LoadingSpinner />}><OpeningHoursSettings /></Suspense>} />
          <Route path="settings/device" element={<Suspense fallback={<LoadingSpinner />}><DeviceSettings /></Suspense>} />
          <Route path="settings/hardware" element={<Suspense fallback={<LoadingSpinner />}><HardwareSettings /></Suspense>} />
          <Route path="settings/device-permissions" element={<Suspense fallback={<LoadingSpinner />}><DevicePermissionsSetup /></Suspense>} />
          <Route path="settings/display-scale" element={<Suspense fallback={<LoadingSpinner />}><DisplayScaleSettings /></Suspense>} />
          {/* Redirect old routes */}
          <Route path="settings/contact-information" element={<Suspense fallback={<LoadingSpinner />}><CompanyDetailsSettings /></Suspense>} />
          <Route path="settings/location-timezone" element={<Suspense fallback={<LoadingSpinner />}><CompanyDetailsSettings /></Suspense>} />
        </Route>
        
        {/* Legal Pages */}
        <Route path="/privacy-policy" element={<Suspense fallback={<LoadingSpinner />}><PrivacyPolicy /></Suspense>} />
        <Route path="/terms-of-service" element={<Suspense fallback={<LoadingSpinner />}><TermsOfService /></Suspense>} />
        <Route path="*" element={<Suspense fallback={<LoadingSpinner />}><NotFound /></Suspense>} />
      </Routes>
  );
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 24 * 60 * 60 * 1000, // 24 hours - data stays fresh longer  
      gcTime: 48 * 60 * 60 * 1000, // 48 hours - keep in cache longer (renamed from cacheTime)
      refetchOnWindowFocus: false, // Don't refetch when switching tabs
      refetchOnMount: false, // Don't refetch when component mounts if data exists
      retry: 3, // Allow retries for better reliability
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <ReactHotToast />
      <BrowserRouter>
        <PageInteractivityGuard />
        <ErrorBoundary>
          <AuthProvider>
            <DisplayScaleProvider>
              <DeviceLiveLayerProvider>
              <AlishaProvider>
                <BrandingThemeApplier>
                  <DeviceBootstrap>
                    <LandscapeLock>
                      <OrientationProvider>
                        <PrefetchOnAuth>
                          <IdleLockProvider>
                            <OrdersRealtimeProvider>
                              <WastageRealtimeProvider>
                                <StatusConfigProvider>
                                  <OrderBasketProvider>
                                    <AppContent />
                                  </OrderBasketProvider>
                                </StatusConfigProvider>
                              </WastageRealtimeProvider>
                            </OrdersRealtimeProvider>
                          </IdleLockProvider>
                        </PrefetchOnAuth>
                      </OrientationProvider>
                    </LandscapeLock>
                  </DeviceBootstrap>
                </BrandingThemeApplier>
              </AlishaProvider>
            </DeviceLiveLayerProvider>
            </DisplayScaleProvider>
          </AuthProvider>
        </ErrorBoundary>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
