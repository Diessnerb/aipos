
import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface TagDisplaySystemProps {
  tags: string[] | null;
  itemName: string;
}

export const TagDisplaySystem = ({ tags, itemName }: TagDisplaySystemProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  if (!tags || tags.length === 0) {
    return null;
  }

  // Categorize tags
  const categorizeTag = (tag: string) => {
    const lowerTag = tag.toLowerCase();
    
    // Dietary tags
    if (lowerTag.includes('vegetarian') || lowerTag.includes('vegan') || 
        lowerTag.includes('gluten') || lowerTag.includes('keto') || 
        lowerTag.includes('paleo') || lowerTag.includes('organic')) {
      return 'dietary';
    }
    
    // Allergen-free tags
    if (lowerTag.includes('free') || lowerTag.includes('allergen') ||
        lowerTag.includes('nut') || lowerTag.includes('dairy') ||
        lowerTag.includes('shellfish') || lowerTag.includes('soy') ||
        lowerTag.includes('egg') || lowerTag.includes('wheat')) {
      return 'allergen';
    }
    
    // Notes (anything with warning words)
    if (lowerTag.includes('generally') || lowerTag.includes('confirm') ||
        lowerTag.includes('cross') || lowerTag.includes('may contain') ||
        lowerTag.includes('check') || lowerTag.includes('ask')) {
      return 'notes';
    }
    
    // Default to dietary for unmatched tags
    return 'dietary';
  };

  const dietaryTags = tags.filter(tag => categorizeTag(tag) === 'dietary');
  const allergenTags = tags.filter(tag => categorizeTag(tag) === 'allergen');
  const noteTags = tags.filter(tag => categorizeTag(tag) === 'notes');

  const handlePillClick = (category: string) => {
    setSelectedCategory(category);
    setIsModalOpen(true);
  };

  const getCategoryData = (category: string) => {
    switch (category) {
      case 'dietary':
        return { tags: dietaryTags, icon: '🥦', title: 'Dietary Tags' };
      case 'allergen':
        return { tags: allergenTags, icon: '🚫', title: 'Allergen-Free Tags' };
      case 'notes':
        return { tags: noteTags, icon: '⚠️', title: 'Notes' };
      default:
        return { tags: [], icon: '', title: '' };
    }
  };

  return (
    <>
      {/* Summary Pills */}
      <div className="flex flex-wrap gap-2 mt-2">
        {dietaryTags.length > 0 && (
          <button
            onClick={() => handlePillClick('dietary')}
            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 transition-colors border border-green-200 shadow-sm"
          >
            🥦 +{dietaryTags.length} Dietary
          </button>
        )}
        
        {allergenTags.length > 0 && (
          <button
            onClick={() => handlePillClick('allergen')}
            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-orange-50 text-orange-700 hover:bg-orange-100 transition-colors border border-orange-200 shadow-sm"
          >
            🚫 +{allergenTags.length} Allergen-Free
          </button>
        )}
        
        {noteTags.length > 0 && (
          <button
            onClick={() => handlePillClick('notes')}
            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700 hover:bg-yellow-100 transition-colors border border-yellow-200 shadow-sm"
          >
            ⚠️ +{noteTags.length} Notes
          </button>
        )}
      </div>

      {/* Compact Icon Line */}
      <div className="mt-1 text-xs text-gray-500 flex items-center gap-2">
        {dietaryTags.slice(0, 2).map((tag, index) => (
          <span key={index} className="inline-flex items-center" title={tag}>
            🥦 {tag}
          </span>
        ))}
        {allergenTags.slice(0, 2).map((tag, index) => (
          <span key={index} className="inline-flex items-center" title={tag}>
            🚫 {tag}
          </span>
        ))}
        {noteTags.slice(0, 1).map((tag, index) => (
          <span key={index} className="inline-flex items-center" title={tag}>
            ⚠️ {tag}
          </span>
        ))}
        {(dietaryTags.length + allergenTags.length + noteTags.length) > 5 && (
          <span className="text-gray-400">+{(dietaryTags.length + allergenTags.length + noteTags.length) - 5} more</span>
        )}
      </div>

      {/* Tag Details Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedCategory && getCategoryData(selectedCategory).icon}
              {selectedCategory && getCategoryData(selectedCategory).title}
            </DialogTitle>
            <DialogDescription>
              Tags for {itemName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {selectedCategory === 'all' || !selectedCategory ? (
              // Show all categories
              <>
                {dietaryTags.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm text-gray-900 mb-2 flex items-center gap-2">
                      🥦 Dietary Tags
                    </h4>
                    <div className="flex flex-wrap gap-1">
                      {dietaryTags.map((tag, index) => (
                        <Badge key={index} variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {allergenTags.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm text-gray-900 mb-2 flex items-center gap-2">
                      🚫 Allergen-Free Tags
                    </h4>
                    <div className="flex flex-wrap gap-1">
                      {allergenTags.map((tag, index) => (
                        <Badge key={index} variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {noteTags.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm text-gray-900 mb-2 flex items-center gap-2">
                      ⚠️ Notes
                    </h4>
                    <div className="flex flex-wrap gap-1">
                      {noteTags.map((tag, index) => (
                        <Badge key={index} variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              // Show selected category only
              <div>
                <div className="flex flex-wrap gap-1">
                  {getCategoryData(selectedCategory).tags.map((tag, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedCategory('all');
                }}
              >
                View All Categories
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsModalOpen(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
