"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type Screen = "roles" | "teacher-access" | "teacher-create" | "teacher-dashboard" | "student";
type FinalRow = { studentNumber: number; targetNumber: number; letter: string; strengths: string[] };
type TeacherDashboard = {
  code: string; className: string; studentCount: number; excludedNumbers: number[];
  participantCount: number; viewedNumbers: number[]; status: "active" | "ended"; finalRows?: FinalRow[];
};
type ActiveStudentResult = {
  mode: "active"; className: string; targetNumber: number; customMission: string;
  reflection: { letter: string; strengths: string[] };
};
type EndedStudentResult = {
  mode: "ended"; className: string; received: { letter: string; strengths: string[] };
};
type StudentResult = ActiveStudentResult | EndedStudentResult;

const DEFAULT_MISSIONS = [
  "먼저 웃으며 반갑게 인사하기", "친구가 잘한 점을 찾아 한 번 칭찬하기",
  "좋아하는 것이 무엇인지 자연스럽게 물어보기", "도움이 필요할 때 조용히 한 번 도와주기",
  "친구와 나의 공통점을 한 가지 찾아보기", "고마웠던 점을 짧게 이야기해 주기",
  "쉬는 시간에 편안한 주제로 짧게 대화하기", "친구의 이야기를 끊지 않고 끝까지 들어주기",
  "친구의 이름을 불러 다정하게 인사하기", "수업 시간에 노력한 점을 찾아 칭찬하기",
  "친구가 말할 때 고개를 끄덕이며 반응해 주기", "오늘 힘내라는 짧은 응원의 말 전하기",
  "친구가 혼자 있을 때 부담 없이 인사 건네기", "친구가 도움을 주면 바로 고맙다고 말하기",
  "친구의 취미나 관심사에 대해 한 가지 질문하기", "오늘 친구가 보여 준 친절을 기억해 두기",
];

async function callApi<T>(payload: Record<string, unknown>): Promise<T> {
  const response = await fetch("/api/manitto", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "잠시 뒤 다시 시도해 주세요.");
  return data;
}

function parseExcluded(value: string) {
  if (!value.trim()) return [];
  return [...new Set(value.split(",").map((item) => Number(item.trim())))];
}

function normalizeCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("roles");
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [teacherCode, setTeacherCode] = useState("");
  const [teacherPin, setTeacherPin] = useState("");
  const [dashboard, setDashboard] = useState<TeacherDashboard | null>(null);
  const [customMissions, setCustomMissions] = useState<Record<string, string>>({});
  const [missionNumber, setMissionNumber] = useState("");
  const [missionText, setMissionText] = useState("");
  const [studentCode, setStudentCode] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [studentResult, setStudentResult] = useState<StudentResult | null>(null);
  const [letter, setLetter] = useState("");
  const [strengths, setStrengths] = useState(["", ""]);
  const [extraMissionVisible, setExtraMissionVisible] = useState(false);
  const [saveState, setSaveState] = useState("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showMessage(text: string, isError = false) { setMessage(text); setError(isError); }
  function goHome() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setScreen("roles"); setDashboard(null); setStudentResult(null); setTeacherPin("");
    setMessage(""); setError(false); setBusy(false);
  }
  function openStudent(code = studentCode) {
    setStudentCode(code); setStudentResult(null); setMessage(""); setScreen("student");
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedCode = normalizeCode(params.get("class") || "");
    const savedCode = localStorage.getItem("manitto-last-class-code") || "";
    setStudentCode(sharedCode || savedCode);
    if (params.get("mode") === "student" && sharedCode.length === 6) {
      localStorage.setItem("manitto-last-class-code", sharedCode);
      setScreen("student");
    }
  }, []);

  async function refreshDashboard(silent = false) {
    if (!teacherCode || !teacherPin) return;
    try {
      const data = await callApi<TeacherDashboard>({ action: "teacherOpen", code: teacherCode, pin: teacherPin });
      setDashboard(data);
      if (!silent) showMessage("최신 확인 현황으로 새로고침했어요.");
    } catch (refreshError) { if (!silent) showMessage((refreshError as Error).message, true); }
  }

  useEffect(() => {
    if (screen !== "teacher-dashboard" || !dashboard || dashboard.status !== "active") return;
    const interval = window.setInterval(() => void refreshDashboard(true), 5000);
    return () => window.clearInterval(interval);
  }, [screen, dashboard?.status, teacherCode, teacherPin]);

  async function handleTeacherOpen(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{4}$/.test(teacherPin)) { showMessage("비밀번호는 숫자 4자리로 입력해 주세요.", true); return; }
    setBusy(true);
    try {
      const data = await callApi<TeacherDashboard>({ action: "teacherOpen", code: teacherCode, pin: teacherPin });
      setDashboard(data); setTeacherCode(data.code); setScreen("teacher-dashboard");
      showMessage(`${data.className} 교사용 화면을 열었어요.`);
    } catch (openError) { showMessage((openError as Error).message, true); }
    finally { setBusy(false); }
  }

  function addCustomMission() {
    const number = Number(missionNumber); const mission = missionText.trim();
    if (!Number.isInteger(number) || number < 1 || number > 50) {
      showMessage("미션을 받을 번호를 1~50 사이로 적어 주세요.", true); return;
    }
    if (!mission) { showMessage("친구에게 보여 줄 비밀 미션을 적어 주세요.", true); return; }
    setCustomMissions((current) => ({ ...current, [number]: mission.slice(0, 80) }));
    setMissionNumber(""); setMissionText(""); showMessage(`${number}번의 비밀 미션을 추가했어요.`);
  }

  async function handleCreateClass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const pin = String(form.get("pin") ?? "");
    const excludedNumbers = parseExcluded(String(form.get("excludedNumbers") ?? ""));
    if (excludedNumbers.some((number) => !Number.isInteger(number))) {
      showMessage("제외 번호는 쉼표로 구분한 숫자로 적어 주세요.", true); return;
    }
    setBusy(true);
    try {
      const data = await callApi<TeacherDashboard>({
        action: "createClass", className: form.get("className"), studentCount: Number(form.get("studentCount")),
        excludedNumbers, pin, customMissions,
      });
      setTeacherPin(pin); setTeacherCode(data.code); setDashboard(data); setScreen("teacher-dashboard");
      showMessage("온라인 반을 만들었어요. 아래 반 코드를 학생들에게 알려 주세요.");
    } catch (createError) { showMessage((createError as Error).message, true); }
    finally { setBusy(false); }
  }

  async function handleStudentCheck(event?: FormEvent<HTMLFormElement>, override?: { code: string; number: number }) {
    event?.preventDefault();
    const code = normalizeCode(override?.code ?? studentCode); const number = override?.number ?? Number(studentNumber);
    setBusy(true);
    try {
      const data = await callApi<StudentResult>({ action: "studentCheck", code, studentNumber: number });
      setStudentCode(code); setStudentNumber(String(number)); setStudentResult(data); setExtraMissionVisible(false);
      localStorage.setItem("manitto-last-class-code", code);
      if (data.mode === "active") {
        setLetter(data.reflection.letter || "");
        setStrengths([data.reflection.strengths[0] || "", data.reflection.strengths[1] || ""]);
        setSaveState(""); showMessage("마니또와 비밀 미션을 확인했어요.");
      } else showMessage("나에게 도착한 편지와 장점을 확인해 보세요.");
      setScreen("student"); return data;
    } catch (checkError) { showMessage((checkError as Error).message, true); throw checkError; }
    finally { setBusy(false); }
  }

  async function saveReflection(nextLetter = letter, nextStrengths = strengths) {
    if (!studentResult || studentResult.mode !== "active") return;
    setSaveState("저장 중…");
    try {
      await callApi({ action: "saveReflection", code: studentCode, studentNumber: Number(studentNumber), letter: nextLetter, strengths: nextStrengths });
      setSaveState("온라인에 자동 저장됐어요 ✓");
    } catch (saveError) { setSaveState((saveError as Error).message); }
  }
  function scheduleSave(nextLetter: string, nextStrengths: string[]) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState("입력 중…");
    saveTimer.current = setTimeout(() => void saveReflection(nextLetter, nextStrengths), 700);
  }

  async function handleEndActivity() {
    if (!dashboard || !window.confirm("현재 활동을 종료할까요? 학생은 이후 받은 편지와 장점을 확인할 수 있어요.")) return;
    setBusy(true);
    try {
      const data = await callApi<TeacherDashboard>({ action: "endActivity", code: teacherCode, pin: teacherPin });
      setDashboard(data); showMessage("활동을 종료했어요. 교사용 최종 배정표가 열렸습니다.");
    } catch (endError) { showMessage((endError as Error).message, true); }
    finally { setBusy(false); }
  }
  async function handleDeleteClass() {
    if (!dashboard || !window.confirm(`${dashboard.className}의 모든 기록을 삭제할까요? 삭제한 기록은 되돌릴 수 없어요.`)) return;
    setBusy(true);
    try {
      await callApi({ action: "deleteClass", code: teacherCode, pin: teacherPin }); goHome();
    } catch (deleteError) { showMessage((deleteError as Error).message, true); setBusy(false); }
  }
  async function copyCode() {
    if (!dashboard) return;
    try { await navigator.clipboard.writeText(dashboard.code); showMessage("반 코드를 복사했어요."); }
    catch { showMessage(`반 코드는 ${dashboard.code}입니다.`); }
  }
  async function copyStudentLink() {
    if (!dashboard) return;
    const link = `${window.location.origin}${window.location.pathname}?mode=student&class=${dashboard.code}`;
    try { await navigator.clipboard.writeText(link); showMessage("학생용 링크를 복사했어요. 학생들에게 보내 주세요."); }
    catch { showMessage("링크 복사가 되지 않았어요. 반 코드 복사 버튼을 이용해 주세요.", true); }
  }

  useEffect(() => {
    const context = (document as Document & { modelContext?: {
      registerTool: (tool: Record<string, unknown>, options?: { signal?: AbortSignal }) => void | Promise<void>;
    } }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const report = (value: void | Promise<void>) => void Promise.resolve(value).catch(console.error);
    report(context.registerTool({
      name: "check_student_manitto", title: "학생 마니또 확인",
      description: "반 코드와 학생 번호로 마니또 결과를 확인하고 같은 내용을 화면에 표시합니다.",
      inputSchema: { type: "object", properties: {
        classCode: { type: "string", description: "교사가 알려 준 6자리 반 코드" },
        studentNumber: { type: "integer", minimum: 1, maximum: 50 },
      }, required: ["classCode", "studentNumber"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute: async (input: unknown) => {
        const value = input as { classCode?: unknown; studentNumber?: unknown };
        const code = normalizeCode(String(value.classCode ?? "")); const number = Number(value.studentNumber);
        if (code.length !== 6 || !Number.isInteger(number)) throw new Error("반 코드와 번호를 확인해 주세요.");
        const data = await handleStudentCheck(undefined, { code, number });
        return { mode: data.mode, className: data.className, displayed: true };
      },
    }, { signal: lifecycle.signal }));
    report(context.registerTool({
      name: "save_student_reflection", title: "비밀 편지와 장점 저장",
      description: "진행 중인 반에 학생의 비밀 편지와 마니또 장점 두 가지를 저장합니다.",
      inputSchema: { type: "object", properties: {
        classCode: { type: "string" }, studentNumber: { type: "integer", minimum: 1, maximum: 50 },
        letter: { type: "string", maxLength: 200 },
        strengths: { type: "array", items: { type: "string", maxLength: 50 }, maxItems: 2 },
      }, required: ["classCode", "studentNumber", "letter", "strengths"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute: async (input: unknown) => {
        const value = input as { classCode?: unknown; studentNumber?: unknown; letter?: unknown; strengths?: unknown };
        const code = normalizeCode(String(value.classCode ?? "")); const number = Number(value.studentNumber);
        const nextLetter = String(value.letter ?? "").slice(0, 200);
        const nextStrengths = Array.isArray(value.strengths) ? value.strengths.slice(0, 2).map((item) => String(item).slice(0, 50)) : [];
        if (code.length !== 6 || !Number.isInteger(number)) throw new Error("반 코드와 번호를 확인해 주세요.");
        await callApi({ action: "saveReflection", code, studentNumber: number, letter: nextLetter, strengths: nextStrengths });
        setStudentCode(code); setStudentNumber(String(number)); setLetter(nextLetter);
        setStrengths([nextStrengths[0] || "", nextStrengths[1] || ""]); setSaveState("온라인에 저장됐어요 ✓");
        return { saved: true, studentNumber: number };
      },
    }, { signal: lifecycle.signal }));
    return () => lifecycle.abort();
  }, []);

  const activeResult = studentResult?.mode === "active" ? studentResult : null;
  const chosenMission = activeResult ? activeResult.customMission || DEFAULT_MISSIONS[(Number(studentNumber) * 3 + activeResult.targetNumber) % DEFAULT_MISSIONS.length] : "";
  const extraMission = activeResult ? DEFAULT_MISSIONS[(Number(studentNumber) * 5 + activeResult.targetNumber + 7) % DEFAULT_MISSIONS.length] : "";
  const progress = dashboard ? Math.round((dashboard.viewedNumbers.length / dashboard.participantCount) * 100) : 0;

  return (
    <main className="page-shell">
      <header className="intro">
        <div className="intro-symbol" aria-hidden="true">💌</div>
        <div className="emoji-row" aria-hidden="true"><span>🌼</span><span>✨</span><span>💗</span></div>
        <p className="eyebrow">친구와 한 걸음 더 가까이</p><h1>우리 반 마니또</h1>
        <p className="description">친구를 조금 더 자세히 알아가는 시간</p>
      </header>

      {screen === "roles" && <section className="panel role-panel" aria-labelledby="role-title">
        <h2 id="role-title">누가 사용하나요?</h2>
        <p className="panel-guide">반 코드로 여러 반이 동시에, 각자의 휴대폰에서 참여할 수 있어요.</p>
        <div className="role-buttons">
          <button className="role-button teacher-role" onClick={() => setScreen("teacher-access")}><span>📝</span>선생님용</button>
          <button className="role-button student-role" onClick={() => openStudent()}><span>🐣</span>학생용</button>
        </div>
      </section>}

      {screen === "teacher-access" && <section className="panel teacher-panel">
        <button className="back-button" onClick={goHome}>← 처음 화면</button>
        <div className="panel-heading"><span>🔒</span><div><p>선생님 전용</p><h2>교사용 입장</h2></div></div>
        <div className="first-class-help">
          <span aria-hidden="true">💡</span>
          <div><strong>처음 만드는 반인가요?</strong><p>반 코드는 직접 적지 않아요. 아래의 <b>새 반 만들기</b>를 누르면 자동으로 만들어집니다.</p></div>
        </div>
        <p className="existing-class-title">이미 만든 반 다시 열기</p>
        <p className="panel-guide">반을 만들 때 자동 생성된 코드와 교사용 비밀번호를 입력해 주세요.</p>
        <form onSubmit={handleTeacherOpen} className="form-stack">
          <label>자동 생성된 반 코드<input value={teacherCode} onChange={(e) => setTeacherCode(normalizeCode(e.target.value))} placeholder="예: A7K9P2" maxLength={6} required /></label>
          <label>교사용 비밀번호<input value={teacherPin} onChange={(e) => setTeacherPin(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="숫자 4자리" type="password" inputMode="numeric" maxLength={4} required /></label>
          <button className="button primary" disabled={busy}>{busy ? "확인 중…" : "🔓 기존 반 열기"}</button>
        </form>
        <div className="divider"><span>또는</span></div>
        <button className="button soft new-class-button" onClick={() => { setTeacherPin(""); setCustomMissions({}); setScreen("teacher-create"); showMessage(""); }}>✨ 처음이라면 새 반 만들기</button>
        <p className={`message ${error ? "error" : ""}`} aria-live="polite">{message}</p>
      </section>}

      {screen === "teacher-create" && <section className="panel teacher-panel">
        <button className="back-button" onClick={() => { setScreen("teacher-access"); showMessage(""); }}>← 기존 반 열기</button>
        <div className="panel-heading"><span>📝</span><div><p>선생님</p><h2>새 반 만들기</h2></div></div>
        <form onSubmit={handleCreateClass} className="form-stack">
          <label>반 이름<input name="className" placeholder="예: 2학년 3반" maxLength={40} required /></label>
          <label>학생 수<input name="studentCount" type="number" min="2" max="50" inputMode="numeric" placeholder="예: 28" required /></label>
          <label>제외할 번호 <small>(선택)</small><input name="excludedNumbers" inputMode="numeric" placeholder="예: 3, 7, 15" /><small>여러 명이면 쉼표로 구분해 주세요.</small></label>
          <label>교사용 비밀번호<input name="pin" type="password" inputMode="numeric" pattern="\d{4}" maxLength={4} placeholder="숫자 4자리" required /><small>기존 반을 다시 열 때 필요해요. 학생에게는 알려 주지 마세요.</small></label>
          <section className="mission-editor">
            <h3>💡 친구별 비밀 미션 <small>(선택)</small></h3><p>특정 번호에게만 보여 줄 미션을 추가할 수 있어요.</p>
            <div className="mission-fields">
              <label>미션을 받을 번호<input value={missionNumber} onChange={(e) => setMissionNumber(e.target.value)} type="number" min="1" max="50" placeholder="예: 12" /></label>
              <label>비밀 미션<input value={missionText} onChange={(e) => setMissionText(e.target.value)} maxLength={80} placeholder="예: 쉬는 시간에 먼저 인사하기" /></label>
            </div>
            <button className="button mission-add" type="button" onClick={addCustomMission}>＋ 이 미션 추가</button>
            {Object.entries(customMissions).length > 0 && <ul className="mission-list">{Object.entries(customMissions).sort(([a], [b]) => Number(a) - Number(b)).map(([number, text]) => <li key={number}><span><strong>{number}번</strong> · {text}</span><button type="button" onClick={() => setCustomMissions((current) => { const next = { ...current }; delete next[number]; return next; })}>삭제</button></li>)}</ul>}
          </section>
          <button className="button primary" disabled={busy}>{busy ? "만드는 중…" : "🎲 배정하고 반 만들기"}</button>
        </form>
        <p className={`message ${error ? "error" : ""}`} aria-live="polite">{message}</p>
      </section>}

      {screen === "teacher-dashboard" && dashboard && <section className="panel teacher-panel wide-panel">
        <button className="back-button" onClick={goHome}>🔒 잠그고 처음 화면</button>
        <div className="panel-heading"><span>📝</span><div><p>선생님 전용</p><h2>{dashboard.className}</h2></div></div>
        <div className="class-code-card"><p>학생에게 알려 줄 반 코드</p><strong>{dashboard.code}</strong><div className="class-code-actions"><button className="button code-copy" onClick={copyCode}>📋 코드 복사</button><button className="button link-copy" onClick={copyStudentLink}>🔗 학생용 링크 복사</button></div></div>
        <p className="share-guide">학생은 <strong>학생용 → 반 코드 → 번호</strong> 순서로 입력하면 돼요. 다른 반은 다른 코드로 동시에 사용할 수 있습니다.</p>
        <section className="status-card">
          <div className="status-heading"><h3>학생 확인 현황</h3><strong>{dashboard.viewedNumbers.length} / {dashboard.participantCount}명</strong></div>
          <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={dashboard.participantCount} aria-valuenow={dashboard.viewedNumbers.length}><span style={{ width: `${progress}%` }} /></div>
          <p>{dashboard.viewedNumbers.length ? `확인 완료: ${[...dashboard.viewedNumbers].sort((a, b) => a - b).map((n) => `${n}번`).join(", ")}` : "아직 확인한 학생이 없어요."}</p>
          {dashboard.status === "active" ? <div className="dashboard-actions"><button className="button soft" onClick={() => void refreshDashboard()} disabled={busy}>🔄 현황 새로고침</button><button className="button danger" onClick={handleEndActivity} disabled={busy}>현재 활동 종료</button></div> :
            <div className="end-summary"><h3>🎉 최종 배정표</h3><p>학생에게는 자신을 지켜본 친구의 번호가 공개되지 않아요.</p>
              <div className="assignment-list">{dashboard.finalRows?.map((row) => <article key={row.studentNumber} className="assignment-row"><div><span>{row.studentNumber}번</span><b>→ {row.targetNumber}번 친구</b></div><p><strong>비밀 편지</strong>{row.letter || "작성하지 않았어요."}</p><p><strong>장점</strong>{row.strengths.length ? row.strengths.join(" · ") : "작성하지 않았어요."}</p></article>)}</div>
            </div>}
        </section>
        <div className="dashboard-bottom"><button className="button student-shortcut" onClick={() => openStudent(dashboard.code)}>🐣 이 반의 학생용 화면 보기</button><button className="text-button" onClick={handleDeleteClass}>이 반 기록 삭제</button></div>
        <p className={`message ${error ? "error" : ""}`} aria-live="polite">{message}</p>
      </section>}

      {screen === "student" && <section className="panel student-panel">
        <button className="back-button" onClick={goHome}>← 처음 화면</button>
        <div className="panel-heading"><span>🐣</span><div><p>학생</p><h2>학생용 확인</h2></div></div>
        {!studentResult && <><p className="panel-guide">선생님이 알려 준 반 코드와 내 번호를 입력해 주세요.</p>
          <form onSubmit={(event) => void handleStudentCheck(event).catch(() => undefined)} className="form-stack">
            <label>반 코드<input value={studentCode} onChange={(e) => setStudentCode(normalizeCode(e.target.value))} placeholder="예: A7K9P2" maxLength={6} required /></label>
            <label>번호<input value={studentNumber} onChange={(e) => setStudentNumber(e.target.value)} type="number" min="1" max="50" inputMode="numeric" placeholder="예: 12" required /></label>
            <button className="button secondary" disabled={busy}>{busy ? "확인 중…" : "🔍 확인"}</button>
          </form></>}
        {activeResult && <div className="student-result">
          <p className="result-label">나의 마니또는</p><p className="result-number"><strong>{activeResult.targetNumber}</strong>번 친구!</p>
          <p className="result-guide">{activeResult.className}의 {activeResult.targetNumber}번 친구를 따뜻하게 지켜봐 주세요. 다른 친구에게는 비밀!</p>
          <div className="mission-box"><p>{activeResult.customMission ? "선생님이 전한 비밀 미션" : "오늘의 마니또 미션"}</p><strong>{chosenMission}</strong></div>
          {!extraMissionVisible ? <button className="button extra" onClick={() => setExtraMissionVisible(true)}>🎁 미션 하나 더 도전하기</button> : <div className="mission-box extra-box"><p>추가 비밀 미션</p><strong>{extraMission}</strong></div>}
          <label className="reflection">💌 마니또에게 남길 비밀 편지 <small>(선택)</small><textarea value={letter} onChange={(e) => { const next = e.target.value.slice(0, 200); setLetter(next); scheduleSave(next, strengths); }} rows={4} maxLength={200} placeholder="친구에게 전하고 싶은 따뜻한 말을 적어 보세요." /><span>{letter.length} / 200자</span></label>
          <fieldset className="strengths"><legend>🌟 마니또의 장점 2가지 <small>(선택)</small></legend><label>첫 번째 장점<input value={strengths[0]} onChange={(e) => { const next = [e.target.value.slice(0, 50), strengths[1]]; setStrengths(next); scheduleSave(letter, next); }} maxLength={50} placeholder="예: 친구의 말을 잘 들어줘요" /></label><label>두 번째 장점<input value={strengths[1]} onChange={(e) => { const next = [strengths[0], e.target.value.slice(0, 50)]; setStrengths(next); scheduleSave(letter, next); }} maxLength={50} placeholder="예: 항상 밝게 인사해요" /></label></fieldset>
          <p className="save-state" aria-live="polite">{saveState}</p>
          <button className="button quiet" onClick={() => { if (saveTimer.current) clearTimeout(saveTimer.current); void saveReflection(); setStudentResult(null); setMessage(""); }}>확인했어요</button>
        </div>}
        {studentResult?.mode === "ended" && <div className="student-result end-reveal">
          <p className="result-label">나에게 도착한</p><h3>비밀 편지와 장점 💌</h3><p className="result-guide">누가 쓴 편지인지는 나중에 공개돼요.</p>
          <div className="received"><p>받은 편지</p><strong>{studentResult.received.letter || "아직 도착한 편지가 없어요."}</strong></div>
          <div className="received"><p>🌟 친구가 적어 준 나의 장점</p>{studentResult.received.strengths.length ? <ol>{studentResult.received.strengths.map((value, index) => <li key={index}>{value}</li>)}</ol> : <strong>아직 적어 준 장점이 없어요.</strong>}</div>
          <button className="button quiet" onClick={() => { setStudentResult(null); setMessage(""); }}>확인했어요</button>
        </div>}
        <p className={`message ${error ? "error" : ""}`} aria-live="polite">{message}</p>
      </section>}

      <footer>🌈 서로를 존중하며 즐겁게 참여해요!</footer>
    </main>
  );
}
