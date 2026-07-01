import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  light?: boolean;
}

export const SecureFinLogo: React.FC<LogoProps> = ({
  className = '',
  size = 'md',
  showText = true,
  light = false,
}) => {
  const sizeClasses = {
    sm: 'h-6 w-6 text-sm',
    md: 'h-8 w-8 text-lg',
    lg: 'h-12 w-12 text-2xl',
    xl: 'h-16 w-16 text-3xl',
  };

  const textSizes = {
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-3xl',
    xl: 'text-4xl',
  };

  return (
    <div className={`flex items-center gap-3 select-none ${className}`} id="securefin-logo-wrapper">
      {/* Dynamic vector shield & financial infinity loop icon */}
      <svg
        className={`${sizeClasses[size].split(' ')[0]} ${sizeClasses[size].split(' ')[1]} flex-shrink-0`}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        id="securefin-svg-logo"
      >
        {/* Outer security shield structure */}
        <path
          d="M50 10 L85 25 V50 C85 71.5 70 90 50 95 C30 90 15 71.5 15 50 V25 L50 10 Z"
          fill={light ? 'rgba(255, 255, 255, 0.15)' : 'rgba(22, 92, 169, 0.08)'}
          stroke={light ? '#ffffff' : '#165ca9'}
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Interlocking modern fin curve representing geometric wealth growth */}
        <path
          d="M32 45 C32 35, 45 35, 50 45 C55 55, 68 55, 68 45 C68 35, 55 35, 50 45 C45 55, 32 55, 32 45 Z"
          stroke={light ? '#38bdf8' : '#3a75c4'}
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Center security keyhole / growth anchor */}
        <circle cx="50" cy="45" r="5" fill={light ? '#ffffff' : '#165ca9'} />
        {/* Underline base structure to lock in security */}
        <path
          d="M35 70 H65"
          stroke={light ? '#38bdf8' : '#3a75c4'}
          strokeWidth="5"
          strokeLinecap="round"
        />
      </svg>

      {showText && (
        <span
          className={`font-sans font-bold tracking-tight ${textSizes[size]} ${
            light ? 'text-white' : 'text-slate-900'
          }`}
          id="securefin-text-brand"
        >
          Secure
          <span className={light ? 'text-sky-300 font-light' : 'text-brand-primary font-light'}>
            Fin
          </span>
        </span>
      )}
    </div>
  );
};
