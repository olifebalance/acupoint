// 작품 목록. 작품이 바뀌거나 늘어나면 이 목록만 고치면 된다.
// 한 줄이 가게 하나가 되고, 가게 수만큼 거리가 길어진다.
//
//   id     assets/ 폴더의 파일 이름 (id.mp4 영상, id.webp 포스터)
//   title  작품 제목            shop  간판에 적힐 이름
//   type   작품 종류(설명)      color 간판 표시·차양에 쓰는 색 하나
//   kind   가게 모양: food · fashion · bakery · books · story
//          목록에 없는 값이거나 비워 두면 기본 가게로 그린다.
export interface Work {
  id: string;
  title: string;
  shop: string;
  type: string;
  color: string;
  kind?: string;
}

export const WORKS: Work[] = [
  { id: 'burger', title: '한입의 상상', shop: '버거스테이지', type: '음식 · 제품 광고', color: '#d9902b', kind: 'food' },
  { id: 'andz', title: '새로운 시즌의 시작', shop: 'ANDZ', type: '패션 · 스토어 오픈', color: '#3f4a5c', kind: 'fashion' },
  { id: 'bakery', title: '빵이 건네는 온기', shop: '밤가시베이커리', type: '베이커리 · 브랜드 영상', color: '#9a5b32', kind: 'bakery' },
  { id: 'book', title: '책에서, 일상으로', shop: '오라이프밸런스', type: '협업 브랜드 · 도서 소개', color: '#2f6b66', kind: 'books' },
  { id: 'wuxia', title: '상상이 장면이 될 때', shop: '창작 콘셉트', type: '무협 · 스토리 영상', color: '#b3412d', kind: 'story' },
];
