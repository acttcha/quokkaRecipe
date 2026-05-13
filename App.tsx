import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { CurrentScreen } from './src/types';
import { isOnboardingDone } from './src/services/preferences';
import OnboardingScreen from './src/screens/OnboardingScreen';
import HomeScreen from './src/screens/HomeScreen';
import CameraScreen from './src/screens/CameraScreen';
import RecipeScreen from './src/screens/RecipeScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import SavedScreen from './src/screens/SavedScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import FridgeScreen from './src/screens/FridgeScreen';
import FridgeScanScreen from './src/screens/FridgeScanScreen';

type AppState = 'loading' | 'onboarding' | 'app';

export default function App() {
  const [appState, setAppState] = useState<AppState>('loading');
  const [screen, setScreen] = useState<CurrentScreen>({ name: 'Home' });

  useEffect(() => {
    isOnboardingDone().then(done => {
      setAppState(done ? 'app' : 'onboarding');
    });
  }, []);

  if (appState === 'loading') return null;

  if (appState === 'onboarding') {
    return <OnboardingScreen onDone={() => setAppState('app')} />;
  }

  const navigate = (next: CurrentScreen) => setScreen(next);
  const goBack = () => setScreen({ name: 'Home' });

  if (screen.name === 'Fridge') {
    return <FridgeScreen navigate={navigate} goBack={goBack} />;
  }
  if (screen.name === 'FridgeRecipes') {
    return (
      <RecipeScreen
        navigate={navigate}
        goBack={goBack}
        prefillIngredients={screen.ingredients}
      />
    );
  }
  if (screen.name === 'Saved') {
    return <SavedScreen navigate={navigate} goBack={goBack} />;
  }
  if (screen.name === 'Profile') {
    return (
      <ProfileScreen
        navigate={navigate}
        goBack={goBack}
        onResetPreferences={() => setAppState('onboarding')}
      />
    );
  }
  if (screen.name === 'Settings') {
    return (
      <SettingsScreen
        navigate={navigate}
        goBack={goBack}
        onResetPreferences={() => setAppState('onboarding')}
      />
    );
  }
  if (screen.name === 'Camera') {
    return <CameraScreen navigate={navigate} goBack={goBack} fridgeMode={screen.fridgeMode} />;
  }
  if (screen.name === 'FridgeScan') {
    return (
      <FridgeScanScreen
        navigate={navigate}
        goBack={goBack}
        imageBase64={screen.imageBase64}
        mimeType={screen.mimeType}
      />
    );
  }
  if (screen.name === 'Recipes') {
    return (
      <RecipeScreen
        navigate={navigate}
        goBack={goBack}
        imageBase64={screen.imageBase64}
        mimeType={screen.mimeType}
      />
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <HomeScreen navigate={navigate} goBack={goBack} />
    </>
  );
}
