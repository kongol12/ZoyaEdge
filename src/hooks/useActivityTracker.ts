import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../lib/auth';

export function useActivityTracker() {
  const location = useLocation();
  const { user } = useAuth();
  const lastPath = useRef(location.pathname);
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);

  const logActivity = async (data: {
    type: 'auth' | 'navigation' | 'action' | 'system' | 'security';
    severity: 'info' | 'warning' | 'error' | 'critical';
    message: string;
    path?: string;
    metadata?: any;
  }) => {
    try {
      await addDoc(collection(db, 'system_logs'), {
        ...data,
        userId: user?.uid || 'anonymous',
        userEmail: user?.email || 'anonymous',
        ip: 'client-side', // Real IP would be handled server-side if needed
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Failed to log activity:', error);
    }
  };

  // Track Navigation
  useEffect(() => {
    if (lastPath.current !== location.pathname) {
      logActivity({
        type: 'navigation',
        severity: 'info',
        message: `Navigation vers ${location.pathname}`,
        path: location.pathname,
        metadata: { from: lastPath.current }
      });
      lastPath.current = location.pathname;
    }
  }, [location.pathname]);

  // Track Scroll
  useEffect(() => {
    const handleScroll = () => {
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
      
      scrollTimeout.current = setTimeout(() => {
        const scrollPercent = Math.round(
          (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
        );
        
        if (scrollPercent > 20) { // Only log significant scrolls
          logActivity({
            type: 'action',
            severity: 'info',
            message: `Défilement de la page (${scrollPercent}%)`,
            path: location.pathname,
            metadata: { scrollPercent }
          });
        }
      }, 2000); // Debounce scroll logging
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    };
  }, [location.pathname]);

  // Track Global Clicks
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const clickable = target.closest('button, a, input[type="submit"], [role="button"], select, input[type="checkbox"], input[type="radio"]');
      
      if (clickable) {
        const el = clickable as HTMLElement;
        let label = el.innerText?.trim() || 
                    el.getAttribute('aria-label') || 
                    el.getAttribute('title') || 
                    el.getAttribute('name') ||
                    el.getAttribute('id') ||
                    'composante-ui';

        // Special handling for clean labels
        if (label === 'composante-ui' || label.length < 1) {
          const svg = el.querySelector('svg');
          if (svg) {
            const lucideClass = Array.from(svg.classList).find(c => c.startsWith('lucide-'));
            if (lucideClass) label = `Icône ${lucideClass.replace('lucide-', '')}`;
          }
        }

        // Limit label length
        const displayLabel = label.substring(0, 50);

        logActivity({
          type: 'action',
          severity: 'info',
          message: `Interaction: [${displayLabel}]`,
          path: location.pathname,
          metadata: { 
            element: clickable.tagName.toLowerCase(),
            id: el.id,
            label: label,
            type: (clickable as any).type || (clickable as any).role || 'ui-element'
          }
        });
      }
    };

    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [location.pathname]);

  return { logActivity };
}
