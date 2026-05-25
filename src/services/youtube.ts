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

/**
 * 레시피 재료 텍스트에서 검색용 핵심 이름만 추출
 * 예: "다시마 (10cmX10cm) 4장" → "다시마"
 *     "묵은 김치 1컵 (약 200g)" → "묵은 김치"
 *     "돼지고기 앞다리살 200g" → "돼지고기 앞다리살"
 */
export function cleanIngredientName(raw: string): string {
  // 1) 괄호와 그 안 내용 제거
  let s = raw.replace(/\([^)]*\)/g, ' ').trim();
  // 2) 공백으로 분리
  const tokens = s.split(/\s+/).filter(Boolean);
  // 3) 수량/단위 토큰 제거
  const QTY = /^\d+([.,/]\d+)?(g|kg|ml|l|개|장|쪽|대|컵|큰술|작은술|묶음|줌|마리|모|입|봉|병|캔|알|톨)?$/i;
  const MOD = /^(약|약간|적당량|조금|살짝|한|두|세|네)$/;
  const nameTokens = tokens.filter(t => !QTY.test(t) && !MOD.test(t));
  const cleaned = nameTokens.join(' ').trim();
  return cleaned || raw.trim();
}

export function openCoupang(ingredient: string) {
  const q = cleanIngredientName(ingredient);
  Linking.openURL(`https://www.coupang.com/np/search?q=${encodeURIComponent(q)}`);
}

export { formatViewCount };

export function extractYouTubeVideoId(input: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = input.trim().match(p);
    if (m) return m[1];
  }
  return null;
}

// ─── 유튜브 레시피 분석용 ─────────────────────────────────────

export interface YTSearchResult {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  viewCount: number;
}

export async function searchYoutubeForRecipe(recipeName: string): Promise<YTSearchResult[]> {
  if (!YT_API_KEY) throw new Error('YouTube API 키가 없어요 (.env 확인)');

  const q = encodeURIComponent(`${recipeName} 레시피`);
  const searchRes = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${q}&type=video&maxResults=12&order=relevance&regionCode=KR&relevanceLanguage=ko&key=${YT_API_KEY}`
  );
  const searchData = await searchRes.json();

  if (searchData.error) {
    const msg = searchData.error.errors?.[0]?.reason || searchData.error.message || 'YouTube API 오류';
    throw new Error(`YouTube 오류: ${msg}`);
  }
  if (!searchData.items?.length) return [];

  const ids = searchData.items.map((i: any) => i.id.videoId).join(',');
  const statsRes = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${ids}&key=${YT_API_KEY}`
  );
  const statsData = await statsRes.json();
  const statsMap: Record<string, number> = {};
  for (const item of statsData.items || []) {
    statsMap[item.id] = parseInt(item.statistics.viewCount || '0', 10);
  }

  return searchData.items
    .map((item: any) => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url || '',
      viewCount: statsMap[item.id.videoId] || 0,
    }))
    .sort((a: YTSearchResult, b: YTSearchResult) => b.viewCount - a.viewCount);
}

export async function getVideoDescription(videoId: string): Promise<string> {
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet&key=${YT_API_KEY}`
  );
  const data = await res.json();
  return data.items?.[0]?.snippet?.description || '';
}

export async function fetchVideoTranscript(videoId: string): Promise<string> {
  try {
    const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: { 'Accept-Language': 'ko-KR,ko;q=0.9' },
    });
    const html = await pageRes.text();

    // captionTracks 위치 찾기
    const idx = html.indexOf('"captionTracks":');
    if (idx === -1) return '';

    const start = html.indexOf('[', idx);
    if (start === -1) return '';

    // 중괄호 깊이로 배열 끝 찾기
    let depth = 0;
    let end = start;
    for (let i = start; i < Math.min(start + 100000, html.length); i++) {
      const c = html[i];
      if (c === '[' || c === '{') depth++;
      else if (c === ']' || c === '}') { depth--; if (depth === 0) { end = i; break; } }
    }

    let tracks: any[];
    try { tracks = JSON.parse(html.slice(start, end + 1)); } catch { return ''; }

    // 한국어 수동 자막 > 한국어 자동 자막 > 첫 번째 트랙 순으로 시도
    const track =
      tracks.find(t => t.languageCode === 'ko' && t.kind !== 'asr') ||
      tracks.find(t => t.languageCode === 'ko') ||
      tracks.find(t => t.languageCode?.startsWith('ko')) ||
      tracks[0];
    if (!track?.baseUrl) return '';

    const captionRes = await fetch(`${track.baseUrl}&fmt=json3`);
    const captionData = await captionRes.json();

    return (captionData.events || [])
      .filter((e: any) => e.segs)
      .map((e: any) => e.segs.map((s: any) => (s.utf8 || '').replace(/\n/g, ' ')).join(''))
      .filter((s: string) => s.trim())
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  } catch {
    return '';
  }
}
