'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const D=require('../src/data.js'),M=require('../src/domain.js');
const clone=x=>JSON.parse(JSON.stringify(x));
function completeTask(state,stage,level=3){const t=M.taskState(state,stage),spec=M.taskSpec(state,stage);M.FIELDS.forEach(f=>t.fields[f]='자료에 근거한 가상 작업 기록');spec.rubric.forEach(r=>t.levels[r.id]=level);D.safety.forEach(r=>t.safety[r.id]='yes');t.critical='no';t.submittedAt=new Date().toISOString();t.evaluationKind='demo_self_rated';return t;}
test('content is 8 SELF, 12 KNOW, 7 roles and valid unique IDs',()=>{
  assert.equal(D.self.length,8);assert.equal(D.know.length,12);assert.equal(D.roles.length,7);
  assert.equal(new Set([...D.self,...D.know,...D.roles].map(q=>q.id)).size,27);
  D.know.forEach(q=>{assert.equal(q.options.length,4);assert.ok(M.validOption(q.correct));assert.ok(q.explanation);});
  for(const r of D.roles)for(const stage of ['S2','S3'])for(const mode of ['design','implementation']){const t=D.getTask(stage,r.id,mode);assert.ok(t.title&&t.context);assert.ok(t.resources.length);assert.equal(t.rubric.length,5);assert.equal(t.rubric.reduce((s,r)=>s+r.weight,0),100);t.rubric.forEach(x=>assert.equal(x.anchors.length,5));}
});
test('unanswered is null and never a zero score',()=>{const s=M.summary(M.createState());assert.equal(s.self.score,null);assert.equal(s.know.score,null);assert.equal(s.use.score,null);assert.equal(s.build.score,null);assert.equal(s.totalScore,null);assert.equal(s.suitability,'not_determined');});
test('KNOW uses 12 equal points, gates score on all answers and explicit submission',()=>{
  const s=M.createState();D.know.forEach((q,i)=>s.know[q.id]=i<9?q.correct:(q.correct+1)%4);
  assert.equal(M.knowledge(s).score,null);s.knowSubmittedAt=new Date().toISOString();assert.equal(M.knowledge(s).score,75);assert.equal(M.knowledge(s).correct,9);
  delete s.know.KNOW12;assert.equal(M.knowledge(s).score,null);
});
test('SELF is a separate supplementary mean, zero is a valid completed score',()=>{
  const s=M.createState();D.self.forEach(q=>s.self[q.id]=0);assert.equal(M.selfScore(s).score,0);D.self.forEach(q=>s.self[q.id]=4);assert.equal(M.selfScore(s).score,100);assert.equal(M.summary(s).use.score,null);delete s.self.SELF08;assert.equal(M.selfScore(s).score,null);
});
test('rubric rejects missing, fractional and out of range levels',()=>{
  const rubric=D.rubrics.use,levels=Object.fromEntries(rubric.map(r=>[r.id,4]));assert.equal(M.rubricScore(levels,rubric),100);levels.framing=0;assert.equal(M.rubricScore(levels,rubric),80);
  for(const bad of [null,'3',-1,5,2.5,NaN]){levels.framing=bad;assert.equal(M.rubricScore(levels,rubric),null);}delete levels.framing;assert.equal(M.rubricScore(levels,rubric),null);
});
test('USE requires S1 and S2, never borrows S3 and never marks any practice verified',()=>{
  const s=M.createState();completeTask(s,'S1',4);completeTask(s,'S3',4);assert.equal(M.summary(s).use.score,null);completeTask(s,'S2',2);const result=M.summary(s);assert.equal(result.use.score,75);assert.equal(result.build.score,100);result.tasks.forEach(t=>assert.equal(t.verified,false));assert.equal(result.totalScore,null);assert.equal(result.suitability,'not_determined');
});
test('roles and BUILD design/implementation keep independent tasks',()=>{
  const s=M.createState();completeTask(s,'S2',3);completeTask(s,'S3',3);s.profile.roleId='it';assert.equal(M.summary(s).use.score,null);assert.equal(M.summary(s).build.score,null);s.profile.roleId='strategy';assert.equal(M.summary(s).build.score,75);s.profile.buildMode='implementation';assert.equal(M.summary(s).build.score,null);completeTask(s,'S3',1);assert.equal(M.summary(s).build.score,25);s.profile.buildMode='design';assert.equal(M.summary(s).build.score,75);assert.notDeepEqual(D.rubrics.design,D.rubrics.implementation);
});
test('critical defect holds suitability despite a 100 score, also before submission',()=>{
  const s=M.createState();['S1','S2','S3'].forEach(stage=>completeTask(s,stage,4));const t=M.taskState(s,'S3');t.critical='yes';t.criticalNote='승인 없이 외부 발송됨';let summary=M.summary(s);assert.equal(summary.build.score,100);assert.equal(summary.suitability,'hold_review');assert.equal(summary.safety.code,'hold_review');t.submittedAt=null;assert.equal(M.summary(s).suitability,'hold_review');
});
test('safety never treats unknown, no or all-yes self-report as verified',()=>{
  const t=M.emptyTask();assert.equal(M.safetyState(t).code,'unreviewed');D.safety.forEach(r=>t.safety[r.id]='yes');assert.equal(M.safetyState(t).code,'unreviewed');t.critical='no';assert.equal(M.safetyState(t).code,'self_reported_controls');t.safety.data='no';assert.equal(M.safetyState(t).code,'review_required');t.critical='yes';assert.equal(M.safetyState(t).code,'hold_review');
});
test('required fields, rubric, safety, critical notes gate submitted score',()=>{
  const s=M.createState(),t=completeTask(s,'S1');t.fields.prompt=' ';assert.equal(M.taskResult(s,'S1').score,null);t.fields.prompt='기록';delete t.levels.framing;assert.equal(M.taskResult(s,'S1').score,null);t.levels.framing=3;delete t.safety.data;assert.equal(M.taskResult(s,'S1').score,null);t.safety.data='yes';t.critical='yes';assert.equal(M.taskResult(s,'S1').score,null);t.criticalNote='결함 메모';assert.equal(M.taskResult(s,'S1').score,75);
});
test('JSON roundtrip preserves responses, tasks and content version',()=>{
  const s=M.createState();s.profile.name='연습';completeTask(s,'S1',2);D.self.forEach(q=>s.self[q.id]=2);assert.deepEqual(M.sanitize(clone(s)),s);
});
test('import strips forged verification, scores, code objects and prototype fields',()=>{
  const s=M.createState();completeTask(s,'S1',2);s.verified=true;s.score=999;s.tasks.S1.verified=true;s.tasks.S1.score=100;s.tasks.S1.reviewer='admin';s.tasks.S1.fields.extra='<script>alert(1)</script>';s.profile.admin=true;s.__proto__.unexpected='untrusted';const sanitized=M.sanitize(clone(s));assert.equal(sanitized.verified,undefined);assert.equal(sanitized.tasks.S1.score,undefined);assert.equal(sanitized.profile.admin,undefined);assert.equal(M.taskResult(sanitized,'S1').score,50);assert.equal(M.taskResult(sanitized,'S1').verified,false);delete Object.prototype.unexpected;
});
test('import rejects schema, content mismatch, invalid values, lengths and incomplete submitted tasks',()=>{
  const bad=[s=>s.schemaVersion=2,s=>s.contentVersion='other',s=>s.know.KNOW01=8,s=>s.self.SELF01=-1,s=>s.profile.roleId='other',s=>s.profile.buildMode='both',s=>s.profile.name='x'.repeat(61),s=>s.tasks.S1.fields.output={code:'unsafe'},s=>s.tasks.S1.levels.framing=2.5,s=>s.tasks.S1.critical='maybe',s=>s.tasks.S1.submittedAt=new Date().toISOString(),s=>s.tasks.S1.fields.output='x'.repeat(20001),s=>s.knowSubmittedAt='yesterday',s=>s.createdAt='not a date',s=>s.knowSubmittedAt=new Date().toISOString()];
  bad.forEach(mutate=>{const s=M.createState();mutate(s);assert.throws(()=>M.sanitize(s));});
});
test('report JSON always includes provenance, limitations, no total and false verification',()=>{
  const s=M.createState();completeTask(s,'S3',4);const r=M.makeReport(s);assert.equal(r.verifiedCompetency,false);assert.equal(r.assessments.build.verified,false);assert.equal(r.assessments.totalScore,null);assert.equal(r.contentStatus,'draft_authorized');assert.ok(r.limitations.length>=5);
});
test('progress counts active roles and distinguishes incomplete from zero scored',()=>{
  const s=M.createState();assert.equal(M.progress(s).percent,0);D.self.forEach(q=>s.self[q.id]=0);D.know.forEach(q=>s.know[q.id]=0);['S1','S2','S3'].forEach(stage=>completeTask(s,stage,0));assert.equal(M.progress(s).percent,100);s.profile.roleId='it';assert.equal(M.progress(s).answered,21);s.profile.roleId='strategy';assert.equal(M.progress(s).answered,23);
});
