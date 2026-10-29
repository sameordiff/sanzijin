'use strict';
const $ = s => document.querySelector(s);
let cards=[], mode='read', sequence=0, timer=null, current=null;
const audio=new Audio(); audio.preload='auto';
const synth=window.speechSynthesis;
let voices=[], utterance=null, voicePreference='auto';
try{voicePreference=localStorage.getItem('sanzijing-voice')||'auto';}catch{}
function isTaiwanVoice(v){return /(?:^|[-_])TW(?:$|[-_])/i.test(v.lang||'')||/taiwan|台湾|臺灣|台灣/i.test((v.name||'')+' '+(v.voiceURI||''));}
function updateVoices(){
 const availableVoices=synth?synth.getVoices():[];
 if(availableVoices.some(v=>v.voiceURI===voicePreference&&isTaiwanVoice(v))){voicePreference='auto';try{localStorage.setItem('sanzijing-voice','auto');}catch{}if(utterance&&isTaiwanVoice(utterance.voice||{}))stop(false);}
 const previous=$('#voice').value;
 voices=availableVoices.filter(v=>(/^zh[-_](CN|SG|HK)/i.test(v.lang)||/^cmn/i.test(v.lang))&&!isTaiwanVoice(v));
 const score=v=>(/zh[-_]CN|cmn[-_]Hans/i.test(v.lang)?100:0)+(/natural|neural|premium|enhanced|晓晓|xiaoxiao|xiaoyi|siri/i.test(v.name)?50:0)+(/female|tingting|婷婷/i.test(v.name)?5:0);
 voices.sort((a,b)=>score(b)-score(a));
 $('#voice').innerHTML='<option value="auto">手机中文 · 自动优选</option>'+voices.map((v,i)=>{const o=document.createElement('option');o.value='voice:'+i;o.textContent=v.name+' · '+(/[-_]HK/i.test(v.lang)?'香港中文':'普通话');return o.outerHTML}).join('')+'<option value="recorded">原版录音 · 备用</option>';
 const preferred=voices.findIndex(v=>v.voiceURI===voicePreference);
 $('#voice').value=voicePreference==='recorded'?'recorded':preferred>=0?'voice:'+preferred:'auto';
 const v=selectedVoice();
 $('#voice-note').textContent=v?'当前声音：'+v.name+'。可点“试听声音”选一个喜欢的声音。':'当前使用原版录音。若手机提供中文语音，会在这里显示供你选择。';
}
function selectedVoice(){const value=$('#voice').value;return value==='recorded'?null:value.startsWith('voice:')?voices[Number(value.slice(6))]:voices[0];}
const progressKey='sanzijing-listened-pdf-v1';
const listened=new Set();
try{JSON.parse(localStorage.getItem(progressKey)||'[]').forEach(x=>listened.add(x));}catch{}
const legacyPhraseMap={"0-0": "曰水火", "0-1": "木金土", "0-2": "此五行", "0-3": "本乎数", "1-0": "曰仁义", "1-1": "礼智信", "1-2": "此五常", "1-3": "不容紊", "2-0": "稻粱菽", "2-1": "麦黍稷", "2-2": "此六谷", "2-3": "人所食", "3-0": "马牛羊", "3-1": "鸡犬豕", "3-2": "此六畜", "3-3": "人所饲", "4-0": "曰喜怒", "4-1": "曰哀惧", "4-2": "爱恶欲", "4-3": "七情俱", "5-0": "匏土革", "5-1": "木石金", "5-2": "丝与竹", "5-3": "乃八音", "6-0": "高曾祖", "6-1": "父而身", "6-2": "身而子", "6-3": "子而孙", "7-0": "自子孙", "7-1": "至玄曾", "7-2": "乃九族", "7-3": "人之伦", "8-0": "父子恩", "8-1": "夫妇从", "8-2": "兄则友", "8-3": "弟则恭", "9-0": "长幼序", "9-1": "友与朋", "9-2": "君则敬", "9-3": "臣则忠", "10-0": "此十义", "10-1": "人所同", "11-0": "凡训蒙", "11-1": "须讲究", "11-2": "详训诂", "11-3": "明句读", "12-0": "为学者", "12-1": "必有初", "12-2": "小学终", "12-3": "至四书", "13-0": "论语者", "13-1": "二十篇", "13-2": "群弟子", "13-3": "记善言", "14-0": "孟子者", "14-1": "七篇止", "14-2": "讲道德", "14-3": "说仁义", "15-0": "作中庸", "15-1": "乃孔伋", "15-2": "中不偏", "15-3": "庸不易"};
function migrateProgress(){try{if(localStorage.getItem(progressKey)===null){JSON.parse(localStorage.getItem('sanzijing-listened')||'[]').forEach(id=>{if(legacyPhraseMap[id])listened.add(legacyPhraseMap[id]);});localStorage.setItem(progressKey,JSON.stringify([...listened]));}}catch{}}
function progress(){const total=cards.reduce((n,c)=>n+c.phrases.length,0);let count=0;cards.forEach((c,i)=>c.phrases.forEach((_,j)=>{if(listened.has(c.phrases[j].text))count++}));$('#progress-text').textContent=`已听 ${count} / ${total} 句`;$('#progress-bar').style.width=`${count/total*100}%`;}
function render(){
 $('#lessons').innerHTML=cards.map((c,i)=>`<article class="lesson" id="lesson-${i}"><div class="lesson-heading"><span class="lesson-index">${String(i+1).padStart(2,'0')}</span><h3>${c.title}<small>原书第${c.printedPage}页</small></h3><button class="lesson-action" data-section="${i}" aria-label="朗读${c.title}">▶ 读这一节</button></div><div class="phrase-grid">${c.phrases.map((p,j)=>`<button class="phrase" id="phrase-${i}-${j}" data-card="${i}" data-phrase="${j}" aria-label="点读：${p.text}，${p.pinyin.join(' ')}">${[...p.text].map((ch,k)=>`<span class="glyph"><span class="py">${p.pinyin[k]}</span><span class="han">${ch}</span></span>`).join('')}</button>`).join('')}</div>${c.sourceNote?`<p class="source-note">原文提示 · ${c.sourceNote}</p>`:""}<div class="meaning-box"><div class="meaning-head"><span>说给小朋友听</span><button data-meaning="${i}">♫ 听解读</button></div><p>${c.meaning}</p><div class="tip">小提醒 · ${c.tip}</div></div></article>`).join('');
 $('#lesson-jump').innerHTML=cards.map((c,i)=>`<option value="${i}">${String(i+1).padStart(2,'0')} · ${c.title}</option>`).join('');
 progress();
}
function stop(reset=true){sequence++;clearTimeout(timer);if(synth)synth.cancel();utterance=null;audio.pause();audio.onended=null;audio.onerror=null;audio.onplaying=null;audio.currentTime=0;current=null;document.querySelectorAll('.active').forEach(el=>el.classList.remove('active'));if(reset){$('#now').textContent='朗读已停止';$('#status').textContent='点任意三个字，重新开始';}}
function error(){stop(false);$('#error').hidden=false;$('#error').textContent='声音暂时没有播放成功。请检查手机音量和网络，然后再点一次；也可以换用 Safari 或 Chrome 打开。';$('#status').textContent='请再点一次重试';}
function play(items,{follow=false,gap=450}={}){
 stop(false);$('#error').hidden=true;const token=sequence;let index=0;
 function next(){
  if(token!==sequence)return;
  if(index>=items.length){document.querySelectorAll('.active').forEach(el=>el.classList.remove('active'));$('#now').textContent='读完啦，真棒！';$('#status').textContent='现在，试着自己读一遍吧';return;}
  const item=items[index++];current=item;document.querySelectorAll('.active').forEach(el=>el.classList.remove('active'));
  const el=item.id?document.getElementById(`phrase-${item.id}`):document.getElementById(`lesson-${item.card}`);if(el){el.classList.add('active');if(follow)el.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});}
  $('#now').textContent=item.text;$('#status').textContent=item.id?'仔细听，再跟着读一遍':'听听这几句话的意思';
  const complete=()=>{if(token!==sequence)return;if(item.id){listened.add(item.text);try{localStorage.setItem(progressKey,JSON.stringify([...listened]))}catch{}progress();}timer=setTimeout(next,gap/Number($('#rate').value));};
  const selected=selectedVoice();
  function recordedFallback(){
   if(token!==sequence)return;
   if(!item.audio){error();return;}
   audio.src=item.audio;audio.playbackRate=Number($('#rate').value);audio.preservesPitch=true;
   audio.onended=complete;audio.onerror=()=>{if(token===sequence)error()};
   const promise=audio.play();if(promise)promise.catch(()=>{if(token===sequence)error()});
  }
  if(selected&&synth){
   utterance=new SpeechSynthesisUtterance(item.spoken||item.speech||item.text);
   utterance.voice=selected;utterance.lang=selected.lang;utterance.rate=0.9*Number($('#rate').value);utterance.pitch=1;
   utterance.onend=complete;
   utterance.onerror=e=>{if(token!==sequence||e.error==='canceled'||e.error==='interrupted')return;$('#voice-note').textContent='这个声音暂时不可用，已切换为备用录音。';recordedFallback();};
   synth.speak(utterance);
  }else recordedFallback();
 }
 next();
}
function phraseItems(i){return cards[i].phrases.map((p,j)=>({...p,id:`${i}-${j}`}))}
function syncRevealButton(){const phrases=[...document.querySelectorAll('.phrase')];$('#reveal').textContent=phrases.length&&phrases.every(el=>el.classList.contains('revealed'))?'遮住全文':'显示全文';}
function continueMemory(){stop(false);$('#now').textContent='继续背诵吧';$('#status').textContent='文字已遮住，想不起来再点一下';$('#error').hidden=true;}
function hideAll(){document.querySelectorAll('.revealed').forEach(el=>el.classList.remove('revealed'));syncRevealButton();continueMemory();}
function switchMode(next){stop(false);mode=next;$('.workspace').classList.toggle('memory',mode==='memory');$('.workspace').classList.toggle('meaning',mode==='meaning');document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.mode===mode)));document.querySelectorAll('.revealed').forEach(el=>el.classList.remove('revealed'));$('#reveal').hidden=mode!=='memory';$('#hide-all').hidden=mode!=='memory';$('#hide-all-bottom').hidden=mode!=='memory';$('#stop').hidden=mode==='memory';$('#reveal').textContent='显示全文';const texts={read:['小手点一点，耳朵听一听','每组三个字都可以点读，听完再跟着读一遍。'],memory:['遮住课文，试着自己背','点一下看提示、听发音，再点一下遮住；也可以一键遮住，继续背。'],meaning:['读懂意思，记得更牢','先读课文，再听一听：这些话讲了什么？']};$('#mode-title').textContent=texts[mode][0];$('#mode-help').textContent=texts[mode][1];$('#now').textContent=mode==='memory'?'轮到你来背啦':'准备好了吗？';$('#status').textContent=mode==='meaning'?'点“听解读”，把道理听明白':'点任意三个字，开始朗读';}
$('#lessons').addEventListener('click',e=>{const p=e.target.closest('[data-phrase]');if(p){const i=Number(p.dataset.card),j=Number(p.dataset.phrase);if(mode==='memory'){const revealed=p.classList.toggle('revealed');syncRevealButton();if(!revealed){continueMemory();return;}}play([phraseItems(i)[j]]);return}const section=e.target.closest('[data-section]');if(section){play(phraseItems(Number(section.dataset.section)),{follow:true,gap:mode==='read'?1100:700});return}const meaning=e.target.closest('[data-meaning]');if(meaning){let i=Number(meaning.dataset.meaning);play([{audio:cards[i].audio,text:cards[i].title+' · 解读',speech:cards[i].speech||cards[i].meaning.replaceAll('句读','句豆'),card:i}]);}});
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>switchMode(b.dataset.mode)));
$('#pinyin').addEventListener('change',e=>$('.workspace').classList.toggle('no-pinyin',!e.target.checked));
$('#size').addEventListener('change',e=>document.body.classList.toggle('large',e.target.value==='large'));
$('#rate').addEventListener('change',e=>{audio.playbackRate=Number(e.target.value);if(utterance&&current){stop(false);$('#status').textContent='语速已调整，再点一句试试';}});
$('#voice').addEventListener('change',()=>{stop(false);const v=selectedVoice();voicePreference=$('#voice').value==='recorded'?'recorded':$('#voice').value==='auto'?'auto':v?.voiceURI||'auto';try{localStorage.setItem('sanzijing-voice',voicePreference)}catch{}$('#voice-note').textContent=v?'当前声音：'+v.name+'。点“试听声音”听一听。':'当前使用原版录音。';$('#now').textContent='声音已切换';$('#status').textContent='点三个字，听听新声音';});
$('#voice-preview').addEventListener('click',()=>{if(!cards.length)return;const v=selectedVoice();play(v?[{text:'试听 · '+v.name,spoken:'你好呀，我们一起来读三字经。慢慢读，你一定可以。',audio:cards[0].phrases[0].audio}]:[phraseItems(0)[0]]);});
updateVoices();if(synth)synth.addEventListener('voiceschanged',updateVoices);
$('#reveal').addEventListener('click',()=>{const phrases=[...document.querySelectorAll('.phrase')];const show=!phrases.every(el=>el.classList.contains('revealed'));if(!show){hideAll();return;}phrases.forEach(el=>el.classList.add('revealed'));syncRevealButton();});
$('#hide-all').addEventListener('click',hideAll);
$('#hide-all-bottom').addEventListener('click',hideAll);
$('#play-all').disabled=true;
$('#play-all').addEventListener('click',()=>play(cards.flatMap((_,i)=>phraseItems(i)),{follow:true,gap:mode==='read'?1100:700}));
$('#stop').addEventListener('click',()=>stop());
$('#lesson-jump').addEventListener('change',e=>{const el=document.getElementById('lesson-'+e.target.value);if(el){stop(false);el.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});history.replaceState(null,'','#lesson-'+e.target.value);}});
window.addEventListener('pagehide',()=>stop(false));
fetch('data.json?v=pdf-full1').then(r=>{if(!r.ok)throw Error();return r.json()}).then(data=>{cards=data;migrateProgress();render();$('#play-all').disabled=false;if(/^#lesson-\d+$/.test(location.hash)){const target=document.getElementById(location.hash.slice(1));if(target){$('#lesson-jump').value=location.hash.slice(8);target.scrollIntoView({block:'start'});}}}).catch(()=>{$('#error').hidden=false;$('#error').textContent='课文加载失败，请检查网络并刷新页面。'});
