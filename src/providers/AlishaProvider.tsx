import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { isDeviceBound, getBoundCompany } from '@/utils/deviceBinding';
import { useCurrentUser } from '@/hooks/useCurrentUser';

interface AlishaMemory {
  companyMemory: any[];
  userPreferences: any[];
  conversationHistory: any[];
}

interface AlishaSettings {
  personalityStyle: 'professional' | 'friendly' | 'concise';
  proactiveSuggestions: boolean;
  learningEnabled: boolean;
  customInstructions: string | null;
}

interface AlishaContextType {
  isActive: boolean;
  isLearning: boolean;
  memory: AlishaMemory;
  settings: AlishaSettings;
  loadMemory: () => Promise<void>;
  saveMemory: (type: string, key: string, value: any) => Promise<void>;
  updateSettings: (settings: Partial<AlishaSettings>) => Promise<void>;
}

const AlishaContext = createContext<AlishaContextType | undefined>(undefined);

export const AlishaProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { currentUser } = useCurrentUser();
  const [isActive, setIsActive] = useState(false);
  const [isLearning, setIsLearning] = useState(false);
  const [memory, setMemory] = useState<AlishaMemory>({
    companyMemory: [],
    userPreferences: [],
    conversationHistory: [],
  });
  const [settings, setSettings] = useState<AlishaSettings>({
    personalityStyle: 'professional',
    proactiveSuggestions: true,
    learningEnabled: true,
    customInstructions: null,
  });

  // Initialize Alisha when device is bound
  useEffect(() => {
    const boundCompany = getBoundCompany();
    const deviceIsBound = isDeviceBound();
    
    console.log('🤖 Alisha: Initialization check', {
      deviceIsBound,
      hasBoundCompany: !!boundCompany,
      hasUser: !!user,
      companyId: boundCompany?.company_id
    });
    
    if (deviceIsBound && boundCompany && user) {
      console.log('🤖 Alisha: Activating Alisha AI');
      setIsActive(true);
      loadSettings().then(() => {
        loadMemory();
      });
    } else {
      console.log('🤖 Alisha: Not activating - requirements not met');
      setIsActive(false);
    }
  }, [user]);

  const loadSettings = async () => {
    const boundCompany = getBoundCompany();
    if (!boundCompany) {
      console.log('🤖 Alisha: No bound company found');
      return;
    }

    try {
      console.log('🤖 Alisha: Loading settings for company:', boundCompany.company_id);
      const { data, error } = await supabase
        .from('alisha_company_settings')
        .select('*')
        .eq('company_id', boundCompany.company_id)
        .single();

      if (error && error.code === 'PGRST116') {
        // No settings exist, create defaults
        console.log('🤖 Alisha: Creating default settings');
        const { data: newSettings, error: insertError } = await supabase
          .from('alisha_company_settings')
          .insert({
            company_id: boundCompany.company_id,
            personality_style: 'professional',
            proactive_suggestions: true,
            learning_enabled: true,
            custom_instructions: null,
          })
          .select()
          .single();

        if (newSettings && !insertError) {
          console.log('🤖 Alisha: Default settings created successfully');
          setSettings({
            personalityStyle: newSettings.personality_style as any,
            proactiveSuggestions: newSettings.proactive_suggestions,
            learningEnabled: newSettings.learning_enabled,
            customInstructions: newSettings.custom_instructions,
          });
        } else {
          console.error('🤖 Alisha: Error creating default settings:', insertError);
        }
      } else if (data && !error) {
        console.log('🤖 Alisha: Settings loaded successfully');
        setSettings({
          personalityStyle: data.personality_style as any,
          proactiveSuggestions: data.proactive_suggestions,
          learningEnabled: data.learning_enabled,
          customInstructions: data.custom_instructions,
        });
      } else {
        console.error('🤖 Alisha: Error loading settings:', error);
      }
    } catch (error) {
      console.error('🤖 Alisha: Error loading Alisha settings:', error);
    }
  };

  const loadMemory = async () => {
    const boundCompany = getBoundCompany();
    if (!boundCompany || !currentUser) return;

    setIsLearning(true);
    try {
      // Load company memory
      const { data: companyMem } = await supabase
        .from('alisha_memory')
        .select('*')
        .eq('company_id', boundCompany.company_id)
        .order('confidence_score', { ascending: false })
        .limit(50);

      // Load user preferences
      const { data: userPrefs } = await supabase
        .from('alisha_user_preferences')
        .select('*')
        .eq('company_id', boundCompany.company_id)
        .eq('user_id', currentUser.id)
        .order('frequency', { ascending: false })
        .limit(20);

      // Load recent conversation history
      const { data: convHistory } = await supabase
        .from('alisha_conversations')
        .select('*')
        .eq('company_id', boundCompany.company_id)
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(100);

      setMemory({
        companyMemory: companyMem || [],
        userPreferences: userPrefs || [],
        conversationHistory: convHistory || [],
      });
    } catch (error) {
      console.error('Error loading Alisha memory:', error);
    } finally {
      setIsLearning(false);
    }
  };

  const saveMemory = async (type: string, key: string, value: any) => {
    const boundCompany = getBoundCompany();
    if (!boundCompany || !settings.learningEnabled) return;

    try {
      const { error } = await supabase
        .from('alisha_memory')
        .upsert({
          company_id: boundCompany.company_id,
          memory_type: type,
          memory_key: key,
          memory_value: value,
          confidence_score: 1.0,
          usage_count: 1,
        }, {
          onConflict: 'company_id,memory_type,memory_key',
        });

      if (!error) {
        await loadMemory();
      }
    } catch (error) {
      console.error('Error saving Alisha memory:', error);
    }
  };

  const updateSettings = async (newSettings: Partial<AlishaSettings>) => {
    const boundCompany = getBoundCompany();
    if (!boundCompany) return;

    try {
      const { error } = await supabase
        .from('alisha_company_settings')
        .upsert({
          company_id: boundCompany.company_id,
          personality_style: newSettings.personalityStyle || settings.personalityStyle,
          proactive_suggestions: newSettings.proactiveSuggestions ?? settings.proactiveSuggestions,
          learning_enabled: newSettings.learningEnabled ?? settings.learningEnabled,
          custom_instructions: newSettings.customInstructions ?? settings.customInstructions,
        }, {
          onConflict: 'company_id',
        });

      if (!error) {
        setSettings({ ...settings, ...newSettings });
      }
    } catch (error) {
      console.error('Error updating Alisha settings:', error);
    }
  };

  return (
    <AlishaContext.Provider
      value={{
        isActive,
        isLearning,
        memory,
        settings,
        loadMemory,
        saveMemory,
        updateSettings,
      }}
    >
      {children}
    </AlishaContext.Provider>
  );
};

export const useAlisha = () => {
  const context = useContext(AlishaContext);
  if (context === undefined) {
    throw new Error('useAlisha must be used within AlishaProvider');
  }
  return context;
};
