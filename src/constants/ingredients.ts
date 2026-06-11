import { getLang } from '../services/locale';

// 자동완성 재료 목록 — 언어별로 독립.
// 한국어: 한식 위주 식재료. 영어: 서양·글로벌 식재료.
// (직역이 아니라 각 문화권에서 실제로 흔히 쓰는 재료로 구성)

export const POPULAR_INGREDIENTS_KO = [
  // 달걀·유제품
  '달걀', '우유', '버터', '치즈', '슬라이스치즈', '모짜렐라치즈',
  '파마산치즈', '크림치즈', '생크림', '요거트', '사워크림', '두유',

  // 채소 — 기본
  '양파', '적양파', '마늘', '대파', '쪽파', '생강', '샬롯',
  '당근', '감자', '고구마', '무', '단무지',
  '배추', '양배추', '적양배추', '청경채',
  '시금치', '상추', '깻잎', '부추', '미나리', '쑥갓', '케일',
  '루꼴라', '치커리', '로메인', '수채',

  // 채소 — 열매·뿌리
  '애호박', '단호박', '오이', '가지', '비트', '래디시', '순무',
  '연근', '우엉', '도라지', '더덕', '마', '토란',
  '토마토', '방울토마토', '아보카도',
  '고추', '홍고추', '청양고추', '풋고추', '피망', '파프리카',
  '옥수수', '완두콩', '에다마메',

  // 채소 — 서양·허브
  '브로콜리', '콜리플라워', '아스파라거스', '셀러리', '리크',
  '바질', '파슬리', '고수', '딜', '로즈마리', '타임', '민트',

  // 채소 — 나물·산채
  '콩나물', '숙주나물', '고사리', '취나물', '참나물',

  // 두부·콩류
  '두부', '연두부', '순두부', '유부',
  '콩', '검은콩', '팥', '강낭콩', '렌틸콩', '병아리콩', '완두',
  '청국장', '낫토',

  // 버섯
  '표고버섯', '팽이버섯', '새송이버섯', '느타리버섯', '양송이버섯',
  '목이버섯', '석이버섯', '건표고버섯', '트러플',

  // 닭고기
  '닭가슴살', '닭다리', '닭볶음탕용', '닭날개', '닭안심',
  '닭껍질', '삼계탕용닭', '훈제닭',

  // 돼지고기
  '삼겹살', '돼지목살', '돼지앞다리살', '돼지갈비', '돼지안심',
  '돼지족발', '돼지껍데기', '항정살', '가브리살',
  '다진돼지고기',

  // 소고기
  '소고기', '소불고기', '소갈비', '소안심', '소등심',
  '소차돌박이', '소꼬리', '소양', '다진소고기',

  // 기타 육류
  '오리고기', '오리로스', '양고기', '스팸', '런천미트',

  // 해산물 — 생선
  '고등어', '삼치', '갈치', '조기', '가자미', '광어', '우럭',
  '도미', '농어', '병어', '아귀', '민어', '숭어',
  '연어', '참치', '명태', '동태', '황태', '코다리', '대구',

  // 해산물 — 갑각류·두족류·조개
  '새우', '대하', '꽃게', '대게', '킹크랩',
  '오징어', '낙지', '문어', '주꾸미', '한치', '꼴뚜기',
  '바지락', '홍합', '굴', '전복', '가리비', '소라', '새조개',

  // 가공·냉동
  '참치캔', '골뱅이캔', '꽁치캔',
  '햄', '소시지', '비엔나소시지', '베이컨', '핫도그',
  '어묵', '어묵바', '게맛살', '맛살',
  '만두', '군만두', '물만두', '떡볶이떡', '가래떡', '절편', '떡국떡',
  '냉동새우', '냉동오징어', '냉동홍합',

  // 건어물·해조류
  '멸치', '북어', '황태채', '북어채', '오징어채', '쥐포', '뱅어포',
  '미역', '미역줄기', '다시마', '김', '파래', '톳', '매생이', '모자반',

  // 곡류
  '쌀', '현미', '찹쌀', '보리', '귀리', '잡곡', '흑미',
  '오트밀', '퀴노아', '옥수수가루',

  // 면류
  '라면', '당면', '우동면', '소면', '칼국수면', '냉면',
  '스파게티', '펜네', '푸실리', '쌀국수면', '쌀면', '메밀면',

  // 빵·가루류
  '식빵', '바게트', '크루아상', '모닝빵', '또띠야',
  '밀가루', '박력분', '강력분', '부침가루', '튀김가루',
  '전분', '감자전분', '쌀가루', '찹쌀가루', '빵가루', '파니르',

  // 김치·절임
  '김치', '깍두기', '열무김치', '백김치', '총각김치',
  '파김치', '깻잎장아찌', '무장아찌', '오이소박이',

  // 장류·기본양념
  '간장', '국간장', '진간장', '양조간장',
  '된장', '청국장', '고추장', '쌈장',
  '소금', '설탕', '흑설탕', '후추', '흰후추',

  // 기름·식초
  '참기름', '들기름', '올리브오일', '포도씨유', '카놀라유', '식용유',
  '식초', '현미식초', '사과식초', '발사믹식초',

  // 술·감미료
  '맛술', '청주', '미림', '소주', '막걸리',
  '꿀', '올리고당', '물엿', '매실청', '아가베시럽',

  // 소스·페이스트
  '마요네즈', '케첩', '머스타드', '홀그레인머스타드',
  '굴소스', '두반장', '춘장', 'XO소스', '남플라',
  '스리라차', '타바스코', '핫소스',
  '토마토페이스트', '토마토소스', '데리야키소스', '돈까스소스',
  '발사믹글레이즈', '버팔로소스',

  // 젓갈·액젓
  '새우젓', '멸치액젓', '까나리액젓', '명란젓', '창란젓', '오징어젓',

  // 향신료·가루
  '고춧가루', '파프리카가루', '카레가루', '강황가루',
  '계피', '팔각', '오향가루', '큐민', '코리앤더',
  '바닐라에센스', '베이킹파우더', '베이킹소다',
  '다진마늘', '다진생강', '건마늘',

  // 씨앗·견과
  '참깨', '흑임자', '들깨', '땅콩', '아몬드',
  '호두', '캐슈넛', '잣', '피스타치오',
  '해바라기씨', '호박씨', '치아씨드',
  '코코넛밀크', '코코넛플레이크',

  // 과일
  '사과', '배', '레몬', '라임', '귤', '오렌지', '자몽',
  '딸기', '포도', '블루베리', '라즈베리', '체리',
  '복숭아', '자두', '살구', '수박', '참외', '멜론',
  '바나나', '키위', '망고', '파인애플', '파파야',
  '무화과', '석류',
];

export const POPULAR_INGREDIENTS_EN = [
  // Eggs & dairy
  'Eggs', 'Milk', 'Butter', 'Cheese', 'Cheddar', 'Mozzarella',
  'Parmesan', 'Cream Cheese', 'Heavy Cream', 'Yogurt', 'Greek Yogurt',
  'Sour Cream', 'Soy Milk',

  // Vegetables — basic
  'Onion', 'Red Onion', 'Garlic', 'Green Onion', 'Scallion', 'Ginger', 'Shallot', 'Leek',
  'Carrot', 'Potato', 'Sweet Potato', 'Radish', 'Turnip', 'Beet',
  'Cabbage', 'Red Cabbage', 'Napa Cabbage', 'Bok Choy',
  'Spinach', 'Lettuce', 'Romaine', 'Arugula', 'Kale', 'Swiss Chard',

  // Vegetables — fruiting & more
  'Zucchini', 'Squash', 'Pumpkin', 'Butternut Squash', 'Cucumber', 'Eggplant',
  'Tomato', 'Cherry Tomato', 'Avocado',
  'Bell Pepper', 'Red Pepper', 'Green Pepper', 'Jalapeño', 'Chili Pepper',
  'Corn', 'Peas', 'Green Beans', 'Edamame',
  'Broccoli', 'Cauliflower', 'Brussels Sprouts', 'Asparagus', 'Celery', 'Artichoke',

  // Herbs
  'Basil', 'Parsley', 'Cilantro', 'Dill', 'Rosemary', 'Thyme', 'Mint',
  'Oregano', 'Sage', 'Chives', 'Bay Leaf',

  // Mushrooms
  'Mushroom', 'Button Mushroom', 'Cremini', 'Portobello', 'Shiitake',
  'Oyster Mushroom', 'Enoki', 'Truffle',

  // Tofu & beans
  'Tofu', 'Silken Tofu', 'Firm Tofu', 'Tempeh',
  'Chickpeas', 'Black Beans', 'Kidney Beans', 'White Beans', 'Lentils', 'Soybeans',

  // Chicken
  'Chicken Breast', 'Chicken Thigh', 'Chicken Wings', 'Chicken Drumstick',
  'Whole Chicken', 'Ground Chicken', 'Rotisserie Chicken',

  // Pork
  'Pork Belly', 'Pork Shoulder', 'Pork Loin', 'Pork Chop', 'Pork Ribs',
  'Bacon', 'Ham', 'Ground Pork', 'Prosciutto',

  // Beef
  'Beef', 'Ground Beef', 'Steak', 'Ribeye', 'Sirloin',
  'Short Ribs', 'Brisket', 'Beef Tenderloin', 'Stew Beef',

  // Other meat
  'Duck', 'Lamb', 'Turkey', 'Spam',

  // Sausage & deli
  'Sausage', 'Italian Sausage', 'Pepperoni', 'Hot Dog', 'Deli Meat', 'Salami',

  // Seafood — fish
  'Salmon', 'Tuna', 'Cod', 'Mackerel', 'Tilapia', 'Halibut',
  'Sea Bass', 'Trout', 'Sardine', 'Anchovy', 'Catfish', 'Snapper',

  // Seafood — shellfish
  'Shrimp', 'Prawn', 'Crab', 'Lobster',
  'Squid', 'Octopus', 'Clam', 'Mussel', 'Oyster', 'Scallop',

  // Canned & frozen
  'Canned Tuna', 'Fish Cake', 'Crab Stick', 'Dumplings',
  'Frozen Shrimp', 'Frozen Vegetables',

  // Dried & seaweed
  'Dried Anchovy', 'Seaweed', 'Nori', 'Kelp', 'Wakame',

  // Grains
  'Rice', 'White Rice', 'Brown Rice', 'Jasmine Rice', 'Basmati Rice',
  'Quinoa', 'Barley', 'Oats', 'Oatmeal', 'Couscous', 'Cornmeal',

  // Noodles & pasta
  'Spaghetti', 'Penne', 'Fusilli', 'Macaroni', 'Lasagna', 'Egg Noodles',
  'Ramen', 'Udon', 'Soba', 'Rice Noodles', 'Glass Noodles',

  // Bread & flour
  'Bread', 'White Bread', 'Baguette', 'Croissant', 'Tortilla', 'Pita',
  'Flour', 'All-Purpose Flour', 'Bread Flour', 'Cornstarch',
  'Breadcrumbs', 'Panko', 'Baking Powder', 'Baking Soda', 'Yeast',

  // Pickles & ferments
  'Kimchi', 'Pickles', 'Olives', 'Capers', 'Sauerkraut',

  // Sauces, condiments & pastes
  'Soy Sauce', 'Ketchup', 'Mustard', 'Dijon Mustard', 'Mayonnaise',
  'Oyster Sauce', 'Fish Sauce', 'Hoisin Sauce', 'Sriracha', 'Hot Sauce',
  'Tabasco', 'Worcestershire Sauce', 'BBQ Sauce', 'Teriyaki Sauce',
  'Tomato Paste', 'Tomato Sauce', 'Marinara Sauce', 'Pasta Sauce', 'Salsa',
  'Pesto', 'Gochujang', 'Doenjang', 'Miso', 'Curry Paste', 'Tahini', 'Peanut Butter',

  // Oils & vinegar
  'Olive Oil', 'Vegetable Oil', 'Canola Oil', 'Sesame Oil', 'Coconut Oil',
  'Vinegar', 'Balsamic Vinegar', 'Apple Cider Vinegar', 'Rice Vinegar', 'White Vinegar',

  // Sweeteners & alcohol
  'Honey', 'Maple Syrup', 'Agave Syrup', 'Corn Syrup', 'Sugar', 'Brown Sugar',
  'Cooking Wine', 'White Wine', 'Red Wine', 'Mirin', 'Sake',

  // Spices & seasonings
  'Salt', 'Black Pepper', 'White Pepper', 'Chili Powder', 'Paprika',
  'Curry Powder', 'Turmeric', 'Cumin', 'Coriander', 'Cinnamon', 'Nutmeg',
  'Cloves', 'Star Anise', 'Garlic Powder', 'Onion Powder', 'Cayenne',
  'Chili Flakes', 'Italian Seasoning', 'Vanilla Extract', 'Minced Garlic',

  // Seeds & nuts
  'Sesame Seeds', 'Peanuts', 'Almonds', 'Walnuts', 'Cashews', 'Pine Nuts',
  'Pistachios', 'Sunflower Seeds', 'Pumpkin Seeds', 'Chia Seeds', 'Flax Seeds',
  'Coconut Milk', 'Shredded Coconut',

  // Fruit
  'Apple', 'Pear', 'Lemon', 'Lime', 'Orange', 'Grapefruit',
  'Strawberry', 'Grapes', 'Blueberry', 'Raspberry', 'Cherry',
  'Peach', 'Plum', 'Apricot', 'Watermelon', 'Melon', 'Cantaloupe',
  'Banana', 'Kiwi', 'Mango', 'Pineapple', 'Papaya', 'Fig', 'Pomegranate',
];

/** 현재 앱 언어에 맞는 자동완성 재료 목록. */
export function getPopularIngredients(): string[] {
  return getLang() === 'en' ? POPULAR_INGREDIENTS_EN : POPULAR_INGREDIENTS_KO;
}

/** 입력어로 재료 추천 필터 (대소문자 무시 — 영어 대응). */
export function filterPopularIngredients(query: string, exclude: string[] = []): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return getPopularIngredients().filter(
    item => !exclude.includes(item) && item.toLowerCase().includes(q),
  );
}
