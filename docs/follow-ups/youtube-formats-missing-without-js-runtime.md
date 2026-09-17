# JS 런타임이 없어 유튜브 화질 목록이 불완전하다

**Symptom**: `yt-dlp`가 유튜브에서 화질 목록을 가져올 때 n-challenge를 풀지 못하고, 받을 수 있는 화질 일부가 목록에서 빠집니다. 추출이 완전히 실패하지는 않아 겉으로는 정상으로 보입니다.

**Observed evidence**: Windows 11에서 `yt-dlp 2026.08.19`로 `https://www.youtube.com/watch?v=aqz-KE-bpKQ`를 조회할 때 두 경고가 나왔습니다.

```
WARNING: [youtube] No supported JavaScript runtime could be found. Only deno is enabled
by default; to use another runtime add --js-runtimes RUNTIME[:PATH] to your command/config.
YouTube extraction without a JS runtime has been deprecated, and some formats may be missing.
WARNING: [youtube] aqz-KE-bpKQ: n challenge solving failed: Some formats may be missing.
```

같은 환경에서 `player_client`를 하나로 고정하면 상황이 더 나빠집니다. `mweb`은 `GVS PO Token` 요구로 사용할 수 있는 포맷이 0개가 되고, `web`·`tv`·`tv_simply`·`ios`·`web_safari`·`web_embedded`는 모두 exit 1로 실패했습니다. `android_vr`만 성공했으나 포맷 5개에 최대 360p, 영상·소리 병합 포맷은 0개였습니다. 클라이언트를 지정하지 않은 기본 폴백 체인만 4K(`401+251`)를 가져왔습니다.

**Suspected cause**: `yt-dlp 2026.08.19`는 유튜브의 n-challenge를 풀기 위해 JavaScript 런타임(기본값 `deno`)을 필요로 하는데 이 PC에 설치되어 있지 않습니다. 런타임이 없으면 서명 해독이 필요한 포맷이 목록에서 제외되는 것으로 보입니다.

**What was tried**: 런타임을 설치하지 않기로 했습니다. 대신 사용자에게 목록이 불완전할 수 있다는 사실을 화면에서 알리는 방향으로 범위를 정했습니다. 이 선택은 안내만 정확하게 만들 뿐, 빠진 화질을 되살리지는 못합니다.

**Proposed next step**: `deno`를 설치한 뒤 같은 영상(`aqz-KE-bpKQ`)을 다시 조회해, 경고가 사라지는지와 포맷 수가 기존 53개에서 늘어나는지 확인합니다. 늘어난다면 JS 런타임을 [video-extraction](../decisions/video-extraction.md)의 필수 외부 도구로 올릴지 결정합니다.
