
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      campaignAbout,
      toneOfVoice,
      preferredLength,
      callToAction,
      seasonalReference,
      audienceType,
      promotionLimitations,
      campaignType
    } = await req.json();

    console.log('AI Campaign Generation request:', { campaignType, preferredLength, toneOfVoice });

    // Build the prompt with copywriting frameworks
    let prompt = `You are a world-class copywriter specializing in restaurant marketing. Create compelling ${campaignType} content using proven copywriting frameworks (AIDA, PAS, 4Cs).

Campaign Details:
- About: ${campaignAbout}
- Tone: ${toneOfVoice}
- Length: ${preferredLength}
- Channel: ${campaignType}`;

    if (callToAction) prompt += `\n- Call to Action: ${callToAction}`;
    if (seasonalReference) prompt += `\n- Seasonal Reference: ${seasonalReference}`;
    if (audienceType) prompt += `\n- Audience: ${audienceType}`;
    if (promotionLimitations) prompt += `\n- Limitations: ${promotionLimitations}`;

    prompt += `\n\nFormatting Requirements:
- Break lines every 1-2 sentences for mobile readability
- Use benefit-first messaging
- Include urgency/scarcity triggers where appropriate
- Bold important phrases with **text**
- Start with a strong hook
- End with a clear, compelling CTA
- Optimize for ${campaignType === 'sms' ? 'SMS (under 160 chars)' : campaignType === 'social' ? 'social media engagement' : 'email open and click rates'}

Write the marketing content now:`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are an expert copywriter who creates high-converting marketing content for restaurants. Your writing is persuasive, benefit-focused, and optimized for mobile reading. You understand marketing psychology and use proven frameworks.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_completion_tokens: preferredLength === 'short' ? 100 : preferredLength === 'medium' ? 300 : 800,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again in a moment.');
      }
      if (response.status === 401) {
        throw new Error('Invalid API key. Please check your AI configuration.');
      }
      if (response.status === 402) {
        throw new Error('AI credits exhausted. Please add credits to your Lovable workspace.');
      }
      
      throw new Error(`AI Gateway error: ${response.statusText}`);
    }

    const data = await response.json();
    const generatedContent = data.choices[0].message.content;

    // Log the generation (optional backend logging)
    try {
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        const { data: userData } = await supabase.auth.getUser(token);
        
        if (userData.user) {
          await supabase.from('ai_campaign_logs').insert({
            user_id: userData.user.id,
            prompt_inputs: {
              campaignAbout,
              toneOfVoice,
              preferredLength,
              callToAction,
              seasonalReference,
              audienceType,
              promotionLimitations,
              campaignType
            },
            output: generatedContent,
            channel: campaignType
          });
        }
      }
    } catch (logError) {
      console.error('Error logging campaign generation:', logError);
      // Don't fail the request if logging fails
    }

    return new Response(JSON.stringify({ content: generatedContent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-campaign function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
