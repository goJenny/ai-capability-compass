# LLM 평가 교체 계약 · v1

현재 패키지의 기본 평가기는 `demo`입니다. 루브릭 단계는 사용자가 입력합니다. 이 문서는 **향후 연결용 계약**이며 작동하는 LLM 백엔드를 제공하지 않습니다.

## 변경 지점

`src/evaluators.js`:

```js
Compass.evaluationConfig = {
  mode: 'backend',
  endpoint: '/api/evaluate'
};
```

HTTP로 실행해야 하며 같은 출처 서버에만 요청합니다. GitHub Pages는 서버 API를 실행하지 않으므로 별도 서버/프록시와 배포 방식이 필요합니다. 일반 정적 데모에는 그대로 `mode: 'demo'`를 유지하세요.

`createEvaluator().evaluate({ task, submission })` 인터페이스를 사용합니다. 데이터와 채점 계산은 UI에서 분리되어 있어 `app.js` 전체를 다시 작성하지 않아도 교체할 수 있습니다.

## 요청

`POST /api/evaluate` · `Content-Type: application/json`

```json
{
  "contractVersion": 1,
  "contentVersion": "draft-ko-2026-10-13.1",
  "stage": "S3",
  "roleId": "strategy",
  "buildMode": "design",
  "rubric": [{ "id": "scope", "label": "목표와 책임 범위", "weight": 20, "anchors": [] }],
  "submission": {
    "fields": { "plan": "...", "prompt": "...", "output": "...", "verification": "...", "controls": "..." },
    "levels": { "scope": 2, "workflow": 2, "human": 2, "tests": 2, "handoff": 2 },
    "safety": { "data": "yes", "authority": "yes", "injection": "unknown", "review": "yes" },
    "critical": "unknown",
    "criticalNote": "",
    "submittedAt": null,
    "evaluationKind": null
  }
}
```

실제 요청에는 선택한 루브릭 5개 항목과 각 항목의 5단계 기준이 모두 포함됩니다.

## 응답

```json
{
  "contractVersion": 1,
  "levels": { "scope": 2, "workflow": 3, "human": 2, "tests": 1, "handoff": 2 }
}
```

각 단계는 정수 0~4이며 활성 루브릭의 5개 ID가 모두 필요합니다. `S1/S2`의 ID는 `framing, instruction, output, verification, safety`, `S3`의 ID는 `scope, workflow, human, tests, handoff`입니다. 모드마다 ID가 같아도 기준 문구는 다르므로 서버는 `buildMode`를 반드시 적용합니다.

서버의 총점·합격·검증 완료 주장·평가자 식별을 신뢰하지 않습니다. 클라이언트가 검증된 단계와 로컬 가중치로 점수를 다시 계산하고 `llm_advisory / verified:false`로 표시합니다. 사용자 안전 응답은 LLM 점수와 독립적입니다. 서버가 안전 결함을 자동 탐지할 기능은 이 계약에 아직 없으므로 운영 연결 전에 별도의 안전 검토 계약과 기록을 추가해야 합니다.

## 오류와 일관성

- HTTP 오류, 비JSON 응답, 계약 버전 불일치, 잘못된 단계는 제출 실패로 처리합니다.
- 요청은 20초 후 취소됩니다. 저장한 응답은 유지합니다.
- 요청 중 답안이나 진단 상태가 바뀌면 이전 평가 응답을 적용하지 않습니다.
- 성공 시 LLM 단계를 별도로 검증한 제안으로 저장하며, 이후 답안 변경은 점수를 무효화합니다.
- 현재 어댑터는 LLM 근거·모델·평가 버전·토큰 사용량을 저장하지 않습니다. 운영 시 감사 필드와 평가 이력을 서버에 추가하세요.

## 서버에서 갖춰야 할 사항

1. 서버 보관 API 키, 인증·요청 제한, CSRF 등 서비스 환경에 맞는 접근 통제.
2. 클라이언트에서 받은 루브릭 대신 서버에 고정한 버전별 문항·정답·루브릭을 사용. 입력·길이·권한 검증.
3. 제출물과 외부 자료를 신뢰할 수 없는 데이터로 취급. 임의 코드·링크·도구 실행 금지.
4. 구조화 출력 검증, 모델/프롬프트 버전 기록, 오류·비용 제한.
5. 중대 안전 결함의 평가자 검토, 인간 평가의 증거·평가자·시점·근거 기록.
6. 실제 구현 평가가 필요하면 별도의 격리 실행 환경과 승인된 데이터·최소권한 제공. 현재 브라우저 코드는 이를 제공하지 않음.

이는 구현할 서버의 설계 요구사항이며 이 정적 데모의 제공 기능이 아닙니다.
