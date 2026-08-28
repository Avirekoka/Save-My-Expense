import React from 'react';
import * as LucideIcons from 'lucide-react';
import { Category } from '../../types';

interface CategoryIconProps {
  category?: Category | null;
  categoryId?: string;
  className?: string;
  size?: number;
  iconOnly?: boolean;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({
  category,
  categoryId,
  className = 'w-9 h-9',
  size = 18,
  iconOnly = false,
}) => {
  const iconName = category?.icon || 'HelpCircle';
  const color = category?.color || '#64748B';

  // @ts-ignore
  const IconComponent = (LucideIcons as any)[iconName] || LucideIcons.HelpCircle;

  if (iconOnly) {
    return <IconComponent size={size} style={{ color }} />;
  }

  return (
    <div
      className={`rounded-xl flex items-center justify-center shrink-0 transition-transform ${className}`}
      style={{
        backgroundColor: `${color}18`, // 10% opacity background
        color: color,
      }}
    >
      <IconComponent size={size} strokeWidth={2.2} />
    </div>
  );
};
