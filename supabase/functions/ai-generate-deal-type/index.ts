import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FieldSchema {
  name: string;
  label: string;
  type: 'number' | 'integer' | 'currency' | 'text' | 'textarea' | 'boolean' | 'select' | 'multiselect' | 'time' | 'date';
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  options?: Array<{ value: string; label: string }>;
  helpText?: string;
}

interface DealTypeSchema {
  name: string;
  key: string;
  fields: FieldSchema[];
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function validateDealTypeSchema(data: any): DealTypeSchema {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid response format');
  }

  const { name, key, fields } = data;

  if (!name || typeof name !== 'string') {
    throw new Error('Name is required and must be a string');
  }

  if (!key || typeof key !== 'string') {
    throw new Error('Key is required and must be a string');
  }

  if (!Array.isArray(fields)) {
    throw new Error('Fields must be an array');
  }

  const validTypes = ['number', 'integer', 'currency', 'text', 'textarea', 'boolean', 'select', 'multiselect', 'time', 'date'];

  for (const field of fields) {
    if (!field.name || !field.label || !field.type) {
      throw new Error('Each field must have name, label, and type');
    }
    if (!validTypes.includes(field.type)) {
      throw new Error(`Invalid field type: ${field.type}`);
    }
  }

  return { name, key: slugify(key), fields };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { description } = await req.json();

    if (!description || typeof description !== 'string') {
      throw new Error('Description is required');
    }

    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    console.log('Generating deal type for description:', description);

    const prompt = `You are a restaurant deal type generator. Based on the description provided, generate a JSON object that defines the deal type structure with input fields.

Description: "${description}"

Generate a JSON response with this exact structure:
{
  "name": "Human-readable name for the deal type",
  "key": "kebab-case-key-for-the-deal-type",
  "fields": [
    {
      "name": "field_name",
      "label": "Display Label",
      "type": "one of: number, integer, currency, text, textarea, boolean, select, multiselect, time, date",
      "required": true/false,
      "min": optional_minimum_value,
      "max": optional_maximum_value,
      "step": optional_step_for_numbers,
      "options": [{"value": "val", "label": "Label"}] // only for select/multiselect
      "helpText": "Optional help text"
    }
  ]
}

Rules:
- Keep field names simple and snake_case
- Use descriptive labels
- Choose appropriate field types
- For discounts, use "number" type with min: 0
- For currencies, use "currency" type
- For yes/no options, use "boolean"
- For time ranges, use "time" type
- Only include fields that make sense for the deal type
- Maximum 5 fields per deal type

Examples:
- "Student discount 20% off with valid ID" → fields for discount percentage, ID verification requirements
- "Happy hour 2-for-1 cocktails" → fields for time range, applicable items
- "Birthday special free dessert" → fields for verification method, dessert selection

Return only valid JSON, no explanations.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a helpful assistant that generates structured JSON for restaurant deal types.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const generatedText = data.choices[0].message.content;

    console.log('AI response:', generatedText);

    let parsedSchema;
    try {
      parsedSchema = JSON.parse(generatedText);
    } catch (e) {
      console.error('Failed to parse AI response as JSON:', e);
      throw new Error('AI returned invalid JSON format');
    }

    const validatedSchema = validateDealTypeSchema(parsedSchema);

    return new Response(JSON.stringify(validatedSchema), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in ai-generate-deal-type function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate deal type';
    return new Response(JSON.stringify({ 
      error: errorMessage,
      fallbackSchema: {
        name: "Custom Deal",
        key: "custom-deal",
        fields: [
          {
            name: "description",
            label: "Deal Description",
            type: "textarea",
            required: true,
            helpText: "Describe the details of this deal"
          }
        ]
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});