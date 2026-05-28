import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { HealthProvider } from "@/context/HealthContext";
import { HydrationProvider, useHydration } from "@/context/HydrationContext";
import { WaterIntakeProvider } from "@/context/WaterIntakeContext";
import { WorkoutProvider } from "@/context/WorkoutContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function NavigationGuard() {
  const { hasOnboarded, isLoaded } = useHydration();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    // Don't route until AsyncStorage has finished loading — otherwise the
    // guard fires with hasOnboarded=false (default) before the persisted value
    // is read, which sends onboarded users back to the onboarding screen.
    // Segments is intentionally NOT a dependency: the guard should only re-run
    // when auth state changes, not on every navigation, which would cause
    // spurious redirects during route transitions.
    if (!isLoaded) return;
    const inOnboarding = segments[0] === "onboarding";
    if (!hasOnboarded && !inOnboarding) {
      router.replace("/onboarding");
    } else if (hasOnboarded && inOnboarding) {
      router.replace("/(tabs)");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasOnboarded, isLoaded]);

  return null;
}

function RootLayoutNav() {
  return (
    <>
      <NavigationGuard />
      <Stack screenOptions={{ headerBackTitle: "Back" }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen
          name="scan"
          options={{ headerShown: false, presentation: "fullScreenModal" }}
        />
        <Stack.Screen
          name="results"
          options={{ headerShown: false, presentation: "fullScreenModal" }}
        />
        <Stack.Screen
          name="workout"
          options={{ headerShown: false, presentation: "modal" }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <HydrationProvider>
            <WaterIntakeProvider>
            <HealthProvider>
              <WorkoutProvider>
                <GestureHandlerRootView>
                  <RootLayoutNav />
                </GestureHandlerRootView>
              </WorkoutProvider>
            </HealthProvider>
            </WaterIntakeProvider>
          </HydrationProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
