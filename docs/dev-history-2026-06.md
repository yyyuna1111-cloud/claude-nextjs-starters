# MLOps Dashboard 개발 이력 (2026-06)

> 작업 기간: 2026-06-08 ~ 2026-06-11  
> 담당: 이승연

---

## 배포 이미지 버전 이력

| 버전 | 날짜 | 주요 내용 |
|------|------|-----------|
| v0.1.6 | 06-09 | NFS 스토리지 연동 최초 완성 |
| v0.1.7 | 06-10 | extra_pvcs 이중 래핑 버그 수정, Jupyter URL 외부 주소 수정 |
| v0.1.8 | 06-10 | Jupyter 서버 생성 Dialog UI, 서버명 유효성 검사 |
| v0.1.9 | 06-10 | Registry 이미지 업로드(.tar), Jupyter 이미지 Select 추가 |
| v0.1.10 | 06-10 | v0.1.9 버그픽스 재배포 (Select 빈 문자열 크래시) |
| v0.1.11 | 06-11 | Docker Push 가이드 다이얼로그 추가 (별도) |
| v0.1.12 | 06-11 | 이미지 등록 다이얼로그 통합 (tar 업로드 + Push 가이드 탭) |

---

## 구현 기능 목록

### 1. NFS 스토리지 연동 (bigdata-nas-3)

- **경로**: `bigdata-nas-3.wehago.com:/ifs/data/nfs/dev/sllm`
- **방식**: K8s Static PV/PVC (SeaweedFS 미사용, NFS 직결)
- **이유**: SeaweedFS는 자체 ingestion 파일만 서빙 가능 → 기존 raw NFS 파일 인식 불가
- **네임스페이스별 PV/PVC 생성** (PVC는 네임스페이스 스코프)
  - `datascience-storage`: Jupyter pod용
  - `mlops-dashboard`: 대시보드 API용 (`/mnt/sllm` 마운트)
- **Storage API 분기**: `bucket === 'shared-sllm'` → Node.js `fs` 모듈 직접 접근
- **PVC 식별 버그 수정**: Static PV는 `volumeName` 대신 PVC 이름을 bucket ID로 사용

관련 파일:
- `deploy/jupyterhub-storage/shared-sllm-pv-pvc.yaml`
- `deploy/mlops-dashboard/shared-sllm-pv-pvc.yaml`
- `src/app/api/storage/browse/route.ts`
- `src/app/api/storage/pvcs/route.ts`

---

### 2. Jupyter 마운트 스토리지 선택

- 서버 생성 시 `shared-sllm` 체크박스로 마운트 여부 선택
- KubeSpawner `pre_spawn_hook`에서 `spawner.user_options.extra_pvcs` 처리
- 마운트 경로: `/home/jovyan/shared-sllm`

**핵심 버그 및 수정**:
```
잘못된 방식: POST body = { user_options: { extra_pvcs: [...] } }
→ spawner.user_options = { user_options: { extra_pvcs: [...] } }  ← hook이 못 찾음

올바른 방식: POST body = { extra_pvcs: [...] }
→ spawner.user_options = { extra_pvcs: [...] }  ← 정상
```

JupyterHub API는 POST body 전체를 `spawner.user_options`로 저장하는 구조.

관련 파일:
- `src/app/api/jupyter/servers/route.ts`
- `deploy/jupyterhub-storage/values.yaml` (pre_spawn_hook)

---

### 3. Jupyter 서버 생성 UI 개선

- 인라인 폼 → Dialog 팝업으로 교체
- 서버명 유효성 검사: `/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/`
  - 한글·특수문자 입력 시 실시간 에러 표시
  - K8s 레이블 규칙 준수
- 스토리지 섹션: 개인(기본, 비활성) + shared-sllm 체크박스

관련 파일:
- `src/app/dashboard/jupyter/page.tsx`

---

### 4. NFS 파일 권한 (참고)

- NFS `root_squash`: Jupyter `jovyan(uid 1000)` → "others" 권한만 보유
- 임시 해결: `chmod 777 -R /nas_folders/sllm/{username}` (NFS 서버에서 실행)
- 장기 방안: 디렉터리별 소유권 분리 또는 읽기 전용 마운트 검토 필요

---

### 5. Registry 이미지 등록

**tar 파일 업로드**
- 로컬에서 `docker save image:tag -o image.tar` 생성 후 대시보드 UI로 업로드
- 대시보드 pod에서 `skopeo`로 private registry에 push
- 클라이언트에서 insecure registry 설정 불필요
- Dockerfile에 `apk add --no-cache skopeo` 추가

**Docker Push 가이드**
- insecure registry 등록 방법 (Docker Desktop / Linux)
- Docker Desktop 설정 스크린샷 포함 (`public/docker-insecure-registry-guide.png`)

**Jupyter 이미지 선택**
- `jupyter/` 접두사로 registry에 업로드된 이미지 → Jupyter 서버 생성 시 드롭다운 자동 표시
- 목록에 없으면 "직접 입력" 모드로 전환 가능

관련 파일:
- `src/app/api/registry/upload/route.ts` (신규)
- `src/app/api/registry/jupyter-images/route.ts` (신규)
- `src/app/dashboard/registry/page.tsx`
- `src/app/dashboard/jupyter/page.tsx`
- `Dockerfile`

---

## 인프라 정보

### Private Registry
- 주소: `10.70.170.227:80`
- 구성: nginx(80) → docker registry 컨테이너(5000)
- nginx 설정: `proxy_buffering off`, `proxy_request_buffering off`, `proxy_read_timeout 900`, `client_max_body_size 0`
- nginx 버전: 1.10.3 (오래됨, `proxy_socket_keepalive` 미지원)
- **docker push EOF 이슈**: 대용량 이미지 push 시 중간 네트워크 장비 TCP 타임아웃으로 끊김 현상 있음. 근본 해결은 nginx 업그레이드 또는 네트워크 담당자에게 방화벽 TCP timeout 설정 요청 필요.

### JupyterHub
- Helm chart: jupyterhub 3.3.8
- 네임스페이스: `datascience-storage`
- 서비스: `http://10.70.170.177:30900` (외부 접근용)
- 내부 URL: `JUPYTERHUB_URL` (API 호출용)
- 외부 URL: `NEXT_PUBLIC_JUPYTERHUB_URL` (브라우저 링크용)

### 배포 방식
- ArgoCD GitOps: `master` 브랜치 감시
- 이미지 빌드: `docker buildx build --platform linux/amd64`
- buildx 설정: `~/.config/buildkit/buildkitd.toml` (insecure registry 허용)
- **주의**: 버그픽스도 반드시 이미지 태그 올리고 `deployment.yaml` 수정해야 ArgoCD가 감지

---

## 환경변수 (configmap)

| 변수 | 설명 |
|------|------|
| `JUPYTERHUB_URL` | JupyterHub 내부 API URL |
| `NEXT_PUBLIC_JUPYTERHUB_URL` | 브라우저에서 접근 가능한 JupyterHub URL |
| `JUPYTERHUB_TOKEN` | JupyterHub admin API 토큰 |
| `DOCKER_REGISTRY_URL` | registry HTTP URL (API 호출용) |
| `NEXT_PUBLIC_REGISTRY_HOST` | registry 호스트:포트 (UI 표시용) |
| `JUPYTER_IMAGE_PREFIX` | Jupyter 이미지 접두사 (기본값: `jupyter`) |
