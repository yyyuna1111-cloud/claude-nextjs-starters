# NFS 스토리지 연동 + Jupyter 마운트 선택 구현 정리

> 구현 기간: 2026-06-08 ~ 2026-06-10  
> 배포 버전: v0.1.4 → v0.1.8

---

## 개요

`bigdata-nas-3.wehago.com:/ifs/data/nfs/dev/sllm` NAS를 MLOps 대시보드 Storage 페이지에 표시하고, Jupyter 노트북 서버 생성 시 해당 스토리지를 선택적으로 마운트할 수 있도록 구현.

---

## 1. Kubernetes — 스토리지 계층

### Static PV/PVC (NFS)

- `PersistentVolume` — `storageClassName: ""` (동적 프로비저닝 없이 수동 생성)
- `PersistentVolumeClaim` — `volumeName`으로 특정 PV에 고정 바인딩
- NFS 접근: `nfs.server` + `nfs.path` 직접 지정
- `accessModes: ReadWriteMany` — 여러 pod이 동시 마운트 가능

### 네임스페이스 스코프 문제

PVC는 네임스페이스에 귀속되므로 같은 NFS 경로라도 네임스페이스별로 별도 PV+PVC 필요.

```
datascience-storage  →  shared-sllm-nfs (PV) + shared-sllm (PVC)   # Jupyter pod용
mlops-dashboard      →  shared-sllm-nfs-dashboard (PV) + shared-sllm (PVC)  # 대시보드 API용
```

### Deployment volumeMount

`mlops-dashboard` pod에 `/mnt/sllm` 마운트 추가 → Next.js API 서버가 NFS 파일시스템에 직접 접근 가능.

```yaml
volumeMounts:
  - name: sllm-storage
    mountPath: /mnt/sllm
volumes:
  - name: sllm-storage
    persistentVolumeClaim:
      claimName: shared-sllm
```

---

## 2. JupyterHub — 동적 볼륨 마운트

### Helm Chart (jupyterhub 3.3.8)

- 인터넷 없는 환경: `.tgz` 로컬 파일로 `helm upgrade` 실행
- `values.yaml`의 `hub.extraConfig`에 Python 코드 직접 삽입

### KubeSpawner `pre_spawn_hook`

Jupyter 서버 시작 직전에 실행되는 Python async 함수. `spawner.volumes`와 `spawner.volume_mounts`를 동적으로 추가해 pod spec을 수정한다.

```python
EXTRA_PVC_MOUNTS = {
    "shared-sllm": "/home/jovyan/shared-sllm",
}

async def pre_spawn_hook(spawner):
    extra_pvcs = spawner.user_options.get("extra_pvcs", [])
    for pvc_name in extra_pvcs:
        if pvc_name in EXTRA_PVC_MOUNTS:
            spawner.volumes.append({
                "name": pvc_name,
                "persistentVolumeClaim": {"claimName": pvc_name}
            })
            spawner.volume_mounts.append({
                "name": pvc_name,
                "mountPath": EXTRA_PVC_MOUNTS[pvc_name]
            })

c.KubeSpawner.pre_spawn_hook = pre_spawn_hook
```

### 핵심 디버깅 포인트 (삽질 원인)

JupyterHub API는 POST body **전체**를 `spawner.user_options`로 저장한다.

```
# 잘못된 구조 (이중 래핑)
POST body: { user_options: { extra_pvcs: ["shared-sllm"] } }
→ spawner.user_options = { user_options: { extra_pvcs: [...] } }
→ hook에서 get("extra_pvcs") = []  ← 마운트 안 됨

# 올바른 구조
POST body: { extra_pvcs: ["shared-sllm"] }
→ spawner.user_options = { extra_pvcs: ["shared-sllm"] }
→ hook에서 get("extra_pvcs") = ["shared-sllm"]  ← 정상
```

확인 방법: `kubectl cp`로 디버그 스크립트를 hub pod에 복사 후 `kubectl exec`로 실행.

```python
# debug_hub.py
import urllib.request, json
req = urllib.request.Request(
    'http://localhost:8081/hub/api/users/{username}',
    headers={'Authorization': 'token {token}'}
)
data = json.loads(urllib.request.urlopen(req).read())
for name, s in data.get('servers', {}).items():
    print(name, s.get('user_options'))
```

---

## 3. Next.js API Routes — 파일 접근 계층

### Node.js `fs` 모듈 (NFS 직접 접근)

기존 SeaweedFS Filer API 호출 방식과 분기 처리.

```typescript
// src/app/api/storage/browse/route.ts
if (bucket === 'shared-sllm') {
  // Node.js fs 모듈로 /mnt/sllm 직접 접근
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
} else {
  // SeaweedFS Filer API 호출
  const res = await fetch(`${FILER_URL}/${bucket}/...`)
}
```

적용 API: `browse` / `upload` / `download` / `delete`

### Path Traversal 방지

```typescript
function safePath(base: string, userInput: string): string {
  const resolved = path.resolve(base, userInput)
  if (!resolved.startsWith(base)) throw new Error('Invalid path')
  return resolved
}
```

### PVC 식별 버그 수정

Static PV(`storageClass: ""`)는 `pvc.spec.volumeName`이 PV 이름(`shared-sllm-nfs`)으로 설정되어 bucket ID로 쓰면 불일치 발생.

```typescript
// src/app/api/storage/pvcs/route.ts
const volumeName = storageClass === ''
  ? name          // static PV → PVC 이름을 bucket ID로 사용
  : (pvc.spec?.volumeName || pvcToBucket[name] || '')
```

---

## 4. 권한 관리 — NFS root_squash

| 항목 | 내용 |
|------|------|
| NFS 옵션 | `root_squash` — root 접근을 `nobody(uid 65534)`로 매핑 |
| Jupyter 사용자 | `jovyan(uid 1000)` → NFS에서 "others" 권한만 보유 |
| 임시 해결 | NFS 서버에서 `chmod 777 -R /nas_folders/sllm/{username}` |
| 장기 방안 | 공유 스토리지 읽기 전용 마운트 or 디렉터리별 소유권 분리 |

---

## 5. 프론트엔드 — UI

### Jupyter 서버 생성 Dialog

- 기존 인라인 카드 폼 → shadcn/ui `Dialog` 컴포넌트로 교체
- 서버명 유효성 검사 (K8s 레이블 규칙 준수)

```typescript
const SERVER_NAME_REGEX = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/
// 영소문자, 숫자, 하이픈만 허용 / 영소문자·숫자로 시작·끝
```

- 스토리지 선택: `Checkbox`로 개인 스토리지(기본, 비활성) + shared-sllm 선택

---

## 6. 배포 파이프라인

| 단계 | 도구 |
|------|------|
| 로컬 빌드 | `docker buildx build --platform linux/amd64` |
| 이미지 저장소 | Private registry `10.70.170.227:80` |
| GitOps | ArgoCD — `master` 브랜치 감시, `deployment.yaml` 이미지 태그 변경 감지 후 자동 배포 |
| 배포 트리거 | GitLab MR → master 머지 → ArgoCD 자동 sync |

### 이미지 버전 이력

| 버전 | 주요 변경 |
|------|-----------|
| v0.1.4 | NFS Static PV/PVC 생성, Storage API 분기 처리 초기 |
| v0.1.5 | Storage API 분기 완성, PVC 식별 버그 수정 |
| v0.1.6 | 최초 완전 동작 버전 |
| v0.1.7 | extra_pvcs 이중 래핑 버그 수정, JupyterHub hook 수정, Jupyter URL 외부 주소로 변경 |
| v0.1.8 | Jupyter 서버 생성 Dialog UI, 서버명 유효성 검사 |

---

## 7. 기술 스택 요약

| 영역 | 기술 |
|------|------|
| 스토리지 연동 | Kubernetes NFS Static PV/PVC, ReadWriteMany |
| Jupyter 동적 마운트 | KubeSpawner `pre_spawn_hook`, `user_options` |
| 파일 API | Node.js `fs` 모듈 (NFS 직접 접근) |
| 기존 스토리지 API | SeaweedFS Filer HTTP API |
| UI 컴포넌트 | shadcn/ui Dialog, Checkbox, Radix UI |
| 배포 | Docker buildx (linux/amd64), ArgoCD GitOps |
| 디버깅 | `kubectl cp` + Python 스크립트, `kubectl describe pod` |
| 헬름 차트 | JupyterHub 3.3.8 (로컬 `.tgz` 설치, 인터넷 없는 환경) |
