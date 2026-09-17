# 배포와 접근 범위

## Decisions

- Vercel(Hobby 요금제)에 배포합니다. 별도 서버나 컨테이너 호스팅으로 옮기지 않습니다.
- 아는 사람만 씁니다. 로그인 없이 인터넷에 공개하지 않습니다.
- 로그인은 계정 없이 공유 비밀번호 하나로 합니다. 아이디·가입·비밀번호 재설정을 두지 않습니다.
- 완성된 동영상 파일은 함수가 직접 응답으로 돌려주지 않고 Vercel Blob에 올린 뒤, 그 다운로드 주소만 응답으로 돌려줍니다. 실제 파일 바이트는 함수를 거치지 않고 브라우저가 Blob에서 직접 받습니다.
- `yt-dlp`와 `ffmpeg`는 정적 바이너리로 프로젝트에 포함해 배포합니다([video-extraction](video-extraction.md)). `ffmpeg`는 처음에는 `ffmpeg-static` 패키지의 설치 스크립트가 받아오는 바이너리를 그대로 썼지만, 배포 캐시 상태에 따라 그 스크립트가 실행되지 않을 수 있다는 게 실제로 확인되어(아래 Evidence) `bin/ffmpeg`로 직접 커밋하는 방식으로 바꿨습니다. `bin/yt-dlp`와 같은 방식입니다.
- 저장 폴더 지정, 최근 폴더, 폴더 열기는 다루지 않습니다. 다운로드는 브라우저 자체 다운로드 기능으로 충분합니다.

## Boundaries

- 여러 사람이 로그인 없이 동시에 접근하는 형태는 이 결정이 다루지 않습니다. 공개 범위를 넓히려면 이 결정을 다시 정해야 합니다.
- 하나의 공유 비밀번호이므로 누가 언제 무엇을 받았는지 사용자별로 구분하지 않습니다. 개인별 사용 기록이 필요해지면 이 결정을 다시 정해야 합니다.
- 결제나 사용량 과금은 다루지 않습니다.

## Why

로컬 PC에서 실행하던 도구가 웹으로 배포되면서 "사용자가 권리를 갖는 콘텐츠만 받는다"는 전제를 운영자가 강제할 방법이 사라집니다. 불특정 다수가 익명으로 쓰게 하면 이 서비스는 사실상 공개 다운로드 사이트가 되어 저작권 분쟁의 당사자가 운영자가 됩니다. 아는 사람만으로 범위를 좁히면 이 전제를 계속 지킬 수 있습니다.

계정 시스템은 이 규모에 비해 과합니다. 회원가입·비밀번호 재설정·이메일 인증까지 만들 이유가 없고, 공유 비밀번호 하나로 접근 자체를 막는 것으로 목적을 달성합니다.

Vercel을 그대로 쓰기로 한 이유는 이미 이 저장소가 Vercel과 연동되어 있고, 실측 결과 Hobby 요금제도 Fluid Compute가 기본 적용되어 함수 실행 시간이 300초까지 허용되기 때문입니다([Evidence](#evidence-worth-preserving) 참고). 대신 응답 본문 크기가 4.5MB로 고정되어 있어, 완성된 동영상을 함수 응답으로 그대로 돌려주는 방식은 아주 짧은 저화질 클립을 빼면 전부 실패합니다. 파일을 Blob에 올리고 주소만 돌려주면 실제 바이트가 함수를 거치지 않으므로 이 제한과 무관해집니다.

## Reconsider when

- 로그인 없는 공개 접근이 실제로 필요해질 때 (익명 다수 대상 서비스로 범위가 넓어지는 결정이 먼저 필요합니다)
- 사용자별 기록·권한 구분이 필요해질 때 (공유 비밀번호로는 불가능합니다)
- Vercel Hobby의 300초 실행 제한이나 4.5MB 응답 제한이 실제 사용에서 반복적으로 발목을 잡을 때
- 함수 번들 크기(정적 바이너리 포함 250MB) 제한에 실제로 부딪힐 때

## Still-rejected alternatives

- Docker 컨테이너(Railway·Fly.io 등)로 이전 — 처음에는 이 방향으로 진행하다가, 이미 연동된 Vercel을 유지하고 싶다는 요청으로 되돌렸습니다. 실행 시간 제한이 없다는 장점은 있지만, 별도 인프라 구성·비용·운영 부담이 새로 생깁니다. Vercel의 제한이 반복적으로 문제가 되면 재검토합니다.
- 함수가 파일 바이트를 직접 스트리밍 응답으로 돌려주는 방식 — Vercel 문서상 응답 본문 4.5MB 제한에 스트리밍 응답도 포함되어, 정상 크기의 동영상에서는 거의 항상 실패합니다.
- 로그인 없는 완전 공개 — 저작권 남용 규모가 통제 불가능해지고 운영자가 그 책임을 직접 집니다.
- 개별 계정(회원가입) — 이 규모(아는 사람만)에 비해 구현·운영 부담이 과합니다. 사용자별 구분이 실제로 필요해지면 재검토합니다.

## Evidence worth preserving

- Vercel 공식 문서(`functions/configuring-functions/duration`, `functions/limitations`, 2026-09 기준) 확인 결과:
  - Hobby 요금제는 Fluid Compute가 기본 적용되어 있고, 이때 `maxDuration`은 기본값과 최댓값이 모두 300초(5분)입니다.
  - 함수의 요청/응답 본문은 요금제와 무관하게 **4.5MB**로 고정되어 있고, 초과 시 `413 FUNCTION_PAYLOAD_TOO_LARGE`가 발생합니다. 스트리밍 응답도 이 제한에 포함됩니다.
  - 함수 배포 번들은 압축 해제 기준 250MB(Node), Python 함수는 500MB까지 허용됩니다.
  - Edge 런타임은 응답을 25초 안에 시작해야 하고, 이후 최대 300초까지 스트리밍을 이어갈 수 있습니다.
- `ffmpeg-static` 패키지는 `path.join(__dirname, ...)`으로 자신이 내려받은 바이너리 경로를 찾습니다. Next.js가 이 패키지를 기본값대로 서버 번들에 포함시키면 `__dirname`이 실제 경로가 아니라 `\ROOT\node_modules\ffmpeg-static` 같은 자리표시자로 치환됩니다. `yt-dlp`는 이 잘못된 경로를 받고도 즉시 실패하지 않고 `WARNING: ffmpeg-location ... does not exist! Continuing without ffmpeg`라는 경고만 남긴 뒤, 영상과 소리를 합치지 않은 채 `exit 0`으로 끝납니다. 그 결과 `--print after_move:filepath`가 가리키는 합쳐진 파일은 존재하지 않고, 분리된 `.f<id>.mp4`/`.f<id>.webm` 조각만 남습니다. `next.config.ts`의 `serverExternalPackages: ["ffmpeg-static"]`로 이 패키지를 번들링에서 제외해(순수 Node `require`로 남겨) 해결했습니다. 같은 문제가 다시 나타나면 이 항목부터 의심합니다.
- 위 번들링 문제를 고친 뒤에도 실제 Vercel 배포에서 같은 증상(`ENOENT: no such file or directory, stat '/tmp/vdl-.../....mp4'`)이 재발했습니다. 원인은 별도였습니다: 이 프로젝트는 `bun`을 쓰는데, `bun install`은 `package.json`의 `trustedDependencies`에 없는 패키지의 설치 스크립트(postinstall 등)를 기본적으로 실행하지 않습니다. `ffmpeg-static`의 실제 바이너리 다운로드는 그 설치 스크립트(`install.js`)가 하므로, 신뢰 목록에 없으면 `node_modules/ffmpeg-static`에 JS 파일만 설치되고 바이너리는 아예 받아지지 않습니다. 로컬 개발 환경은 이전에 `npm install`로 한 번 받아둔 바이너리가 우연히 남아 있어 문제를 가리고 있었지만, Vercel의 새 빌드는 매번 처음부터 설치하므로 바이너리가 없는 채로 배포됐습니다. `package.json`의 `trustedDependencies`에 `ffmpeg-static`을 추가해(바이너리 없이 완전히 새로 `bun install`한 뒤 실제로 다시 받아지는 것을 확인) 해결했습니다. 같은 방식으로 바이너리를 내려받는 패키지를 새로 추가할 때는 이 신뢰 목록부터 확인합니다.
- `trustedDependencies` 수정이 `main`에 병합·배포된 뒤에도, 실제 배포(`https://project-1-eta-hazel.vercel.app/`)에서 정확히 같은 `ENOENT` 증상이 다시 재현됐습니다. 배포 로그(`vercel inspect --logs`)를 보면 그 빌드가 "Restored build cache from previous deployment" 뒤 `bun install`에서 "Checked N installs across M packages (no changes)"로 끝났습니다 — 즉 캐시된 `node_modules`를 그대로 재사용해 설치 스크립트 자체가 다시 실행되지 않았을 가능성이 높습니다. 로컬에서 했던 검증(바이너리 없이 완전히 새로 `bun install`)은 캐시가 없는 환경이라 통과했지만, Vercel의 웜 빌드 캐시에서는 같은 보장이 서지 않는다는 뜻입니다. 즉 `trustedDependencies` 수정만으로는 캐시 상태에 따라 다시 깨질 수 있어 근본 해결로 보기 어렵습니다. 그래서 `ffmpeg`도 `yt-dlp`와 같은 방식으로 바꿨습니다: 정적 Linux 바이너리를 `bin/ffmpeg`에 직접 커밋하고, `resolveTools()`가 리눅스(비-Windows)에서는 `ffmpeg-static` 패키지의 설치 스크립트 결과를 아예 거치지 않고 이 커밋된 바이너리를 바로 쓰도록 했습니다. 설치 스크립트·트러스트 목록·빌드 캐시 어느 쪽이 문제였는지와 무관하게 재발할 수 없는 구조입니다.
- 위 두 가지를 고친 뒤 실제 프로덕션에서 전체 흐름(로그인 → 추출 → 다운로드)을 처음으로 끝까지 테스트하자 새로운 오류가 나왔습니다: `Vercel Blob: Cannot use public access on a private store. The store is configured with private access.` 프로젝트에 연결돼 있던 Blob 스토어가 `private` 접근 모드로 만들어져 있었는데, `uploadForDownload`는 항상 `access: "public"`으로 업로드를 시도했기 때문입니다. Vercel Blob 스토어의 접근 모드(`public`/`private`)는 **생성 시에만 정해지고 이후 변경할 수 없습니다** (`vercel blob create-store --access <public|private>`, 별도의 update 명령 없음). 그래서 `public` 모드로 새 스토어를 만들어 프로젝트에 연결하고, 기존 `private` 스토어는 삭제했습니다. 이 프로젝트의 설계(파일 바이트를 함수가 아니라 브라우저가 Blob에서 직접 받는 방식)는 애초에 `public` 접근을 전제하므로, Blob 스토어를 새로 만들 때는 반드시 `--access public`을 명시해야 합니다. 또한 이런 환경변수(`BLOB_READ_WRITE_TOKEN`) 변경은 이미 떠 있는 배포에는 즉시 반영되지 않고, 재배포해야 새 값을 읽습니다.
