export interface YouTubeVideo {
  id: string;
  title: string;
  channel: string;
  viewCount: number;
  thumbnailColor: string;
  thumbnailEmoji: string;
  url: string;
}

export interface Nutrition {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface Recipe {
  name: string;
  description: string;
  cookTime: string;
  servings: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  ingredients: string[];
  steps: string[];
  nutrition?: Nutrition;
}

export interface SavedRecipe extends Recipe {
  id: string;
  savedAt: string;
  sourceIngredients: string[];
}

export type ScreenName = 'Home' | 'Camera' | 'Recipes' | 'Settings' | 'Saved';

export type CurrentScreen =
  | { name: 'Home' }
  | { name: 'Camera'; fridgeMode?: boolean; receiptMode?: boolean }
  | { name: 'FridgeScan'; imageBase64: string; mimeType: string }
  | { name: 'ReceiptScan'; imageBase64: string; mimeType: string }
  | { name: 'Recipes'; imageBase64: string; mimeType: string }
  | { name: 'FridgeRecipes'; ingredients: string[] }
  | { name: 'Settings' }
  | { name: 'Saved' }
  | { name: 'Profile' }
  | { name: 'Fridge' }
  | { name: 'SavedRecipeDetail'; recipe: SavedRecipe };

export interface NavProps {
  navigate: (screen: CurrentScreen) => void;
  goBack: () => void;
}
