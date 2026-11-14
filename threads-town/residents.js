// 스레드 마을 주민 목록. 주민이 늘거나 바뀌면 이 파일만 고친다.
//
//  slot   마을의 자리 이름 (town.js의 SLOTS 참고). 미모 옆자리일수록 좋은 자리.
//  house  집 모양 (town.js의 HOUSES에 그려 둔 이름). 새 주민은 새 집을 그려 넣는다.
//  name   간판·카드에 적힐 이름      handle  스레드 아이디 (@ 없이)
//  intro  카드에 나오는 소개 두 줄. 프로필 글을 코드결이 줄여 쓴 것이라 본인 확인이 필요하다.
//  link   비우면 스레드 프로필(https://www.threads.com/@handle)로 간다.
window.RESIDENTS = [
  { slot: 'center', house: 'mimo', name: '미모', handle: 'mimo1000', color: '#E7FC66',
    intro: 'AI로 미모를 만들고, 본업도 하는 사람.\n스친들의 가게로 가득 찬 마을을 짓고 있어요.' },

  { slot: 'B2', house: 'harry', name: '해리 포토', handle: 'jeju_harry', color: '#3f7fd1',
    intro: '제주에 사는 AI 마법사 해리 포토.\n누구나 따라 할 수 있는 이미지·영상 프롬프트를 나눠요.' },
  { slot: 'B3', house: 'ohssam', name: '오쌤의라이프밸런스', handle: 'ohlifebalance', color: '#3f8f6b',
    intro: '한의학 박사 오쌤.\n증상이 아니라 뿌리를 찾아, 내 몸의 주인이 되는 여정을 함께 걸어요.' },
  { slot: 'temple', house: 'temple', name: '도원 쉼터', handle: 'empty_prompt', color: '#2f7d6a',
    intro: '절 다니는 한의사 도원.\n절에서 배운 지혜로 몸과 마음을 돌보는 이야기를 전해요.' },

  { slot: 'A1', house: 'zcre', name: 'ZCRE 지크', handle: 'zcre.co.kr', color: '#8b7cf6',
    intro: 'AI 크리에이티브 스튜디오 지크.\n크리에이터의 창작을 돕는 AI 도구를 만들어요.' },
  { slot: 'A2', house: 'sodam', name: '소담풍수', handle: 'sodammi88', color: '#e58fb0',
    intro: '한국의 풍수 그림을 그리는 소담.\n달항아리 작품을 만들어요.' },
  { slot: 'A4', house: 'lomaximo', name: 'LoMáximo', handle: 'lomaximo_official', color: '#8a9a3c',
    intro: '올리브오일 로막시모.\n스페인 생활과 올리브오일 고르는 법을 들려줘요.' },
  { slot: 'A5', house: 'loha', name: '로하 Loha', handle: 'loha.onhwa', color: '#b9783f',
    intro: '꽃과 글과 커피를 사랑하는 로하.\n스레드 이야기와 AI 영상, 사진을 나눠요.' },

  { slot: 'B1', house: 'dalgo', name: '글쓰는 달고', handle: 'written.dalgo', color: '#7f9a8a',
    intro: '글쓰는 달고입니다.\n조금 늦게, 조금 조용하게 글을 씁니다.' },
  { slot: 'B4', house: 'hyekyung', name: '비커밍 혜경', handle: 'becoming_hyekyung', color: '#e07a9a',
    intro: '꽃으로 마음을, 글로 사람을 잇는 꽃언니.\n『성장의 감각』 공저자예요.' },

  { slot: 'C1', house: 'hespera', name: 'Hespera Crepus', handle: 'hesperacrepus', color: '#c96a3a',
    intro: '룬을 읽고, 룬을 엮는 마녀.\n룬 이야기를 연재해요.' },
  { slot: 'C2', house: 'onyu', name: '온유 ONYU', handle: 'onyu.kr', color: '#5aa9c9',
    intro: '오뉴데이 온유.\n타월을 만들고, 글을 쓰고, 달리는 사람이에요.' },
];
