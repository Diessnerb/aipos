import React, { useEffect } from 'react';
import { useCompanySettings } from '@/hooks/useCompanySettings';

// Helper function to convert hex to HSL
const hexToHsl = (hex: string): string => {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
};

// Helper function to load Google Fonts
const loadGoogleFont = (fontFamily: string) => {
  if (typeof document === 'undefined') return;

  const fontMap: { [key: string]: string } = {
    'inter': 'Inter:wght@400;500;600;700',
    'roboto': 'Roboto:wght@400;500;700',
    'open-sans': 'Open+Sans:wght@400;500;600;700',
    'lato': 'Lato:wght@400;700',
    'montserrat': 'Montserrat:wght@400;500;600;700'
  };

  const googleFontUrl = fontMap[fontFamily];
  if (!googleFontUrl) return;

  const existingLink = document.querySelector(`link[href*="${fontFamily}"]`);
  if (existingLink) return;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${googleFontUrl}&display=swap`;
  document.head.appendChild(link);
};

interface BrandingThemeApplierProps {
  children: React.ReactNode;
}

export const BrandingThemeApplier: React.FC<BrandingThemeApplierProps> = ({ children }) => {
  const { settings, loading } = useCompanySettings();

  // Listen for instant branding updates
  useEffect(() => {
    const handleBrandingUpdate = (event: CustomEvent) => {
      const brandingData = event.detail;
      applyTheme(brandingData);
    };

    window.addEventListener('branding-theme-updated', handleBrandingUpdate as EventListener);
    
    return () => {
      window.removeEventListener('branding-theme-updated', handleBrandingUpdate as EventListener);
    };
  }, []);

  // Helper function to apply theme changes
  const applyTheme = (themeData: any) => {
    const root = document.documentElement;

    if (themeData.primary_color) {
      const primaryHsl = hexToHsl(themeData.primary_color);
      root.style.setProperty('--brand-primary', primaryHsl);
    }

    if (themeData.secondary_color) {
      const secondaryHsl = hexToHsl(themeData.secondary_color);
      root.style.setProperty('--brand-secondary', secondaryHsl);
    }

    if (themeData.font_style) {
      loadGoogleFont(themeData.font_style);
      
      const fontFamilyMap: { [key: string]: string } = {
        'inter': 'Inter, sans-serif',
        'roboto': 'Roboto, sans-serif',
        'open-sans': 'Open Sans, sans-serif',
        'lato': 'Lato, sans-serif',
        'montserrat': 'Montserrat, sans-serif'
      };

      const fontFamily = fontFamilyMap[themeData.font_style];
      if (fontFamily) {
        root.style.setProperty('--brand-font-family', fontFamily);
      }
    }
  };

  useEffect(() => {
    if (loading || !settings) return;

    const root = document.documentElement;

    // Apply brand colors to CSS variables for basic text
    if (settings.primary_color) {
      const primaryHsl = hexToHsl(settings.primary_color);
      root.style.setProperty('--brand-primary', primaryHsl);
    }

    if (settings.secondary_color) {
      const secondaryHsl = hexToHsl(settings.secondary_color);
      root.style.setProperty('--brand-secondary', secondaryHsl);
    }

    // Load and apply font family
    if (settings.font_style) {
      loadGoogleFont(settings.font_style);
      
      const fontFamilyMap: { [key: string]: string } = {
        'inter': 'Inter, sans-serif',
        'roboto': 'Roboto, sans-serif',
        'open-sans': 'Open Sans, sans-serif',
        'lato': 'Lato, sans-serif',
        'montserrat': 'Montserrat, sans-serif'
      };

      const fontFamily = fontFamilyMap[settings.font_style];
      if (fontFamily) {
        root.style.setProperty('--brand-font-family', fontFamily);
      }
    }
  }, [settings, loading]);

  useEffect(() => {
    // Add CSS styles for brand theming
    const styleId = 'branding-theme-styles';
    let styleElement = document.getElementById(styleId) as HTMLStyleElement;
    
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = styleId;
      document.head.appendChild(styleElement);
    }

    styleElement.textContent = `
      /* Apply brand colors to basic text elements */
      .brand-text-primary {
        color: hsl(var(--brand-primary, var(--foreground))) !important;
      }
      
      .brand-text-secondary {
        color: hsl(var(--brand-secondary, var(--muted-foreground))) !important;
      }

      /* Apply brand font to body and basic elements */
      body,
      .brand-font {
        font-family: var(--brand-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif) !important;
      }

      /* Apply brand colors to headings without specific color classes */
      h1:not([class*="text-red"]):not([class*="text-green"]):not([class*="text-blue"]):not([class*="text-yellow"]):not([class*="text-orange"]):not([class*="text-purple"]):not([class*="text-pink"]):not([class*="text-indigo"]):not([class*="text-violet"]):not([class*="text-cyan"]):not([class*="text-teal"]):not([class*="text-sky"]):not([class*="text-emerald"]):not([class*="text-lime"]):not([class*="text-amber"]):not([class*="text-rose"]):not([class*="text-fuchsia"]):not([class*="text-destructive"]):not([class*="text-success"]):not([class*="text-warning"]):not([style*="color"]),
      h2:not([class*="text-red"]):not([class*="text-green"]):not([class*="text-blue"]):not([class*="text-yellow"]):not([class*="text-orange"]):not([class*="text-purple"]):not([class*="text-pink"]):not([class*="text-indigo"]):not([class*="text-violet"]):not([class*="text-cyan"]):not([class*="text-teal"]):not([class*="text-sky"]):not([class*="text-emerald"]):not([class*="text-lime"]):not([class*="text-amber"]):not([class*="text-rose"]):not([class*="text-fuchsia"]):not([class*="text-destructive"]):not([class*="text-success"]):not([class*="text-warning"]):not([style*="color"]),
      h3:not([class*="text-red"]):not([class*="text-green"]):not([class*="text-blue"]):not([class*="text-yellow"]):not([class*="text-orange"]):not([class*="text-purple"]):not([class*="text-pink"]):not([class*="text-indigo"]):not([class*="text-violet"]):not([class*="text-cyan"]):not([class*="text-teal"]):not([class*="text-sky"]):not([class*="text-emerald"]):not([class*="text-lime"]):not([class*="text-amber"]):not([class*="text-rose"]):not([class*="text-fuchsia"]):not([class*="text-destructive"]):not([class*="text-success"]):not([class*="text-warning"]):not([style*="color"]) {
        color: hsl(var(--brand-primary, var(--foreground))) !important;
      }

      /* Apply brand colors to neutral text classes */
      .text-gray-900:not([class*="hover:"]):not([class*="focus:"]):not([class*="active:"]),
      .text-gray-800:not([class*="hover:"]):not([class*="focus:"]):not([class*="active:"]),
      .text-gray-700:not([class*="hover:"]):not([class*="focus:"]):not([class*="active:"]),
      .text-foreground:not([class*="hover:"]):not([class*="focus:"]):not([class*="active:"]) {
        color: hsl(var(--brand-primary, var(--foreground))) !important;
      }

      /* Apply secondary brand color to muted text */
      .text-gray-600:not([class*="hover:"]):not([class*="focus:"]):not([class*="active:"]),
      .text-gray-500:not([class*="hover:"]):not([class*="focus:"]):not([class*="active:"]),
      .text-muted-foreground:not([class*="hover:"]):not([class*="focus:"]):not([class*="active:"]),
      p.text-muted-foreground:not([class*="hover:"]):not([class*="focus:"]):not([class*="active:"]) {
        color: hsl(var(--brand-secondary, var(--muted-foreground))) !important;
      }

      /* Apply brand colors to basic paragraphs without specific colors */
      p:not([class*="text-red"]):not([class*="text-green"]):not([class*="text-blue"]):not([class*="text-yellow"]):not([class*="text-orange"]):not([class*="text-purple"]):not([class*="text-pink"]):not([class*="text-indigo"]):not([class*="text-violet"]):not([class*="text-cyan"]):not([class*="text-teal"]):not([class*="text-sky"]):not([class*="text-emerald"]):not([class*="text-lime"]):not([class*="text-amber"]):not([class*="text-rose"]):not([class*="text-fuchsia"]):not([class*="text-destructive"]):not([class*="text-success"]):not([class*="text-warning"]):not(.text-muted-foreground):not(.text-gray-600):not(.text-gray-500):not([style*="color"]) {
        color: hsl(var(--brand-primary, var(--foreground))) !important;
      }
    `;

    return () => {
      // Cleanup - remove the style element when component unmounts
      const element = document.getElementById(styleId);
      if (element) {
        element.remove();
      }
    };
  }, []);

  return <>{children}</>;
};