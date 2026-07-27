/** Small caret glyph drawn with borders (no icon font needed). */

import React from 'react';
import {StyleSheet, View} from 'react-native';

export function Chevron({up, color, size = 10}: {up: boolean; color: string; size?: number}) {
  return (
    <View
      style={[
        styles.caret,
        {
          width: size,
          height: size,
          borderColor: color,
          transform: [{translateY: up ? size / 4 : -size / 4}, {rotate: up ? '45deg' : '225deg'}],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  caret: {borderLeftWidth: 2, borderTopWidth: 2},
});
