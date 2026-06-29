import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Content-based pattern detection for drinks
const DRINK_PATTERNS = [
  // Beverage types
  /\b(beer|lager|ale|ipa|stout|pilsner)\b/i,
  /\b(wine|pinot|chardonnay|merlot|cabernet|sauvignon|grigio|blanc)\b/i,
  /\b(cocktail|martini|mojito|margarita|daiquiri|cosmopolitan)\b/i,
  /\b(coffee|espresso|latte|cappuccino|americano|mocha|macchiato)\b/i,
  /\b(tea|chai|matcha|earl grey|chamomile)\b/i,
  /\b(juice|smoothie|milkshake|frappe)\b/i,
  /\b(cola|coke|pepsi|sprite|fanta|lemonade|soda)\b/i,
  /\b(vodka|gin|rum|whisky|whiskey|tequila|bourbon|cognac|brandy)\b/i,
  /\b(cider|kombucha|water|sparkling)\b/i,
  // Drink formats/measurements
  /\b(pint|half|bottle|glass|shot|cl|ml)\b/i,
  /(75cl|750ml|330ml|500ml)/i,
];

// Content-based pattern detection for food
const FOOD_PATTERNS = [
  // Cooking methods
  /\b(grilled|fried|roasted|baked|steamed|poached|sautéed|braised)\b/i,
  /\b(chargrilled|pan-fried|deep-fried|slow-cooked)\b/i,
  // Food items
  /\b(chicken|beef|pork|lamb|fish|salmon|steak|burger|pizza|pasta)\b/i,
  /\b(salad|soup|sandwich|wrap|taco|burrito|curry|rice|noodles)\b/i,
  /\b(cheese|bacon|sausage|egg|chips|fries|potato)\b/i,
  /\b(bread|toast|bagel|croissant|pancake|waffle)\b/i,
  // Food descriptors
  /\b(crispy|tender|juicy|fresh|homemade|spicy|creamy)\b/i,
  /\b(served with|topped with|drizzled with)\b/i,
];

// Animal allergens for dietary filtering
const ANIMAL_ALLERGENS = ['Milk', 'Eggs', 'Fish', 'Crustaceans', 'Molluscs'];

// Analyze item names to detect category type
function analyzeItemNames(itemNames: string[]): { isDrink: boolean, isFood: boolean, confidence: number } {
  let drinkScore = 0;
  let foodScore = 0;
  
  itemNames.forEach(name => {
    const lowerName = name.toLowerCase();
    
    // Check drink patterns
    DRINK_PATTERNS.forEach(pattern => {
      if (pattern.test(lowerName)) {
        drinkScore += 1;
      }
    });
    
    // Check food patterns
    FOOD_PATTERNS.forEach(pattern => {
      if (pattern.test(lowerName)) {
        foodScore += 1;
      }
    });
  });
  
  const totalItems = itemNames.length;
  const drinkConfidence = totalItems > 0 ? drinkScore / totalItems : 0;
  const foodConfidence = totalItems > 0 ? foodScore / totalItems : 0;
  
  return {
    isDrink: drinkConfidence > 0.3, // 30% threshold
    isFood: foodConfidence > 0.3,
    confidence: Math.max(drinkConfidence, foodConfidence)
  };
}

interface MenuItemIngredient {
  ingredient_name: string;
  is_included: boolean;
  allergens: string[] | null;
}

interface MenuItem {
  id: string;
  name: string;
  price: number;
  description: string | null;
  allergens: string[] | null;
  tags: string[] | null;
  category_id: string | null;
  is_active: boolean;
  menu_categories?: {
    name: string;
  };
  menu_item_ingredients?: MenuItemIngredient[];
}

// Intelligent query expansion based on content analysis
function intelligentQueryExpansion(
  query: string,
  categoryIntelligence: Map<string, { isDrink: boolean, isFood: boolean }>
): string[] {
  const lowerQuery = query.toLowerCase().trim();
  const terms = [lowerQuery];
  
  // "drinks" query → expand to ALL detected drink categories
  if (lowerQuery.includes('drink') || lowerQuery.includes('beverage')) {
    categoryIntelligence.forEach((intel, catName) => {
      if (intel.isDrink) {
        terms.push(catName.toLowerCase());
      }
    });
  }
  
  // "food" query → expand to ALL detected food categories
  if (lowerQuery.includes('food') || lowerQuery.includes('eat') || lowerQuery.includes('meal') || lowerQuery.includes('dish')) {
    categoryIntelligence.forEach((intel, catName) => {
      if (intel.isFood) {
        terms.push(catName.toLowerCase());
      }
    });
  }
  
  // "wine" query → include all drink categories (wine colors like Red, White, Rose will be included)
  if (lowerQuery.includes('wine')) {
    categoryIntelligence.forEach((intel, catName) => {
      if (intel.isDrink) {
        const lowerCat = catName.toLowerCase();
        // Include wine-related categories
        if (lowerCat.includes('wine') || lowerCat.includes('red') || 
            lowerCat.includes('white') || lowerCat.includes('rose') || 
            lowerCat.includes('rosé') || lowerCat.includes('sparkling')) {
          terms.push(lowerCat);
        }
      }
    });
  }
  
  // "beer" query → include beer-related drink categories
  if (lowerQuery.includes('beer') || lowerQuery.includes('lager') || lowerQuery.includes('ale')) {
    categoryIntelligence.forEach((intel, catName) => {
      if (intel.isDrink) {
        const lowerCat = catName.toLowerCase();
        if (lowerCat.includes('beer') || lowerCat.includes('lager') || 
            lowerCat.includes('ale') || lowerCat.includes('pint') || 
            lowerCat.includes('half') || lowerCat.includes('draft')) {
          terms.push(lowerCat);
        }
      }
    });
  }
  
  // "starters" query → expand to common starter keywords
  if (lowerQuery.includes('starter') || lowerQuery.includes('appetizer') || 
      lowerQuery.includes('small plate') || lowerQuery.includes('nibble')) {
    terms.push('tapas', 'wings', 'nachos', 'bruschetta', 'calamari', 
               'prawn', 'shrimp', 'soup', 'garlic bread', 'olives', 
               'salad', 'sharing', 'platter');
  }
  
  // "mains" query → expand to common main course keywords
  if (lowerQuery.includes('main') || lowerQuery.includes('entree') || 
      lowerQuery.includes('entrée')) {
    terms.push('burger', 'pizza', 'pasta', 'steak', 'chicken', 'fish', 
               'curry', 'rice', 'sandwich', 'breakfast', 'wrap', 
               'grill', 'roast', 'chips', 'fries');
  }
  
  // "desserts" query → expand to common dessert keywords
  if (lowerQuery.includes('dessert') || lowerQuery.includes('sweet') || 
      lowerQuery.includes('pudding') || lowerQuery.includes('afters')) {
    terms.push('cake', 'ice cream', 'brownie', 'cheesecake', 'tart', 
               'chocolate', 'tiramisu', 'sundae', 'cookie', 'crumble', 
               'waffle', 'pancake');
  }
  
  return [...new Set(terms)]; // Remove duplicates
}

// Determine why an item matched (for debugging)
function getMatchReason(item: MenuItem, searchTerms: string[]): string | null {
  for (const term of searchTerms) {
    if (item.name.toLowerCase().includes(term)) return "name";
    if (item.description?.toLowerCase().includes(term)) return "description";
    if (item.menu_categories?.name.toLowerCase().includes(term)) return "category name";
    if (item.tags?.some(tag => tag.toLowerCase().includes(term))) return "tag";
    if (item.menu_item_ingredients?.some(ing => 
      ing.is_included && ing.ingredient_name.toLowerCase().includes(term)
    )) return "ingredient";
  }
  return null;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const { company_id, search_query, filter_allergen, filter_dietary } = 
      'body' in payload ? payload.body : payload;

    console.log("get-menu-for-voice-agent called");
    console.log("Parameters:", { company_id, search_query, filter_allergen, filter_dietary });

    // Validate company_id
    if (!company_id) {
      return new Response(
        JSON.stringify({ error: 'company_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(company_id)) {
      return new Response(
        JSON.stringify({ error: 'Invalid company_id format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Fetching menu for company_id: ${company_id}`);
    if (search_query) console.log(`Search query: ${search_query}`);
    if (filter_allergen) console.log(`Filter allergen: ${filter_allergen}`);
    if (filter_dietary) console.log(`Filter dietary: ${filter_dietary}`);

    // Fetch menu items with all related data
    const { data: menuItems, error: menuError } = await supabase
      .from('menu_items')
      .select(`
        id,
        name,
        price,
        description,
        allergens,
        tags,
        category_id,
        menu_categories!inner(
          name
        ),
        menu_item_ingredients(
          ingredient_name,
          is_included,
          allergens
        )
      `)
      .eq('company_id', company_id)
      .order('display_order', { ascending: true });

    if (menuError) {
      console.error('Database error:', menuError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch menu items', details: menuError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!menuItems || menuItems.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'No menu items found for this restaurant',
          categories: [],
          dietary_summary: { gluten_free_count: 0, vegan_count: 0, vegetarian_count: 0, dairy_free_count: 0 }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let filteredItems = menuItems as MenuItem[];

    // Build category intelligence map by analyzing item names
    const categoryIntelligence = new Map<string, { isDrink: boolean, isFood: boolean }>();
    const itemsByCategory = new Map<string, string[]>();

    (filteredItems as MenuItem[]).forEach(item => {
      const catName = item.menu_categories?.name || 'Other';
      if (!itemsByCategory.has(catName)) {
        itemsByCategory.set(catName, []);
      }
      itemsByCategory.get(catName)!.push(item.name);
    });

    // Analyze each category's items to determine if it's drinks or food
    itemsByCategory.forEach((items, categoryName) => {
      const analysis = analyzeItemNames(items);
      categoryIntelligence.set(categoryName, {
        isDrink: analysis.isDrink,
        isFood: analysis.isFood
      });
      console.log(`Category "${categoryName}": ${analysis.isDrink ? 'DRINKS' : ''} ${analysis.isFood ? 'FOOD' : ''} (confidence: ${(analysis.confidence * 100).toFixed(0)}%)`);
    });

    // Apply search query with intelligent expansion
    if (search_query) {
      const searchTerms = intelligentQueryExpansion(search_query, categoryIntelligence);
      console.log(`Intelligently expanded "${search_query}" to:`, searchTerms);

      filteredItems = filteredItems.filter(item => {
        return searchTerms.some(term => 
          item.name.toLowerCase().includes(term) ||
          item.description?.toLowerCase().includes(term) ||
          item.menu_categories?.name.toLowerCase().includes(term) ||
          item.tags?.some(tag => tag.toLowerCase().includes(term)) ||
          item.menu_item_ingredients?.some(ing => 
            ing.is_included && ing.ingredient_name.toLowerCase().includes(term)
          )
        );
      });

      console.log(`Search filtered: ${filteredItems.length} items found`);
    }

    // Apply allergen filter (exclude items containing this allergen)
    if (filter_allergen) {
      filteredItems = filteredItems.filter(item => {
        // Check item-level allergens
        if (item.allergens?.includes(filter_allergen)) return false;
        
        // Check ingredient-level allergens
        const hasAllergenInIngredients = item.menu_item_ingredients?.some(
          ing => ing.is_included && ing.allergens?.includes(filter_allergen)
        );
        
        return !hasAllergenInIngredients;
      });

      console.log(`Allergen filtered (excluding ${filter_allergen}): ${filteredItems.length} items`);
    }

    // Apply dietary filter (checks both tags and ingredients)
    if (filter_dietary) {
      filteredItems = filteredItems.filter(item => {
        const itemTags = (item.tags || []).map(t => t.toLowerCase());
        
        switch (filter_dietary) {
          case 'vegan':
            // Check if tagged vegan
            const hasVeganTag = itemTags.includes('vegan');
            
            // OR check ingredients don't contain animal products
            const hasNoAnimalAllergens = 
              !item.allergens?.some(a => ANIMAL_ALLERGENS.includes(a)) &&
              !item.menu_item_ingredients?.some(ing => 
                ing.is_included && ing.allergens?.some(a => ANIMAL_ALLERGENS.includes(a))
              );
            
            return hasVeganTag || hasNoAnimalAllergens;
          
          case 'vegetarian':
            // Check if tagged vegetarian or vegan
            const hasVegTag = itemTags.includes('vegetarian') || itemTags.includes('vegan');
            
            // OR check ingredients don't contain meat/fish/seafood (dairy and eggs OK)
            const meatAllergens = ['Fish', 'Crustaceans', 'Molluscs'];
            const hasNoMeatAllergens = 
              !item.allergens?.some(a => meatAllergens.includes(a)) &&
              !item.menu_item_ingredients?.some(ing => 
                ing.is_included && ing.allergens?.some(a => meatAllergens.includes(a))
              );
            
            return hasVegTag || hasNoMeatAllergens;
          
          case 'gluten_free':
            // Check if tagged gluten-free (handle variations)
            const hasGlutenFreeTag = 
              itemTags.includes('gluten-free') || 
              itemTags.includes('gluten free') ||
              itemTags.some(t => t.includes('gluten') && t.includes('free'));
            
            // OR check ingredients don't contain gluten
            const hasNoGluten = 
              !item.allergens?.includes('Gluten') &&
              !item.menu_item_ingredients?.some(ing => 
                ing.is_included && ing.allergens?.includes('Gluten')
              );
            
            return hasGlutenFreeTag || hasNoGluten;
          
          case 'dairy_free':
            // Check if tagged dairy-free (handle variations)
            const hasDairyFreeTag = 
              itemTags.includes('dairy-free') || 
              itemTags.includes('dairy free') ||
              itemTags.some(t => t.includes('dairy') && t.includes('free'));
            
            // OR check ingredients don't contain milk
            const hasNoDairy = 
              !item.allergens?.includes('Milk') &&
              !item.menu_item_ingredients?.some(ing => 
                ing.is_included && ing.allergens?.includes('Milk')
              );
            
            return hasDairyFreeTag || hasNoDairy;
          
          default:
            return true;
        }
      });

      console.log(`Dietary filtered (${filter_dietary}): ${filteredItems.length} items`);
    }

    // Get company name
    const { data: company } = await supabase
      .from('companies')
      .select('name')
      .eq('id', company_id)
      .single();

    // Group items by category
    const categoriesMap = new Map<string, any>();

    filteredItems.forEach(item => {
      const categoryName = item.menu_categories?.name || 'Other';
      
      if (!categoriesMap.has(categoryName)) {
        categoriesMap.set(categoryName, {
          category_name: categoryName,
          items: []
        });
      }

      // Extract all allergens (item + ingredients)
      const allAllergens = new Set<string>(item.allergens || []);
      item.menu_item_ingredients?.forEach(ing => {
        if (ing.is_included && ing.allergens) {
          ing.allergens.forEach(a => allAllergens.add(a));
        }
      });

      // Extract ingredients list
      const ingredientsList = item.menu_item_ingredients
        ?.filter(ing => ing.is_included)
        .map(ing => ing.ingredient_name) || [];

      // Determine dietary flags - ONLY if we have ingredient data
      const itemAllergens = Array.from(allAllergens);
      const hasIngredientData = ingredientsList.length > 0 || (item.allergens && item.allergens.length > 0);
      
      let isVegan, isVegetarian, isGlutenFree, isDairyFree;
      
      if (!hasIngredientData) {
        // No ingredient or allergen data - mark as unknown
        isVegan = null;
        isVegetarian = null;
        isGlutenFree = null;
        isDairyFree = null;
      } else {
        // Calculate based on allergens
        isVegan = !itemAllergens.some(a => ANIMAL_ALLERGENS.includes(a));
        isVegetarian = !itemAllergens.some(a => ['Fish', 'Crustaceans', 'Molluscs'].includes(a));
        isGlutenFree = !itemAllergens.includes('Gluten');
        isDairyFree = !itemAllergens.includes('Milk');
      }

      categoriesMap.get(categoryName)!.items.push({
        name: item.name,
        price: item.price,
        description: item.description,
        allergens: itemAllergens,
        ingredients: ingredientsList,
        is_vegan: isVegan,
        is_vegetarian: isVegetarian,
        is_gluten_free: isGlutenFree,
        is_dairy_free: isDairyFree,
        has_ingredient_data: hasIngredientData,
        match_reason: search_query ? getMatchReason(item, intelligentQueryExpansion(search_query, categoryIntelligence)) : null
      });
    });

    const categories = Array.from(categoriesMap.values());

    // Calculate dietary summary
    const dietary_summary = {
      gluten_free_count: filteredItems.filter(item => 
        !item.allergens?.includes('Gluten') &&
        !item.menu_item_ingredients?.some(ing => ing.is_included && ing.allergens?.includes('Gluten'))
      ).length,
      vegan_count: filteredItems.filter(item =>
        !item.allergens?.some(a => ANIMAL_ALLERGENS.includes(a)) &&
        !item.menu_item_ingredients?.some(ing => 
          ing.is_included && ing.allergens?.some(a => ANIMAL_ALLERGENS.includes(a))
        )
      ).length,
      vegetarian_count: filteredItems.filter(item =>
        !item.allergens?.some(a => ['Fish', 'Crustaceans', 'Molluscs'].includes(a)) &&
        !item.menu_item_ingredients?.some(ing => 
          ing.is_included && ing.allergens?.some(a => ['Fish', 'Crustaceans', 'Molluscs'].includes(a))
        )
      ).length,
      dairy_free_count: filteredItems.filter(item =>
        !item.allergens?.includes('Milk') &&
        !item.menu_item_ingredients?.some(ing => ing.is_included && ing.allergens?.includes('Milk'))
      ).length,
    };

    // Build conversational text response
    let responseText = `=== ${(company?.name || 'RESTAURANT').toUpperCase()} MENU ===\n\n`;
    
    // Add filter info if applied
    if (search_query || filter_allergen || filter_dietary) {
      responseText += `FILTERS APPLIED:\n`;
      if (search_query) responseText += `• Searching for: ${search_query}\n`;
      if (filter_allergen) responseText += `• Excluding allergen: ${filter_allergen}\n`;
      if (filter_dietary) responseText += `• Dietary preference: ${filter_dietary}\n`;
      responseText += `\n`;
    }
    
    // Add total items
    responseText += `Total items available: ${filteredItems.length}\n\n`;
    
    // Add categories and items
    categories.forEach((category, index) => {
      responseText += `${category.category_name.toUpperCase()}\n`;
      
      category.items.forEach((item: any) => {
        // Item name and price
        const priceStr = item.price > 0 ? `£${item.price.toFixed(2)}` : 'Price on request';
        responseText += `• ${item.name} - ${priceStr}\n`;
        
        // Description
        if (item.description) {
          responseText += `  ${item.description}\n`;
        }
        
        // Dietary flags - only show if we have ingredient data
        if (item.has_ingredient_data) {
          const dietaryFlags = [];
          if (item.is_vegan) dietaryFlags.push('Vegan');
          if (item.is_vegetarian) dietaryFlags.push('Vegetarian');
          if (item.is_gluten_free) dietaryFlags.push('Gluten Free');
          if (item.is_dairy_free) dietaryFlags.push('Dairy Free');
          
          if (dietaryFlags.length > 0) {
            responseText += `  [${dietaryFlags.join(', ')}]\n`;
          }
        } else {
          responseText += `  [Dietary info: Please ask staff]\n`;
        }
        
        // Allergens
        if (item.allergens && item.allergens.length > 0) {
          responseText += `  ⚠️ Contains: ${item.allergens.join(', ')}\n`;
        }
        
        responseText += `\n`;
      });
      
      // Add spacing between categories
      if (index < categories.length - 1) {
        responseText += `\n`;
      }
    });
    
    // Add dietary summary
    responseText += `\n---\nDIETARY SUMMARY:\n`;
    responseText += `• ${dietary_summary.gluten_free_count} Gluten Free items\n`;
    responseText += `• ${dietary_summary.vegan_count} Vegan items\n`;
    responseText += `• ${dietary_summary.vegetarian_count} Vegetarian items\n`;
    responseText += `• ${dietary_summary.dairy_free_count} Dairy Free items\n`;

    console.log(`Returning ${filteredItems.length} items in ${categories.length} categories`);

    return new Response(
      responseText,
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' } 
      }
    );

  } catch (error) {
    console.error('Error in get-menu-for-voice-agent:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
