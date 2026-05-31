import { ImageSourcePropType } from 'react-native';

// 잎사귀 충전 패키지 정의.
// 가격은 한국 IAP 표준 슬롯 (₩1,100 / ₩3,300 / ₩5,500 / ₩11,000 / ₩33,000) 에 맞춤.
// 실제 결제 연동(expo-iap / RevenueCat)은 사업자등록 + Play Console 결제 설정 후 추가.

export interface LeafPackage {
  id: string;
  name: string;
  image: ImageSourcePropType;
  price: number;       // KRW (부가세 포함)
  leaves: number;      // 지급 잎사귀 수
  bonusPercent?: number; // 새싹 대비 개당 가격 절약 % (마케팅용)
  featured?: boolean;  // "인기" 라벨
}

export const LEAF_PACKAGES: LeafPackage[] = [
  { id: 'handful', name: '잎사귀 한 줌',   image: require('../../assets/product1.webp'), price: 1100,  leaves: 12 },
  { id: 'bundle',  name: '잎사귀 한 다발', image: require('../../assets/product2.webp'), price: 3300,  leaves: 50,  bonusPercent: 25, featured: true },
  { id: 'armful',  name: '잎사귀 한 아름', image: require('../../assets/product3.webp'), price: 5500,  leaves: 100, bonusPercent: 50 },
  { id: 'basket',  name: '잎사귀 한 바구니', image: require('../../assets/product4.webp'), price: 11000, leaves: 220, bonusPercent: 83 },
  { id: 'box',     name: '잎사귀 한 박스', image: require('../../assets/product5.webp'), price: 33000, leaves: 800, bonusPercent: 123 },
];

export function formatKrw(n: number): string {
  return `₩${n.toLocaleString('ko-KR')}`;
}

export function pricePerLeaf(pkg: LeafPackage): number {
  return Math.round(pkg.price / pkg.leaves);
}
