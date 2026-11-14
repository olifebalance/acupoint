// 스레드 마을 주민 목록. 입점이 늘면 이 목록만 고치면 된다.
//
//  - 거리(street) 하나가 그림 한 줄이다. 거리가 꽉 차면 아래에 새 거리를 더한다.
//  - lots 순서가 곧 자리 순서다. 먼저 입점한 가게일수록 앞 거리, 미모 가게 옆 좋은 자리에 둔다.
//  - vacant: true 는 빈 자리. "입점 가능" 팻말이 선다.
//
//   name   간판에 적힐 이름          handle  스레드 아이디(@ 포함)
//   intro  자기소개 (두세 줄)        link    눌렀을 때 갈 주소 (스레드·스토어·인스타 등)
//   color  가게 색 하나              kind    가게 모양:
//          food · fashion · bakery · books · story · cafe · flower · photo · studio
//          비우거나 다른 값이면 기본 가게(화분)로 그린다.
export interface Lot {
  name?: string;
  handle?: string;
  intro?: string;
  link?: string;
  linkLabel?: string;
  color?: string;
  kind?: string;
  vacant?: boolean;
  /** 자동으로 붙는 주소: "1-3" = 1번가 3호 */
  no?: string;
}
export interface Street { name: string; lots: Lot[] }

// ※ 아래 주민은 모두 예시다. 실제 스친 정보로 바꾼다. 링크도 스레드 첫 화면으로 가는 임시 주소다.
const SAMPLE_LINK = 'https://www.threads.com/';

export const STREETS: Street[] = [
  {
    name: '1번가',
    lots: [
      { name: '새벽빵집', handle: '@예시_계정', intro: '매일 새벽 네 시에 굽는 동네 빵집이에요.\n갓 나온 빵 소식을 스레드에 올려요.', link: SAMPLE_LINK, color: '#9a5b32', kind: 'bakery' },
      { name: '모모커피', handle: '@예시_계정', intro: '직접 볶은 원두로 내리는 작은 카페예요.\n오늘의 원두 이야기를 들려드려요.', link: SAMPLE_LINK, color: '#6b4a32', kind: 'cafe' },
      { name: 'MIMO 광고사', handle: '@미모', intro: '가게의 이야기를 광고로 만듭니다.\n이 마을은 미모와 함께한 스친들의 거리예요.', link: SAMPLE_LINK, color: '#b3412d', kind: 'studio' },
      { name: '꽃집 봄날', handle: '@예시_계정', intro: '계절 꽃으로 꽃다발을 만들어요.\n매주 새로 들어온 꽃을 소개해요.', link: SAMPLE_LINK, color: '#b05a7a', kind: 'flower' },
      { name: '책방 느린오후', handle: '@예시_계정', intro: '천천히 읽는 사람들의 동네 책방이에요.\n이번 주에 읽은 책을 나눠요.', link: SAMPLE_LINK, color: '#2f6b66', kind: 'books' },
      { vacant: true },
    ],
  },
  {
    name: '2번가',
    lots: [
      { name: '필름사진관', handle: '@예시_계정', intro: '필름으로 찍는 증명사진과 가족사진.\n현상한 사진 이야기를 올려요.', link: SAMPLE_LINK, color: '#3f4a5c', kind: 'photo' },
      { name: '옷가게 결', handle: '@예시_계정', intro: '오래 입는 옷만 골라 오는 편집숍이에요.\n이번 주 새 옷을 보여드려요.', link: SAMPLE_LINK, color: '#4f6b55', kind: 'fashion' },
      { vacant: true }, { vacant: true }, { vacant: true }, { vacant: true },
    ],
  },
];
STREETS.forEach((s, si) => s.lots.forEach((l, li) => { l.no = `${si + 1}-${li + 1}`; }));
