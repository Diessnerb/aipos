import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { MessageCircle, X, Send, Loader2, Square } from 'lucide-react';
import { useAIContext } from '@/hooks/useAIContext';
import { useToast } from '@/hooks/use-toast';
import { AIVoiceCommand } from './AIVoiceCommand';
import { useAlisha } from '@/providers/AlishaProvider';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { getBoundCompany } from '@/utils/deviceBinding';
import { usePermissionCheck } from '@/hooks/usePermissionCheck';
import { supabase } from '@/integrations/supabase/client';
import { ReservationConflictService } from '@/services/reservationConflictService';
import { QuickAccessButtons } from './QuickAccessButtons';
import { ConfirmationButtons } from './ConfirmationButtons';
import { YesNoButtons } from './YesNoButtons';
import { CustomerCard } from './CustomerCard';
import { useNavigate } from 'react-router-dom';
import { offlineAwareInsert } from '@/utils/offlineAwareSupabase';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  customerData?: any;
}

interface AIAssistantProps {
  isOpen: boolean;
  onClose: () => void;
}

type WorkflowType = 'add-reservation' | 'walk-in' | 'find-customer' | 'search-menu' | null;

interface PendingReservation {
  customerName: string;
  partySize: number;
  date: string;
  time: string;
  phone?: string;
  email?: string;
  suggestedTable?: number;
  suggestedTables?: number[];
  reservationType?: 'standard' | 'last_minute';
  availableMinutes?: number;
}

export const AIAssistant: React.FC<AIAssistantProps> = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [activeWorkflow, setActiveWorkflow] = useState<WorkflowType>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingReservation, setPendingReservation] = useState<PendingReservation | null>(null);
  const [showYesNoButtons, setShowYesNoButtons] = useState(false);
  const scrollEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hydratedRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { context, addTaskToHistory } = useAIContext();
  const { toast } = useToast();
  const { memory, settings, saveMemory, loadMemory } = useAlisha();
  const { currentUser } = useCurrentUser();
  const { checkPermission } = usePermissionCheck();
  const boundCompany = useMemo(() => getBoundCompany(), []);
  const navigate = useNavigate();

  // Initialize chat history and greeting
  useEffect(() => {
    const initializeChatHistory = async () => {
      if (hydratedRef.current) return;
      
      // Debug logging
      console.log('🤖 [AIAssistant] Initialization check:', {
        boundCompany: boundCompany?.company_id,
        currentUser: currentUser?.id,
        userCompanyId: currentUser?.company_id
      });
      
      // Use company ID from either bound company or current user
      const companyId = boundCompany?.company_id || currentUser?.company_id;
      
      if (!currentUser?.id) {
        console.log('🤖 [AIAssistant] Waiting for user data...');
        setIsLoadingHistory(false);
        return;
      }

      try {
        setIsLoadingHistory(true);
        
        // Get user name
        let userName = 'there';
        const { data: userData } = await supabase
          .from('users')
          .select('full_name')
          .eq('id', currentUser.id)
          .single();
        
        if (userData?.full_name) {
          userName = userData.full_name;
        }

        console.log('🤖 [AIAssistant] User name:', userName);

        // Load chat history if we have a company ID
        let hasHistory = false;
        if (companyId) {
          console.log('🤖 [AIAssistant] Loading chat history for company:', companyId);
          
          const { data: history, error } = await supabase
            .from('alisha_conversations')
            .select('*')
            .eq('company_id', companyId)
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false })
            .limit(50);

          if (error) {
            console.error('🤖 [AIAssistant] Error loading chat history:', error);
          } else if (history && history.length > 0) {
            hasHistory = true;
            console.log('🤖 [AIAssistant] Loaded', history.length, 'messages from database');
            
            const loadedMessages: Message[] = history.reverse().map(h => ({
              role: h.role as 'user' | 'assistant',
              content: h.content
            }));
            
            setMessages(loadedMessages);
            
            // Add contextual greeting for returning users after a brief delay
            setTimeout(() => {
              const greetingMessage = {
                role: 'assistant' as const,
                content: `Hi ${userName}, how are you today? How can I help?`
              };
              
              setMessages(prev => [...prev, greetingMessage]);
              
              // Save greeting to database if we have company ID
              if (companyId) {
                supabase.from('alisha_conversations').insert({
                  company_id: companyId,
                  user_id: currentUser.id,
                  role: 'assistant',
                  content: greetingMessage.content,
                  context_data: { greeting: 'returning_user' }
                });
              }
            }, 500);
          }
        }

        // Show welcome message if no history
        if (!hasHistory) {
          console.log('🤖 [AIAssistant] No history found, showing welcome message');
          
          const welcomeMessage = {
            role: 'assistant' as const,
            content: `Hi ${userName}! I'm Alisha, your AI assistant for ${boundCompany?.company_name || 'your restaurant'}. Use the quick access buttons above or ask me anything!`
          };
          
          setMessages([welcomeMessage]);
          
          // Save welcome message to database if we have company ID
          if (companyId) {
            await supabase.from('alisha_conversations').insert({
              company_id: companyId,
              user_id: currentUser.id,
              role: 'assistant',
              content: welcomeMessage.content,
              context_data: { greeting: 'first_time_user' }
            });
          }
        }

        hydratedRef.current = true;
      } catch (error) {
        console.error('🤖 [AIAssistant] Error initializing chat:', error);
        
        // Fallback: Show a basic greeting even if everything fails
        const fallbackMessage = {
          role: 'assistant' as const,
          content: "Hi! I'm Alisha, your AI assistant. How can I help you today?"
        };
        setMessages([fallbackMessage]);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    initializeChatHistory();
  }, [boundCompany, currentUser]);

  // Auto-scroll to bottom when messages change or loading state changes
  useEffect(() => {
    const scrollToBottom = () => {
      scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };
    
    // Use setTimeout to ensure DOM has updated
    const timeoutId = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timeoutId);
  }, [messages, isLoading]);

  const handleQuickAction = async (action: WorkflowType) => {
    console.log('🎯 Quick action clicked:', { action, isLoading });
    
    if (isLoading) {
      console.log('⚠️ Action blocked - already loading');
      return;
    }
    
    setActiveWorkflow(action);
    setShowConfirmation(false);
    setPendingReservation(null);
    
    // Send workflow initiation to AI so it can start the conversational flow
    let userMessage = '';
    
    switch (action) {
      case 'add-reservation':
        userMessage = "I want to add a new reservation";
        break;
      case 'walk-in':
        userMessage = "I need to seat walk-in guests";
        break;
      case 'find-customer':
        userMessage = "I need to find a customer";
        break;
      case 'search-menu':
        userMessage = "I want to search the menu";
        break;
    }
    
    console.log('💬 Sending workflow initiation to AI:', userMessage);
    addTaskToHistory(`started_${action}_workflow`);
    
    // Let AI handle the conversation flow
    streamChat(userMessage);
  };

  const streamChat = async (userMessage: string) => {
    console.log('🤖 streamChat started:', { userMessage, isLoading });
    
    // If already loading, cancel the current request
    if (abortControllerRef.current) {
      console.log('🛑 Cancelling previous request');
      abortControllerRef.current.abort();
      // Remove the incomplete assistant message
      setMessages(prev => {
        const lastMessage = prev[prev.length - 1];
        if (lastMessage?.role === 'assistant' && !lastMessage.content) {
          return prev.slice(0, -1);
        }
        return prev;
      });
    }
    
    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();
    
    const newMessages = [...messages, { role: 'user' as const, content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      let userName = 'there';
      if (currentUser?.id) {
        const { data: userData } = await supabase
          .from('users')
          .select('full_name')
          .eq('id', currentUser.id)
          .single();
        if (userData?.full_name) userName = userData.full_name;
      }
      
      const enhancedContext = {
        ...context,
        activeWorkflow,
        userPermissions: {
          canAccessSettings: checkPermission('/settings', 'edit'),
          canManageUsers: checkPermission('/settings', 'admin'),
          canViewReservations: checkPermission('/reservations', 'view'),
          canCreateReservations: checkPermission('/reservations', 'edit'),
          canViewCustomers: checkPermission('/customers', 'view'),
          canViewReports: checkPermission('/analytics', 'view'),
          userRole: currentUser?.role,
          isOwner: currentUser?.is_owner,
          isCompanyAdmin: currentUser?.is_company_admin,
        },
        alishaMemory: {
          companyKnowledge: memory.companyMemory.slice(0, 10),
          userPreferences: memory.userPreferences,
        },
        alishaSettings: settings,
        userName,
        companyName: boundCompany?.company_name,
        companyData: {
          companyId: boundCompany?.company_id,
        },
      };

      console.log('📤 Calling AI assistant with context:', { 
        messageCount: newMessages.length,
        activeWorkflow,
        userName 
      });

      // Get current session for auth
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            messages: newMessages,
            context: enhancedContext,
          }),
          signal: abortControllerRef.current.signal,
        }
      );

      console.log('📥 Response received:', { 
        status: response.status, 
        ok: response.ok,
        statusText: response.statusText
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error:', { status: response.status, errorText });
        throw new Error(errorText || 'Failed to get AI response');
      }

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';
      let textBuffer = '';

      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantMessage += content;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: 'assistant',
                  content: assistantMessage,
                };
                return updated;
              });
            }
          } catch (e) {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      console.log('✅ Stream complete, message length:', assistantMessage.length);

      // Detect yes/no questions in AI response
      const yesNoPattern = /\?\s*\(yes\/no\)|\?\s*\(y\/n\)/i;
      const hasYesNoQuestion = yesNoPattern.test(assistantMessage);
      if (hasYesNoQuestion) {
        console.log('🔘 Yes/No question detected, showing buttons');
        setShowYesNoButtons(true);
      }

      // Check if AI response contains reservation booking confirmation
      if (activeWorkflow === 'add-reservation' || activeWorkflow === 'walk-in') {
        const bookingMatch = assistantMessage.match(/I'll book (.*?) on table (\d+) at (\d+:\d+\s*(?:am|pm)?) for (\d+) guests?/i);
        if (bookingMatch) {
          setPendingReservation({
            customerName: bookingMatch[1],
            partySize: parseInt(bookingMatch[4]),
            date: new Date().toISOString().split('T')[0],
            time: bookingMatch[3],
            suggestedTable: parseInt(bookingMatch[2]),
            reservationType: 'standard',
          });
          setShowConfirmation(true);
        }
      }

      // Check if AI response contains customer data
      if (activeWorkflow === 'find-customer' && assistantMessage.includes('CUSTOMER_DATA:')) {
        const customerDataMatch = assistantMessage.match(/CUSTOMER_DATA:\s*(\{.*?\})/s);
        if (customerDataMatch) {
          try {
            const customerData = JSON.parse(customerDataMatch[1]);
            setMessages(prev => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                role: 'assistant',
                content: assistantMessage.replace(/CUSTOMER_DATA:.*/, '').trim(),
                customerData,
              };
              return updated;
            });
          } catch (e) {
            console.error('Failed to parse customer data:', e);
          }
        }
      }

      addTaskToHistory(`asked_ai: ${userMessage.substring(0, 50)}`);
      
      // Save messages to database
      if (boundCompany?.company_id && currentUser?.id) {
        // Save user message
        await offlineAwareInsert('alisha_conversations', {
          company_id: boundCompany.company_id,
          user_id: currentUser.id,
          role: 'user',
          content: userMessage,
          context_data: {
            workflow: activeWorkflow,
            page: context.currentPage
          }
        });

        // Save assistant message
        await offlineAwareInsert('alisha_conversations', {
          company_id: boundCompany.company_id,
          user_id: currentUser.id,
          role: 'assistant',
          content: assistantMessage,
          context_data: {
            workflow: activeWorkflow,
            page: context.currentPage
          }
        });

        // Reload memory to reflect new conversation
        await loadMemory();
      }
    } catch (error) {
      console.error('AI chat error:', error);
      
      // Don't show error toast if request was aborted (user cancelled)
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('🛑 Request cancelled by user');
        // Remove the incomplete assistant message if it exists
        setMessages(prev => {
          const lastMessage = prev[prev.length - 1];
          if (lastMessage?.role === 'assistant') {
            return prev.slice(0, -1);
          }
          return prev;
        });
      } else {
        toast({
          title: 'AI Error',
          description: error instanceof Error ? error.message : 'Failed to get response',
          variant: 'destructive',
        });
        setMessages(prev => prev.slice(0, -1));
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleYesClick = () => {
    console.log('✅ Yes button clicked');
    setShowYesNoButtons(false);
    streamChat('yes');
  };

  const handleNoClick = () => {
    console.log('❌ No button clicked');
    setShowYesNoButtons(false);
    streamChat('no');
  };

  const handleSend = () => {
    console.log('📨 handleSend called:', { input, isLoading });
    
    // If loading, this becomes a stop button
    if (isLoading) {
      console.log('🛑 Stop button clicked');
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      return;
    }
    
    if (!input.trim()) {
      console.log('⚠️ Send blocked - empty input');
      return;
    }
    
    const message = input.trim();
    setInput('');
    setShowYesNoButtons(false); // Hide yes/no buttons when sending new message
    
    // Keep focus on input field so user can continue typing
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
    
    streamChat(message);
  };

  const handleConfirmReservation = async () => {
    if (!pendingReservation || !boundCompany?.company_id) return;
    
    setIsLoading(true);
    try {
      // CRITICAL: Validate for conflicts before inserting
      const validation = await ReservationConflictService.validateReservation(
        {
          date: pendingReservation.date,
          time: pendingReservation.time,
          table_numbers: pendingReservation.suggestedTables || (pendingReservation.suggestedTable ? [pendingReservation.suggestedTable] : []),
          party_size: pendingReservation.partySize,
        },
        boundCompany.company_id,
        undefined
      );

      if (validation.hasConflict) {
        // Show conflict error with alternatives
        toast({
          title: 'Table Unavailable',
          description: validation.conflictMessage || 'This table is already booked at this time.',
          variant: 'destructive',
        });

        // Inform user and offer to find alternatives
        setMessages(prev => [
          ...prev,
          { 
            role: 'assistant', 
            content: `I'm sorry, but that table is already booked at this time. ${
              validation.alternativeTables && validation.alternativeTables.length > 0 
                ? `\n\n✅ Available alternatives:\n${validation.alternativeTables.map(t => `• Table ${t.table_number} (${t.seats} seats)`).join('\n')}\n\nWould you like me to book one of these instead?`
                : 'Let me help you find another table.'
            }`
          }
        ]);

        setShowConfirmation(false);
        setIsLoading(false);
        return;
      }

      // Validation passed, proceed with insert
      const { error } = await offlineAwareInsert('reservations', {
        company_id: boundCompany.company_id,
        customer_name: pendingReservation.customerName,
        party_size: pendingReservation.partySize,
        date: pendingReservation.date,
        time: pendingReservation.time,
        phone: pendingReservation.phone || '',
        email: pendingReservation.email || '',
        table_number: pendingReservation.suggestedTable,
        table_numbers: pendingReservation.suggestedTables || (pendingReservation.suggestedTable ? [pendingReservation.suggestedTable] : []),
        status: 'confirmed',
        reservation_type: pendingReservation.reservationType || 'standard',
      });

      if (error) {
        // Handle database trigger errors (CONFLICT_DETECTED)
        if (error.message?.includes('CONFLICT_DETECTED') || error.code === '23505') {
          toast({
            title: 'Double Booking Prevented',
            description: 'This table is already booked. Let me find you an alternative.',
            variant: 'destructive',
          });
          setMessages(prev => [
            ...prev,
            { role: 'assistant', content: 'The table became unavailable while I was processing. Let me find you another option right away.' }
          ]);
          setShowConfirmation(false);
          setIsLoading(false);
          return;
        }
        throw error;
      }

      toast({
        title: 'Reservation Confirmed',
        description: `${pendingReservation.customerName} booked on table ${pendingReservation.suggestedTable}`,
      });

      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `✅ Perfect! I've confirmed the reservation for ${pendingReservation.customerName}. The table is all set!` }
      ]);

      setShowConfirmation(false);
      setPendingReservation(null);
      setActiveWorkflow(null);
    } catch (error) {
      console.error('Reservation creation error:', error);
      toast({
        title: 'Booking Failed',
        description: 'Failed to create reservation. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelReservation = () => {
    setShowConfirmation(false);
    setPendingReservation(null);
    setMessages(prev => [
      ...prev,
      { role: 'assistant', content: "No problem! Let me know if you'd like to try a different time or table." }
    ]);
  };

  const handleCustomerAction = (action: 'edit' | 'add-reservation' | 'view-history', customerId: string) => {
    if (action === 'add-reservation') {
      setActiveWorkflow('add-reservation');
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: "Great! Let's create a reservation for this customer. What date and time would they like?" }
      ]);
    } else if (action === 'view-history') {
      navigate('/customers');
      onClose();
    }
  };

  const handleVoiceCommand = (command: string) => {
    setInput(command);
    setTimeout(() => {
      if (command.trim()) {
        streamChat(command);
      }
    }, 500);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <Card className="w-96 h-[700px] shadow-2xl flex flex-col bg-background border-2 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-primary/10 to-primary-glow/10">
        <div className="flex items-center gap-2">
          <div className="relative">
            <MessageCircle className="h-5 w-5 text-primary" />
            {settings.learningEnabled && (
              <div className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-accent animate-pulse" />
            )}
          </div>
          <div>
            <h3 className="font-semibold">Alisha</h3>
            <p className="text-xs text-muted-foreground">
              AI Assistant • {boundCompany?.company_name}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Quick Access Buttons */}
      <QuickAccessButtons
        onAddReservation={() => handleQuickAction('add-reservation')}
        onWalkIn={() => handleQuickAction('walk-in')}
        onFindCustomer={() => handleQuickAction('find-customer')}
        onSearchMenu={() => handleQuickAction('search-menu')}
        disabled={isLoading}
      />

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        {isLoadingHistory ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-2">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground">Loading conversation...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message, index) => (
              <div 
                key={index}
                className="animate-slide-in-up"
                style={{ 
                  animationDelay: `${Math.min(index * 50, 1000)}ms`,
                  animationFillMode: 'forwards'
                }}
              >
                <div
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
                
                {/* Render customer card if present */}
                {message.customerData && (
                  <div className="mt-2 max-w-[90%]">
                    <CustomerCard
                      customer={message.customerData}
                      onAction={handleCustomerAction}
                    />
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start animate-fade-in">
                <div className="bg-muted rounded-lg p-3">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
            {/* Invisible element to scroll to with spacing */}
            <div ref={scrollEndRef} className="h-4" />
          </div>
        )}
      </ScrollArea>

      {/* Confirmation Buttons */}
      {showConfirmation && pendingReservation && (
        <ConfirmationButtons
          onYes={handleConfirmReservation}
          onCancel={handleCancelReservation}
          disabled={isLoading}
        />
      )}

      {/* Yes/No Quick Reply Buttons */}
      {showYesNoButtons && !showConfirmation && (
        <YesNoButtons
          onYes={handleYesClick}
          onNo={handleNoClick}
          disabled={isLoading}
        />
      )}

      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex gap-2 items-end">
          <AIVoiceCommand onCommand={handleVoiceCommand} />
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me anything or use voice..."
            className="flex-1"
          />
          <Button
            onClick={handleSend}
            disabled={!isLoading && !input.trim()}
            size="icon"
            variant={isLoading ? "destructive" : "default"}
            title={isLoading ? "Stop response" : "Send message"}
          >
            {isLoading ? (
              <Square className="h-4 w-4" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
};
