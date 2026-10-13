# 데이터와 평가 상태

## 진단 상태

`schemaVersion:1`, `contentVersion:draft-ko-2026-10-13.1`을 함께 검증합니다. 스키마가 같아도 문항 버전이 다르면 잘못된 비교를 방지하기 위해 가져오기를 거부합니다.

- `id`, `createdAt`, `updatedAt`: 로컬 진단 식별자와 ISO 시각.
- `profile`: 선택 이름, `roleId`, `buildMode` (`design | implementation`).
- `self`: 문항 ID → 정수 0~4. 미응답은 키 없음.
- `know`: 문항 ID → 보기 인덱스 0~3. `knowSubmittedAt`은 전체 제출 시각.
- `tasks.S1`: 공통 과제 1개.
- `tasks.S2[roleId]`: 직무별 과제 7개.
- `tasks.S3[roleId][buildMode]`: 직무·유형별 과제 14개.
- `dataSource`: `participant | sample`. 예시 데이터는 화면·리포트에 표시.

실무 저장 구조:

```json
{
  "fields": { "plan": "", "prompt": "", "output": "", "verification": "", "controls": "" },
  "levels": {},
  "safety": {},
  "critical": "unknown",
  "criticalNote": "",
  "submittedAt": null,
  "evaluationKind": null
}
```

`levels`: 활성 루브릭의 정수 0~4. `safety`: 항목별 `yes | no | unknown`.

점수는 저장된 확정값을 신뢰하지 않고 답안과 단계로 재계산합니다. 백업의 `verified`, 임의 점수, 평가자 주장 등은 읽지 않습니다. JSON에는 응답을 허용 목록으로 복사하며 HTML 렌더링은 이스케이프합니다. 텍스트는 항목당 20,000자, 이름은 60자, 결함 메모는 2,000자로 제한합니다. 가져오기 파일은 2MB 이하입니다. 사용자 생성 코드를 실행하지 않습니다.

## 점수

| 지표 | 계산 | 미완료 처리 |
|---|---|---|
| SELF | 8문항 합 ÷ 32 × 100 | 8문항 미완료 → null |
| KNOW | 정답 수 ÷ 12 × 100 | 전체 응답+제출 전 → null |
| S1/S2/S3 | Σ(단계 ÷ 4 × 가중치) ÷ 가중치 합 × 100 | 필수 응답·단계·안전 확인·제출 전 → null |
| USE | (S1+S2) ÷ 2 | 한 과제라도 미산출 → null |
| BUILD | 선택 직무·유형 S3 | 미산출 → null |

소수점 첫째 자리로 반올림합니다. `0`은 유효 점수이며 `null`은 미산출입니다. 전체 합산 점수는 없습니다. 진행률은 SELF 응답8 + KNOW 응답12 + 활성 과제 제출3 = 23단위를 기준으로 합니다. 따라서 KNOW가 채점 전이어도 모두 응답했다면 진행 단위 12개가 표시됩니다.

## 실무 평가 상태

- `not_submitted`: 제출 전 또는 수정으로 점수 무효화.
- `demo_self_rated`: 사용자 루브릭으로 계산한 데모 자기채점.
- `llm_advisory`: 향후 서버 평가기가 제안한 단계. 미검증.
- 모든 실무 상태의 `verified`는 **false**. 현재 제품에는 `verified`를 활성화할 경로가 없음.

## 안전성 우선순위

1. `hold_review`: 중대 결함 `yes`. **적격 판정 보류·별도 검토**.
2. `review_required`: 안전 확인 중 `no`가 있음. 중대성 및 통제 보완 검토.
3. `unreviewed`: `unknown`, 누락, 중대 결함 미확인. 안전성 미확인.
4. `self_reported_controls`: 안전 확인 모두 `yes`이고 중대 결함 `no`. **자기보고이며 검증 전**.

리포트는 활성 S1/S2/S3 중 가장 우선하는 상태를 표시합니다. 다른 직무·유형의 결함은 해당 과제로 전환하면 표시하며 활성 과제와 혼합하지 않습니다. 수치 점수는 결함이 있어도 표시하되, 판정 보류 상태를 상단에 표시합니다. 안전 상태는 수치 점수와 독립적이며 점수를 낮춰 결함을 숨기지 않습니다.

중대 결함이 없어도 데모는 `suitability:not_determined`입니다. 합격 판정을 생성하지 않습니다.

## 저장 범위

키는 `ai-capability-compass:v0.4:draft.1`입니다. localStorage는 브라우저·출처별 평문 저장입니다. 저장 실패를 화면에 표시하고 JSON 백업을 안내합니다. 손상되거나 버전이 다른 기존 저장값은 새 응답으로 자동 덮어쓰지 않고, 명시적 새 진단 또는 가져오기 후에만 교체합니다.

동일한 출처에서 여러 탭을 동시에 수정하는 상황의 병합은 구현하지 않았습니다. 실제 진단은 한 탭에서 진행하세요. 서버 계정별 저장이나 응답 이력은 향후 범위입니다.
