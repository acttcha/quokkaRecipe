export interface YouTubeVideo {
  id: string;
  title: string;
  channel: string;
  viewCount: number;
  description?: string;     // 영상 설명 (snippet.description)
  durationSec?: number;     // 영상 길이 (초 단위)
  publishedAt?: string;     // ISO 날짜 (snippet.publishedAt)
  likeCount?: number;       // 좋아요 수
  thumbnailUrl?: string;    // YouTube 썸네일 (있으면 사용)
  thumbnailColor: string;   // 폴백 배경색
  thumbnailEmoji: string;   // 폴백 이모지
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
  folderId?: string;
  source?: 'ai' | 'youtube';
  youtubeVideoId?: string;
  youtubeThumbnail?: string;
  youtubeTitle?: string;
}

export interface Folder {
  id: string;
  name: string;
  createdAt: string;
}

export type ScreenName = 'Home' | 'Camera' | 'Recipes' | 'Settings' | 'Saved';

export type CurrentScreen =
  | { name: 'Home' }
  | { name: 'Camera'; fridgeMode?: boolean; receiptMode?: boolean }
  | { name: 'FridgeScan'; imageBase64: string; mimeType: string }
  | { name: 'ReceiptScan'; imageBase64: string; mimeType: string }
  | { name: 'Recipes'; imageBase64: string; mimeType: string }
  | { name: 'FridgeRecipes'; ingredients: string[] }
  | { name: 'DishRecipe'; dishName: string; servings?: number }
  | { name: 'Settings' }
  | { name: 'Saved' }
  | { name: 'Profile' }
  | { name: 'Fridge' }
  | { name: 'SavedRecipeDetail'; recipe: SavedRecipe }
  | { name: 'YoutubeRecipe'; recipeName?: string; directVideo?: { videoId: string; title: string; channelTitle: string } }
  | { name: 'LeafShop' }
  | { name: 'CookMode'; recipeName: string; steps: string[] }
  | { name: 'CookingLog' }
  | { name: 'ShoppingList' };

export interface NavProps {
  navigate: (screen: CurrentScreen) => void;
  goBack: () => void;
}
