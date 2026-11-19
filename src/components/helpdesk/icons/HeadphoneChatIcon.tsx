import React from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';

interface HeadphoneChatIconProps {
  size?: number;
  style?: StyleProp<ImageStyle>;
}

export const HeadphoneChatIcon: React.FC<HeadphoneChatIconProps> = ({
  size = 32,
  style,
}) => {
  return (
    <Image
      source={{ uri: 'ic_headphone_desk' }}
      style={[
        {
          width: size,
          height: size,
          resizeMode: 'contain',
        },
        style,
      ]}
    />
  );
};
