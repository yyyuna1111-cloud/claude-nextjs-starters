# CPU/GPU 통합 Jupyter 이미지
# base-notebook(CPU 기본 이미지) 위에 CUDA 빌드 PyTorch만 추가.
# GPU가 없는 노드에서도 정상 동작 (torch.cuda.is_available() == False로 떨어질 뿐 컨테이너는 그대로 구동됨)
FROM 10.70.170.227:80/jupyter/base-notebook:x86_64-python-3.11.6

USER root

RUN apt-get update && apt-get install -y --no-install-recommends \
        pciutils \
    && rm -rf /var/lib/apt/lists/*

USER ${NB_UID}

# CUDA 12.1 빌드 — wheel에 cuDNN/cuBLAS 등 런타임 라이브러리 포함, 호스트에 CUDA 툴킷 별도 설치 불필요
RUN pip install --no-cache-dir \
        torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121

USER root
