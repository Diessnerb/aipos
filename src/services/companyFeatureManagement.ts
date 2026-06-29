import { supabase } from '@/integrations/supabase/client';

export interface CompanyFeatureData {
  features: Record<string, boolean>;
  settings: Record<string, any>;
}

/**
 * Fetch all features and settings for a company
 */
export const fetchCompanyFeatureData = async (companyId: string): Promise<CompanyFeatureData> => {
  try {
    // Fetch subscription features
    const { data: featuresData, error: featuresError } = await supabase
      .from('company_subscription_features')
      .select('*')
      .eq('company_id', companyId);

    if (featuresError) throw featuresError;

    // Fetch company settings
    const { data: settingsData, error: settingsError } = await supabase
      .from('company_settings')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle();

    if (settingsError) throw settingsError;

    // Fetch delivery settings
    const { data: deliverySettingsData, error: deliveryError } = await supabase
      .from('delivery_settings')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle();

    // Convert features array to record
    const features: Record<string, boolean> = {};
    featuresData?.forEach(feature => {
      features[feature.feature_name] = feature.enabled;
    });

    // Merge all settings with sensible defaults (all booleans default to true)
    const settings = {
      // Default all booleans to true
      auto_assign_tables: true,
      optimization_enabled: true,
      strategic_optimization_enabled: true,
      sms_reminders_enabled: true,
      enable_time_based_group_protection: true,
      show_allergen_disclaimer: true,
      enable_auto_ordering: true,
      notify_on_low_stock: true,
      notify_on_order_received: true,
      // Override with actual data if it exists
      ...(settingsData || {}),
      ...(deliverySettingsData || {})
    };

    return { features, settings };
  } catch (error) {
    console.error('Error fetching company feature data:', error);
    throw error;
  }
};

/**
 * Update a page feature toggle
 */
export const updatePageFeature = async (
  companyId: string, 
  featureName: string, 
  enabled: boolean
): Promise<void> => {
  try {
    const { error } = await supabase
      .from('company_subscription_features')
      .upsert({
        company_id: companyId,
        feature_name: featureName,
        enabled: enabled,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'company_id,feature_name'
      });

    if (error) throw error;
  } catch (error) {
    console.error('Error updating page feature:', error);
    throw error;
  }
};

/**
 * Update a company setting
 */
export const updateCompanySetting = async (
  companyId: string,
  settingKey: string,
  value: any
): Promise<void> => {
  try {
    const { error } = await supabase
      .from('company_settings')
      .update({
        [settingKey]: value,
        updated_at: new Date().toISOString()
      })
      .eq('company_id', companyId);

    if (error) throw error;
  } catch (error) {
    console.error('Error updating company setting:', error);
    throw error;
  }
};

/**
 * Update a delivery setting
 */
export const updateDeliverySetting = async (
  companyId: string,
  settingKey: string,
  value: any
): Promise<void> => {
  try {
    // Check if delivery settings exist
    const { data: existing } = await supabase
      .from('delivery_settings')
      .select('id')
      .eq('company_id', companyId)
      .maybeSingle();

    if (existing) {
      // Update existing
      const { error } = await supabase
        .from('delivery_settings')
        .update({
          [settingKey]: value,
          updated_at: new Date().toISOString()
        })
        .eq('company_id', companyId);

      if (error) throw error;
    } else {
      // Create new with the setting
      const { error } = await supabase
        .from('delivery_settings')
        .insert({
          company_id: companyId,
          [settingKey]: value
        });

      if (error) throw error;
    }
  } catch (error) {
    console.error('Error updating delivery setting:', error);
    throw error;
  }
};

/**
 * Batch update multiple features and settings
 */
export const batchUpdateFeatures = async (
  companyId: string,
  updates: Array<{
    type: 'feature' | 'setting' | 'delivery_setting';
    key: string;
    value: any;
  }>
): Promise<void> => {
  try {
    const promises = updates.map(update => {
      if (update.type === 'feature') {
        return updatePageFeature(companyId, update.key, update.value);
      } else if (update.type === 'delivery_setting') {
        return updateDeliverySetting(companyId, update.key, update.value);
      } else {
        return updateCompanySetting(companyId, update.key, update.value);
      }
    });

    await Promise.all(promises);
  } catch (error) {
    console.error('Error batch updating features:', error);
    throw error;
  }
};
