import React, { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { searchAddress, SearchResult } from "@/services/addressSearch";
import { cn } from "@/lib/utils";
import { MapPin, Search } from "lucide-react";

interface AddressSearchProps {
  onAddressSelect: (address: SearchResult) => void;
  placeholder?: string;
  className?: string;
  initialValue?: string;
}

export const AddressSearch: React.FC<AddressSearchProps> = ({
  onAddressSelect,
  placeholder = "Enter postcode or address...",
  className,
  initialValue = ""
}) => {
  const [query, setQuery] = useState(initialValue);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (resultsRef.current && !resultsRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.length >= 2) {
      searchTimeoutRef.current = setTimeout(async () => {
        setIsLoading(true);
        try {
          const searchResults = await searchAddress(query);
          setResults(searchResults);
          setShowResults(searchResults.length > 0);
        } catch (error) {
          console.error("Search error:", error);
          setResults([]);
        } finally {
          setIsLoading(false);
        }
      }, 300);
    } else {
      setResults([]);
      setShowResults(false);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query]);

  const handleAddressSelect = (address: SearchResult) => {
    setQuery(address.postcode);
    setShowResults(false);
    onAddressSelect(address);
  };

  return (
    <div className={cn("relative", className)} ref={resultsRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setShowResults(results.length > 0)}
          className="pl-10"
        />
      </div>

      {showResults && (
        <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
          {isLoading ? (
            <div className="p-3 text-center text-muted-foreground">
              Searching...
            </div>
          ) : results.length > 0 ? (
            results.map((address, index) => (
              <Button
                key={`${address.postcode}-${index}`}
                variant="ghost"
                className="w-full justify-start p-3 h-auto whitespace-normal text-left"
                onClick={() => handleAddressSelect(address)}
              >
                <MapPin className="h-4 w-4 mr-2 flex-shrink-0 text-muted-foreground" />
                <div className="flex flex-col items-start">
                  <span className="font-medium">{address.postcode}</span>
                  <span className="text-sm text-muted-foreground">
                    {address.city}, {address.county}
                  </span>
                </div>
              </Button>
            ))
          ) : (
            <div className="p-3 text-center text-muted-foreground">
              No addresses found
            </div>
          )}
        </div>
      )}
    </div>
  );
};