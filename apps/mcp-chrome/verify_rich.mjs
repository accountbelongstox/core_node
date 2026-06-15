import fs from 'fs';
import { JSDOM } from 'jsdom';

let h = fs.readFileSync('D:/programing/core_node/apps/mcp-chrome/run_inspect.html', 'utf8');
h = h.split('\\"').join('"').split('\\/').join('/').split('\\n').join('\n');
const dom = new JSDOM(h, { url: 'https://cn.bing.com/dict/search?q=run' });
const { document } = dom.window;
const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();

const result = {
  word: null,
  phonetics: [],
  translations: [],
  synonyms: [],
  advancedTranslations: [],
  detailedDefinitions: [],
  examples: [],
  sampleImages: [],
};

result.word = (document.querySelector('.qdef .hd_div strong, .hd_div strong') || {}).textContent || null;

// phonetics
document.querySelectorAll('.hd_p1_1 .b_primtxt').forEach((label) => {
  result.phonetics.push({ text: norm(label.textContent), lang: label.classList.contains('hd_prUS') ? 'en-US' : 'en-GB' });
});

// short definitions
document.querySelectorAll('.qdef > ul > li').forEach((li) => {
  const pos = li.querySelector('.pos');
  const def = li.querySelector('.def');
  const definition = norm((def || li).textContent);
  if (definition) result.translations.push({ partOfSpeech: norm(pos && pos.textContent) || '', definition });
});

// synonyms (.wd_div)
document.querySelectorAll('.wd_div .tb_div').forEach((div) => {
  const t = div.querySelector('h2'); const c = div.nextElementSibling;
  if (t && c) result.synonyms.push({ type: norm(t.textContent), words: norm(c.textContent) });
});

// web definitions (.df_div)
document.querySelectorAll('.df_div .tb_div').forEach((div) => {
  const t = div.querySelector('h2'); const c = div.nextElementSibling;
  if (t && c) result.advancedTranslations.push({ type: norm(t.textContent), content: norm(c.textContent) });
});

// detailed Collins/Oxford definitions (.se_lis)
document.querySelectorAll('.se_lis tr.def_row').forEach((row) => {
  const bil = row.querySelector('.bil'); const val = row.querySelector('.val');
  const cn = norm(bil && bil.textContent); const en = norm(val && val.textContent);
  if ((cn || en) && result.detailedDefinitions.length < 30) result.detailedDefinitions.push({ cn, en });
});

// example sentences (.sen_en / .sen_cn)
const senEn = document.querySelectorAll('.sen_en');
const senCn = document.querySelectorAll('.sen_cn');
for (let i = 0; i < senEn.length && result.examples.length < 20; i++) {
  const en = norm(senEn[i].textContent); const cn = senCn[i] ? norm(senCn[i].textContent) : '';
  if (en) result.examples.push({ en, cn });
}

// images
document.querySelectorAll('.img_area img, .simg img').forEach((img) => {
  const url = img.getAttribute('src') || img.getAttribute('data-src');
  if (url && !result.sampleImages.some((s) => s.url === url)) result.sampleImages.push({ url });
});

console.log('WORD:', norm(result.word));
console.log('PHONETICS:', result.phonetics.map((p) => `${p.lang}:${p.text}`).join('  '));
console.log('SHORT DEFS:', result.translations.length); result.translations.slice(0,3).forEach((t)=>console.log(`   [${t.partOfSpeech}] ${t.definition.slice(0,60)}`));
console.log('DETAILED DEFS (.se_lis):', result.detailedDefinitions.length); result.detailedDefinitions.slice(0,3).forEach((d,i)=>console.log(`   ${i+1}. ${d.cn.slice(0,30)} — ${d.en.slice(0,50)}`));
console.log('WEB DEFS (.df_div):', result.advancedTranslations.length); result.advancedTranslations.slice(0,2).forEach((a)=>console.log(`   [${a.type.slice(0,20)}] ${a.content.slice(0,50)}`));
console.log('SYNONYMS (.wd_div):', result.synonyms.length); result.synonyms.slice(0,2).forEach((s)=>console.log(`   [${s.type}] ${s.words.slice(0,50)}`));
console.log('EXAMPLES (.sen_en/.sen_cn):', result.examples.length); result.examples.slice(0,3).forEach((e)=>console.log(`   • ${e.en.slice(0,55)}  ${e.cn.slice(0,30)}`));
console.log('IMAGES:', result.sampleImages.length);
const ok = result.translations.length && result.detailedDefinitions.length && result.examples.length;
console.log('\nVERDICT:', ok ? 'PASS ✓ — rich data (short+detailed defs + examples) extracted' : 'FAIL ✗');
