import React from 'react';
import Svg, { G, Path, Rect, Circle } from 'react-native-svg';
import { StyleProp, ViewStyle } from 'react-native';

interface HeadphoneChatIconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
}

export const HeadphoneChatIcon: React.FC<HeadphoneChatIconProps> = ({
  size = 28,
  color = '#000000',
  strokeWidth = 8.0,
  style,
}) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 385 385" fill="none" style={style}>
      <G
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* kulaklık bandı */}
        <Path d="M34 151 A159 159 0 0 1 346 151" />
        {/* kulaklıklar */}
        <Rect x={17} y={152} width={28} height={58} rx={13} />
        <Rect x={332} y={152} width={28} height={58} rx={13} />
        {/* mikrofon kolu ve mikrofon */}
        <Path d="M33.5 210 A159 159 0 0 0 172 340" />
        <Rect x={172} y={327} width={33} height={22} rx={9} />
        {/* konuşma balonu */}
        <Path d="M282.4 267 L302.9 326.9 L236.8 298.4 A125.5 125.5 0 1 1 282.4 267 Z" />
        {/* üç nokta */}
        <Circle cx={129} cy={182} r={16} />
        <Circle cx={190} cy={182} r={16} />
        <Circle cx={251} cy={182} r={16} />
      </G>
    </Svg>
  );
};
