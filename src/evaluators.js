(function(root){
  'use strict';
  const C=root.Compass;
  // Replace this with {mode:'backend',endpoint:'/api/evaluate'} after implementing a server.
  // No provider API key, secret, or provider URL belongs in browser code.
  C.evaluationConfig={mode:'demo'};
  function validateLevels(levels,rubric){
    if(!levels||!rubric.every(r=>C.domain.validLevel(levels[r.id])))throw new Error('평가 응답의 루브릭 단계가 0~4 범위를 벗어났거나 누락됐습니다.');
    return Object.fromEntries(rubric.map(r=>[r.id,levels[r.id]]));
  }
  function createEvaluator(config=C.evaluationConfig){
    if(config.mode==='demo')return {kind:'demo_self_rated',async evaluate(request){
      const levels=validateLevels(request.submission.levels,request.task.rubric);
      return {kind:'demo_self_rated',levels,score:C.domain.rubricScore(levels,request.task.rubric),verified:false,
        safety:C.domain.safetyState(request.submission),note:'사용자가 입력한 루브릭 단계로 계산했습니다. 실제 수행 능력은 검증하지 않았습니다.'};
    }};
    if(config.mode!=='backend')throw new Error('지원하지 않는 평가 모드입니다.');
    return {kind:'llm_advisory',async evaluate(request){
      const endpoint=new URL(config.endpoint,root.location.href);
      if(endpoint.origin!==root.location.origin||!/^https?:$/.test(endpoint.protocol))throw new Error('평가 요청은 같은 출처의 HTTP 서버에만 전송할 수 있습니다.');
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
      try {
        const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',signal:controller.signal,
          body:JSON.stringify({contractVersion:1,contentVersion:C.data.contentVersion,stage:request.task.id,roleId:request.task.roleId,buildMode:request.task.mode,rubric:request.task.rubric,submission:request.submission})});
        if(!response.ok)throw new Error(`평가 서버가 오류를 반환했습니다 (${response.status}). 응답은 저장되어 있습니다.`);
        const raw=await response.json();
        if(raw.contractVersion!==1)throw new Error('평가 서버의 계약 버전이 일치하지 않습니다.');
        const levels=validateLevels(raw.levels,request.task.rubric);
        return {kind:'llm_advisory',levels,score:C.domain.rubricScore(levels,request.task.rubric),verified:false,
          safety:C.domain.safetyState(request.submission),note:'LLM 평가 제안입니다. 인간 평가자의 별도 검토 전에는 검증된 능력이나 적격 판정으로 사용할 수 없습니다.'};
      } catch(e) {if(e.name==='AbortError')throw new Error('평가 요청 시간이 초과됐습니다. 응답은 저장되어 있으니 다시 시도해 주세요.');throw e;}
      finally {clearTimeout(timer);}
    }};
  }
  C.evaluators={createEvaluator,validateLevels};
  if(typeof module!=='undefined')module.exports=C.evaluators;
})(typeof globalThis!=='undefined'?globalThis:window);
