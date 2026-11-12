# 씨앗도둑 | 스토리보드 공동 리뷰

LEEOLAB AI 드라마 스토리보드의 컷별 리뷰·승인 페이지입니다. 기존 2~3화 데이터와 화면 구조를 보존했습니다.

## 현재 구현
- 2~3화 컷별 보기, 전체 보기, 대사·카메라·연출·시점 태그 편집
- 컷별 승인/수정 요청/상태 표시, 이전 그림 비교, 수정 목록 복사
- 기본은 로컬 저장. **Supabase 연결 전에는 절대 팀 실시간 공유가 되지 않습니다.**
- Supabase 연결 후 이메일 OTP 로그인, 멤버십/RLS에 따른 컷별 변경 실시간 동기화
- GitHub Actions 기반 Pages 배포 워크플로

## 1. 웹사이트 배포
GitHub 저장소 > **Settings > Pages > Build and deployment > Source: GitHub Actions** 를 선택합니다.
그 후 Actions에서 **Publish storyboard review to GitHub Pages** 워크플로를 실행하거나 main에 푸시합니다.
사이트 주소: https://leeolabkorea.github.io/seed-thief-storyboard/

참고: Pages 사이트는 **공개 URL**입니다. 이 저장소 역시 현재 public이며, index.html 안에 2~3화 대사와 연출 메모가 포함되어 있습니다. 비공개 원고라면 Pages로 공개하기 전에 호스팅 및 보안 전략을 재검토하세요. Supabase RLS는 DB 내용을 보호하지만 공개된 HTML에 들어 있는 대본은 보호하지 않습니다.

## 2. 팀원 간 실시간 동기화 설정
1. Supabase에 새 프로젝트를 만듭니다.
2. SQL Editor에서 `supabase/schema.sql` 전체를 실행합니다.
3. Supabase > Authentication > Providers에서 Email OTP를 활성화하고, **URL Configuration > Site URL 및 Redirect URLs**에 위 Pages 주소를 넣습니다.
4. Supabase > Project Settings / API Keys에서 **Project URL**과 **publishable/anon key**를 확인합니다. `service_role` / secret 키는 절대 올리지 않습니다.
5. 루트 `config.js`의 `url`, `anonKey`를 입력합니다.
6. 웹사이트를 새로고침하고 감독 이메일로 로그인 링크를 받습니다. 로그인 후 첫 화면에서 팀 권한이 없다는 메시지가 표시되는 것은 정상입니다.
7. Supabase SQL Editor에서 로그인된 감독의 이메일로 다음을 실행합니다.

```sql
insert into public.board_members(user_id, role)
select id, 'owner' from auth.users where email = 'YOUR_EMAIL@example.com'
on conflict (user_id) do update set role = excluded.role;
```

8. 팀원도 이메일로 한 번 로그인한 뒤 같은 쿼리에서 역할을 `editor` 또는 `viewer`로 바꾸어 등록합니다. 반영 후 페이지를 새로고침합니다.

**권한**: owner/editor는 컷 수정·승인, viewer는 조회만 가능합니다. DB 행 수준 보안(RLS)이 강제합니다. 팀원 간 동시 편집은 서로 다른 필드면 JSON 병합으로 보존합니다. **같은 필드를 동시에 고칠 때는 나중에 저장한 값이 우선**이므로 동시 수정 조율이 필요합니다.

## 3. 이미지 폴더
이미지들은 HTML에 포함되지 않습니다. `p/2-1-1.jpg`, `p/2-1-2.jpg` 등의 16:9 JPG를 넣으세요. 원본 이미지가 없어 현재는 '이미지 준비 중' 안내 화면이 표시됩니다. 완료된 이미지를 업로드하면 그대로 보입니다.
이미지를 이력과 함께 관리할 계획이라면 Supabase Storage로 이전하거나 버전 파일명을 쓰는 편이 안전합니다.

## 4. 이후 확장
- 새 회차 데이터는 현재 HTML 안의 `DATA`에서 분리해 JSON으로 관리
- 프롬프트·생성 이미지 업로드/버전 기록
- 리뷰 요청을 감지하는 별도 AI 작업 서버/스케줄러. **현재는 미구현이며, 요청 버튼만 누른다고 AI 그림이 자동 생성되지는 않습니다.**
- 팀별 프로젝트/회차 권한 및 댓글 이력 고도화

## 보안
GitHub Pages는 배포용이며 로그인된 팀원의 실제 상태는 Supabase에 저장합니다. 정적 HTML 속 컷·대사는 공용 공개 저장소에 들어 있으므로, 원고 전체를 보호하려면 데이터를 인증된 DB에서만 읽도록 코드 구조를 추가로 변경해야 합니다. `config.js`에는 공개용 키 외의 비밀번호/비밀 키를 입력하지 마세요.
