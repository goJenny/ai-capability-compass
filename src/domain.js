(function (root) {
  'use strict';
  const C = root.Compass, D = C.data;
  const FIELDS = ['plan', 'prompt', 'output', 'verification', 'controls'];
  const round = n => Math.round(n * 10) / 10;
  const validLevel = v => Number.isInteger(v) && v >= 0 && v <= 4;
  const validOption = v => Number.isInteger(v) && v >= 0 && v <= 3;
  const emptyTask = () => ({ fields:Object.fromEntries(FIELDS.map(k => [k,''])), levels:{}, safety:{}, critical:'unknown', criticalNote:'', submittedAt:null, evaluationKind:null });
  function createState() {
    const now = new Date().toISOString();
    return {schemaVersion:D.schemaVersion, contentVersion:D.contentVersion, id:root.crypto?.randomUUID?.() || `local-${Date.now()}`, createdAt:now, updatedAt:now,
      profile:{name:'',roleId:D.roles[0].id,buildMode:'design'}, self:{}, know:{}, knowSubmittedAt:null,
      tasks:{S1:emptyTask(), S2:Object.fromEntries(D.roles.map(r => [r.id,emptyTask()])), S3:Object.fromEntries(D.roles.map(r => [r.id,{design:emptyTask(),implementation:emptyTask()}]))}, dataSource:'participant'};
  }
  function taskState(state, stage, roleId=state.profile.roleId, mode=state.profile.buildMode) {
    return stage === 'S1' ? state.tasks.S1 : stage === 'S2' ? state.tasks.S2[roleId] : state.tasks.S3[roleId][mode];
  }
  function taskSpec(state, stage) { return D.getTask(stage,state.profile.roleId,state.profile.buildMode); }
  function taskIssues(task, spec, requireLevels=true) {
    const issues = [];
    FIELDS.forEach(k => { if (!task.fields[k]?.trim()) issues.push({kind:'field',id:k}); });
    if (requireLevels) spec.rubric.forEach(r => {if (!validLevel(task.levels[r.id])) issues.push({kind:'level',id:r.id});});
    D.safety.forEach(r => {if (!['yes','no','unknown'].includes(task.safety[r.id])) issues.push({kind:'safety',id:r.id});});
    if (!['yes','no','unknown'].includes(task.critical)) issues.push({kind:'critical',id:'critical'});
    if (task.critical==='yes' && !task.criticalNote.trim()) issues.push({kind:'field',id:'criticalNote'});
    return issues;
  }
  function rubricScore(levels, rubric) {
    if (!rubric.every(r => validLevel(levels[r.id]))) return null;
    const weights = rubric.reduce((s,r)=>s+r.weight,0);
    return round(rubric.reduce((s,r)=>s+levels[r.id]/4*r.weight,0)/weights*100);
  }
  function safetyState(task) {
    if (task.critical==='yes') return {code:'hold_review',label:'판정 보류 · 별도 검토 필요',tone:'danger', reason:'중대 통제 결함을 보고했습니다. 점수와 별개로 적격 판정을 보류합니다.'};
    if (D.safety.some(r=>task.safety[r.id]==='no')) return {code:'review_required',label:'통제 보완 · 검토 필요',tone:'warn',reason:'미충족 통제가 있습니다. 중대성 판단과 보완은 별도 검토가 필요합니다.'};
    if (task.critical!=='no'||D.safety.some(r=>task.safety[r.id]!=='yes')) return {code:'unreviewed',label:'안전성 미확인',tone:'neutral',reason:'통제 확인 또는 결함 보고가 완료되지 않았습니다.'};
    return {code:'self_reported_controls',label:'통제 충족 자기보고 · 검증 전',tone:'info',reason:'사용자가 통제를 충족했다고 보고했습니다. 안전성을 검증한 결과가 아닙니다.'};
  }
  function knowledge(state) {
    const answered=D.know.filter(q=>validOption(state.know[q.id])).length;
    const correct=D.know.filter(q=>state.know[q.id]===q.correct).length;
    return {answered,total:12,correct:state.knowSubmittedAt&&answered===12?correct:null,score:state.knowSubmittedAt&&answered===12?round(correct/12*100):null,status:state.knowSubmittedAt&&answered===12?'completed':'in_progress'};
  }
  function selfScore(state) {
    const answered=D.self.filter(q=>validLevel(state.self[q.id])).length;
    return {answered,total:8,score:answered===8?round(D.self.reduce((s,q)=>s+state.self[q.id],0)/32*100):null,status:answered===8?'completed':'in_progress'};
  }
  function taskResult(state, stage) {
    const task=taskState(state,stage), spec=taskSpec(state,stage);
    const ready=!!task.submittedAt&&taskIssues(task,spec).length===0;
    return {stage,roleId:spec.roleId,mode:spec.mode,score:ready?rubricScore(task.levels,spec.rubric):null,
      status:ready?(task.evaluationKind==='llm_advisory'?'llm_advisory':'demo_self_rated'):'not_submitted', verified:false,
      assessmentLabel:ready?(task.evaluationKind==='llm_advisory'?'LLM 평가 제안 · 검증 전':'데모 자기채점 · 검증 전'):'제출 전',
      submittedAt:ready?task.submittedAt:null, safety:safetyState(task),rubric:spec.rubric.map(r=>({id:r.id,label:r.label,weight:r.weight,level:validLevel(task.levels[r.id])?task.levels[r.id]:null}))};
  }
  function summary(state) {
    const tasks=['S1','S2','S3'].map(s=>taskResult(state,s));
    const use=tasks[0].score!==null&&tasks[1].score!==null?round((tasks[0].score+tasks[1].score)/2):null;
    const order=['hold_review','review_required','unreviewed','self_reported_controls'];
    const safety=tasks.map(t=>t.safety).sort((a,b)=>order.indexOf(a.code)-order.indexOf(b.code))[0];
    return {know:knowledge(state),self:selfScore(state),tasks,use:{score:use,verified:false,status:use===null?'not_complete':'unverified_assessment'},
      build:{score:tasks[2].score,mode:state.profile.buildMode,verified:false,status:tasks[2].status}, safety,
      suitability:safety.code==='hold_review'?'hold_review':'not_determined', suitabilityLabel:safety.code==='hold_review'?'적격 판정 보류 · 전문가 검토 필요':'적격 판정 미실시 · 파일럿',
      totalScore:null};
  }
  function progress(state) {
    const s=selfScore(state),k=knowledge(state);
    const taskCount=['S1','S2','S3'].filter(stage=>taskResult(state,stage).score!==null).length;
    return {answered:s.answered+k.answered+taskCount,total:23,percent:Math.round((s.answered+k.answered+taskCount)/23*100),taskCount};
  }
  // JSON export/import preserves answers, never trusted assertions of verification.
  function sanitize(raw) {
    if (!raw||typeof raw!=='object'||Array.isArray(raw)||raw.schemaVersion!==D.schemaVersion) throw new Error('지원하지 않는 백업 형식입니다.');
    if (raw.contentVersion!==D.contentVersion) throw new Error('문항 버전이 다릅니다. 현재 문항과 같은 버전의 백업만 가져올 수 있습니다.');
    const next=createState();
    const text=(v,max=20000)=>{if(typeof v!=='string'||v.length>max)throw new Error('백업의 텍스트 형식이나 길이가 잘못되었습니다.');return v;};
    const date=v=>{if(typeof v!=='string'||!Number.isFinite(Date.parse(v)))throw new Error('백업 날짜 형식이 잘못되었습니다.');return v;};
    next.id=text(raw.id,100); next.createdAt=date(raw.createdAt); next.updatedAt=date(raw.updatedAt);
    if (!raw.profile||!D.roles.some(r=>r.id===raw.profile.roleId)||!['design','implementation'].includes(raw.profile.buildMode))throw new Error('백업의 직무 또는 BUILD 유형이 잘못되었습니다.');
    next.profile={name:text(raw.profile.name,60),roleId:raw.profile.roleId,buildMode:raw.profile.buildMode};
    for (const q of D.self) if (raw.self?.[q.id]!==undefined) {if(!validLevel(raw.self[q.id]))throw new Error('SELF 응답 범위가 잘못되었습니다.');next.self[q.id]=raw.self[q.id];}
    for (const q of D.know) if (raw.know?.[q.id]!==undefined) {if(!validOption(raw.know[q.id]))throw new Error('KNOW 응답 범위가 잘못되었습니다.');next.know[q.id]=raw.know[q.id];}
    next.knowSubmittedAt=raw.knowSubmittedAt?date(raw.knowSubmittedAt):null;
    if(next.knowSubmittedAt&&knowledge(next).answered!==12)throw new Error('완료된 KNOW 응답이 12개가 아닙니다.');
    function readTask(rawTask,spec) {
      if(!rawTask||typeof rawTask!=='object')throw new Error('실무과제 백업이 누락되었습니다.');
      const t=emptyTask();
      FIELDS.forEach(f=>{t.fields[f]=text(rawTask.fields?.[f]);});
      for(const r of spec.rubric)if(rawTask.levels?.[r.id]!==undefined){if(!validLevel(rawTask.levels[r.id]))throw new Error('루브릭 범위가 잘못되었습니다.');t.levels[r.id]=rawTask.levels[r.id];}
      for(const r of D.safety)if(rawTask.safety?.[r.id]!==undefined){if(!['yes','no','unknown'].includes(rawTask.safety[r.id]))throw new Error('안전 확인 값이 잘못되었습니다.');t.safety[r.id]=rawTask.safety[r.id];}
      if(!['yes','no','unknown'].includes(rawTask.critical))throw new Error('결함 보고 값이 잘못되었습니다.');
      t.critical=rawTask.critical;t.criticalNote=text(rawTask.criticalNote,2000);
      t.submittedAt=rawTask.submittedAt?date(rawTask.submittedAt):null;
      // Import never accepts reviewer identity, trusted status, server score, or verified=true.
      t.evaluationKind=t.submittedAt?(rawTask.evaluationKind==='llm_advisory'?'llm_advisory':'demo_self_rated'):null;
      if(t.submittedAt&&taskIssues(t,spec).length)throw new Error('제출된 과제에 필수 응답이 누락되었습니다.');
      return t;
    }
    next.tasks.S1=readTask(raw.tasks?.S1,D.s1 ? D.getTask('S1',next.profile.roleId,'design'):null);
    for (const role of D.roles) {
      next.tasks.S2[role.id]=readTask(raw.tasks?.S2?.[role.id],D.getTask('S2',role.id,'design'));
      for(const mode of ['design','implementation'])next.tasks.S3[role.id][mode]=readTask(raw.tasks?.S3?.[role.id]?.[mode],D.getTask('S3',role.id,mode));
    }
    next.dataSource=raw.dataSource==='sample'?'sample':'participant';
    return next;
  }
  function makeReport(state) {
    const s=summary(state);
    return {reportVersion:1,specVersion:D.specVersion,contentVersion:D.contentVersion,generatedAt:new Date().toISOString(),
      participant:{...state.profile},dataSource:state.dataSource,contentStatus:D.provenance.status,
      assessments:s,verifiedCompetency:false,limitations:['문항·직무는 사용자 승인 초안이며 전문가 검증 전입니다.','KNOW는 정답 일치율이며 표준화된 역량 수준을 뜻하지 않습니다.','실무점수는 데모 자기채점 또는 LLM 평가 제안이며 수행 능력·코드 실행·증거 진위를 검증하지 않습니다.','USE = (S1+S2)/2는 구현용 초안 규칙입니다. BUILD 유형끼리 직접 비교하지 않습니다.','총점·적격/부적격·확정 수준 구간을 산출하지 않습니다.']};
  }
  C.domain={FIELDS,createState,emptyTask,taskState,taskSpec,taskIssues,rubricScore,safetyState,knowledge,selfScore,taskResult,summary,progress,sanitize,makeReport,validLevel,validOption};
  if(typeof module!=='undefined')module.exports=C.domain;
})(typeof globalThis!=='undefined'?globalThis:window);
