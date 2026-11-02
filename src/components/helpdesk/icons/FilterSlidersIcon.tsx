import React from 'react';
import Svg, { Circle, Line } from 'react-native-svg';

export interface FilterSlidersIconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

/**
 * FilterSlidersIcon
 * Custom SVG Filter Slider Icon matching SVG Repo specification:
 * viewBox: 0 0 32 32
 * Circles & Lines for 3 horizontal adjustment sliders.
 */
export const FilterSlidersIcon: React.FC<FilterSlidersIconProps> = ({
  size = 17,
  color = '#94A3B8',
  strokeWidth = 2,
}) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {/* Top Row Slider */}
      <Circle
        cx="23"
        cy="7"
        r="3"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line
        x1="3"
        y1="7"
        x2="20"
        y2="7"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line
        x1="29"
        y1="7"
        x2="26"
        y2="7"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Middle Row Slider */}
      <Circle
        cx="12"
        cy="16"
        r="3"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line
        x1="3"
        y1="16"
        x2="9"
        y2="16"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line
        x1="29"
        y1="16"
        x2="15"
        y2="16"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Bottom Row Slider */}
      <Circle
        cx="23"
        cy="25"
        r="3"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line
        x1="3"
        y1="25"
        x2="20"
        y2="25"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line
        x1="29"
        y1="25"
        x2="26"
        y2="25"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
};
