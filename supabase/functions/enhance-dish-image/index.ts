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
    const { assetId } = await req.json();
    
    if (!assetId) {
      throw new Error('assetId is required');
    }
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    console.log(`Processing image enhancement for asset: ${assetId}`);
    
    // 1. Fetch asset record
    const { data: asset, error: assetError } = await supabase
      .from('assets')
      .select('*')
      .eq('id', assetId)
      .single();
    
    if (assetError || !asset) {
      throw new Error(`Asset not found: ${assetError?.message}`);
    }
    
    console.log(`Found asset: ${asset.original_filename}`);
    
    // 2. Update status to processing
    await supabase
      .from('assets')
      .update({ enhancement_status: 'processing' })
      .eq('id', assetId);
    
    // 3. Download original image from storage
    const { data: imageData, error: downloadError } = await supabase
      .storage
      .from('marketing-assets')
      .download(asset.file_path);
    
    if (downloadError) {
      throw new Error(`Failed to download image: ${downloadError.message}`);
    }
    
    console.log('Image downloaded from storage');
    
    // 4. Convert to base64
    const arrayBuffer = await imageData.arrayBuffer();
    const base64Image = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    const imageUrl = `data:${asset.mime_type};base64,${base64Image}`;
    
    // 5. Call Lovable AI Gateway with Gemini 2.5 Flash for image enhancement
    const enhancementPrompt = `Transform this restaurant dish photo into an ultra-realistic, professional food photography masterpiece.

Enhancement Guidelines:
- LIGHTING: Apply soft, directional professional lighting with gentle shadows. Create a warm, inviting glow that highlights textures without harsh contrasts.
- COLORS: Enhance to be vibrant yet natural. Boost saturation by 15-20% while maintaining authenticity. Make greens more vibrant, reds richer, whites cleaner.
- COMPOSITION: Perfect depth of field - sharp foreground (the dish), softly blurred background (bokeh effect). Rule of thirds composition.
- STYLING: Add professional food styling touches - garnish highlights, sauce details, texture clarity, moisture/gloss on appropriate elements.
- BACKGROUND: Clean, uncluttered background. If needed, subtly blur or remove distracting elements. Professional restaurant ambiance.
- PLATING: Enhance presentation - make plating look pristine, clean edges, elegant arrangement.
- TEXTURE: Bring out food textures - crispy looks crispy, creamy looks smooth, fresh looks fresh.
- OVERALL: Make it look like a Michelin-star restaurant photo shoot. Magazine-quality. Instagram-worthy.

CRITICAL: Maintain authenticity - do not change what the dish is, only elevate its visual appeal to professional standards.`;

    console.log('Calling AI image enhancement...');

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: enhancementPrompt },
              { type: 'image_url', image_url: { url: imageUrl } }
            ]
          }
        ],
        modalities: ['image', 'text']
      })
    });
    
    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      throw new Error(`AI enhancement failed: ${errorText}`);
    }
    
    const aiData = await aiResponse.json();
    const enhancedImageUrl = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!enhancedImageUrl) {
      throw new Error('No enhanced image returned from AI');
    }
    
    console.log('AI enhancement completed');
    
    // 6. Extract base64 data
    const base64Data = enhancedImageUrl.replace(/^data:image\/\w+;base64,/, '');
    const enhancedBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    
    // 7. Upload enhanced image to storage
    const enhancedFilename = `enhanced_${asset.id}_${Date.now()}.png`;
    const { error: uploadError } = await supabase
      .storage
      .from('marketing-assets')
      .upload(enhancedFilename, enhancedBuffer, {
        contentType: 'image/png',
        upsert: false
      });
    
    if (uploadError) {
      throw new Error(`Failed to upload enhanced image: ${uploadError.message}`);
    }
    
    console.log(`Enhanced image uploaded: ${enhancedFilename}`);
    
    // 8. Create new asset record for enhanced image
    const { data: enhancedAsset, error: createError } = await supabase
      .from('assets')
      .insert({
        company_id: asset.company_id,
        source: 'upload',
        file_path: enhancedFilename,
        file_type: 'image',
        original_filename: `enhanced_${asset.original_filename}`,
        mime_type: 'image/png',
        is_enhanced: true,
        dish_name: asset.dish_name,
        tags: [...(asset.tags || []), 'ai_enhanced'],
        metadata: { enhanced_from: asset.id }
      })
      .select()
      .single();
    
    if (createError) {
      throw new Error(`Failed to create enhanced asset record: ${createError.message}`);
    }
    
    console.log(`Enhanced asset record created: ${enhancedAsset.id}`);
    
    // 9. Link original asset to enhanced version
    await supabase
      .from('assets')
      .update({
        enhanced_asset_id: enhancedAsset.id,
        enhancement_status: 'completed'
      })
      .eq('id', assetId);
    
    // 10. Update processing queue
    await supabase
      .from('image_processing_queue')
      .update({ status: 'completed', processed_at: new Date().toISOString() })
      .eq('asset_id', assetId);
    
    // 11. Trigger auto-generation of social posts
    console.log('Triggering auto-generate social posts...');
    const { error: invokeError } = await supabase.functions.invoke('auto-generate-social-post', {
      body: { enhancedAssetId: enhancedAsset.id, companyId: asset.company_id }
    });
    
    if (invokeError) {
      console.error('Failed to trigger social post generation:', invokeError);
      // Don't fail the whole process if social post generation fails
    }
    
    console.log('Image enhancement completed successfully');
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        enhancedAssetId: enhancedAsset.id,
        originalAssetId: assetId 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Enhancement error:', error);
    
    // Try to update asset status to failed
    try {
      const { assetId } = await req.json();
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      await supabase
        .from('assets')
        .update({
          enhancement_status: 'failed',
          enhancement_error: error.message
        })
        .eq('id', assetId);
      
      await supabase
        .from('image_processing_queue')
        .update({ 
          status: 'failed', 
          error_message: error.message,
          processed_at: new Date().toISOString() 
        })
        .eq('asset_id', assetId);
    } catch (updateError) {
      console.error('Failed to update error status:', updateError);
    }
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
