import { Linking } from 'react-native';
import { YouTubeVideo } from '../types';
import { MOCK_MODE } from './claude';

const MOCK_VIDEOS: YouTubeVideo[] = [
  {
    id: 'mock1',
    title: '계란 토마토 볶음 황금 레시피 | 5분 완성!',
    channel: '백종원의 요리비책',
    viewCount: 4821039,
    thumbnailColor: '#FFE0B2',
    thumbnailEmoji: '🍳',
    url: 'https://www.youtube.com/results?search_query=계란+토마토+볶음+레시피&sp=CAM%3D',
  },
  {
    id: 'mock2',
    title: '냉장고 재료로 만드는 초간단 파스타',
    channel: '요리왕 비룡',
    viewCount: 3102847,
    thumbnailColor: '#C8E6C9',
    thumbnailEmoji: '🍝',
    url: 'https://www.youtube.com/results?search_query=간단+파스타+레시피&sp=CAM%3D',
  },
  {
    id: 'mock3',
    title: '토마토계란국 만들기 | 해장국으로도 최고',
    channel: '만개의레시피',
    viewCount: 1987462,
    thumbnailColor: '#FFCDD2',
    thumbnailEmoji: '🍲',
    url: 'https://www.youtube.com/results?search_query=토마토+계란국&sp=CAM%3D',
  },
  {
    id: 'mock4',
    title: '양파 요리 BEST 10 | 이 재료로 뭐든 됩니다',
    channel: '구독자 300만 쿡방',
    viewCount: 982301,
    thumbnailColor: '#E1BEE7',
    thumbnailEmoji: '🧅',
    url: 'https://www.youtube.com/results?search_query=양파+요리+레시피&sp=CAM%3D',
  },
];

function formatViewCount(count: number): string {
  if (count >= 100000000) return `${(count / 100000000).toFixed(1)}억회`;
  if (count >= 10000) return `${Math.floor(count / 10000)}만회`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}천회`;
  return `${count}회`;
}

const YT_API_KEY = process.env.EXPO_PUBLIC_YOUTUBE_API_KEY ?? '';

export async function searchYouTubeRecipes(ingredients: string[]): Promise<YouTubeVideo[]> {
  if (MOCK_MODE || !YT_API_KEY) {
    await new Promise(r => setTimeout(r, 1000));
    return MOCK_VIDEOS;
  }

  const query = encodeURIComponent(ingredients.slice(0, 3).join(' ') + ' 레시피');
  const searchRes = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query}&order=viewCount&type=video&maxResults=6&regionCode=KR&relevanceLanguage=ko&key=${YT_API_KEY}`
  );
  const searchData = await searchRes.json();
  if (!searchData.items) return MOCK_VIDEOS;

  const ids = searchData.items.map((i: any) => i.id.videoId).join(',');
  const statsRes = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${ids}&key=${YT_API_KEY}`
  );
  const statsData = await statsRes.json();
  const statsMap: Record<string, number> = {};
  for (const item of statsData.items || []) {
    statsMap[item.id] = parseInt(item.statistics.viewCount || '0', 10);
  }

  const emojis = ['🍳', '🍜', '🥘', '🍲', '🥗', '🍱'];
  const colors = ['#FFE0B2', '#C8E6C9', '#FFCDD2', '#E1BEE7', '#B3E5FC', '#DCEDC8'];

  return searchData.items.map((item: any, i: number) => ({
    id: item.id.videoId,
    title: item.snippet.title,
    channel: item.snippet.channelTitle,
    viewCount: statsMap[item.id.videoId] || 0,
    thumbnailColor: colors[i % colors.length],
    thumbnailEmoji: emojis[i % emojis.length],
    url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
  }));
}

export function openYouTubeSearch(ingredients: string[]) {
  const query = encodeURIComponent(ingredients.slice(0, 3).join(' ') + ' 레시피');
  Linking.openURL(`https://www.youtube.com/results?search_query=${query}&sp=CAM%3D`);
}

export function openYouTubeByName(recipeName: string) {
  const query = encodeURIComponent(recipeName + ' 레시피');
  Linking.openURL(`https://www.youtube.com/results?search_query=${query}&sp=CAM%3D`);
}

export function openCoupang(ingredient: string) {
  Linking.openURL(`https://www.coupang.com/np/search?q=${encodeURIComponent(ingredient)}`);
}

export { formatViewCount };
