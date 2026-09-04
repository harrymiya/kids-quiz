import { BANKS, KNOWLEDGE, knowledgeName, unitGrade } from './curriculum';

export { KNOWLEDGE, knowledgeName, unitGrade };

const randomFrom = (items) => items[Math.floor(Math.random() * items.length)];
export const shuffle = (items) => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

export const subjects = [
  { id: 'math', name: '数学', emoji: '🔢', desc: '计算 / 图形 / 应用', color: '#5cc7ff', grades: '一~六年级' },
  { id: 'chinese', name: '语文', emoji: '📖', desc: '拼音 / 阅读 / 习作', color: '#ff8fb2', grades: '一~六年级' },
  { id: 'english', name: '英语', emoji: '🅰️', desc: '启蒙 / 语法 / 阅读', color: '#b28bff', grades: '启蒙~六年级' },
  { id: 'science', name: '科学', emoji: '🔬', desc: '生命 / 物质 / 宇宙', color: '#4fd6b5', grades: '一~六年级' },
  { id: 'life', name: '生活', emoji: '🏠', desc: '安全 / 法治 / 文化', color: '#ffc94a', grades: '一~六年级' },
  { id: 'geography', name: '地理', emoji: '🌍', desc: '地图 / 中国 / 世界', color: '#49a8ef', grades: '启蒙~六年级' },
];

const numberOptions = (answer, count = 4) => {
  const options = new Set([answer]);
  const offsets = shuffle([1, -1, 2, -2, 3, -3, 5, -5, 10, -10]);
  offsets.forEach((offset) => {
    if (options.size < count) options.add(Math.max(0, answer + offset));
  });
  let extra = 1;
  while (options.size < count) { options.add(answer + 10 + extra); extra += 1; }
  return shuffle([...options]);
};

// 数学生成题同样打上知识点标签与讲解(与考纲对齐)
const mathModes = (challenge) => {
  const modes = [
    ['add', 'm-add20'], ['subtract', 'm-add20'], ['compare', 'm-count'],
    ['missing', 'm-add20'], ['sequence', 'm-pattern'], ['shape', 'm-shape'],
  ];
  if (challenge >= 2) modes.push(['word-add', 'm-word'], ['odd-even', 'm-count'], ['clock', 'm-time']);
  if (challenge >= 3) modes.push(['multiply', 'm-mult'], ['money', 'm-money'], ['word-subtract', 'm-word']);
  if (challenge >= 4) modes.push(['division', 'm-div'], ['mixed', 'm-add100'], ['order', 'm-pattern'], ['half', 'm-div']);
  return modes;
};

const mathExplain = {
  add: (a, b, answer) => `把两部分合起来用加法：${a}+${b}=${answer}。`,
  subtract: (visual, answer) => `从总数里拿走一部分：${visual}=${answer}。`,
  compare: (answer) => `比一比大小，大的数是 ${answer}。`,
  missing: (answer) => `想加法算减法，想想几加几等于总数，答案是 ${answer}。`,
  sequence: (answer) => `找到每次多几的规律，下一个是 ${answer}。`,
  shape: (answer) => `数一数图形的边，答案是 ${answer} 条。`,
  'word-add': (answer) => `合起来用加法计算，一共是 ${answer}。`,
  'word-subtract': (answer) => `吃掉、用掉用减法，还剩 ${answer}。`,
  'odd-even': (answer) => `个位是1、3、5、7、9的是奇数，是0、2、4、6、8的是偶数，所以是${answer}。`,
  clock: (answer) => `时针走过几就是几时过一点，加上小时数就是 ${answer}。`,
  multiply: (answer) => `背一背乘法口诀，答案是 ${answer}。`,
  division: (answer) => `平均分用除法，想口诀算一算，每份是 ${answer}。`,
  money: (answer) => `付的钱减去价格就是找回的钱：${answer} 元。`,
  mixed: (answer) => `按从左到右的顺序一步一步算，答案是 ${answer}。`,
  order: (answer) => `从小到大排一排，正确的是 ${answer}。`,
  half: (answer) => `平均分成2份用除法，每人 ${answer} 颗。`,
};

const mathQuestion = (challenge, index, modeEntry) => {
  const [mode, knowledge] = modeEntry;
  const max = Math.min(50, 6 + challenge * 5);
  const a = 1 + Math.floor(Math.random() * max);
  const b = 1 + Math.floor(Math.random() * Math.max(2, max - a + 1));
  let prompt = '算一算';
  let visual = `${a} + ${b}`;
  let answer = a + b;
  let options;
  let svg = null;
  let type = '加法能手';

  if (mode === 'subtract') {
    const high = Math.max(a, b); const low = Math.min(a, b);
    visual = `${high} − ${low}`; answer = high - low; type = '减法能手';
  }
  if (mode === 'compare') {
    let other = b;
    if (other === a) other = a === max ? a - 1 : a + 1;
    prompt = '哪个数更大？'; visual = `${a}  和  ${other}`; answer = Math.max(a, other); type = '比较达人';
  }
  if (mode === 'missing') {
    const total = a + b;
    prompt = '方框里应该填几？'; visual = `${a} + □ = ${total}`; answer = b; type = '数字填空';
  }
  if (mode === 'sequence') {
    const step = 1 + Math.floor(Math.random() * Math.min(5, challenge + 1));
    const start = 1 + Math.floor(Math.random() * 10);
    prompt = '找规律，接下来是几？'; visual = `${start}，${start + step}，${start + step * 2}，□`; answer = start + step * 3; type = '数列侦探';
  }
  if (mode === 'shape') {
    const shapes = [
      { name: '三角形', icon: '🔺', sides: 3 },
      { name: '正方形', icon: '🟦', sides: 4 },
      { name: '五边形', icon: '⬠', sides: 5 },
      { name: '六边形', icon: '⬡', sides: 6 },
    ];
    const shape = shapes[(index + challenge) % shapes.length];
    prompt = `${shape.name}有几条边？`; visual = shape.icon; answer = shape.sides; type = '图形乐园';
    svg = { kind: 'shape', sides: shape.sides };
  }
  if (mode === 'word-add') {
    const apples = 2 + Math.floor(Math.random() * 9);
    const found = 1 + Math.floor(Math.random() * 7);
    prompt = `篮子里有 ${apples} 个苹果，又放入 ${found} 个，一共有几个？`;
    visual = '🍎 + 🍎'; answer = apples + found; type = '生活应用题';
  }
  if (mode === 'word-subtract') {
    const total = 8 + Math.floor(Math.random() * 13);
    const eaten = 1 + Math.floor(Math.random() * (total - 2));
    prompt = `小狗有 ${total} 块饼干，吃掉 ${eaten} 块，还剩几块？`;
    visual = '🍪 → 🐶'; answer = total - eaten; type = '生活应用题';
  }
  if (mode === 'odd-even') {
    const number = 2 + Math.floor(Math.random() * max);
    prompt = `${number} 是奇数还是偶数？`; visual = `${number}`; answer = number % 2 ? '奇数' : '偶数'; options = shuffle(['奇数', '偶数']); type = '奇偶判断';
  }
  if (mode === 'clock') {
    const hour = 1 + Math.floor(Math.random() * 10);
    const later = 1 + Math.floor(Math.random() * 3);
    const result = (hour + later - 1) % 12 + 1;
    prompt = `现在是 ${hour}:00，${later} 小时后是几点？`; visual = '🕐'; answer = `${result}:00`;
    options = shuffle([...new Set([result, (result % 12) + 1, ((result + 1) % 12) + 1, ((result + 9) % 12) + 1])].map((value) => `${value}:00`));
    type = '认识时间'; svg = { kind: 'clock', hour };
  }
  if (mode === 'multiply') {
    const x = 2 + Math.floor(Math.random() * Math.min(8, challenge + 2));
    const y = 2 + Math.floor(Math.random() * Math.min(8, challenge + 2));
    prompt = '乘法口诀'; visual = `${x} × ${y}`; answer = x * y; type = '乘法高手';
  }
  if (mode === 'division') {
    const divisor = 2 + Math.floor(Math.random() * Math.min(7, challenge + 1));
    const quotient = 2 + Math.floor(Math.random() * Math.min(8, challenge + 2));
    prompt = '平均分一分'; visual = `${divisor * quotient} ÷ ${divisor}`; answer = quotient; type = '除法挑战';
  }
  if (mode === 'money') {
    const bill = challenge >= 4 ? 20 : 10;
    const price = 1 + Math.floor(Math.random() * (bill - 2));
    prompt = `用 ${bill} 元买 ${price} 元的文具，应找回几元？`; visual = '💴 ✏️'; answer = bill - price; type = '购物小能手';
  }
  if (mode === 'mixed') {
    const x = 3 + Math.floor(Math.random() * 12);
    const y = 2 + Math.floor(Math.random() * 9);
    const minus = 1 + Math.floor(Math.random() * Math.min(8, x + y - 1));
    prompt = '先加后减'; visual = `${x} + ${y} − ${minus}`; answer = x + y - minus; type = '混合运算';
  }
  if (mode === 'order') {
    const values = new Set();
    while (values.size < 3) values.add(1 + Math.floor(Math.random() * max));
    const numbers = [...values];
    answer = [...numbers].sort((left, right) => left - right).join(' < ');
    const choices = new Set([answer]);
    while (choices.size < 4) choices.add(shuffle(numbers).join(' < '));
    prompt = '哪一组是从小到大排列？'; visual = numbers.join('、'); options = shuffle([...choices]); type = '数字排队';
  }
  if (mode === 'half') {
    const total = (2 + Math.floor(Math.random() * 9)) * 2;
    prompt = `${total} 颗糖平均分给两个人，每人几颗？`; visual = '🍬 ↔️ 🍬'; answer = total / 2; type = '平均分';
  }

  return {
    id: `math-${challenge}-${mode}-${a}-${b}-${index}`,
    prompt, visual, answer, options: options || numberOptions(answer), type,
    knowledge, svg,
    explain: mathExplain[mode]?.(a, b, answer) || `答案是 ${answer}，再想一想为什么吧！`,
  };
};

// 把课程库条目转成游戏题目
const bankQuestion = (subjectId, item, index, isReview) => ({
  id: `${subjectId}-${BANKS[subjectId].indexOf(item)}`,
  prompt: item.p, visual: item.v, answer: item.a,
  options: shuffle(item.o), type: isReview ? '记忆复习' : item.t,
  knowledge: item.k, explain: item.e, review: isReview,
});

// 单元ID判定：math-3a-08 / yuwen-5b-02 / eng-4a-01 / sci-4b-01 / ddf-6a-04 / geo-10
export const isUnitId = (id) => /^(math|yuwen|eng|sci|ddf)-\d[ab]-\d+$/.test(String(id)) || /^geo-\d+$/.test(String(id));

// 自适应组卷:到期复习 > 薄弱知识点 > 未掌握新题 > 随机
export function buildQuestions(subjectId, challenge, count, dueIds = [], adaptive = {}) {
  const { weakKnowledge = [], masteredKeys = [] } = adaptive;
  if (subjectId === 'math') {
    // 数学:生成题为主 + 穿插课程库静态题(单位换算/图形/时间等考试常考题)
    const generated = [];
    const modes = shuffle(mathModes(challenge));
    const staticCount = Math.min(BANKS.math.length, Math.max(1, Math.round(count / 3)));
    const statics = shuffle(BANKS.math).slice(0, staticCount).map((item, i) =>
      bankQuestion('math', item, i, dueIds.includes(`math-${BANKS.math.indexOf(item)}`)));
    for (let i = 0; i < count - staticCount; i += 1) {
      const entry = modes[i % modes.length];
      generated.push(mathQuestion(challenge, i, entry));
    }
    const all = shuffle([...statics, ...generated]);
    // 薄弱知识点优先
    if (weakKnowledge.length) {
      all.sort((x, y) => Number(weakKnowledge.includes(y.knowledge)) - Number(weakKnowledge.includes(x.knowledge)));
    }
    return all.slice(0, count);
  }
  const pool = BANKS[subjectId] || [];
  if (!pool.length) return [];
  const scoreOf = (item, idx) => {
    const id = `${subjectId}-${idx}`;
    let score = Math.random();
    if (dueIds.includes(id)) score += 10;
    if (weakKnowledge.includes(item.k)) score += 5;
    if (masteredKeys.includes(id)) score -= 4;
    return score;
  };
  const ranked = pool
    .map((item, idx) => ({ item, idx, score: scoreOf(item, idx) }))
    .sort((x, y) => y.score - x.score);
  const picked = [];
  for (let i = 0; i < count; i += 1) {
    const entry = ranked[i % ranked.length];
    picked.push(bankQuestion(subjectId, entry.item, i, dueIds.includes(`${subjectId}-${entry.idx}`)));
  }
  return picked;
}

// AI 生成的题目做安全校验后转成游戏题目
export function normalizeAIQuestions(subjectId, raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => item && item.prompt && item.answer !== undefined && Array.isArray(item.options) && item.options.length >= 2)
    .slice(0, 12)
    .map((item, i) => {
      const options = [...new Set([...item.options.map(String), String(item.answer)])].slice(0, 4);
      while (options.length < 4) options.push(`选项${options.length + 1}`);
      return {
        id: `ai-${subjectId}-${Date.now()}-${i}`,
        prompt: String(item.prompt).slice(0, 200),
        visual: String(item.visual || '🤖').slice(0, 40),
        answer: item.answer,
        options: shuffle(options),
        type: String(item.type || 'AI专属').slice(0, 12),
        knowledge: String(item.knowledge || '综合').slice(0, 40),
        explain: String(item.explain || '跟着AI老师的思路再想一想吧！').slice(0, 300),
        aiMade: true,
      };
    });
}

export function buildMistakeQuestions(mistakes, count = 8) {
  return shuffle(mistakes).slice(0, count).map((m, i) => {
    let options = [];
    try { options = JSON.parse(m.options || '[]'); } catch { options = []; }
    if (!options.length) options = [m.answer];
    return {
      id: m.question_id, prompt: m.prompt, visual: m.visual || '📝',
      answer: /^-?\d+$/.test(String(m.answer)) ? Number(m.answer) : m.answer,
      options: shuffle(options), type: '错题重练',
      knowledge: m.knowledge || '综合', explain: m.explain || '',
      mistakeId: m.id,
    };
  });
}

export const BANKS_COUNT = Object.values(BANKS).reduce((total, bank) => total + bank.length, 0);

export const difficulties = [
  { name: '热身', value: 1, label: '轻松上手', tip: '从熟悉的知识开始' },
  { name: '进阶', value: 3, label: '动脑升级', tip: '题型开始变丰富' },
  { name: '挑战', value: 5, label: '勇者专属', tip: '高阶题型等你征服' },
];

export const GRADES = ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级'];
// 年级数字工具：'三年级上' -> 3
export const gradeNumber = (grade) => {
  const m = String(grade || '').match(/[一二三四五六]/);
  return { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6 }[m?.[0]] || 1;
};

export const relics = [
  { id: 'life-potion', icon: '🧪', name: '生命果汁', type: 'active', uses: 1, desc: '点击恢复 1 点生命（上限 4）' },
  { id: 'hint-lens', icon: '🔭', name: '提示望远镜', type: 'active', uses: 2, desc: '点击隐去一个错误选项' },
  { id: 'answer-crystal', icon: '🔮', name: '答案水晶', type: 'active', uses: 1, desc: '点击让正确答案发光' },
  { id: 'star-cookie', icon: '🍪', name: '星星饼干', type: 'active', uses: 1, desc: '点击立即收集 2 颗星星' },
  { id: 'double-badge', icon: '🏅', name: '双倍徽章', type: 'active', uses: 1, desc: '点击后，下一道答对多得 1 星' },
  { id: 'guard-bubble', icon: '🫧', name: '守护泡泡', type: 'active', uses: 1, desc: '点击后，下一次答错不扣生命' },
  { id: 'lucky-clover', icon: '🍀', name: '幸运四叶草', type: 'passive', desc: '每层第一次答错不扣生命' },
  { id: 'light-feather', icon: '🪽', name: '轻盈羽毛', type: 'passive', desc: '每连续答对 2 题，额外获得 1 星' },
  { id: 'wisdom-crown', icon: '👑', name: '智慧王冠', type: 'passive', desc: '每层首次答对，额外获得 1 星' },
  { id: 'trail-map', icon: '🗺️', name: '探险地图', type: 'passive', desc: '每层最后一题答对，额外获得 2 星' },
  { id: 'streak-drum', icon: '🥁', name: '连击小鼓', type: 'passive', desc: '连续答对 3 题时，额外获得 1 星' },
  { id: 'brave-heart', icon: '💖', name: '勇敢之心', type: 'passive', desc: '只剩 1 点生命时答对，额外获得 1 星' },
];
