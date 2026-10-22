/** Splits long dialogue into readable captions; the transcript keeps the complete text. */
export function dialoguePages(message, maxChars = 130) {
  const words=String(message).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const pages=[];
  let current='';
  for (const word of words) {
    if (current && current.length + word.length + 1 > maxChars) { pages.push(current); current=''; }
    if (word.length > maxChars) {
      if (current) {pages.push(current);current='';}
      for(let i=0;i<word.length;i+=maxChars) pages.push(word.slice(i,i+maxChars));
    } else current += (current?' ':'')+word;
  }
  if(current)pages.push(current);
  return pages;
}
export function visibleDialoguePage(pages,elapsed,duration){
  if(!pages.length)return -1;
  if(!Number.isFinite(elapsed)||!Number.isFinite(duration)||duration<=0)return 0;
  return Math.min(pages.length-1,Math.max(0,Math.floor(elapsed/duration*pages.length)));
}
