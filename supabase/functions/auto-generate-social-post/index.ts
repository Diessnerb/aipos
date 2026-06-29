import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { enhancedAssetId, companyId } = await req.json();
    
    if (!enhancedAssetId || !companyId) {
      throw new Error('enhancedAssetId and companyId are required');
    }
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    console.log(`Generating social posts for enhanced asset: ${enhancedAssetId}`);
    
    // 1. Fetch enhanced asset and brand kit
    const { data: asset, error: assetError } = await supabase
      .from('assets')
      .select('*')
      .eq('id', enhancedAssetId)
      .single();
    
    if (assetError || !asset) {
      throw new Error(`Enhanced asset not found: ${assetError?.message}`);
    }
    
    const { data: brandKit } = await supabase
      .from('brand_kit')
      .select('*')
      .eq('company_id', companyId)
      .single();
    
    const dishName = asset?.dish_name || 'Featured Dish';
    const tone = brandKit?.tone_of_voice || 'warm';
    const customTone = brandKit?.custom_tone_description || '';
    
    console.log(`Dish: ${dishName}, Tone: ${tone}`);
    
    // 2. Generate captions for Instagram and Facebook using AI
    const systemPrompt = `You are a social media expert for restaurants. Create engaging, mouth-watering captions for food photos.

Brand Voice: ${tone === 'custom' ? customTone : tone}
Guidelines:
- Hook first (grab attention in first 5 words)
- Benefit-first messaging (why this matters to the customer)
- Create desire and urgency
- Mobile-optimized (short sentences, line breaks)
- Include relevant emojis naturally
- End with clear CTA
- Keep captions 2-3 sentences for Instagram, can be slightly longer for Facebook

Style:
- Warm: Friendly, inviting, comforting language
- Premium: Sophisticated, refined, exclusive language
- Playful: Fun, energetic, lighthearted language
- Professional: Polished, trustworthy, expert language`;

    const userPrompt = `Generate two separate social media captions for this dish: "${dishName}"

1. INSTAGRAM caption:
   - 2-3 sentences max
   - 3-5 relevant hashtags
   - More emoji usage
   - Visual storytelling focus
   
2. FACEBOOK caption:
   - 3-4 sentences
   - More conversational
   - 1-2 hashtags only
   - Can be slightly more descriptive

Return ONLY a JSON object with this structure:
{
  "instagram": {
    "caption": "Full caption with emojis and hashtags",
    "hashtags": ["hashtag1", "hashtag2", "hashtag3"]
  },
  "facebook": {
    "caption": "Full caption with minimal hashtags",
    "hashtags": ["hashtag1"]
  }
}`;

    console.log('Calling AI for caption generation...');

    const captionResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' }
      })
    });
    
    if (!captionResponse.ok) {
      const errorText = await captionResponse.text();
      throw new Error(`Caption generation failed: ${errorText}`);
    }
    
    const captionData = await captionResponse.json();
    const captions = JSON.parse(captionData.choices[0].message.content);
    
    console.log('AI captions generated successfully');
    
    // 3. Calculate optimal posting time (default to 11am-2pm window)
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(12, 0, 0, 0); // Default to noon tomorrow
    
    // 4. Get public URL for the enhanced image
    const { data: urlData } = supabase
      .storage
      .from('marketing-assets')
      .getPublicUrl(asset.file_path);
    
    const imageUrl = urlData.publicUrl;
    
    // 5. Create pending social posts for Instagram and Facebook
    const instagramPost = {
      company_id: companyId,
      platform: 'instagram',
      network: 'instagram',
      enhanced_asset_id: enhancedAssetId,
      image_urls: [imageUrl],
      caption: captions.instagram.caption,
      hashtags: captions.instagram.hashtags,
      approval_status: 'pending',
      scheduled_post_time: tomorrow.toISOString(),
      status: 'draft'
    };
    
    const facebookPost = {
      company_id: companyId,
      platform: 'facebook',
      network: 'facebook',
      enhanced_asset_id: enhancedAssetId,
      image_urls: [imageUrl],
      caption: captions.facebook.caption,
      hashtags: captions.facebook.hashtags,
      approval_status: 'pending',
      scheduled_post_time: tomorrow.toISOString(),
      status: 'draft'
    };
    
    const { data: posts, error: postsError } = await supabase
      .from('social_media_posts')
      .insert([instagramPost, facebookPost])
      .select();
    
    if (postsError) {
      throw new Error(`Failed to create social posts: ${postsError.message}`);
    }
    
    console.log(`Created ${posts.length} pending social posts`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        postsCreated: posts.length, 
        posts: posts.map(p => ({ id: p.id, platform: p.platform, caption: p.caption }))
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Auto-generate post error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
