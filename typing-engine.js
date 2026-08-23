export function analyze(target, typed) {
  let correct=0, incorrect=0, firstError=-1;
  const chars=[...target], input=[...typed];
  chars.forEach((c,i)=>{ if(input[i]===c) correct++; else if(i<input.length){ incorrect++; if(firstError<0) firstError=i; }});
  const extra=Math.max(0,input.length-target.length);
  incorrect += extra;
  if(firstError<0 && input.length>target.length) firstError=target.length;
  const pending=Math.max(0,target.length-input.length);
  const accuracy=input.length ? Math.round((correct/input.length)*100) : 100;
  return {correct,incorrect,pending,extra,firstError,accuracy,characters:input.length};
}
export function wpm(target, typed, elapsedMs){ return elapsedMs>0 ? Math.round((typed.length/5)/(elapsedMs/60000)) : 0; }
export function tokenAt(command, index, tokens=[]){ let pos=0; for(const token of tokens){ const start=command.indexOf(token.text,pos); if(start<0) continue; if(index>=start && index<start+token.text.length) return {...token,start,end:start+token.text.length}; pos=start+token.text.length; } return null; }
export function mistakeKeysAdded(target, previous, next){ if(next.length<=previous.length)return 0; let added=0; for(let i=previous.length;i<next.length;i++){if(i>=target.length||next[i]!==target[i])added++;} return added; }
