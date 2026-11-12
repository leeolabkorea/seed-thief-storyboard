# 씨앗도둑 스토리보드 — 이미지 운영 규칙

## 구성
- **Google Drive 원본 보관소:** [씨앗 도둑 스토리 보드 / 4화](https://drive.google.com/drive/folders/12PoZW_1wM5xUH4UXrFLGLSBXYSm20Som)
  - [원본_이미지](https://drive.google.com/drive/folders/101s0kI3euorIaW0Tqu1tQmdJfJpG_j-P): 생성된 고해상도 원본 파일
  - [수정_이력](https://drive.google.com/drive/folders/1qDQWFKrBGXw-2UHiu23Vr-7VzJUE20ed): 이전 버전 보관
  - 기존 4화 38컷 프롬프트 문서는 원본 위치 그대로 유지합니다.
- **Supabase Storage:** 비공개 버킷 `storyboard-images`; 웹사이트에서 JPG/PNG/WebP (컷당 최대 10MB) 업로드
- **GitHub Pages:** 이미지 원본을 GitHub에 넣지 않고 컷 데이터/리뷰 UI만 배포합니다.
- **Supabase DB:** `board_cuts`에는 `img`와 `prevImg`를 `storage:episode-4/<컷ID>/<파일명>` 형식으로 저장합니다.

## 페이지에서 이미지 등록
1. 감독/편집자로 로그인
2. 검토할 컷 선택
3. **그림 업로드** 버튼 → JPG/PNG/WebP 선택
4. 업로드 완료 후 Supabase DB에 해당 컷과 이미지 경로가 등록되고 팀원에게 반영됩니다.
5. 교체 업로드 시 직전 이미지의 경로는 `prevImg`에 보존되어 비교할 수 있습니다.

**중요:** Drive에 새 이미지를 넣는 것과 웹사이트에 업로드하는 것은 현재 **서로 별개 작업**입니다. Drive → Supabase 자동 동기화는 아직 구현되지 않았습니다. Drive에는 원본, Supabase에는 검토용 파일을 각각 관리합니다.

## 4화 컷 데이터
- 원문: Google Drive `4화_스토리보드_프롬프트_모음.md`
- 컷 목록: 4-1 15컷, 4-2 15컷, 4-3 3컷, 4-4 5컷 = 총 38컷
- 프롬프트 원문은 `episodes/episode-4-prompts.json`에서 확인합니다.
- 이전 2–3화 컷 데이터는 `episodes/episode-2-3-data.json`에 보관했습니다.

## 주의
- Supabase 버킷은 비공개이고, 팀원(로그인 사용자 중 등록된 멤버)만 이미지를 열 수 있습니다.
- GitHub 저장소는 현재 Public입니다. **HTML에 포함된 4화 장면/행동 설명과 prompts JSON은 외부에서 볼 수 있습니다.** 비공개 시나리오가 필요하면 향후 데이터도 DB로 이동하고 배포 구조를 조정해야 합니다.
- 이전 그림을 여러 단계 깊이로 자동 보관하는 히스토리 UI는 아직 없습니다. Drive의 수정_이력 폴더로 원본을 별도 보관하세요.
