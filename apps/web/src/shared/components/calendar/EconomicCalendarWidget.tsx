import React, { useEffect, useRef, memo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useTheme } from '@shared/lib/theme';
import { useTranslation } from '@shared/lib/i18n';

function EconomicCalendarWidget() {
  const container = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const { theme } = useTheme();
  const { language } = useTranslation();

  useEffect(() => {
    if (!container.current) return;

    setIsLoaded(false);
    // Clear container to prevent duplicate widgets on re-renders
    container.current.innerHTML = '<div id="economicCalendarWidget"></div>';

    const script = document.createElement('script');
    script.src = 'https://www.tradays.com/c/js/widgets/calendar/widget.js?v=15';
    script.type = 'text/javascript';
    script.async = true;
    script.dataset.type = 'calendar-widget';
    
    // Determine the actual theme (0 for light, 1 for dark)
    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    // Configuration for the widget
    script.innerHTML = JSON.stringify({
      width: "100%",
      height: "100%",
      mode: "2",
      fw: "react",
      lang: language,
      theme: isDark ? 1 : 0
    });

    script.onload = () => {
      setIsLoaded(true);
    };
      
    container.current.appendChild(script);

    return () => {
      if (container.current) {
        container.current.innerHTML = '';
      }
    };
  }, [theme, language]);

  return (
    <div className="relative w-full h-full min-h-[600px]">
      {!isLoaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50/50 dark:bg-gray-900/50 backdrop-blur-sm z-10 rounded-2xl">
          <RefreshCw className="w-10 h-10 text-zoya-red animate-spin mb-4" />
          <div className="space-y-3 w-full max-w-md px-6">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse w-3/4 mx-auto"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse w-1/2 mx-auto"></div>
          </div>
        </div>
      )}
      <div ref={container} className="w-full h-full">
        <div id="economicCalendarWidget"></div>
      </div>
      <style>{`
        .ecw-copyright { 
          display: none !important; 
        }
        #economicCalendarWidget iframe {
          border-radius: 1rem !important;
          border: none !important;
        }
      `}</style>
    </div>
  );
}

export default memo(EconomicCalendarWidget);
