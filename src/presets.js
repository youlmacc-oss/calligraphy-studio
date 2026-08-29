export const ESTIMATED_DURATION_MS = 5000

export const FONT_TAB_LABELS = {
  'kr-title': '🇰🇷 헤드라인',
  'kr-calli': '🇰🇷 본문·고딕',
  'kr-myeongjo': '🇰🇷 명조·서예',
  'en-text': '🇺🇸 영문 헤드라인',
  'en-script': '🇺🇸 스크립트',
  woodcut: '🎨 디스플레이/아트',
}

export const FONT_TAB_TOOLTIPS = {
  'kr-title': '한글 헤드라인·고딕 폰트 모음',
  'kr-calli': '한글 본문·가독성 폰트 모음',
  'kr-myeongjo': '한글 명조 및 전통 서예체 모음',
  'en-text': '영문 볼드 헤드라인 폰트 모음',
  'en-script': '영문 필기체·스크립트 폰트 모음',
  woodcut: '개성 있는 디스플레이·키치 폰트 모음',
}

export const FONT_CATEGORIES = [
  { id: 'kr-title', label: FONT_TAB_LABELS['kr-title'], tooltip: FONT_TAB_TOOLTIPS['kr-title'] },
  { id: 'kr-calli', label: FONT_TAB_LABELS['kr-calli'], tooltip: FONT_TAB_TOOLTIPS['kr-calli'] },
  { id: 'kr-myeongjo', label: FONT_TAB_LABELS['kr-myeongjo'], tooltip: FONT_TAB_TOOLTIPS['kr-myeongjo'] },
  { id: 'en-text', label: FONT_TAB_LABELS['en-text'], tooltip: FONT_TAB_TOOLTIPS['en-text'] },
  { id: 'en-script', label: FONT_TAB_LABELS['en-script'], tooltip: FONT_TAB_TOOLTIPS['en-script'] },
  { id: 'woodcut', label: FONT_TAB_LABELS.woodcut, tooltip: FONT_TAB_TOOLTIPS.woodcut },
]

export const FONT_GROUPS = FONT_CATEGORIES.map((item) => ({
  id: item.id,
  label: item.label,
  tag: item.label,
  hint: item.tooltip,
  tooltip: item.tooltip,
}))

export const FONTS = [
  { id: 'shin-gwajang', group: 'kr-calli', label: '상상토끼 신과장체', family: 'SangSangShin, "Nanum Pen Script", cursive', weights: [400] },
  { id: 'flower-road', group: 'kr-calli', label: '상상토끼 꽃길체', family: 'FlowerRoad, cursive', weights: [400] },
  { id: 'pyeongchang', group: 'kr-calli', label: '평창평화체', family: 'PyeongChangPeace, "Black Han Sans", sans-serif', weights: [700] },
  { id: 'nanum-brush', group: 'kr-calli', label: '나눔손글씨 붓', family: '"Nanum Brush Script", cursive', weights: [400] },
  { id: 'nanum-pen', group: 'kr-calli', label: '나눔손글씨 펜', family: '"Nanum Pen Script", cursive', weights: [400] },
  { id: 'dokdo', group: 'kr-calli', label: '독도체', family: 'Dokdo, cursive', weights: [400] },
  { id: 'east-sea-dokdo', group: 'kr-calli', label: '동해독도체', family: '"East Sea Dokdo", cursive', weights: [400] },
  { id: 'yeon-sung', group: 'kr-calli', label: '연성체', family: '"Yeon Sung", cursive', weights: [400] },
  { id: 'uiyeun', group: 'kr-calli', label: '온글잎 의연체', family: 'Uiyeun, "Nanum Pen Script", cursive', weights: [400] },
  { id: 'bombaram', group: 'kr-calli', label: '가비아 봄바람체', family: 'GabiaBombaram, cursive', weights: [400] },
  { id: 'vitro-core', group: 'kr-calli', label: '비트로 코어', family: 'VitroCore, "Black Han Sans", sans-serif', weights: [400] },
  { id: 'bare-hipi', group: 'kr-calli', label: '바른히피', family: 'BareHippie, cursive', weights: [400] },
  { id: 'jalnan', group: 'kr-title', label: '배민 잘난체', family: 'Jalnan, "Black Han Sans", sans-serif', weights: [400] },
  { id: 'black-han', group: 'kr-title', label: '검은고딕', family: '"Black Han Sans", sans-serif', weights: [400] },
  { id: 'monosori', group: 'kr-title', label: '티몬 몬소리체', family: 'Monosori, sans-serif', weights: [400] },
  { id: 'cookierun', group: 'kr-title', label: '쿠키런체', family: 'CookieRun, "Jua", sans-serif', weights: [400, 700] },
  { id: 'jua', group: 'kr-title', label: '배민 주아체', family: 'Jua, sans-serif', weights: [400] },
  { id: 'do-hyeon', group: 'kr-title', label: '배민 도현체', family: '"Do Hyeon", sans-serif', weights: [400] },
  { id: 'gmarket', group: 'kr-title', label: 'G마켓 산스', family: 'GMarketSans, sans-serif', weights: [400, 700] },
  { id: 'pretendard', group: 'kr-title', label: '프리텐다드', family: 'Pretendard, "Noto Sans KR", sans-serif', weights: [400, 700] },
  { id: 'dongle', group: 'kr-title', label: '동글체', family: 'Dongle, sans-serif', weights: [400, 700] },
  { id: 'cafe24', group: 'kr-title', label: '카페24 쑥쑥', family: 'Cafe24Surround, sans-serif', weights: [400] },
  { id: 'nanum-myeongjo', group: 'kr-myeongjo', label: '나눔명조', family: '"Nanum Myeongjo", serif', weights: [400, 700] },
  { id: 'noto-serif-kr', group: 'kr-myeongjo', label: '노토세리프 KR', family: '"Noto Serif KR", serif', weights: [400, 700] },
  { id: 'maru-buri', group: 'kr-myeongjo', label: '마루부리', family: 'MaruBuri, serif', weights: [400, 700] },
  { id: 'chosun-myungjo', group: 'kr-myeongjo', label: '조선일보명조', family: 'ChosunMyungjo, serif', weights: [400] },
  { id: 'kopub-batang', group: 'kr-myeongjo', label: 'KoPub 바탕', family: 'KoPubBatang, serif', weights: [400] },
  { id: 'hunmin-classic', group: 'kr-myeongjo', label: 'EBS 훈민정음 목각체', family: 'EbsHunminjeongeum, "Nanum Myeongjo", serif', weights: [400] },
  { id: 'gyeonggi', group: 'kr-myeongjo', label: '경기천년바탕', family: 'GyeonggiBatang, "Nanum Myeongjo", serif', weights: [400] },
  { id: 'hunmin', group: 'woodcut', label: '훈민정음 언해본 목각', family: 'EbsHunminjeongeum, "Nanum Myeongjo", serif', weights: [400] },
  { id: 'xiaowei', group: 'woodcut', label: '팔만대장경 목판해서', family: '"ZCOOL XiaoWei", "Noto Serif SC", serif', weights: [400] },
  { id: 'rye', group: 'woodcut', label: '빈티지 웨스턴 우드타입', family: 'Rye, Sancreek, serif', weights: [400] },
  { id: 'pirata', group: 'woodcut', label: '미디벌 고딕 우드컷', family: '"Pirata One", UnifrakturMaguntia, serif', weights: [400] },
  { id: 'great-vibes', group: 'en-script', label: 'Great Vibes', family: '"Great Vibes", cursive', weights: [400] },
  { id: 'alex-brush', group: 'en-script', label: 'Alex Brush', family: '"Alex Brush", cursive', weights: [400] },
  { id: 'pacifico', group: 'en-script', label: 'Pacifico', family: 'Pacifico, cursive', weights: [400] },
  { id: 'dancing-script', group: 'en-script', label: 'Dancing Script', family: '"Dancing Script", cursive', weights: [400, 700] },
  { id: 'sacramento', group: 'en-script', label: 'Sacramento', family: 'Sacramento, cursive', weights: [400] },
  { id: 'allura', group: 'en-script', label: 'Allura', family: 'Allura, cursive', weights: [400] },
  { id: 'caveat', group: 'en-script', label: 'Caveat', family: 'Caveat, cursive', weights: [400, 700] },
  { id: 'satisfy', group: 'en-script', label: 'Satisfy', family: 'Satisfy, cursive', weights: [400] },
  { id: 'permanent-marker', group: 'en-script', label: 'Permanent Marker', family: '"Permanent Marker", cursive', weights: [400] },
  { id: 'shadows', group: 'en-script', label: 'Shadows Into Light', family: '"Shadows Into Light", cursive', weights: [400] },
  { id: 'inter', group: 'en-text', label: 'Inter', family: 'Inter, sans-serif', weights: [400, 700] },
  { id: 'montserrat', group: 'en-text', label: 'Montserrat', family: 'Montserrat, sans-serif', weights: [400, 700] },
  { id: 'bebas', group: 'en-text', label: 'Bebas Neue', family: '"Bebas Neue", sans-serif', weights: [400] },
  { id: 'anton', group: 'en-text', label: 'Anton', family: 'Anton, sans-serif', weights: [400] },
  { id: 'playfair', group: 'en-text', label: 'Playfair Display', family: '"Playfair Display", serif', weights: [400, 700] },
  { id: 'cinzel', group: 'en-text', label: 'Cinzel', family: 'Cinzel, serif', weights: [400, 700] },
  { id: 'unifraktur', group: 'en-text', label: 'UnifrakturMaguntia', family: 'UnifrakturMaguntia, serif', weights: [400] },
  { id: 'rubik-glitch', group: 'en-text', label: 'Rubik Glitch', family: '"Rubik Glitch", sans-serif', weights: [400] },
  { id: 'poppins', group: 'en-text', label: 'Poppins', family: 'Poppins, sans-serif', weights: [400, 700] },
  { id: 'bodoni', group: 'en-text', label: 'Bodoni Moda', family: '"Bodoni Moda", serif', weights: [400, 700] },
]

export const FONT_BLURBS = {
  hunmin: '훈민정음 언해본의 굵고 각진 목판 활자',
  'hunmin-classic': 'EBS 훈민정음 해례본의 전통 목판 활자',
  'shin-gwajang': '상상토끼 신과장의 경쾌한 펜 캘리그라피',
  pyeongchang: '평창의 빛 포인트를 닮은 장식 고딕',
  uiyeun: '온글잎 의연의 따뜻하고 또렷한 손글씨',
  xiaowei: '팔만대장경판의 묵직한 조각도 질감',
  rye: '19세기 서부 포스터의 거친 나무 활판',
  pirata: '중세 판화풍의 날카로운 목판 칼맛',
  jalnan: '힘이 넘치는 광고용 청키 산스',
  gyeonggi: '단정한 경기도 전용서체 명조 결',
  cookierun: '통통하고 귀여운 라운드 볼드',
  jua: '배민 감성의 손맛 나는 둥근 고딕',
  dongle: '동글동글한 헤드라인 디스플레이',
  'nanum-brush': '부드러운 붓터치의 한글 캘리그라피',
  'nanum-pen': '가벼운 펜촉의 손글씨 흘림체',
  dokdo: '독도의 거친 암석을 닮은 필획',
  'east-sea-dokdo': '동해 파도처럼 힘 있는 붓글씨',
  'yeon-sung': '고전 목판본을 닮은 고딕 필기',
  bombaram: '봄바람처럼 가벼운 감성 손글씨',
  'flower-road': '꽃길을 닮은 장식적 흘림체',
  'vitro-core': '강한 대비의 장식 디스플레이',
  'bare-hipi': '자유로운 히피 감성의 손글씨',
  cafe24: '동글동글한 카페 간판 스타일',
  pretendard: '현대적인 가독성 중심 산스',
  gmarket: '기하학적인 브랜드 산스세리프',
  'black-han': '묵직한 검은고딕 헤드라인',
  monosori: '또렷한 본문용 고딕 질감',
  'do-hyeon': '배민 도현의 단정한 고딕',
  'nanum-myeongjo': '따뜻하고 단정한 한글 명조',
  'noto-serif-kr': '균형 잡힌 본문용 세리프',
  'maru-buri': '부드러운 곡선이 돋보이는 명조',
  'chosun-myungjo': '신문 활자풍의 클래식 명조',
  'kopub-batang': '출판용 단정한 바탕체',
  'great-vibes': '우아한 시그니처 딥펜 필기체',
  pacifico: '레트로 간판 느낌의 라운드 스크립트',
  'dancing-script': '리듬감 있는 손글씨 스크립트',
  'alex-brush': '섬세한 브러시 캘리그라피',
  sacramento: '가늘고 우아한 웨딩 스크립트',
  allura: '부드러운 커브의 시그니처 펜',
  caveat: '노트에 적은 듯한 캐주얼 필기',
  satisfy: '경쾌한 사인펜 스타일 스크립트',
  'permanent-marker': '굵은 마커의 스트리트 필기',
  shadows: '여백이 살아있는 손글씨 노트체',
  inter: '정돈된 프로덕트 UI 산스',
  montserrat: '기하학적인 모던 산스',
  poppins: '라운드 기하 산스의 또렷한 자형',
  bebas: '압축된 포스터용 산스',
  anton: '강렬한 헤드라인 산스',
  playfair: '고대비 디테일의 디스플레이 세리프',
  cinzel: '각인된 듯한 로마 각석 세리프',
  bodoni: '날카로운 보도니 명조 대비',
  unifraktur: '블랙레터 고딕의 중세 칼맛',
  'rubik-glitch': '디지털 글리치 디스플레이',
}

export const GROUP_GUIDES = {
  'kr-calli': { mood: '자연스러운 갈필 먹물 서예', use: '감성 캘리그라피 추천' },
  'kr-title': { mood: '굵직하고 경쾌한 볼드 고딕', use: '유튜브 썸네일/헤드라인 추천' },
  'kr-myeongjo': { mood: '단정하고 품격 있는 한글 명조', use: '전통 타이틀/본문 추천' },
  woodcut: { mood: '각진 목판·판화 활자', use: '전통 목각/빈티지 포스터 추천' },
  'en-script': { mood: '우아한 시그니처 필기체', use: '사인/로고/초대장 추천' },
  'en-text': { mood: '또렷한 모던 디스플레이', use: '포스터/브랜드 헤드라인 추천' },
}

export function getFontMeta(font) {
  const group = FONT_GROUPS.find((item) => item.id === font.group)
  const groupGuide = GROUP_GUIDES[font.group] ?? { mood: '개성 있는 웹폰트 스타일', use: '타이포 디자인 추천' }
  const blurb = FONT_BLURBS[font.id] ?? groupGuide.mood
  return {
    tag: group?.tag ?? group?.label ?? '🔤 타이포',
    groupId: group?.id ?? font.group,
    groupLabel: group?.label ?? '',
    groupHint: group?.tooltip ?? group?.hint ?? '',
    blurb,
    mood: groupGuide.mood,
    use: groupGuide.use,
    guide: `${blurb} — ${groupGuide.use}`,
  }
}

export const THEMES = [
  { id: 'typo-art', name: 'Typographic & Doodle', hint: '신촌 맛의 랩소디 스타일 포함 8종' },
  { id: 'modern3d', name: 'Modern 3D & Cyber', hint: '메탈 · 젤리 · 네온 · 홀로그램 4종' },
  { id: 'east-asian', name: 'East Asian & Woodcut', hint: '수묵 · 전각 · 목각 4종 포함 7종' },
  { id: 'pop-sub', name: 'Pop & Subculture', hint: '스트리트 · 팝 · 고딕 4종' },
  { id: 'luxury', name: 'Luxury Texture', hint: '크리스털 · 메카닉 · 바이오닉 3종' },
]

export const STUDIO_TABS = [
  { id: 'allinone', label: '🎨 19종 올인원 스타일러', hint: '3D 크롬 · 네온 · 키치 · 팝아트' },
  { id: 'calligraphy', label: '✍️ 캘리그라피 & 동양 서예', hint: '수묵 번짐 · 전각 도장 · 한지 질감' },
  { id: 'woodcut', label: '🪵 전통 목각 & 판화', hint: '훈민정음 · 대장경판 · 우드타입' },
]

export const ASPECTS = [
  { id: '1:1', label: '1:1 Square', w: 1024, h: 1024, hint: '1024×1024 / AI 마스크 & 인스타' },
  { id: '16:9', label: '16:9 Landscape', w: 1920, h: 1080, hint: '1920×1080 / 유튜브 썸네일 & 배너' },
  { id: '9:16', label: '9:16 Portrait', w: 1080, h: 1920, hint: '1080×1920 / 쇼츠, 릴스, 틱톡' },
]

export function getAspect(id) {
  return ASPECTS.find((item) => item.id === id) ?? ASPECTS[0]
}

export const STUDIO_FONT_GROUP = {
  allinone: 'kr-calli',
  calligraphy: 'kr-calli',
  woodcut: 'woodcut',
}

export const CALLIGRAPHY_PRESET_IDS = ['traditional-calligraphy', 'carved-seal', 'organic-botanical']
export const WOODCUT_STUDIO_IDS = ['woodblock-print', 'hunmin-woodcut', 'tripitaka-woodcut', 'rye-woodtype', 'pirata-woodcut']

export const DEFAULT_TEXT = '龍 Dragon 풀정'

export const CALLIGRAPHY_SHADERS = new Set([
  'calligraphy',
  'carvedSeal',
  'woodcutCarving',
  'woodblock',
])

export const NEGATIVE_PROMPT =
  'blurry text, misspelled characters, deformed typography, low resolution, extra distorted strokes, watermark, bad anatomy, artifacts'

export const PROMPT_GUIDE = {
  controlNet: 'ControlNet Weight: 0.85 ~ 1.0',
  cfg: 'CFG Scale: 3.5 ~ 7.0',
  sampler: 'Sampler: Euler / DPM++ 2M',
}

const PRESET_PROMPT_TEMPLATES = {
  'kitsch-sticker': "Kitsch trendy sticker collage typography of '{text}', chunky bold rounded letters, playful food and drink doodle stickers, vibrant pop colors, clean vector outline, magazine cut-out aesthetic",
  'chunky-bubble': "Chunky rounded 3D bubble typography of '{text}', inflated glossy plastic letters, soft bounce silhouette, candy-color highlights, playful Korean headline design, high resolution",
  'interlock-block': "Dynamic interlocking block typography of '{text}', overlapping geometric letterforms, circled number emblems, graphic poster composition, bold color blocking, clean vector edges",
  'wave-warp': "Wave and arc warped typography of '{text}', flowing sine-curve lettering, kinetic motion path, elegant script distortion, high-end editorial type design, 8k",
  'kinetic-stack': "Kinetic stacked residual typography of '{text}', motion-blur echo layers, high-energy poster type, staggered offsets, cinematic depth, sharp readable core letters",
  'split-slice': "Diagonal split-slice glitch typography of '{text}', hard clip offsets, RGB chromatic aberration, digital distortion, futuristic poster lettering, high contrast",
  'hollow-outline': "Hollow outline stacked typography of '{text}', multiple nested stroke contours, neon hairline frames, elegant empty interiors, fashion editorial type",
  'circular-badge': "Circular emblem badge typography of '{text}', 360-degree text wrapping around a crest, luxury seal composition, metallic rim, centered monogram",
  'liquid-chrome': "Futuristic liquid chrome 3D typography of '{text}', molten mercury fluid metal, iridescent reflective sheen, raytracing reflections, hyper-detailed render, dark studio lighting",
  'inflated-jelly': "Inflated 3D jelly typography of '{text}', translucent candy gel letters, subsurface scattering, soft caustics, playful luxury product render",
  'cyber-neon': "Cyberpunk neon glow typography of '{text}', electric cyan and magenta tubes, wet asphalt reflections, night city haze, ultra-sharp luminous edges",
  'sci-fi-hologram': "Sci-fi holographic typography of '{text}', iridescent scanlines, chromatic prism shift, volumetric light, futuristic HUD lettering, 8k",
  'traditional-calligraphy': "Masterpiece Korean brush calligraphy of '{text}', traditional sumi-e ink painting, dynamic expressive strokes, dry brush texture, rich black ink gradation on hanji paper, high resolution, 8k typography design",
  'carved-seal': "Traditional East Asian carved seal stamp typography of '{text}', vermilion cinnabar ink, stone intaglio engraving, square 낙관 composition, antique paper grain",
  'woodblock-print': "Traditional woodblock chiseled typography of '{text}', deeply carved relief woodcut, authentic historical printing plate texture, sharp chisel lines, gouge marks, wood grain details",
  'hunmin-woodcut': "Traditional woodblock chiseled typography of '{text}', Hunminjeongeum woodcut relief, deeply carved Korean printing plate, sharp chisel lines, gouge marks, aged wood grain details",
  'tripitaka-woodcut': "Tripitaka Koreana woodcut typography of '{text}', Buddhist sutra printing plate, heavy carved clerical script, ink-pressed hanji, historical woodblock texture",
  'rye-woodtype': "Vintage western wood type poster typography of '{text}', 19th-century woodtype printing, rough letterpress impression, circus-saloon wood grain, antique ink crush",
  'pirata-woodcut': "Medieval gothic woodcut typography of '{text}', blackletter engraving, pirate-print woodcut, sharp gouge strokes, aged parchment print",
  'street-graffiti': "Street graffiti typography of '{text}', spray-paint drips, wildstyle outlines, brick wall texture, vibrant urban night colors, high detail",
  'comic-pop': "Comic pop-art typography of '{text}', Ben-Day dots, thick ink outlines, explosive halftone background, Roy Lichtenstein energy, clean vector letters",
  'soft-brutalism': "Soft brutalist typography of '{text}', rounded concrete blocks, muted pastel brutalism, thick geometric letters, editorial poster, subtle shadow",
  'gothic-dark': "Y2K gothic dark typography of '{text}', blackletter meets chrome, silver highlights, occult luxury poster, high-contrast metallic serifs",
  'crystal-glass': "Crystal glass typography of '{text}', refractive ice letters, caustic light, luxury product photography, transparent edges, dark studio",
  'mechanic-bevel': "Mechanical bevel emblem typography of '{text}', machined metal letters, industrial engraving, brushed steel, precision CNC edges",
  'organic-botanical': "Organic botanical typography of '{text}', living vine letters, art-nouveau foliage, moss and gold leaf, nature-luxury type design",
}

function fillTemplate(template, text) {
  return template.replaceAll('{text}', text)
}

export function buildAiPromptPack({ text, layers = [], preset, font, aspect, background }) {
  const main = (text || layers.find((layer) => layer.role === 'main')?.text || DEFAULT_TEXT).trim() || DEFAULT_TEXT
  const extras = layers
    .filter((layer) => layer.role !== 'main' && layer.text?.trim())
    .map((layer) => `${layer.name}: ${layer.text.trim()}`)
    .join(' · ')
  const template = PRESET_PROMPT_TEMPLATES[preset.id]
    || `Masterpiece stylized typography of '{text}', ${preset.name} / ${preset.subtitle}, high resolution, 8k type design`
  const fontNote = `Typeface mood: ${font.label}${font.group ? `, ${font.group}` : ''}.`
  const layerNote = extras ? `Supporting copy: ${extras}.` : ''
  const bgNote = background?.dataUrl
    ? `Composite over a custom photographic background, blend mode ${background.blend || 'normal'}, opacity ${Math.round((background.opacity ?? 1) * 100)}%, blur ${background.blur ?? 0}px.`
    : 'Clean designed backdrop, no random scenery, typography-first composition.'
  const ar = aspect?.id ?? '1:1'
  const size = aspect ? `${aspect.w}x${aspect.h}` : '1024x1024'

  const positive = [
    fillTemplate(template, main),
    fontNote,
    layerNote,
    bgNote,
    `Use the uploaded ${size} black-and-white alpha mask as ControlNet / canny / depth guide. Exact glyph shapes, no extra letters.`,
    'Ready for Grok, Flux, Midjourney, and ControlNet inpainting.',
  ].filter(Boolean).join(' ')

  const midjourney = `${positive} --ar ${ar} --stylize 250 --v 6.1`

  const guide = `${PROMPT_GUIDE.controlNet}\n${PROMPT_GUIDE.cfg}\n${PROMPT_GUIDE.sampler}`

  const full = [
    '[Positive Prompt]',
    positive,
    '',
    '[Negative Prompt]',
    NEGATIVE_PROMPT,
    '',
    '[Recommended Params]',
    guide,
    '',
    '[Midjourney]',
    midjourney,
  ].join('\n')

  return { positive, negative: NEGATIVE_PROMPT, midjourney, guide, full, ar, size }
}

export function buildExportPrompt(options) {
  return buildAiPromptPack(options).full
}

export const WOODCUT_PRESETS = [
  {
    id: 'hunmin-woodcut',
    theme: 'east-asian',
    name: '훈민정음 언해 목각',
    subtitle: 'EBS Hunminjeongeum',
    lang: '한글',
    fontId: 'hunmin',
    shader: 'woodcutCarving',
    colors: ['#1a120c', '#c4a574', '#3d2a1c'],
  },
  {
    id: 'tripitaka-woodcut',
    theme: 'east-asian',
    name: '팔만대장경 목판해서',
    subtitle: 'ZCOOL XiaoWei',
    lang: '한자',
    fontId: 'xiaowei',
    shader: 'woodcutCarving',
    colors: ['#1c1410', '#e8d5b5', '#5c3d2e'],
  },
  {
    id: 'rye-woodtype',
    theme: 'east-asian',
    name: '웨스턴 우드타입',
    subtitle: 'Rye / Sancreek',
    lang: '영문',
    fontId: 'rye',
    shader: 'woodcutCarving',
    colors: ['#3b1f0f', '#d4a574', '#8b4513'],
  },
  {
    id: 'pirata-woodcut',
    theme: 'east-asian',
    name: '미디벌 고딕 우드컷',
    subtitle: 'Pirata One',
    lang: '영문',
    fontId: 'pirata',
    shader: 'woodcutCarving',
    colors: ['#140c08', '#a89070', '#2a1810'],
  },
]

export const STICKER_THEMES = [
  { id: 'fnb', label: 'F&B / 카페' },
  { id: 'travel', label: '여행 / 스트리트' },
  { id: 'lovely', label: '러블리 / 꽃' },
]

export const PRESETS = [
  {
    id: 'kitsch-sticker',
    theme: 'typo-art',
    name: '키치 스티커 콜라주',
    subtitle: 'Kitsch Sticker Doodle',
    fontId: 'jalnan',
    shader: 'kitschSticker',
    colors: ['#F6E7C1', '#F4D35E', '#6B3F2A'],
  },
  {
    id: 'chunky-bubble',
    theme: 'typo-art',
    name: '청키 라운드 버블',
    subtitle: 'Chunky Rounded Bubble',
    fontId: 'cookierun',
    shader: 'chunkyBubble',
    colors: ['#E8D5B5', '#F3E2C7', '#6B3F2A'],
  },
  {
    id: 'interlock-block',
    theme: 'typo-art',
    name: '다이내믹 인터록 블록',
    subtitle: 'Dynamic Interlocking Block',
    fontId: 'dongle',
    shader: 'interlockBlock',
    colors: ['#FDE68A', '#FECACA', '#5C3A21'],
  },
  {
    id: 'wave-warp',
    theme: 'typo-art',
    name: '웨이브 워프',
    subtitle: 'Wave & Arc Warp',
    fontId: 'dancing-script',
    shader: 'waveWarp',
    colors: ['#67e8f9', '#f0abfc', '#22d3ee'],
  },
  {
    id: 'kinetic-stack',
    theme: 'typo-art',
    name: '키네틱 스택',
    subtitle: 'Kinetic Stack',
    fontId: 'anton',
    shader: 'kineticStack',
    colors: ['#f8fafc', '#22d3ee', '#fb7185'],
  },
  {
    id: 'split-slice',
    theme: 'typo-art',
    name: '슬라이스 글리치',
    subtitle: 'Split Slice',
    fontId: 'rubik-glitch',
    shader: 'splitSlice',
    colors: ['#22d3ee', '#f472b6', '#f8fafc'],
  },
  {
    id: 'hollow-outline',
    theme: 'typo-art',
    name: '할로우 아웃라인',
    subtitle: 'Hollow Outline',
    fontId: 'montserrat',
    shader: 'hollowOutline',
    colors: ['#e0f2fe', '#a78bfa', '#22d3ee'],
  },
  {
    id: 'circular-badge',
    theme: 'typo-art',
    name: '원형 엠블럼',
    subtitle: 'Circular Badge',
    fontId: 'cinzel',
    shader: 'circularBadge',
    colors: ['#fde68a', '#f8fafc', '#b45309'],
  },
  {
    id: 'liquid-chrome',
    theme: 'modern3d',
    name: '액체 크롬',
    subtitle: 'Liquid Chrome',
    fontId: 'bebas',
    shader: 'liquidChrome',
    colors: ['#8b95a1', '#f8fafc', '#3f4a55'],
  },
  {
    id: 'inflated-jelly',
    theme: 'modern3d',
    name: '3D 젤리',
    subtitle: 'Inflated Jelly',
    fontId: 'cafe24',
    shader: 'inflatedJelly',
    colors: ['#fb7185', '#fda4af', '#be185d'],
  },
  {
    id: 'cyber-neon',
    theme: 'modern3d',
    name: '사이버 네온',
    subtitle: 'Cyber Neon',
    fontId: 'black-han',
    shader: 'cyberNeon',
    colors: ['#22d3ee', '#a78bfa', '#f472b6'],
  },
  {
    id: 'sci-fi-hologram',
    theme: 'modern3d',
    name: '홀로그램',
    subtitle: 'Sci-Fi Hologram',
    fontId: 'rubik-glitch',
    shader: 'hologram',
    colors: ['#67e8f9', '#e879f9', '#38bdf8'],
  },
  {
    id: 'traditional-calligraphy',
    theme: 'east-asian',
    name: '수묵 캘리그라피',
    subtitle: 'Traditional Calligraphy',
    fontId: 'nanum-brush',
    shader: 'calligraphy',
    colors: ['#0a0a0a', '#1c1917', '#44403c'],
  },
  {
    id: 'carved-seal',
    theme: 'east-asian',
    name: '전각 도장',
    subtitle: 'Carved Seal',
    fontId: 'nanum-myeongjo',
    shader: 'carvedSeal',
    colors: ['#b91c1c', '#fecaca', '#7f1d1d'],
  },
  {
    id: 'woodblock-print',
    theme: 'east-asian',
    name: '목판 활판',
    subtitle: 'Woodblock Print',
    fontId: 'hunmin',
    shader: 'woodcutCarving',
    colors: ['#7c2d12', '#b45309', '#1c1917'],
  },
  ...WOODCUT_PRESETS,
  {
    id: 'street-graffiti',
    theme: 'pop-sub',
    name: '그래피티',
    subtitle: 'Street Graffiti',
    fontId: 'permanent-marker',
    shader: 'graffiti',
    colors: ['#facc15', '#22d3ee', '#111827'],
  },
  {
    id: 'comic-pop',
    theme: 'pop-sub',
    name: '코믹 팝아트',
    subtitle: 'Comic Pop',
    fontId: 'anton',
    shader: 'comicPop',
    colors: ['#fde047', '#ef4444', '#111827'],
  },
  {
    id: 'soft-brutalism',
    theme: 'pop-sub',
    name: '소프트 브루탈',
    subtitle: 'Soft Brutalism',
    fontId: 'gmarket',
    shader: 'softBrutal',
    colors: ['#e2e8f0', '#94a3b8', '#334155'],
  },
  {
    id: 'gothic-dark',
    theme: 'pop-sub',
    name: 'Y2K 고딕',
    subtitle: 'Gothic Dark',
    fontId: 'unifraktur',
    shader: 'gothicDark',
    colors: ['#cbd5e1', '#64748b', '#0f172a'],
  },
  {
    id: 'crystal-glass',
    theme: 'luxury',
    name: '크리스털 유리',
    subtitle: 'Crystal Glass',
    fontId: 'playfair',
    shader: 'crystalGlass',
    colors: ['#e0f2fe', '#7dd3fc', '#0369a1'],
  },
  {
    id: 'mechanic-bevel',
    theme: 'luxury',
    name: '메카닉 엠블럼',
    subtitle: 'Mechanic Bevel',
    fontId: 'bebas',
    shader: 'mechanicBevel',
    colors: ['#d6d3d1', '#78716c', '#1c1917'],
  },
  {
    id: 'organic-botanical',
    theme: 'luxury',
    name: '바이오닉 덩굴',
    subtitle: 'Organic Botanical',
    fontId: 'maru-buri',
    shader: 'botanical',
    colors: ['#4ade80', '#86efac', '#14532d'],
  },
]
