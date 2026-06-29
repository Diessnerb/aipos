import React, { useState, useMemo } from 'react';
import { PermissionGuard } from '@/components/PermissionGuard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, Clock, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useDeals, getShortDayName } from '@/hooks/useDeals';
import { useMenuCategories } from '@/hooks/useMenuCategories';
import { PageHeader } from '@/components/ui/page-header';
import { DealFormModal } from '@/components/deals/DealFormModal';
import { DeleteDealModal } from '@/components/deals/DeleteDealModal';
import { NewDealTypeModal } from '@/components/deals/NewDealTypeModal';

const DAYS = [
  { index: 1, name: 'Monday' },
  { index: 2, name: 'Tuesday' },
  { index: 3, name: 'Wednesday' },
  { index: 4, name: 'Thursday' },
  { index: 5, name: 'Friday' },
  { index: 6, name: 'Saturday' },
  { index: 0, name: 'Sunday' }
];

const formatDealType = (dealType: string) => {
  const typeMap: Record<string, string> = {
    'percentage_off': 'Percentage Off',
    'amount_off': 'Amount Off',
    'bogo': 'Buy One Get One',
    'n_for_m': 'Multi-buy Deal',
    'free_item': 'Free Item',
    'happy_hour': 'Happy Hour'
  };
  return typeMap[dealType] || dealType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

const generateDealDescription = (deal: any) => {
  if (deal.description) return deal.description;
  
  switch (deal.deal_type) {
    case 'percentage_off':
      return deal.discount_value ? `${deal.discount_value}% off` : 'Percentage discount';
    case 'amount_off':
      return deal.discount_value ? `£${deal.discount_value} off` : 'Amount discount';
    case 'bogo':
      return 'Buy one, get one free';
    case 'n_for_m':
      if (deal.n_value && deal.m_value) {
        return `Buy ${deal.n_value}, pay for ${deal.m_value}`;
      }
      return 'Multi-buy offer';
    case 'free_item':
      return 'Free item included';
    case 'happy_hour':
      return 'Special pricing period';
    default:
      return 'Special offer';
  }
};

const formatTime = (timeString: string) => {
  if (!timeString) return '';
  const [hours, minutes] = timeString.split(':');
  const hour24 = parseInt(hours);
  const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
  const ampm = hour24 >= 12 ? 'PM' : 'AM';
  return `${hour12}:${minutes} ${ampm}`;
};

const Deals = () => {
  const { toast } = useToast();
  const { deals, loading, createDeal, updateDeal, deleteDeal, toggleDealActive } = useDeals();
  const { categories } = useMenuCategories();
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isNewDealTypeModalOpen, setIsNewDealTypeModalOpen] = useState(false);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dayFilter, setDayFilter] = useState('all');

  const handleCreateDeal = () => {
    setSelectedDeal(null);
    setIsFormModalOpen(true);
  };

  const handleEditDeal = (deal: any) => {
    setSelectedDeal(deal);
    setIsFormModalOpen(true);
  };

  const handleDeleteDeal = (deal: any) => {
    setSelectedDeal(deal);
    setIsDeleteModalOpen(true);
  };

  const handleFormSubmit = async (dealData: any) => {
    try {
      if (selectedDeal?.id) {
        await updateDeal(selectedDeal.id, dealData);
        toast({ title: "Deal updated successfully" });
      } else {
        await createDeal(dealData);
        toast({ title: "Deal created successfully" });
      }
      setIsFormModalOpen(false);
      setSelectedDeal(null);
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to save deal",
        variant: "destructive"
      });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedDeal?.id) return;
    
    try {
      await deleteDeal(selectedDeal.id);
      toast({ title: "Deal deleted successfully" });
      setIsDeleteModalOpen(false);
      setSelectedDeal(null);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete deal",
        variant: "destructive"
      });
    }
  };

  const handleToggleDeal = async (dealId: string, currentStatus: boolean) => {
    try {
      await toggleDealActive(dealId, !currentStatus);
      toast({
        title: currentStatus ? "Deal deactivated" : "Deal activated"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update deal status",
        variant: "destructive"
      });
    }
  };

  // Get category names from IDs for display
  const getCategoryNames = (categoryIds?: string[]): string[] => {
    if (!categoryIds || categoryIds.length === 0) return [];
    const allCategories = [...categories];
    // Flatten to include subcategories
    categories.forEach(cat => {
      if (cat.subcategories) {
        allCategories.push(...cat.subcategories);
      }
    });
    return categoryIds
      .map(id => allCategories.find(cat => cat.id === id)?.name)
      .filter(Boolean) as string[];
  };

  // Filter and search deals
  const filteredDeals = useMemo(() => {
    if (!deals) return [];

    return deals.filter(deal => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = deal.deal_name?.toLowerCase().includes(query);
        const matchesDescription = deal.description?.toLowerCase().includes(query);
        if (!matchesName && !matchesDescription) return false;
      }

      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'active' && !deal.is_active) return false;
        if (statusFilter === 'inactive' && deal.is_active) return false;
      }

      // Day filter
      if (dayFilter !== 'all') {
        const dayIndex = parseInt(dayFilter);
        if (!deal.day_of_week?.includes(dayIndex)) return false;
      }

      return true;
    });
  }, [deals, searchQuery, statusFilter, dayFilter]);

  const hasFilters = searchQuery || statusFilter !== 'all' || dayFilter !== 'all';

  return (
    <PermissionGuard requiredPermission="view" route="/deals">
      <div className="space-y-6">
        <PageHeader
          title="Deals"
          subtitle="Manage promotional deals and special offers"
        >
          <Button onClick={handleCreateDeal}>
            <Plus className="mr-2 h-4 w-4" />
            Add Deal
          </Button>
        </PageHeader>

        {/* Search and Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search deals..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>

              {/* Day Filter */}
              <Select value={dayFilter} onValueChange={setDayFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Day" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Days</SelectItem>
                  {DAYS.map(day => (
                    <SelectItem key={day.index} value={day.index.toString()}>
                      {day.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Deals Grid */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">
            Loading deals...
          </div>
        ) : filteredDeals.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center space-y-3">
                <div className="text-muted-foreground">
                  {hasFilters ? (
                    <>
                      <p className="text-lg font-medium">No deals match your filters</p>
                      <p className="text-sm">Try adjusting your search or filters</p>
                    </>
                  ) : (
                    <>
                      <p className="text-lg font-medium">No deals yet</p>
                      <p className="text-sm">Create your first promotional deal to get started</p>
                    </>
                  )}
                </div>
                {!hasFilters && (
                  <Button onClick={handleCreateDeal} className="mt-4">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Your First Deal
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDeals.map((deal) => (
              <Card key={deal.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6 space-y-4">
                  {/* Header with name and status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg truncate">
                        {deal.deal_name}
                      </h3>
                      <Badge variant="outline" className="mt-2">
                        {formatDealType(deal.deal_type)}
                      </Badge>
                    </div>
                    <Switch
                      checked={deal.is_active}
                      onCheckedChange={() => handleToggleDeal(deal.id, deal.is_active)}
                    />
                  </div>

                  {/* Description */}
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {generateDealDescription(deal)}
                  </p>

                  {/* Applies To badges */}
                  {deal.applies_to && deal.applies_to !== 'all' && (
                    <div className="flex flex-wrap gap-1.5">
                      {deal.applies_to === 'categories' && deal.menu_category_ids && deal.menu_category_ids.length > 0 && (
                        <>
                          {getCategoryNames(deal.menu_category_ids).map((catName, idx) => (
                            <Badge key={idx} variant="default" className="text-xs">
                              {catName}
                            </Badge>
                          ))}
                        </>
                      )}
                      {deal.applies_to === 'items' && deal.menu_item_ids && deal.menu_item_ids.length > 0 && (
                        <Badge variant="default" className="text-xs">
                          {deal.menu_item_ids.length} {deal.menu_item_ids.length === 1 ? 'Item' : 'Items'}
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* Days */}
                  <div className="flex flex-wrap gap-2">
                    {deal.day_of_week?.sort((a, b) => {
                      // Sort so Sunday (0) comes last
                      if (a === 0) return 1;
                      if (b === 0) return -1;
                      return a - b;
                    }).map((dayIndex) => (
                      <Badge key={dayIndex} variant="secondary" className="text-xs">
                        {getShortDayName(dayIndex)}
                      </Badge>
                    ))}
                  </div>

                  {/* Time */}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>
                      {formatTime(deal.start_time)} - {formatTime(deal.end_time)}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditDeal(deal)}
                      className="flex-1"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteDeal(deal)}
                      className="flex-1"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Modals */}
        <DealFormModal
          open={isFormModalOpen}
          onOpenChange={setIsFormModalOpen}
          deal={selectedDeal}
          onSubmit={handleFormSubmit}
        />

        <DeleteDealModal
          open={isDeleteModalOpen}
          onOpenChange={setIsDeleteModalOpen}
          dealName={selectedDeal?.deal_name || ''}
          onConfirm={handleDeleteConfirm}
          isDeleting={false}
        />

        <NewDealTypeModal
          open={isNewDealTypeModalOpen}
          onOpenChange={setIsNewDealTypeModalOpen}
          onSuccess={() => {
            setIsNewDealTypeModalOpen(false);
          }}
        />
      </div>
    </PermissionGuard>
  );
};

export default Deals;