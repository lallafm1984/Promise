# 언제볼래 카드 메뉴 디자인 명세

Date: 2026-06-12
Status: Draft for user review
Scope: 모바일 앱의 카드 메뉴. 구현 전 제품/UX 기준을 고정한다.

## Design Brief

카드 메뉴는 사용자가 약속 카드를 빠르게 만들고, 만든 카드의 현재 상태를 바로 관리하는 화면이다. 상황 템플릿은 제공하지 않는다. 사용자는 약속 방식만 고른 뒤 `언제`, `어디서`를 입력하고 카드 미리보기에서 공유 방식을 선택한다.

## Goals

- 첫 화면에서 `이때볼래?`와 `언제볼래?`의 차이를 즉시 이해하게 한다.
- 필수 입력을 `언제`, `어디서`로 제한해 카드 생성 부담을 낮춘다.
- 생성 후 바로 보내기 전에 카드 내용을 확인하게 한다.
- 진행 중인 카드는 상태 기준으로 정리하고, 상태별 다음 행동을 하나만 크게 제공한다.
- 현재 warm color 카드 테마와 두꺼운 라인, 둥근 카드 스타일을 유지한다.

## Non-Goals

- 상황 템플릿, 카테고리, 추천 장소, 음식/카페/스터디 같은 감성 분류는 이번 범위에서 제외한다.
- 복잡한 일정 조율 기능, 캘린더 연동, 위치 검색 자동완성은 이번 카드 메뉴 명세의 필수 범위가 아니다.
- 공유 대상 선택 UI는 직접 만들지 않고 OS 공유 시트 또는 카카오 공유 흐름에 맡긴다.

## Card Creation Model

카드 메뉴 상단은 만들기 영역이다.

1. 사용자가 약속 방식을 선택한다.
2. 사용자가 `언제`를 입력한다.
3. 사용자가 `어디서`를 입력한다.
4. 필요할 때만 `+ 한마디 추가`를 열어 선택 메시지를 입력한다.
5. `카드 만들기`를 누르면 카드 미리보기를 보여준다.
6. 미리보기에서 `카톡 공유` 또는 `링크 복사`를 선택한다.

### Modes

#### 이때볼래?

정해진 시간 1개와 장소 1개를 보내고 상대가 가능한지 답하는 확정형 카드다.

Required fields:
- `언제`: 날짜와 시간 1개
- `어디서`: 장소 텍스트 1개

Generated title pattern:
- `{날짜/시간}에 {장소}에서 볼래?`

Primary friend response:
- `가능해`
- `어려워`

#### 언제볼래?

후보 시간 여러 개와 장소 1개를 보내고 상대들이 가능한 시간을 고르는 투표형 카드다.

Required fields:
- `언제`: 후보 시간 2개 이상
- `어디서`: 장소 텍스트 1개

Generated title pattern:
- `{장소}에서 언제볼래?`

Primary friend response:
- 후보 시간별 가능 여부 선택
- 가능한 후보가 여러 개면 복수 선택을 허용한다.

### Mode Switching Rule

기본은 `이때볼래?`를 먼저 보여준다. 사용자가 `언제볼래?`를 직접 선택하거나, `+ 후보 시간 추가`를 누르면 투표형 작성 상태로 전환한다. 전환 후에도 장소와 선택 메시지는 유지한다.

## Optional Message

`한 줄 메시지`는 선택 입력이다.

- 기본 화면에는 노출하지 않는다.
- `+ 한마디 추가` 버튼을 누르면 입력 필드를 펼친다.
- 메시지를 입력하지 않아도 카드 생성은 가능하다.
- 메시지가 없으면 카드 미리보기는 자동 생성 제목과 시간/장소만 표시한다.
- 메시지 예시는 짧고 부담 없는 문장으로 둔다.

Example helper text:
- `늦으면 커피 내가 살게`
- `가볍게 한 시간만 보자`

## Preview And Sharing

카드 생성 직후에는 바로 외부 공유를 실행하지 않는다. 먼저 카드 미리보기를 보여준다.

Preview content:
- 자동 생성 제목
- 시간 또는 후보 시간
- 장소
- 선택 메시지, 있는 경우만
- 카드 방식 배지: `이때볼래?` 또는 `언제볼래?`

Actions:
- Primary: `카톡 공유`
- Secondary: `링크 복사`

After action feedback:
- 카톡 공유를 완료하거나 링크를 복사하면 해당 카드는 `응답 대기` 또는 `투표 중` 상태로 내 카드 관리함에 표시한다.
- 링크 복사 성공은 짧은 피드백으로 충분하다.

## Card Management Model

카드 메뉴 하단은 내 카드 관리함이다. 분류 기준은 카드 방식이 아니라 상태다.

Statuses:
- `응답 대기`
- `투표 중`
- `확정됨`
- `지난 약속`

Each managed card shows:
- 상태 배지
- 카드 방식: `이때볼래?` 또는 `언제볼래?`
- 상대 또는 방 이름
- 시간 요약
- 장소 요약
- 상태별 대표 버튼 1개

### Status Actions

응답 대기:
- Button: `공유 다시하기`
- Purpose: 카톡 공유 또는 링크 복사를 다시 열어 재전송한다.

투표 중:
- Button: `결과 보기`
- Purpose: 후보 시간별 응답 현황과 확정 후보를 본다.

확정됨:
- Button: `일정 보기`
- Purpose: 확정된 시간/장소와 알림 상태를 확인한다.

지난 약속:
- Button: `다시 만들기`
- Purpose: 이전 시간/장소를 기반으로 새 카드를 만든다.

Secondary actions such as delete, edit, and copy link stay in card detail or overflow. The list card itself should not show more than one main action.

## Screen Structure

Preferred structure:

1. Header
   - `카드 만들기`
   - Light supporting copy: `시간과 장소만 정하면 카드가 만들어져요.`
2. Mode selector
   - Two large segmented cards: `이때볼래?`, `언제볼래?`
   - `이때볼래?` selected by default
3. Required fields
   - `언제`
   - `어디서`
4. Optional controls
   - `+ 후보 시간 추가`
   - `+ 한마디 추가`
5. Primary action
   - `카드 만들기`
6. Preview state
   - Card preview
   - `카톡 공유`
   - `링크 복사`
7. My cards
   - Status filter chips or grouped sections
   - Managed card rows with one representative action

## Visual Direction

- Keep the current warm palette: cream background, coral primary action, mint/lime support colors, brown outline.
- Use large rounded cards with 2px outline and soft offset shadow.
- Avoid image assets in this screen. Use icons from the existing icon library only when they clarify actions.
- Do not reintroduce situation stickers or decorative image blocks.
- Keep copy short and direct. This screen is a tool, not a landing page.

## Data Model Implications

Existing `AppointmentMode` maps cleanly:
- `DIRECT` -> `이때볼래?`
- `POLL` -> `언제볼래?`

Existing `AppointmentStatus` maps to menu states:
- `PENDING` -> `응답 대기`
- `VOTING` -> `투표 중`
- `CONFIRMED` -> `확정됨`
- `DECLINED` and old confirmed items can appear under `지난 약속` when their event time has passed.

The current `PromiseCard` shape already supports:
- mode
- status
- title
- location
- message
- candidates
- participants
- sharedUrl

The implementation should prefer deriving generated title and status labels in a helper rather than hardcoding them in render components.

## Error And Empty States

Validation:
- `언제` is required.
- `어디서` is required.
- `언제볼래?` requires at least two candidate times before preview.

Error copy:
- Missing time: `만날 시간을 골라주세요.`
- Missing place: `만날 장소를 적어주세요.`
- Too few candidates: `언제볼래?는 후보 시간이 2개 이상 필요해요.`

Empty management state:
- Title: `아직 만든 카드가 없어요`
- Body: `시간과 장소만 정하면 바로 공유할 수 있어요.`
- Action: `첫 카드 만들기`

## Interaction Requirements

- Mode switching preserves already entered field values.
- Adding a second candidate in `이때볼래?` switches the mode to `언제볼래?`.
- Removing candidates down to one should ask or clearly show that the card will return to `이때볼래?`.
- Preview can return to edit without losing data.
- Link copy should be idempotent and safe to repeat.
- Managed card representative buttons should not navigate unexpectedly; each button opens the most relevant next step.

## Verification Criteria

Before implementation handoff is considered done:
- The card menu renders on mobile without horizontal overflow.
- The first visible action is mode selection, not a situation template.
- A user can create an `이때볼래?` preview with only time and place.
- A user can create an `언제볼래?` preview with multiple candidate times and one place.
- `+ 한마디 추가` is collapsed by default and opens an optional field.
- Preview shows `카톡 공유` as the primary action and `링크 복사` as secondary.
- The management section groups or filters by status.
- Each managed card exposes exactly one representative action.
- Typecheck and web export pass after implementation.

## References

- Material Design Cards: https://m3.material.io/components/cards/guidelines
- Material Design Lists: https://m3.material.io/components/lists/overview
- Material Design Text Fields: https://m3.material.io/components/text-fields/guidelines
- Apple Activity Views: https://developer.apple.com/design/human-interface-guidelines/activity-views
