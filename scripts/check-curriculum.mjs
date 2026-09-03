// 目录校验：单元总数 / 重复ID / 题库孤儿知识点 / 选项含答案
// 用法：npm run check
import { BANKS, KNOWLEDGE } from '../src/curriculum.js';

let failed = false;
const fail = (msg) => { failed = true; console.error(`❌ ${msg}`); };
const ok = (msg) => console.log(`✅ ${msg}`);

const subjects = Object.keys(KNOWLEDGE);
const seen = new Map();
let unitTotal = 0;
for (const sid of subjects) {
  for (const k of KNOWLEDGE[sid]) {
    unitTotal += 1;
    if (!k.id || !k.name || !k.grade) fail(`知识点缺字段: ${sid} ${JSON.stringify(k)}`);
    if (seen.has(k.id)) fail(`重复ID: ${k.id}（${seen.get(k.id)} / ${sid}）`);
    else seen.set(k.id, sid);
  }
}
ok(`单元目录共 ${unitTotal} 条（${subjects.map((s) => `${s}:${KNOWLEDGE[s].length}`).join(' ')}）`);

let qTotal = 0;
const covered = new Set();
for (const sid of Object.keys(BANKS)) {
  if (!KNOWLEDGE[sid]) { fail(`题库学科无目录: ${sid}`); continue; }
  BANKS[sid].forEach((item, i) => {
    qTotal += 1;
    const tag = `${sid}[${i}]`;
    if (!item.p || item.a === undefined || !Array.isArray(item.o) || item.o.length < 2) {
      fail(`${tag} 缺题干/答案/选项`);
    } else if (!item.o.map(String).includes(String(item.a))) {
      fail(`${tag} 选项不含答案: ${item.p}`);
    }
    if (!item.k) fail(`${tag} 缺知识点k`);
    else if (!KNOWLEDGE[sid].some((k) => k.id === item.k)) fail(`${tag} 孤儿知识点: ${item.k}`);
    else covered.add(`${sid}:${item.k}`);
  });
}
ok(`手写题库共 ${qTotal} 道`);

for (const sid of subjects) {
  const withQ = KNOWLEDGE[sid].filter((k) => covered.has(`${sid}:${k.id}`)).length;
  console.log(`   ${sid}: ${withQ}/${KNOWLEDGE[sid].length} 单元有手写题（其余由AI按目录出题覆盖）`);
}

if (failed) { console.error('\n校验失败'); process.exit(1); }
console.log('\n校验通过');
