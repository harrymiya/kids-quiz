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

const mathModes = (challenge) => {
  const modes = ['add', 'subtract', 'compare', 'missing', 'sequence', 'shape'];
  if (challenge >= 2) modes.push('word-add', 'odd-even', 'clock');
  if (challenge >= 3) modes.push('multiply', 'money', 'word-subtract');
  if (challenge >= 4) modes.push('division', 'mixed', 'order', 'half');
  return modes;
};

const mathQuestion = (challenge, index, mode) => {
  const max = Math.min(50, 6 + challenge * 5);
  const a = 1 + Math.floor(Math.random() * max);
  const b = 1 + Math.floor(Math.random() * Math.max(2, max - a + 1));
  let prompt = '算一算';
  let visual = `${a} + ${b}`;
  let answer = a + b;
  let options;
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
    type = '认识时间';
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

  return { id: `math-${challenge}-${mode}-${a}-${b}-${index}`, prompt, visual, answer, options: options || numberOptions(answer), type };
};

export function buildQuestions(subjectId, challenge, count, dueIds = []) {
  const generated = [];
  if (subjectId === 'math') {
    const modes = shuffle(mathModes(challenge));
    for (let i = 0; i < count; i += 1) generated.push(mathQuestion(challenge, i, modes[i % modes.length]));
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
