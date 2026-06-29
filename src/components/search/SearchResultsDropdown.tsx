
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { SearchResult } from '@/hooks/useGlobalSearch';
import { cn } from '@/lib/utils';

interface SearchResultsDropdownProps {
  groupedResults: Record<string, SearchResult[]>;
  query: string;
  onClose: () => void;
}

export const SearchResultsDropdown: React.FC<SearchResultsDropdownProps> = ({
  groupedResults,
  query,
  onClose
}) => {
  const navigate = useNavigate();
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  // Flatten results for keyboard navigation
  const flatResults = Object.values(groupedResults).flat();
  
  useEffect(() => {
    setSelectedIndex(0);
  }, [groupedResults]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (flatResults.length === 0) return;
      
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % flatResults.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + flatResults.length) % flatResults.length);
          break;
        case 'Enter':
          e.preventDefault();
          if (flatResults[selectedIndex]) {
            handleResultClick(flatResults[selectedIndex]);
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [flatResults, selectedIndex]);

  const handleResultClick = (result: SearchResult) => {
    navigate(result.route);
    onClose();
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query) return text;
    
    const index = text.toLowerCase().indexOf(query.toLowerCase());
    if (index === -1) return text;
    
    return (
      <>
        {text.substring(0, index)}
        <strong className="bg-yellow-200 px-0.5 rounded">
          {text.substring(index, index + query.length)}
        </strong>
        {text.substring(index + query.length)}
      </>
    );
  };

  if (Object.keys(groupedResults).length === 0) {
    return (
      <Card className="absolute top-full left-0 right-0 mt-1 z-50 shadow-lg border">
        <CardContent className="p-4">
          <div className="text-center text-muted-foreground">
            <p>No results found for "{query}"</p>
            <p className="text-sm mt-1">Try adjusting your search terms</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  let currentIndex = 0;

  return (
    <Card className="absolute top-full left-0 right-0 mt-1 z-50 shadow-lg border max-h-96 overflow-y-auto">
      <CardContent className="p-0">
        {Object.entries(groupedResults).map(([groupName, results]) => (
          <div key={groupName}>
            <div className="px-4 py-2 bg-gray-50 border-b text-sm font-medium text-gray-700">
              {groupName} ({results.length})
            </div>
            {results.map((result) => {
              const isSelected = currentIndex === selectedIndex;
              const resultIndex = currentIndex++;
              
              return (
                <div
                  key={result.id}
                  className={cn(
                    "px-4 py-3 border-b last:border-b-0 cursor-pointer transition-colors",
                    isSelected ? "bg-blue-50 border-blue-200" : "hover:bg-gray-50"
                  )}
                  onClick={() => handleResultClick(result)}
                  onMouseEnter={() => setSelectedIndex(resultIndex)}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-lg mt-0.5">{result.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">
                        {highlightMatch(result.title, query)}
                      </div>
                      <div className="text-sm text-gray-600 truncate">
                        {result.subtitle}
                      </div>
                      {result.metadata && (
                        <div className="text-xs text-gray-500 mt-1 truncate">
                          {result.metadata}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        
        <div className="px-4 py-2 bg-gray-50 text-xs text-gray-500 border-t">
          Use ↑↓ to navigate, Enter to select, Esc to close
        </div>
      </CardContent>
    </Card>
  );
};
