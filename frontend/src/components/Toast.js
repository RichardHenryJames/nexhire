import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet, View } from 'react-native';
import { typography } from '../styles/theme';
import { useTheme } from '../contexts/ThemeContext';

let queue = [];
let updateRef = null;

export function showToast(message, type = 'success', duration = 2500) {
  if (updateRef) {
    updateRef({ message, type, duration, id: Date.now() });
  } else {
    queue.push({ message, type, duration, id: Date.now() });
  }
}

export const ToastHost = () => {
  const { colors } = useTheme();
  const anim = useRef(new Animated.Value(0)).current;
  const [toast, setToast] = React.useState(null);
  const hideTimeout = useRef(null);

  const show = (cfg) => {
    if (hideTimeout.current) clearTimeout(hideTimeout.current);
    setToast(cfg);
    Animated.timing(anim, { toValue: 1, duration: 220, useNativeDriver: true }).start(() => {
      hideTimeout.current = setTimeout(() => hide(), cfg.duration || 2500);
    });
  };
  const hide = () => {
    Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
      setToast(null);
      if (queue.length) show(queue.shift());
    });
  };

  useEffect(() => {
    updateRef = (cfg) => {
      if (toast) {
        // replace current
        setToast(cfg);
      } else {
        show(cfg);
      }
    };
    if (queue.length && !toast) show(queue.shift());
    return () => { updateRef = null; };
  }, [toast]);

  if (!toast) return null;
  const bg = toast.type === 'error' ? (colors.error || colors.danger) : toast.type === 'warning' ? colors.warning : colors.success;

  return (
    <View pointerEvents="none" style={styles.wrapper}>
      <Animated.View style={[styles.toast,{backgroundColor:bg, opacity:anim, transform:[{translateY: anim.interpolate({inputRange:[0,1],outputRange:[20,0]})}]}]}>
        <Text style={styles.text}>{toast.message}</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper:{ position:'absolute', top:60, left:0, right:0, alignItems:'center', zIndex:9999 },
  toast:{ paddingHorizontal:16, paddingVertical:12, borderRadius:24, maxWidth:'90%', shadowColor:'#000', shadowOpacity:0.2, shadowRadius:6, elevation:4 },
  text:{ color:'#fff', fontSize:typography.sizes.sm, fontWeight:typography.weights.medium }
});
