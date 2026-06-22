# LOIND WORKS — 원본 디자인 Firebase 연결본

남친이 만들던 원본 시각 디자인과 화면 구조를 유지하고 Firebase 기능만 연결한 버전입니다.

## 파일

- `index.html`: 원본 로그인·Contact 디자인 + Firebase Authentication
- `work.html`: 원본 Project Workspace 디자인 + Firestore/Storage
- `admin.html`: 동일한 디자인 계열의 관리자 페이지
- `assets/firebase.js`: Firebase 설정
- `assets/login.js`: 로그인
- `assets/work.js`: 프로젝트·댓글·파일·활동·참여자
- `assets/admin.js`: 프로젝트 및 회원 관리

## 사용 데이터

- `loindWorks_users`
- `loindWorks_projects`
- `loindWorks_projects/{projectId}/comments`
- `loindWorks_projects/{projectId}/files`
- `loindWorks_activity`
- Storage: `loind-works/projects/{projectId}/`

## 배포 전에 확인

1. Firebase Authentication의 Email/Password 활성화
2. 관리자 사용자 문서의 `role` 값이 `admin`
3. Firestore 보안 규칙 적용
4. Storage 보안 규칙 적용
5. GitHub Pages 승인 도메인 등록

`setup-admin.html`은 포함하지 않았습니다.
