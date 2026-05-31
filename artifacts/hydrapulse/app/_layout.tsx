import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
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

// ─── Notification deep-link handler ───────────────────────────────────────────
// Runs inside the router tree so useRouter() works.
// Handles both:
//   • tap while app is open / in background (addNotificationResponseReceivedListener)
//   • cold launch from a notification tap (getLastNotificationResponseAsync)

type NotifData = { type?: string };

function routeFromNotification(
  data: NotifData,
  router: ReturnType<typeof useRouter>
) {
  switch (data?.type) {
    case "scan-alarm":
      // Take the user straight to the scan screen.
      router.push("/scan" as never);
      break;
    case "scan-result":
      // Show the result in History.
      router.push("/(tabs)/history" as never);
      break;
    case "smart-reminder":
      // General hydration reminder — go to the home tab.
      router.push("/(tabs)" as never);
      break;
    default:
      break;
  }
}

function NotificationHandler() {
  const router = useRouter();

  useEffect(() => {
    // Handle tap when the app is already running (foreground or background).
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as NotifData;
      routeFromNotification(data, router);
    });

    // Handle cold launch — the app was killed and the user tapped a notification.
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const data = response.notification.request.content.data as NotifData;
      routeFromNotification(data, router);
    }).catch(() => {});

    return () => sub.remove();
  // router identity is stable — safe to omit from deps.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

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
      <NotificationHandler />
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
