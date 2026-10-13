(function(root){
  'use strict';
  const KEY='ai-capability-compass:v0.4:draft.1';
  const C=root.Compass;
  function load(){
    try {const text=root.localStorage.getItem(KEY);return {state:text?C.domain.sanitize(JSON.parse(text)):C.domain.createState(),error:null};}
    catch(e){return {state:C.domain.createState(),error:'저장된 응답을 읽을 수 없습니다. 기존 저장값은 덮어쓰지 않았습니다. JSON 백업을 가져오거나 새 진단을 시작해 주세요.',recoveryRequired:true};}
  }
  function save(state){
    try {root.localStorage.setItem(KEY,JSON.stringify(state));return {ok:true};}
    catch(e){return {ok:false,error:'브라우저 저장을 사용할 수 없습니다. 이 창을 닫기 전에 JSON 백업을 내려받아 주세요.'};}
  }
  function download(filename,content,type='application/json'){
    const blob=new Blob([content],{type:`${type};charset=utf-8`});
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  C.storage={KEY,load,save,download};
  if(typeof module!=='undefined')module.exports=C.storage;
})(typeof globalThis!=='undefined'?globalThis:window);
