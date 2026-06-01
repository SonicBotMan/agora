import React from 'react';

interface DefaultAgentIconProps {
  size?: number;
  className?: string;
}

const DefaultAgentIcon: React.FC<DefaultAgentIconProps> = ({
  size = 22,
  className = '',
}) => (
  <span
    className={`inline-flex shrink-0 items-center justify-center ${className}`}
    aria-hidden="true"
  >
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" fill="#6c63ff" />
      <text x="12" y="16" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">A</text>
    </svg>
  </span>
);

export default DefaultAgentIcon;
