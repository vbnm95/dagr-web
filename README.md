# DAGR Web App

**논문 기반 단백질 구조 분석 웹 애플리케이션**  
DAGR 논문에서 제안된 rigid domain / hinge 분석 아이디어를  
웹에서 직접 실행하고 결과를 확인할 수 있도록 구현한 포트폴리오 프로젝트입니다.

---

## 📘 Based on Paper

본 프로젝트는 아래 논문을 기반으로 제작되었습니다.

> Sim, J., Sim, J., Park, E., & Lee, J. (2015).  
> *Method for identification of rigid domains and hinge residues in proteins based on exhaustive enumeration.*  
> *Proteins: Structure, Function, and Bioinformatics, 83(6), 1054-1067.*

논문에서 제안한 분석 흐름을 바탕으로,  
사용자가 예제 단백질 구조를 바로 실행하거나 직접 PDB 파일을 업로드해  
분석 결과를 웹에서 확인할 수 있도록 구현했습니다.

---

## 🧬 Project Overview

DAGR Web App은 단백질 구조 분석 과정을  
웹에서 바로 실행하고 결과를 확인할 수 있도록 만든 프로젝트입니다.

기존에는 분석 코드와 입력 파일을 직접 다뤄야 했다면,  
이 프로젝트에서는 다음과 같은 흐름으로 보다 쉽게 사용할 수 있습니다.

- 논문 예제를 업로드 없이 바로 실행
- 사용자 PDB 파일 업로드 후 분석 수행
- 2D / 3D 결과 시각화 확인
- JSON 결과 및 메타데이터 확인
- 논문 소개 페이지를 통한 분석 배경 이해

즉, **논문 기반 분석 로직을 웹 UX로 정리하고 배포까지 마무리한 프로젝트**입니다.

---

## 🚀 Live Demo

- **Web App**  
  https://dagr-web.vercel.app

- **API Server**  
  https://dagr-api.onrender.com

---

## 🔍 Main Features

### 1. 논문 예제 즉시 실행
처음 접속한 사용자도 바로 결과를 확인할 수 있도록  
논문 예제 구조를 기본값으로 제공합니다.

- Structure A: `1TJY`
- Structure B: `1TM2`
- Chain A / B: `A / A`

파일 업로드 없이 바로 `Run DAGR`를 눌러 실행할 수 있습니다.

### 2. 사용자 PDB 업로드 분석
예제 실행뿐 아니라,  
직접 업로드한 단백질 구조 파일(PDB) 기준으로도 분석할 수 있습니다.

### 3. 실행 안정성 보강
데모 환경에서도 최대한 안정적으로 실행되도록 다음 요소를 반영했습니다.

- frontend / backend 양쪽 chain 입력 검증
- 45초 이상 실행 시 장시간 실행 안내문 표시
- backend 60초 timeout 적용
- exact 방식 조합 수 초과 시 친절한 오류 메시지 제공

### 4. 결과 페이지 UX 정리
결과 화면에서는 아래 내용을 한 번에 확인할 수 있습니다.

- Coverage / Overlap / Hinge Count 등 요약 지표
- 2D overlap view
- 3D comparison view
- JSON 결과 보기
- 자동 삭제 / 만료 안내

### 5. 논문 소개 페이지 제공
메인 화면에서 논문 소개 페이지로 이동할 수 있도록 구성하여,  
방문자가 분석 방법의 배경을 먼저 이해한 뒤 앱을 실행할 수 있게 했습니다.

---

## 🛠 Tech Stack

### Frontend
- Next.js (App Router)
- TypeScript
- Tailwind CSS

### Backend
- FastAPI
- Python
- subprocess 기반 분석 스크립트 실행

### Data / Bioinformatics
- NumPy
- Biopython
- PDB 파일 기반 단백질 구조 처리

### Deployment
- Vercel (Frontend)
- Render (Backend)

### Development Tools
- VS Code
- Git
- GitHub

---

## 📂 Project Structure

```text
dagr-web/
├─ api/         # FastAPI 백엔드
└─ web/         # Next.js 프론트엔드