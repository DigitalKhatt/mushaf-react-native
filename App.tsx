import '@expo/metro-runtime';
import { WithSkiaWeb } from "@shopify/react-native-skia/lib/module/web";
import React from 'react';
import { Text } from 'react-native';




export default function App() {
  return (
    <WithSkiaWeb
      opts={{ locateFile: (file) => `/web/static/js/${file}` }}
      getComponent={() => import("./mushaf")}
      fallback={<Text style={{ textAlign: 'center' }}>Loading Skia...</Text>}
    />
  );
}