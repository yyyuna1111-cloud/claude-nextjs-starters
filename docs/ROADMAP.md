# MLOps 통합 대시보드 개발 로드맵

Kubeflow 기반 ML 파이프라인 운영을 단일 대시보드에서 관리하는 MLOps 통합 플랫폼

## 개요

MLOps 통합 대시보드는 ML 엔지니어 및 데이터 사이언티스트를 위한 통합 운영 플랫폼으로 다음 기능을 제공합니다:

- **학습 실행 관리**: 데이터셋/코드 선택, 파라미터 입력, GPU/CPU 모드 선택 후 학습 요청 및 모니터링
- **모델 생명주기 관리**: 평가, 레지스트리 등록, 배포(Canary/Blue-Green), 롤백까지 전체 과정 관리
- **인프라 모니터링**: Pod/Node/GPU/PVC/Queue 실시간 상태 확인 및 알림 관리
- **실험 이력 추적**: 전체 작업 이력 및 파라미터/메트릭 비교 분석

## 현재 상태 (2026-05-15 기준)

### 완료된 작업

- Next.js 15.5.3 프로젝트 초기 설정 완료
- 대시보드 공통 레이아웃 (사이드바 + 모바일 네비게이션) 구현 완료
- 대시보드 Overview 페이지 (더미 요약 카드) 구현 완료
- Train 페이지 (학습 목록 테이블, 더미 데이터) 구현 완료
- Models 페이지 플레이스홀더 생성 완료
- Login/Signup 페이지 및 폼 컴포넌트 구현 완료
- shadcn/ui 기본 컴포넌트 설치 완료 (badge, button, card, table, form, dialog, select, skeleton 등)

### 라우팅 구조 변경 필요

현재 사이드바는 `/dashboard/datasets`, `/dashboard/pipelines`, `/dashboard/experiments`, `/dashboard/resources` 경로를 참조하지만, PRD 기반 새 메뉴 구조로 재구성이 필요합니다:

| 메뉴               | 현재 경로                       | 변경 경로                   | 상태   |
| ------------------ | ------------------------------- | --------------------------- | ------ |
| Overview           | `/dashboard`                    | `/dashboard`                | 유지   |
| Train              | `/dashboard/train`              | `/dashboard/train`          | 유지   |
| Evaluation         | 없음                            | `/dashboard/evaluation`     | 신규   |
| Model Registry     | `/dashboard/models`             | `/dashboard/models`         | 재구성 |
| Deployment/Serving | 없음                            | `/dashboard/deployment`     | 신규   |
| Monitoring/Alerts  | `/dashboard/alerts` (부분)      | `/dashboard/monitoring`     | 재구성 |
| Infrastructure     | `/dashboard/resources` (부분)   | `/dashboard/infrastructure` | 재구성 |
| History/Audit      | `/dashboard/experiments` (부분) | `/dashboard/history`        | 재구성 |

## 개발 워크플로우

1. **작업 계획**
   - 기존 코드베이스를 학습하고 현재 상태를 파악
   - 새로운 작업을 포함하도록 `ROADMAP.md` 업데이트
   - 우선순위 작업은 마지막 완료된 작업 다음에 삽입

2. **작업 생성**
   - 기존 코드베이스를 학습하고 현재 상태를 파악
   - `/tasks` 디렉토리에 새 작업 파일 생성
   - 명명 형식: `XXX-description.md` (예: `001-setup.md`)
   - 고수준 명세서, 관련 파일, 수락 기준, 구현 단계 포함
   - API/비즈니스 로직 작업 시 "## 테스트 체크리스트" 섹션 필수 포함 (Playwright MCP 테스트 시나리오 작성)
   - 예시를 위해 `/tasks` 디렉토리의 마지막 완료된 작업 참조

3. **작업 구현**
   - 작업 파일의 명세서를 따름
   - 기능과 기능성 구현
   - API 연동 및 비즈니스 로직 구현 시 Playwright MCP로 테스트 수행 필수
   - 각 단계 후 작업 파일 내 단계 진행 상황 업데이트
   - 구현 완료 후 Playwright MCP를 사용한 E2E 테스트 실행
   - 테스트 통과 확인 후 다음 단계로 진행
   - 각 단계 완료 후 중단하고 추가 지시를 기다림

4. **로드맵 업데이트**
   - 로드맵에서 완료된 작업을 완료로 표시

## 개발 단계

### Phase 1: 라우팅 재구성 및 애플리케이션 골격 (MVP 기반)

> Overview + Train + 기본 라우팅 구조를 PRD 8개 메뉴에 맞게 재구성하고, 전체 타입 시스템을 정의합니다.

- **Task 001: 라우팅 구조 재구성 및 빈 페이지 생성** - 우선순위
  - 사이드바 네비게이션을 8개 메뉴 구조로 변경 (`sidebar-nav.tsx`, `mobile-nav.tsx`)
  - 신규 라우트 디렉토리 및 빈 페이지 파일 생성: `/dashboard/evaluation/page.tsx`, `/dashboard/deployment/page.tsx`, `/dashboard/monitoring/page.tsx`, `/dashboard/infrastructure/page.tsx`, `/dashboard/history/page.tsx`
  - 기존 `/dashboard/datasets`, `/dashboard/pipelines`, `/dashboard/experiments`, `/dashboard/resources` 경로 정리 및 리디렉션 처리
  - 각 페이지에 통일된 플레이스홀더 컴포넌트 배치 (페이지 제목, 설명, "개발 예정" 안내)
  - 전체 라우트 간 네비게이션 동작 검증

- **Task 002: TypeScript 타입 정의 및 데이터 모델 설계**
  - `src/types/` 디렉토리 생성 및 전체 도메인 타입 정의
  - PRD 데이터 모델 기반 인터페이스 정의: `User`, `Dataset`, `DatasetVersion`, `TrainingRun`, `PipelineStep`, `Metric`, `Model`, `Alert`
  - API 응답 래퍼 타입 정의 (`ApiResponse<T>`, `PaginatedResponse<T>`, `ErrorResponse`)
  - Enum 타입 정의: `TrainStatus`, `ComputeMode`, `NodeMode`, `PipelineStepName`, `ModelStatus`, `AlertType`
  - Evaluation 관련 타입 추가: `EvaluationResult`, `ModelComparison`, `RAGMetric`, `EmbeddingMetric`
  - Deployment 관련 타입 추가: `DeploymentConfig`, `DeploymentStrategy` (Canary/Blue-Green), `RollbackInfo`
  - Infrastructure 관련 타입 추가: `PodStatus`, `NodeInfo`, `GPUInfo`, `PVCStatus`, `QueueStatus`
  - Supabase 데이터베이스 스키마 타입 정의 파일 (`src/types/database.ts`)

- **Task 003: 더미 데이터 관리 유틸리티 및 공통 상수 정의**
  - `src/lib/mock-data/` 디렉토리에 각 도메인별 더미 데이터 팩토리 함수 생성
  - Overview 요약 카드용 더미 데이터 정의 (학습 현황, GPU 사용률, 알림 카운트, 배포 상태)
  - Train 관련 더미 데이터 확장 (기존 데이터 마이그레이션 포함)
  - Evaluation, Model Registry, Deployment, Monitoring, Infrastructure, History 더미 데이터 생성
  - 공통 상수 파일 정의: 상태 색상 매핑, 라우트 경로 상수, 메뉴 아이콘 매핑

### Phase 2: UI/UX 완성 - Overview + Train (더미 데이터 활용)

> MVP 1순위인 Overview와 Train 페이지의 UI를 완성합니다.

- **Task 004: 공통 대시보드 컴포넌트 라이브러리 구현** - 우선순위
  - 상태 배지 컴포넌트 (`StatusBadge`): 학습/파이프라인/모델/배포 상태별 색상 및 아이콘 통합
  - 요약 통계 카드 컴포넌트 (`StatCard`): 아이콘, 제목, 수치, 트렌드 표시
  - 데이터 테이블 컴포넌트 (`DataTable`): 정렬, 필터링, 페이지네이션 지원하는 재사용 가능 테이블
  - 빈 상태 컴포넌트 (`EmptyState`): 데이터 없음 안내 UI
  - 페이지 헤더 컴포넌트 (`PageHeader`): 제목, 설명, 액션 버튼 영역 통합
  - 실시간 메트릭 게이지 컴포넌트 (`MetricGauge`): GPU/CPU/메모리 사용률 표시
  - 시계열 차트 래퍼 컴포넌트 (`TimeSeriesChart`): Recharts 기반 공통 차트 컴포넌트

- **Task 005: Overview 페이지 UI 고도화**
  - 기존 Overview 페이지를 PRD 기반으로 재구성
  - 진행 중 학습 목록 요약 카드 (상태, 경과 시간, 진행률 표시)
  - GPU/CPU 사용률 요약 게이지 차트 (노드별 실시간 사용률 시각화)
  - 미확인 알림 목록 카드 (최근 5건, 유형별 아이콘, 확인 상태 표시)
  - 최근 배포 상태 요약 카드 (배포 전략, 트래픽 비율)
  - "새 학습 시작" 버튼 및 각 상세 페이지 바로가기 링크
  - 반응형 레이아웃: 모바일 1열, 태블릿 2열, 데스크탑 3-4열 그리드

- **Task 006: Train 페이지 UI 고도화 - 목록 및 상세**
  - 학습 실행 목록 페이지 (`/dashboard/train`) 리팩토링
  - 상태 필터 탭 (전체/진행 중/완료/실패/취소)
  - DataTable 컴포넌트 적용: 정렬, 검색, 페이지네이션
  - 학습 상세 페이지 (`/dashboard/train/[id]/page.tsx`) 생성
  - 상세 페이지: 파라미터 정보, 파이프라인 DAG 뷰 (prepare/train/evaluate/register), 실시간 로그 패널, 메트릭 차트
  - 학습 요청 폼 다이얼로그/페이지: 학습명, 데이터셋 선택, 코드 선택, 파라미터 입력 (JSON/Key-Value 토글), CPU/GPU 모드, 단일/멀티노드 선택
  - 실패 학습 재실행 버튼 (파라미터 자동 채움)

### Phase 3: UI/UX 완성 - Evaluation + Model Registry (더미 데이터 활용)

> MVP 2순위인 Evaluation과 Model Registry 페이지 UI를 완성합니다.

- **Task 007: Evaluation 페이지 UI 구현** - 우선순위
  - 평가 결과 목록 페이지 (`/dashboard/evaluation`): 평가 run 목록 테이블, 모델명, 평가 유형, 주요 메트릭 요약
  - 평가 상세 페이지 (`/dashboard/evaluation/[id]/page.tsx`): RAG 평가 메트릭 (Precision, Recall, F1, BLEU 등), Embedding 평가 메트릭 (Cosine Similarity, MRR 등)
  - 신구 모델 비교 뷰: 두 모델 선택 후 메트릭 side-by-side 비교 테이블
  - 메트릭 시각화: 레이더 차트 (다차원 메트릭 비교), 바 차트 (단일 메트릭 비교)
  - 평가 결과 필터: 모델명, 평가 유형, 날짜 범위

- **Task 008: Model Registry 페이지 UI 구현**
  - 모델 목록 페이지 (`/dashboard/models`): 모델명, 버전, 상태 (Draft/Registered/Staging/Production/Archived), 생성일
  - 기존 models 플레이스홀더 페이지를 완전한 UI로 교체
  - 모델 상세 페이지 (`/dashboard/models/[id]/page.tsx`): 버전 히스토리 타임라인, 아티팩트 파일 트리, 메트릭 요약
  - 모델 상태 전환 UI: 허용된 상태 전환만 버튼 활성화 (Draft -> Registered -> Staging -> Production, Production -> Archived)
  - 모델 등록 폼: 모델명, 설명, 태그, 연결된 학습 run 선택
  - 아티팩트 파일 목록 및 개별 다운로드 링크

### Phase 4: UI/UX 완성 - Deployment + Monitoring/Alerts (더미 데이터 활용)

> MVP 3-4순위인 Deployment와 Monitoring/Alerts 페이지 UI를 완성합니다.

- **Task 009: Deployment/Serving 페이지 UI 구현** - 우선순위
  - 배포 목록 페이지 (`/dashboard/deployment`): 배포명, 모델명/버전, 배포 전략, 상태, 트래픽 비율
  - 배포 상세 페이지 (`/dashboard/deployment/[id]/page.tsx`): 배포 구성 정보, 엔드포인트 URL, 트래픽 분배 시각화
  - 배포 전략 설정 UI: Canary (트래픽 비율 슬라이더), Blue-Green (전환 토글)
  - 롤백 UI: 이전 버전 목록에서 선택 후 롤백 확인 다이얼로그
  - 배포 이력 타임라인: 버전별 배포/롤백 기록
  - 서빙 엔드포인트 상태 카드: 응답 시간, 요청 수, 에러율

- **Task 010: Monitoring/Alerts 페이지 UI 구현**
  - 모니터링 대시보드 (`/dashboard/monitoring`): 실시간 메트릭 차트 영역 + 알림 목록 영역 분할 레이아웃
  - 실시간 메트릭 패널: 서빙 모델별 추론 지연시간, 처리량, 에러율 차트 (Recharts 시계열)
  - 알림 목록: 유형 (학습 실패/GPU 부족/스토리지 부족), 발생 시각, 대상, 확인 여부
  - 알림 상세 패널: 오류 메시지, 관련 로그 발췌, 발생 원인 요약
  - 알림 필터: 유형별, 확인/미확인, 날짜 범위
  - 알림 확인 처리 (읽음 표시) 및 실패 학습 재실행 버튼

### Phase 5: UI/UX 완성 - Infrastructure + History/Audit (더미 데이터 활용)

> 나머지 Infrastructure와 History/Audit 페이지 UI를 완성합니다.

- **Task 011: Infrastructure 페이지 UI 구현** - 우선순위
  - 인프라 개요 페이지 (`/dashboard/infrastructure`): Pod/Node/GPU/PVC/Queue 탭 구성
  - Pod 상태 탭: Pod 목록 테이블 (이름, 네임스페이스, 상태, CPU/메모리 사용량, 노드)
  - Node 상태 탭: 노드 목록 (노드명, 상태 Ready/NotReady, GPU 수, CPU/메모리 사용률)
  - GPU 모니터링 탭: 노드별 GPU 사용률 게이지, VRAM 사용량, 현재 할당된 학습 run 표시
  - PVC 상태 탭: Rook-Ceph 스토리지 사용량 도넛 차트 (데이터셋/모델/로그 용도별), PVC 목록
  - Queue 상태 탭: 학습 큐 대기열 현황, 우선순위별 대기 작업 수
  - 사용률 이력 시계열 차트 (최근 24시간), 임계값 초과 항목 강조 표시

- **Task 012: History/Audit 페이지 UI 구현**
  - 전체 작업 이력 페이지 (`/dashboard/history`): 통합 이벤트 타임라인
  - 이력 테이블: 작업 유형 (학습/배포/모델 등록/알림 등), 수행자, 시각, 상태, 상세 링크
  - 실험 비교 기능: 여러 run 체크박스 선택 후 파라미터/메트릭 side-by-side 비교 테이블
  - 메트릭 추이 비교 차트 (다중 run 오버레이)
  - 고급 필터: 작업 유형, 수행자, 날짜 범위, 상태
  - 감사 로그: 모델 상태 변경, 배포 이벤트, 권한 변경 등 주요 이벤트 기록

### Phase 6: 백엔드 연동 - Supabase 설정 및 핵심 API 구현

> 더미 데이터를 실제 Supabase 백엔드로 교체합니다.

- **Task 013: Supabase 프로젝트 설정 및 데이터베이스 구축** - 우선순위
  - Supabase 프로젝트 생성 및 환경 변수 설정 (`.env.local`)
  - Supabase 클라이언트 초기화 (`src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`)
  - PRD 데이터 모델 기반 PostgreSQL 테이블 생성 (마이그레이션 SQL)
  - Row Level Security (RLS) 정책 설정
  - Supabase Storage 버킷 생성 (datasets, codes, models, artifacts)
  - 시드 데이터 스크립트 작성 및 실행
  - Playwright MCP를 활용한 데이터베이스 연결 및 CRUD 검증 테스트

- **Task 014: 인증 시스템 구현 (Supabase Auth)**
  - Supabase Auth 기반 회원가입/로그인/로그아웃 구현
  - 기존 Login/Signup 폼을 Supabase Auth와 연동
  - 인증 미들웨어 구현 (`middleware.ts`): 비로그인 시 `/login` 리디렉션
  - 세션 관리 및 토큰 갱신 로직
  - 대시보드 레이아웃에 사용자 정보 표시 및 로그아웃 기능
  - Playwright MCP로 인증 플로우 E2E 테스트: 회원가입 -> 로그인 -> 대시보드 접근 -> 로그아웃 -> 리디렉션 검증

- **Task 015: Train 관련 API 및 데이터 연동**
  - Server Actions 구현: 학습 요청 생성, 목록 조회, 상세 조회, 재실행
  - 데이터셋/코드 업로드 API: Supabase Storage 멀티파트 업로드, checksum 검증
  - 데이터셋/코드 버전 관리 API: 버전 목록, 버전 생성
  - Train 페이지 더미 데이터를 실제 API 호출로 교체
  - 파이프라인 단계별 상태 조회 API
  - Playwright MCP로 학습 요청 생성 -> 목록 확인 -> 상세 조회 E2E 테스트

- **Task 016: Overview 페이지 데이터 연동**
  - 진행 중 학습 목록 실시간 조회 (Supabase Realtime 구독)
  - GPU/CPU 사용률 데이터 조회 API
  - 미확인 알림 카운트 및 최근 알림 조회
  - Overview 페이지 더미 데이터를 실제 API로 교체
  - Playwright MCP로 Overview 페이지 데이터 렌더링 검증

### Phase 7: 백엔드 연동 - Evaluation + Model Registry + Deployment

> Evaluation, Model Registry, Deployment 페이지의 백엔드를 연동합니다.

- **Task 017: Evaluation 관련 API 및 데이터 연동** - 우선순위
  - Server Actions 구현: 평가 결과 목록, 상세 조회, 모델 비교
  - RAG/Embedding 평가 메트릭 저장 및 조회 API
  - 신구 모델 비교 데이터 조회 API
  - Evaluation 페이지 더미 데이터를 실제 API로 교체
  - Playwright MCP로 평가 결과 조회 및 모델 비교 E2E 테스트

- **Task 018: Model Registry API 및 데이터 연동**
  - Server Actions 구현: 모델 등록, 목록 조회, 상태 변경, 아티팩트 조회
  - 모델 상태 전환 비즈니스 로직 (허용된 전환만 가능하도록 검증)
  - 아티팩트 파일 다운로드 URL 생성 (Supabase Storage signed URL)
  - Model Registry 페이지 더미 데이터를 실제 API로 교체
  - Playwright MCP로 모델 등록 -> 상태 변경 -> 아티팩트 다운로드 E2E 테스트

- **Task 019: Deployment/Serving API 및 데이터 연동**
  - Server Actions 구현: 배포 생성, 목록 조회, 상태 조회, 롤백
  - Canary/Blue-Green 배포 전략 설정 API
  - 트래픽 비율 변경 API
  - 롤백 실행 API 및 확인 로직
  - Deployment 페이지 더미 데이터를 실제 API로 교체
  - Playwright MCP로 배포 생성 -> 트래픽 조정 -> 롤백 E2E 테스트

### Phase 8: 백엔드 연동 - Monitoring + Infrastructure + History

> 나머지 페이지의 백엔드를 연동하고 실시간 기능을 구현합니다.

- **Task 020: Monitoring/Alerts API 및 실시간 기능 구현** - 우선순위
  - 알림 CRUD API: 목록 조회, 확인 처리, 필터링
  - Supabase Realtime 구독: 새 알림 실시간 수신, 메트릭 업데이트
  - SSE 기반 학습 로그 스트리밍 구현
  - 헤더 알림 벨 아이콘 실시간 카운트 업데이트
  - Monitoring 페이지 더미 데이터를 실제 API로 교체
  - Playwright MCP로 알림 수신 -> 확인 처리 -> 재실행 E2E 테스트

- **Task 021: Infrastructure API 및 데이터 연동**
  - Pod/Node/GPU 상태 조회 API (Kubernetes API 연동 또는 메트릭 수집기 연동)
  - PVC/스토리지 사용량 조회 API (Rook-Ceph 메트릭)
  - Queue 상태 조회 API
  - 사용률 이력 시계열 데이터 조회 API (최근 24시간)
  - Infrastructure 페이지 더미 데이터를 실제 API로 교체
  - Playwright MCP로 인프라 상태 조회 및 임계값 경고 표시 E2E 테스트

- **Task 022: History/Audit API 및 데이터 연동**
  - 통합 이벤트 이력 조회 API (학습/배포/모델 등록/알림 등 모든 이벤트)
  - 실험 비교 API: 다중 run 파라미터/메트릭 비교 데이터 조회
  - 감사 로그 API: 주요 이벤트 기록 및 조회
  - History 페이지 더미 데이터를 실제 API로 교체
  - Playwright MCP로 이력 조회, 필터링, 실험 비교 E2E 테스트

### Phase 9: 통합 테스트 및 사용자 플로우 검증

> 전체 페이지 간 연동 및 사용자 시나리오 기반 E2E 테스트를 수행합니다.

- **Task 023: 핵심 사용자 플로우 통합 테스트** - 우선순위
  - Playwright MCP 전체 사용자 여정 테스트: 로그인 -> Overview 확인 -> 학습 요청 -> 파이프라인 모니터링 -> 평가 확인 -> 모델 등록 -> 배포
  - 실패 복구 플로우 테스트: 학습 실패 -> 알림 확인 -> 원인 파악 -> 재실행
  - 배포 롤백 플로우 테스트: 배포 -> 문제 감지 -> 롤백 실행 -> 이전 버전 확인
  - 에러 핸들링 테스트: 네트워크 오류, 인증 만료, 데이터 유효성 검증 실패
  - 크로스 페이지 네비게이션 검증: 모든 바로가기 링크 및 리디렉션 동작

- **Task 024: 반응형 디자인 및 접근성 검증**
  - 모바일 (375px), 태블릿 (768px), 데스크탑 (1280px+) 반응형 레이아웃 검증
  - 모바일 사이드바 햄버거 메뉴 동작 검증
  - 키보드 네비게이션 및 포커스 관리 검증
  - 다크 모드/라이트 모드 전환 시 UI 일관성 검증

### Phase 10: 성능 최적화 및 배포

> 프로덕션 배포를 위한 최적화 및 CI/CD를 구성합니다.

- **Task 025: 성능 최적화** - 우선순위
  - React Server Components 최적화: 클라이언트 컴포넌트 최소화
  - 데이터 페칭 최적화: 캐싱 전략 (revalidate, stale-while-revalidate)
  - Recharts 차트 컴포넌트 동적 임포트 (`next/dynamic`)
  - 이미지 및 정적 자산 최적화
  - Supabase 쿼리 최적화: 인덱스 추가, 불필요한 조인 제거
  - 번들 사이즈 분석 및 트리쉐이킹 확인

- **Task 026: CI/CD 파이프라인 및 Vercel 배포**
  - GitHub Actions CI 파이프라인: lint, type-check, build 자동화
  - Playwright E2E 테스트 CI 통합
  - Vercel 프로젝트 설정 및 환경 변수 구성
  - Preview 배포 (PR별 자동 배포) 설정
  - Production 배포 파이프라인 구성
  - 모니터링 및 에러 트래킹 설정 (Vercel Analytics)
