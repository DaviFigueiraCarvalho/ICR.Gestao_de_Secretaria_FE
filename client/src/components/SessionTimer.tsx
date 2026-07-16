import { useState, useEffect } from 'react';
import { useICRAuth } from '../contexts/ICRAuthContext';
import { useTheme } from '../contexts/ThemeContext';

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = parts[1];
    // Base64url decode
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function getTokenExpiration(token: string | null): number | null {
  if (!token) return null;
  
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  
  // JWT standard expiration claim
  const exp = payload.exp;
  if (typeof exp === 'number' && Number.isFinite(exp)) {
    return exp * 1000; // Convert to milliseconds
  }
  
  return null;
}

function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return '00:00:00';
  
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function getTimerColor(ms: number, isDark: boolean): string {
  if (ms <= 0) {
    return isDark ? 'text-red-400' : 'text-red-600';
  }
  
  const totalMinutes = ms / 1000 / 60;
  
  if (totalMinutes < 5) {
    return isDark ? 'text-red-400' : 'text-red-600';
  } else if (totalMinutes < 15) {
    return isDark ? 'text-yellow-400' : 'text-yellow-600';
  } else {
    return isDark ? 'text-green-400' : 'text-green-600';
  }
}

export default function SessionTimer() {
  const { token } = useICRAuth();
  const { theme } = useTheme();
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [isExpired, setIsExpired] = useState(false);
  
  const isDark = theme === 'dark';
  
  useEffect(() => {
    const expirationTime = getTokenExpiration(token);
    
    if (!expirationTime) {
      setTimeRemaining(null);
      setIsExpired(false);
      return;
    }
    
    const updateTimer = () => {
      const now = Date.now();
      const remaining = expirationTime - now;
      
      if (remaining <= 0) {
        setTimeRemaining(0);
        setIsExpired(true);
      } else {
        setTimeRemaining(remaining);
        setIsExpired(false);
      }
    };
    
    // Initial update
    updateTimer();
    
    // Update every second
    const interval = setInterval(updateTimer, 1000);
    
    return () => clearInterval(interval);
  }, [token]);
  
  if (!token || timeRemaining === null) {
    return null;
  }
  
  const timerColor = getTimerColor(timeRemaining, isDark);
  const displayText = isExpired ? 'Sessão expirada' : `Sessão expira em: ${formatTimeRemaining(timeRemaining)}`;
  
  return (
    <div
      className="sticky top-0 z-30 w-full"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 30,
      }}
    >
      <div
        className={`
          px-4 py-2 text-center text-sm font-['Nunito'] font-medium
          border-b backdrop-blur-sm
          ${isDark ? 'bg-[#1c1c1c]/95 border-white/10' : 'bg-white/95 border-[#017158]/20'}
          ${timerColor}
        `}
      >
        {displayText}
      </div>
    </div>
  );
}