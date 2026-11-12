/* 씨앗도둑 — Supabase auth + realtime adapter for legacy board UI */
(function () {
  const config = window.STORYBOARD_SUPABASE || {};
  if (!config.url || !config.anonKey) {
    window.storyboardDB = { use: async () => null };
    return;
  }
  if (!window.supabase || !window.supabase.createClient) {
    window.storyboardDB = { use: async () => { throw new Error('Supabase 라이브러리를 불러오지 못했습니다.'); } };
    return;
  }
  const client = window.supabase.createClient(config.url, config.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const style = document.createElement('style');
  style.textContent = `
  #sb-auth-gate{position:fixed;inset:0;z-index:9999;background:#161618ef;display:grid;place-items:center;padding:24px}
  #sb-auth-gate[hidden]{display:none}
  #sb-auth-panel{background:#252527;border:1px solid #4b4740;color:#ede9e1;border-radius:14px;
    width:min(440px,100%);padding:28px;font-family:system-ui,sans-serif;box-shadow:0 16px 45px #0009}
  #sb-auth-panel h2{margin:0 0 10px;font-size:22px}#sb-auth-panel p{color:#bbb4aa;line-height:1.6}
  #sb-auth-panel input{width:100%;padding:12px;border-radius:8px;background:#171719;color:white;
    border:1px solid #666;margin:9px 0}
  #sb-auth-panel button{background:#d6a75a;color:#20190d;font-weight:700;border:0;
    padding:11px 16px;border-radius:8px;cursor:pointer;width:100%}
  #sb-auth-msg{font-size:13px;white-space:pre-wrap;margin-top:12px}
  body[data-role="viewer"] .sheet input,body[data-role="viewer"] .sheet textarea,
  body[data-role="viewer"] .sheet button{pointer-events:none;opacity:.55}
  `;
  document.head.appendChild(style);
  const gate = document.createElement('div');
  gate.id = 'sb-auth-gate';
  gate.innerHTML = '<div id="sb-auth-panel"><h2>씨앗도둑 팀 로그인</h2><p>승인된 팀원만 보드와 수정 내역을 확인할 수 있습니다. 이메일로 로그인 링크를 받습니다.</p><form id="sb-auth-form"><input id="sb-auth-email" type="email" autocomplete="email" placeholder="팀원 이메일" required><button type="submit">로그인 링크 보내기</button></form><div id="sb-auth-msg"></div></div>';
  document.body.appendChild(gate);
  const msg = message => { document.getElementById('sb-auth-msg').textContent = message; };
  const form = document.getElementById('sb-auth-form');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('sb-auth-email').value.trim();
    const { error } = await client.auth.signInWithOtp({
      email, options: { emailRedirectTo: location.href.split('#')[0].split('?')[0] }
    });
    msg(error ? '로그인 링크 전송 실패: ' + error.message : '이메일을 확인해 로그인 링크를 눌러주세요.\n첫 로그인 후에는 감독이 팀원 권한을 등록해야 합니다.');
  });

  // Display current authentication state rather than always showing the email form.
  function showAuthState(state, detail) {
    form.hidden = state === 'signed-in';
    if (state === 'signed-in') {
      msg(detail || '이메일 인증 완료. 팀원 권한을 확인하고 있습니다.');
    } else if (detail) msg(detail);
  }

  async function authorizedSession() {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (!data.session) { showAuthState('signed-out', '로그인 후 이메일로 받은 링크를 이 브라우저에서 열어주세요.'); return null; }
    showAuthState('signed-in', '이메일 인증 완료 · 팀원 권한 확인 중…');
    const { data: member, error: memberError } = await client.from('board_members')
      .select('role').eq('user_id', data.session.user.id).maybeSingle();
    if (memberError) throw memberError;
    if (!member) {
      showAuthState('signed-in', '로그인은 성공했습니다. 다만 아직 팀원 권한이 등록되지 않았습니다.\n관리자에게 등록을 요청한 뒤 페이지를 새로고침하세요.');
      return null;
    }
    return member;
  }

  async function waitForPermission() {
    let member = await authorizedSession();
    if (member) { gate.hidden = true; document.body.dataset.role = member.role; return member; }
    return new Promise((resolve) => {
      const check = async () => {
        try {
          member = await authorizedSession();
          if (member) {
            gate.hidden = true;
            document.body.dataset.role = member.role;
            client.auth.onAuthStateChange((_event, session) => {
              if (!session) location.reload();
            });
            resolve(member);
          }
        } catch (e) { msg('로그인 확인 실패: ' + e.message); }
      };
      client.auth.onAuthStateChange(() => { setTimeout(check, 100); });
      document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
      window.addEventListener('focus', check);
    });
  }

  function collection(name) {
    const table = name === 'cuts' ? 'board_cuts' : 'board_meta';
    return {
      doc(id) {
        if (name !== 'cuts') throw new Error('메타데이터 쓰기는 서버에서만 가능합니다.');
        const patch = data => client.rpc('patch_board_cut', { p_id: id, p_patch: data })
          .then(({error}) => { if (error) throw error; });
        return { update: patch, set: patch };
      },
      onSnapshot(callback, onError) {
        let active = true, sequence = 0;
        const refresh = async () => {
          const seq = ++sequence;
          const {data, error} = await client.from(table).select('id,data');
          if (!active || seq !== sequence) return;
          if (error) { if (onError) onError(error); return; }
          callback({docs: (data || []).map(d => ({id:d.id, data: () => d.data}))});
        };
        const channel = client.channel('sb-' + name + '-' + Math.random().toString(36).slice(2))
          .on('postgres_changes', {event:'*',schema:'public',table}, refresh)
          .subscribe(s => { if (s === 'SUBSCRIBED') refresh(); });
        refresh();
        return () => { active = false; client.removeChannel(channel); };
      }
    };
  }

  window.storyboardDB = {
    client,
    use: async () => {
      await waitForPermission();
      return { collection };
    }
  };
})();
