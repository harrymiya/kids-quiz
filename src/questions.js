const randomFrom = (items) => items[Math.floor(Math.random() * items.length)];
export const shuffle = (items) => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

const pools = {
  chinese: [
    ['看图选汉字', '🌞', '日', ['日', '月', '天']], ['看图选汉字', '🌙', '月', ['月', '日', '云']],
    ['看图选汉字', '⛰️', '山', ['山', '水', '火']], ['看图选汉字', '💧', '水', ['水', '火', '山']],
    ['看图选汉字', '🔥', '火', ['火', '木', '土']], ['看图选汉字', '🚪', '门', ['门', '问', '开']],
    ['看图选汉字', '🚗', '车', ['车', '东', '来']], ['看图选汉字', '✋', '手', ['手', '毛', '牛']],
  ],
  english: [
    ['选择对应的首字母', 'Apple 苹果', 'A', ['A', 'B', 'C']], ['选择对应的首字母', 'Ball 球', 'B', ['B', 'D', 'P']],
    ['选择对应的首字母', 'Cat 猫', 'C', ['C', 'G', 'O']], ['选择对应的首字母', 'Dog 狗', 'D', ['D', 'B', 'P']],
    ['选择对应的英文', '🔴 红色', 'red', ['red', 'blue', 'green']], ['选择对应的英文', '🔵 蓝色', 'blue', ['blue', 'black', 'green']],
    ['选择对应的英文', '🟢 绿色', 'green', ['green', 'gray', 'red']], ['选择对应的英文', '🟡 黄色', 'yellow', ['yellow', 'red', 'pink']],
  ],
  science: [
    ['哪一种动物会冬眠？', '动物世界', '熊', ['熊', '鸡', '鱼']], ['植物制造养分需要什么？', '植物生长', '阳光', ['阳光', '月亮', '雪']],
    ['下雨前天空常出现什么？', '天气观察', '乌云', ['乌云', '彩虹', '星星']], ['人的心脏在哪里？', '认识身体', '胸腔', ['胸腔', '手掌', '脚底']],
    ['水结冰后会变成什么？', '物质变化', '冰', ['冰', '沙子', '烟']], ['哪种动物用鳃呼吸？', '动物世界', '鱼', ['鱼', '猫', '鸟']],
    ['种子发芽通常需要什么？', '植物生长', '水和适宜温度', ['水和适宜温度', '油和冰', '只有石头']], ['影子通常在什么时候出现？', '光与影', '有光时', ['有光时', '完全黑暗时', '闭眼时']],
  ],
  life: [
    ['过马路应该走哪里？', '🚦', '斑马线', ['斑马线', '花坛里', '车道中']], ['饭前要做什么？', '🧼', '洗手', ['洗手', '跑步', '睡觉']],
    ['陌生人给的东西能随便吃吗？', '🍎', '不能', ['不能', '当然能', '只吃一半']], ['怎样保护眼睛？', '👀', '保持阅读距离', ['保持阅读距离', '躺着看', '关灯看']],
    ['发现火灾应该拨打什么电话？', '🔥', '119', ['119', '120', '114']], ['乘车时应该怎么做？', '🚙', '系安全带', ['系安全带', '伸手出窗', '车内奔跑']],
  ],
  geography: [
    ['太阳从哪边升起？', '🌅', '东方', ['东方', '西方', '北方']], ['我们生活的星球叫什么？', '🌍', '地球', ['地球', '月球', '火星']],
    ['地图上通常用蓝色表示什么？', '🗺️', '水域', ['水域', '森林', '沙漠']], ['指南针的红色指针通常指向哪里？', '🧭', '北方', ['北方', '南方', '东方']],
    ['中国的首都是哪里？', '🏙️', '北京', ['北京', '上海', '广州']], ['地球表面面积最大的是？', '🌊', '海洋', ['海洋', '陆地', '冰川']],
  ],
};

export const subjects = [
  { id: 'math', name: '数学', emoji: '🔢', desc: '计算 / 比较 / 填空', color: '#5cc7ff' },
  { id: 'chinese', name: '语文', emoji: '📖', desc: '识字 / 表达', color: '#ff8fb2' },
  { id: 'english', name: '英语', emoji: '🅰️', desc: '字母 / 单词', color: '#b28bff' },
  { id: 'science', name: '科学', emoji: '🔬', desc: '动物 / 植物 / 天气', color: '#4fd6b5' },
  { id: 'life', name: '生活', emoji: '🏠', desc: '安全 / 习惯 / 常识', color: '#ffc94a' },
  { id: 'geography', name: '地理', emoji: '🌍', desc: '城市 / 地球 / 方位', color: '#49a8ef' },
];

const mathQuestion = (challenge, index) => {
  const max = Math.min(30, 5 + challenge * 3);
  const a = 1 + Math.floor(Math.random() * max);
  const b = 1 + Math.floor(Math.random() * Math.max(2, max - a + 1));
  const mode = challenge >= 4 ? index % 4 : index % 3;
  let prompt = '算一算', visual = `${a} + ${b}`, answer = a + b, type = '计算能手';
  if (mode === 1) { const high = Math.max(a, b); const low = Math.min(a, b); visual = `${high} − ${low}`; answer = high - low; }
  if (mode === 2) { prompt = '哪个数更大？'; visual = `${a}  与  ${b}`; answer = Math.max(a, b); type = '比较达人'; }
  if (mode === 3) { const x = 2 + Math.floor(Math.random() * 5); const y = 2 + Math.floor(Math.random() * 5); prompt = '乘法口诀'; visual = `${x} × ${y}`; answer = x * y; }
  const options = new Set([answer]);
  while (options.size < 4) options.add(Math.max(0, answer + Math.floor(Math.random() * 7) - 3));
  return { id: `math-${challenge}-${mode}-${a}-${b}-${index}`, prompt, visual, answer, options: shuffle([...options]), type };
};

export function buildQuestions(subjectId, challenge, count, dueIds = []) {
  const generated = [];
  if (subjectId === 'math') {
    for (let i = 0; i < count; i += 1) generated.push(mathQuestion(challenge, i));
    return generated;
  }
  const pool = pools[subjectId];
  const prioritized = [...pool].sort((a, b) => {
    const aId = `${subjectId}-${pool.indexOf(a)}`; const bId = `${subjectId}-${pool.indexOf(b)}`;
    return Number(dueIds.includes(bId)) - Number(dueIds.includes(aId));
  });
  for (let i = 0; i < count; i += 1) {
    const item = prioritized[i % prioritized.length] || randomFrom(pool);
    const sourceIndex = pool.indexOf(item);
    generated.push({ id: `${subjectId}-${sourceIndex}`, prompt: item[0], visual: item[1], answer: item[2], options: shuffle(item[3]), type: dueIds.includes(`${subjectId}-${sourceIndex}`) ? '记忆复习' : '趣味题库' });
  }
  return generated;
}

export const difficulties = [
  { name: '热身', value: 1, label: '轻松上手', tip: '从熟悉的知识开始' },
  { name: '进阶', value: 3, label: '动脑升级', tip: '题型开始变丰富' },
  { name: '挑战', value: 5, label: '勇者专属', tip: '高阶题型等你征服' },
];

export const relics = [
  { icon: '🍀', name: '幸运四叶草', desc: '每层第一次答错不扣生命' },
  { icon: '🪽', name: '轻盈羽毛', desc: '连对 2 题额外获得 1 星' },
  { icon: '🔍', name: '记忆放大镜', desc: '优先复习需要巩固的知识' },
  { icon: '🛡️', name: '勇气护盾', desc: '立刻恢复 1 点生命' },
];
