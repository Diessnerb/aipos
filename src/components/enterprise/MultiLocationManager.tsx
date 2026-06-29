import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Building2, 
  Plus, 
  Settings, 
  Users, 
  BarChart3, 
  Globe, 
  MapPin,
  Phone,
  Mail,
  Clock,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Copy,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export interface Location {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  phone: string;
  email: string;
  timezone: string;
  status: 'active' | 'inactive' | 'setup';
  managerId: string;
  managerName: string;
  createdAt: Date;
  settings: {
    currency: string;
    language: string;
    operatingHours: {
      [key: string]: { open: string; close: string; closed: boolean };
    };
    features: string[];
  };
  analytics: {
    totalTables: number;
    totalCapacity: number;
    avgOccupancy: number;
    revenueThisMonth: number;
    reservationsThisMonth: number;
  };
}

interface MultiLocationManagerProps {
  onLocationSelect?: (locationId: string) => void;
}

export const MultiLocationManager: React.FC<MultiLocationManagerProps> = ({
  onLocationSelect
}) => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [isAddLocationOpen, setIsAddLocationOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const { currentUser } = useCurrentUser();

  useEffect(() => {
    loadLocations();
  }, []);

  const loadLocations = async () => {
    setLoading(true);
    try {
      // Mock data - replace with actual API call
      const mockLocations: Location[] = [
        {
          id: 'loc-1',
          name: 'Downtown Bistro',
          address: '123 Main St',
          city: 'New York',
          state: 'NY',
          zipCode: '10001',
          country: 'USA',
          phone: '+1 (555) 123-4567',
          email: 'downtown@bistro.com',
          timezone: 'America/New_York',
          status: 'active',
          managerId: 'mgr-1',
          managerName: 'Sarah Johnson',
          createdAt: new Date('2024-01-15'),
          settings: {
            currency: 'USD',
            language: 'en',
            operatingHours: {
              monday: { open: '11:00', close: '22:00', closed: false },
              tuesday: { open: '11:00', close: '22:00', closed: false },
              wednesday: { open: '11:00', close: '22:00', closed: false },
              thursday: { open: '11:00', close: '22:00', closed: false },
              friday: { open: '11:00', close: '23:00', closed: false },
              saturday: { open: '10:00', close: '23:00', closed: false },
              sunday: { open: '10:00', close: '21:00', closed: false }
            },
            features: ['reservations', 'pos', 'analytics', 'marketing']
          },
          analytics: {
            totalTables: 25,
            totalCapacity: 120,
            avgOccupancy: 78,
            revenueThisMonth: 45000,
            reservationsThisMonth: 890
          }
        },
        {
          id: 'loc-2',
          name: 'Waterfront Café',
          address: '456 Harbor View',
          city: 'San Francisco',
          state: 'CA',
          zipCode: '94105',
          country: 'USA',
          phone: '+1 (555) 987-6543',
          email: 'waterfront@cafe.com',
          timezone: 'America/Los_Angeles',
          status: 'active',
          managerId: 'mgr-2',
          managerName: 'Michael Chen',
          createdAt: new Date('2024-02-20'),
          settings: {
            currency: 'USD',
            language: 'en',
            operatingHours: {
              monday: { open: '07:00', close: '20:00', closed: false },
              tuesday: { open: '07:00', close: '20:00', closed: false },
              wednesday: { open: '07:00', close: '20:00', closed: false },
              thursday: { open: '07:00', close: '20:00', closed: false },
              friday: { open: '07:00', close: '21:00', closed: false },
              saturday: { open: '08:00', close: '21:00', closed: false },
              sunday: { open: '08:00', close: '19:00', closed: false }
            },
            features: ['reservations', 'pos', 'delivery']
          },
          analytics: {
            totalTables: 18,
            totalCapacity: 75,
            avgOccupancy: 65,
            revenueThisMonth: 32000,
            reservationsThisMonth: 654
          }
        },
        {
          id: 'loc-3',
          name: 'Garden Terrace',
          address: '789 Park Avenue',
          city: 'Chicago',
          state: 'IL',
          zipCode: '60611',
          country: 'USA',
          phone: '+1 (555) 456-7890',
          email: 'garden@terrace.com',
          timezone: 'America/Chicago',
          status: 'setup',
          managerId: 'mgr-3',
          managerName: 'Emily Rodriguez',
          createdAt: new Date('2024-03-10'),
          settings: {
            currency: 'USD',
            language: 'en',
            operatingHours: {
              monday: { open: '16:00', close: '22:00', closed: false },
              tuesday: { open: '16:00', close: '22:00', closed: false },
              wednesday: { open: '16:00', close: '22:00', closed: false },
              thursday: { open: '16:00', close: '22:00', closed: false },
              friday: { open: '16:00', close: '23:00', closed: false },
              saturday: { open: '11:00', close: '23:00', closed: false },
              sunday: { open: '11:00', close: '21:00', closed: false }
            },
            features: ['reservations']
          },
          analytics: {
            totalTables: 0,
            totalCapacity: 0,
            avgOccupancy: 0,
            revenueThisMonth: 0,
            reservationsThisMonth: 0
          }
        }
      ];

      setLocations(mockLocations);
    } catch (error) {
      console.error('Error loading locations:', error);
      toast.error('Failed to load locations');
    } finally {
      setLoading(false);
    }
  };

  const handleLocationSelect = (locationId: string) => {
    setSelectedLocation(locationId);
    onLocationSelect?.(locationId);
    toast.success(`Switched to ${locations.find(l => l.id === locationId)?.name}`);
  };

  const handleAddLocation = () => {
    // This would open a comprehensive location setup wizard
    setIsAddLocationOpen(true);
  };

  const handleCloneLocation = (locationId: string) => {
    const location = locations.find(l => l.id === locationId);
    if (location) {
      // Clone location settings
      toast.success(`Cloning configuration from ${location.name}`);
      setIsAddLocationOpen(true);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency
    }).format(amount);
  };

  const getStatusColor = (status: Location['status']) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'inactive': return 'bg-gray-500';
      case 'setup': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: Location['status']) => {
    switch (status) {
      case 'active': return <CheckCircle className="h-4 w-4" />;
      case 'inactive': return <AlertCircle className="h-4 w-4" />;
      case 'setup': return <Settings className="h-4 w-4" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading locations...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            Multi-Location Management
          </h2>
          <p className="text-muted-foreground">
            Manage all your restaurant locations from one central dashboard
          </p>
        </div>
        <Button onClick={handleAddLocation}>
          <Plus className="h-4 w-4 mr-2" />
          Add Location
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Total Locations</p>
                <p className="text-2xl font-bold">{locations.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Capacity</p>
                <p className="text-2xl font-bold">
                  {locations.reduce((sum, loc) => sum + loc.analytics.totalCapacity, 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Monthly Revenue</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(locations.reduce((sum, loc) => sum + loc.analytics.revenueThisMonth, 0))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Avg Occupancy</p>
                <p className="text-2xl font-bold">
                  {Math.round(locations.reduce((sum, loc) => sum + loc.analytics.avgOccupancy, 0) / locations.length)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Locations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {locations.map((location) => (
          <Card 
            key={location.id} 
            className={`cursor-pointer transition-all hover:shadow-lg ${
              selectedLocation === location.id ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => handleLocationSelect(location.id)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{location.name}</CardTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <div className={`w-2 h-2 rounded-full ${getStatusColor(location.status)}`} />
                    <span className="text-sm text-muted-foreground capitalize">
                      {location.status}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCloneLocation(location.id);
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  {getStatusIcon(location.status)}
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Address */}
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="text-sm">
                  <p>{location.address}</p>
                  <p className="text-muted-foreground">
                    {location.city}, {location.state} {location.zipCode}
                  </p>
                </div>
              </div>

              {/* Contact */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{location.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{location.email}</span>
                </div>
              </div>

              {/* Manager */}
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Manager: {location.managerName}</span>
              </div>

              <Separator />

              {/* Analytics */}
              {location.status === 'active' && (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Tables</p>
                    <p className="font-medium">{location.analytics.totalTables}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Capacity</p>
                    <p className="font-medium">{location.analytics.totalCapacity}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Occupancy</p>
                    <p className="font-medium">{location.analytics.avgOccupancy}%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Revenue</p>
                    <p className="font-medium">
                      {formatCurrency(location.analytics.revenueThisMonth, location.settings.currency)}
                    </p>
                  </div>
                </div>
              )}

              {/* Features */}
              <div className="flex flex-wrap gap-1">
                {location.settings.features.map((feature) => (
                  <Badge key={feature} variant="secondary" className="text-xs">
                    {feature}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add Location Dialog */}
      <Dialog open={isAddLocationOpen} onOpenChange={setIsAddLocationOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Location</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="basic" className="mt-4">
            <TabsList>
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
              <TabsTrigger value="hours">Hours</TabsTrigger>
              <TabsTrigger value="features">Features</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Restaurant Name</Label>
                  <Input id="name" placeholder="Enter restaurant name" />
                </div>
                <div>
                  <Label htmlFor="manager">Manager</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select manager" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mgr-1">Sarah Johnson</SelectItem>
                      <SelectItem value="mgr-2">Michael Chen</SelectItem>
                      <SelectItem value="mgr-3">Emily Rodriguez</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="address">Address</Label>
                <Input id="address" placeholder="Street address" />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input id="city" placeholder="City" />
                </div>
                <div>
                  <Label htmlFor="state">State</Label>
                  <Input id="state" placeholder="State" />
                </div>
                <div>
                  <Label htmlFor="zip">ZIP Code</Label>
                  <Input id="zip" placeholder="ZIP" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" placeholder="+1 (555) 123-4567" />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="location@restaurant.com" />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="currency">Currency</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD - US Dollar</SelectItem>
                      <SelectItem value="EUR">EUR - Euro</SelectItem>
                      <SelectItem value="GBP">GBP - British Pound</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="America/New_York">Eastern Time</SelectItem>
                      <SelectItem value="America/Chicago">Central Time</SelectItem>
                      <SelectItem value="America/Denver">Mountain Time</SelectItem>
                      <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="hours" className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Set operating hours for each day of the week
              </p>
              {/* Operating hours configuration would go here */}
              <div className="text-center text-muted-foreground">
                Operating hours configuration panel
              </div>
            </TabsContent>

            <TabsContent value="features" className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Select features to enable for this location
              </p>
              {/* Feature selection would go here */}
              <div className="text-center text-muted-foreground">
                Feature selection panel
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => setIsAddLocationOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              toast.success('Location added successfully!');
              setIsAddLocationOpen(false);
            }}>
              Create Location
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};