"use client";

import { FormEvent, useEffect, useState } from "react";

type Screen = "roles" | "teacher-access" | "teacher-create" | "teacher-dashboard" | "student" | "student-complete";
type TeacherDashboard = {
  code: string; className: string; studentCount: number; excludedNumbers: number[];
  participantCount: number; viewedNumbers: number[]; strengthNumbers: number[]; poemNumbers: number[];
  receivedViewedNumbers: number[];
  status: "active" | "ended";
};
type ActiveStudentResult = {
  mode: "active"; className: string; targetNumber: number; customMission: string;
  reflection: { strengths: string[]; poemName: string; poemLines: string[] };
};
type EndedStudentResult = {
  mode: "ended"; className: string; received: { strengths: string[]; poemName: string; poemLines: string[] };
};
type StudentResult = ActiveStudentResult | EndedStudentResult;
type CompletionMode = "sent" | "received";

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
  const [resultRevealed, setResultRevealed] = useState(false);
  const [strengths, setStrengths] = useState(["", "", ""]);
  const [poemName, setPoemName] = useState("");
  const [poemLines, setPoemLines] = useState(["", "", ""]);
  const [completionMode, setCompletionMode] = useState<CompletionMode>("sent");
  const [extraMissionVisible, setExtraMissionVisible] = useState(false);
  const [saveState, setSaveState] = useState("");

  function showMessage(text: string, isError = false) { setMessage(text); setError(isError); }
  function goHome() {
    setScreen("roles"); setDashboard(null); setStudentResult(null); setResultRevealed(false); setTeacherPin("");
    setMessage(""); setError(false); setBusy(false);
  }
  function openStudent(code = studentCode) {
    setStudentCode(code); setStudentResult(null); setResultRevealed(false); setMessage(""); setScreen("student");
  }

  async function refreshDashboard(silent = false) {
    if (!teacherCode || !teacherPin) return;
    try {
      const data = await callApi<TeacherDashboard>({ action: "teacherOpen", code: teacherCode, pin: teacherPin });
      setDashboard(data);
      if (!silent) showMessage("최신 확인 현황으로 새로고침했어요.");
    } catch (refreshError) { if (!silent) showMessage((refreshError as Error).message, true); }
  }

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
    if (code.length !== 6) {
      const validationError = new Error("반 코드는 영문과 숫자 6자리로 입력해 주세요.");
      showMessage(validationError.message, true); throw validationError;
    }
    if (!Number.isInteger(number) || number < 1 || number > 50) {
      const validationError = new Error("내 번호를 1~50 사이의 숫자로 입력해 주세요.");
      showMessage(validationError.message, true); throw validationError;
    }
    setBusy(true);
    try {
      const data = await callApi<StudentResult>({ action: "studentCheck", code, studentNumber: number });
      setStudentCode(code); setStudentNumber(String(number)); setStudentResult(data); setResultRevealed(false); setExtraMissionVisible(false);
      if (data.mode === "active") {
        setStrengths([data.reflection.strengths[0] || "", data.reflection.strengths[1] || "", data.reflection.strengths[2] || ""]);
        setPoemName(data.reflection.poemName || "");
        setPoemLines([data.reflection.poemLines[0] || "", data.reflection.poemLines[1] || "", data.reflection.poemLines[2] || ""]);
        setSaveState(""); showMessage("비밀 결과가 준비됐어요. 혼자 확인하기를 눌러 주세요.");
      } else showMessage("친구의 마음이 도착했어요. 혼자 확인해 보세요.");
      setScreen("student"); return data;
    } catch (checkError) { showMessage((checkError as Error).message, true); throw checkError; }
    finally { setBusy(false); }
  }

  async function saveReflection() {
    if (!studentResult || studentResult.mode !== "active" || !canFinishReflection) return false;
    setSaveState("저장 중…");
    try {
      await callApi({ action: "saveReflection", code: studentCode, studentNumber: Number(studentNumber), strengths, poemName, poemLines });
      setSaveState("따뜻한 마음을 저장했어요 ✓");
      return true;
    } catch (saveError) { setSaveState((saveError as Error).message); return false; }
  }
  async function handleReflectionComplete() {
    setBusy(true);
    const saved = await saveReflection();
    if (saved) {
      setStudentResult(null); setResultRevealed(false);
      setStudentCode(""); setStudentNumber(""); setStrengths(["", "", ""]); setPoemName(""); setPoemLines(["", "", ""]);
      setCompletionMode("sent"); showMessage(""); setScreen("student-complete");
    }
    setBusy(false);
  }

  async function handleReceivedComplete() {
    if (!studentResult || studentResult.mode !== "ended") return;
    setBusy(true);
    try {
      await callApi({ action: "acknowledgeReceived", code: studentCode, studentNumber: Number(studentNumber) });
      setStudentResult(null); setResultRevealed(false); setStudentCode(""); setStudentNumber("");
      setStrengths(["", "", ""]); setPoemName(""); setPoemLines(["", "", ""]);
      setCompletionMode("received"); showMessage(""); setScreen("student-complete");
    } catch (completeError) { showMessage((completeError as Error).message, true); }
    finally { setBusy(false); }
  }

  async function handleEndActivity() {
    if (!dashboard) return;
    const unfinishedLines = [
      pendingViewed.length ? `마니또 확인 전: ${numberList(pendingViewed)}` : "",
      pendingReflections.length ? `마음 전하기 작성 전: ${numberList(pendingReflections)}` : "",
    ].filter(Boolean);
    const confirmText = unfinishedLines.length
      ? `아직 완료하지 않은 학생이 있어요.\n\n${unfinishedLines.join("\n")}\n\n그래도 활동을 종료할까요? 종료 후에는 더 이상 작성할 수 없어요.`
      : "모든 학생이 참여를 마쳤어요. 현재 활동을 종료할까요?";
    if (!window.confirm(confirmText)) return;
    setBusy(true);
    try {
      const data = await callApi<TeacherDashboard>({ action: "endActivity", code: teacherCode, pin: teacherPin });
      setDashboard(data); showMessage("활동을 종료했어요. 학생은 받은 장점 3가지와 이름 삼행시를 확인할 수 있습니다.");
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
  async function shareStudentSite() {
    if (!dashboard) return;
    const siteUrl = window.location.origin;
    const shareText = `${dashboard.className} 우리 반 마니또\n반 코드: ${dashboard.code}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "우리 반 마니또", text: shareText, url: siteUrl });
        showMessage("학생용 사이트를 공유했어요.");
        return;
      }
      await navigator.clipboard.writeText(`${shareText}\n${siteUrl}`);
      showMessage("학생용 사이트 주소와 반 코드를 복사했어요.");
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(`${shareText}\n${siteUrl}`);
        showMessage("학생용 사이트 주소와 반 코드를 복사했어요.");
      } catch {
        showMessage(`사이트 주소: ${siteUrl} · 반 코드: ${dashboard.code}`);
      }
    }
  }
  async function shareEndNotice() {
    if (!dashboard) return;
    const siteUrl = window.location.origin;
    const notice = `${dashboard.className} 마니또 활동이 끝났어요!\n반 코드: ${dashboard.code}\n학생용 → 반 코드 → 번호 순서로 들어가 친구가 남긴 마음을 확인하세요.`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "우리 반 마니또 활동 종료", text: notice, url: siteUrl });
        showMessage("활동 종료 안내를 공유했어요.");
        return;
      }
      await navigator.clipboard.writeText(`${notice}\n${siteUrl}`);
      showMessage("활동 종료 안내문을 복사했어요.");
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(`${notice}\n${siteUrl}`);
        showMessage("활동 종료 안내문을 복사했어요.");
      } catch {
        showMessage(`사이트 주소: ${siteUrl} · 반 코드: ${dashboard.code}`);
      }
    }
  }
  function downloadParticipationCsv() {
    if (!dashboard) return;
    const rows = [
      ["번호", "마니또 확인", "장점 3가지", "이름 삼행시", "받은 마음 확인"],
      ...participantNumbers.map((number) => [
        `${number}번`,
        dashboard.viewedNumbers.includes(number) ? "확인" : "미확인",
        dashboard.strengthNumbers.includes(number) ? "작성" : "미작성",
        dashboard.poemNumbers.includes(number) ? "작성" : "미작성",
        dashboard.status === "ended" ? dashboard.receivedViewedNumbers.includes(number) ? "확인" : "미확인" : "활동 중",
      ]),
    ];
    const csv = rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const blobUrl = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    const safeClassName = dashboard.className.replace(/[\\/:*?"<>|]/g, "_");
    link.href = blobUrl; link.download = `${safeClassName}_마니또_참여현황.csv`; link.click();
    URL.revokeObjectURL(blobUrl);
    showMessage("참여 현황 CSV 파일을 저장했어요.");
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
      name: "save_student_reflection", title: "친구에게 전할 마음 저장",
      description: "진행 중인 반에 친구의 장점 세 가지와 이름 삼행시를 함께 저장합니다.",
      inputSchema: { type: "object", properties: {
        classCode: { type: "string" }, studentNumber: { type: "integer", minimum: 1, maximum: 50 },
        strengths: { type: "array", items: { type: "string", maxLength: 50 }, minItems: 3, maxItems: 3 },
        poemName: { type: "string", description: "삼행시에 사용할 친구 이름 또는 별명 3글자" },
        poemLines: { type: "array", items: { type: "string", maxLength: 80 }, minItems: 3, maxItems: 3 },
      }, required: ["classCode", "studentNumber", "strengths", "poemName", "poemLines"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute: async (input: unknown) => {
        const value = input as { classCode?: unknown; studentNumber?: unknown; strengths?: unknown; poemName?: unknown; poemLines?: unknown };
        const code = normalizeCode(String(value.classCode ?? "")); const number = Number(value.studentNumber);
        const nextStrengths = Array.isArray(value.strengths) ? value.strengths.slice(0, 3).map((item) => String(item).slice(0, 50)) : [];
        const nextPoemName = String(value.poemName ?? "").trim();
        const nextPoemLines = Array.isArray(value.poemLines) ? value.poemLines.slice(0, 3).map((item) => String(item).slice(0, 80)) : [];
        if (code.length !== 6 || !Number.isInteger(number)) throw new Error("반 코드와 번호를 확인해 주세요.");
        await callApi({ action: "saveReflection", code, studentNumber: number, strengths: nextStrengths, poemName: nextPoemName, poemLines: nextPoemLines });
        setStudentCode(code); setStudentNumber(String(number)); setStrengths([nextStrengths[0] || "", nextStrengths[1] || "", nextStrengths[2] || ""]);
        setPoemName(nextPoemName); setPoemLines([nextPoemLines[0] || "", nextPoemLines[1] || "", nextPoemLines[2] || ""]); setSaveState("온라인에 저장됐어요 ✓");
        return { saved: true, studentNumber: number };
      },
    }, { signal: lifecycle.signal }));
    return () => lifecycle.abort();
  }, []);

  const activeResult = studentResult?.mode === "active" ? studentResult : null;
  const chosenMission = activeResult ? activeResult.customMission || DEFAULT_MISSIONS[(Number(studentNumber) * 3 + activeResult.targetNumber) % DEFAULT_MISSIONS.length] : "";
  const extraMission = activeResult ? DEFAULT_MISSIONS[(Number(studentNumber) * 5 + activeResult.targetNumber + 7) % DEFAULT_MISSIONS.length] : "";
  const participantNumbers = dashboard ? Array.from({ length: dashboard.studentCount }, (_, index) => index + 1).filter((number) => !dashboard.excludedNumbers.includes(number)) : [];
  const pendingViewed = dashboard ? participantNumbers.filter((number) => !dashboard.viewedNumbers.includes(number)) : [];
  const completedReflectionNumbers = dashboard ? dashboard.strengthNumbers.filter((number) => dashboard.poemNumbers.includes(number)).sort((a, b) => a - b) : [];
  const pendingReflections = dashboard ? participantNumbers.filter((number) => !completedReflectionNumbers.includes(number)) : [];
  const receivedViewedNumbers = dashboard ? [...dashboard.receivedViewedNumbers].sort((a, b) => a - b) : [];
  const pendingReceived = dashboard ? participantNumbers.filter((number) => !dashboard.receivedViewedNumbers.includes(number)) : [];
  const displayedViewedNumbers = dashboard?.status === "ended" ? receivedViewedNumbers : [...(dashboard?.viewedNumbers ?? [])].sort((a, b) => a - b);
  const displayedPendingNumbers = dashboard?.status === "ended" ? pendingReceived : pendingViewed;
  const displayedProgress = dashboard ? Math.round((displayedViewedNumbers.length / dashboard.participantCount) * 100) : 0;
  const numberList = (numbers: number[]) => numbers.length ? numbers.map((number) => `${number}번`).join(", ") : "없음";
  const poemSyllables = Array.from(poemName);
  const canFinishReflection = Boolean(strengths.every((strength) => strength.trim()) && poemSyllables.length === 3 && poemLines.every((line) => line.trim()));

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
        <div className="class-code-card"><p>학생에게 알려 줄 반 코드</p><strong>{dashboard.code}</strong><div className="class-code-actions"><button className="button code-copy" onClick={copyCode}>📋 코드 복사</button><button className="button site-share" onClick={shareStudentSite}>📤 학생용 사이트 공유</button></div></div>
        <p className="share-guide">공유한 사이트를 연 뒤 학생은 <strong>학생용 → 반 코드 → 번호</strong> 순서로 직접 입력하면 돼요. 다른 반은 다른 코드로 동시에 사용할 수 있습니다.</p>
        <section className="status-card">
          <div className="status-heading"><h3>{dashboard.status === "ended" ? "받은 마음 확인 현황" : "학생 확인 현황"}</h3><strong>{displayedViewedNumbers.length} / {dashboard.participantCount}명</strong></div>
          <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={dashboard.participantCount} aria-valuenow={displayedViewedNumbers.length}><span style={{ width: `${displayedProgress}%` }} /></div>
          <div className="completion-lines"><p><b>확인 완료</b>{numberList(displayedViewedNumbers)}</p><p className="pending"><b>아직 확인 전</b>{numberList(displayedPendingNumbers)}</p></div>
          <div className="writing-status" aria-label="마음 전하기 작성 현황">
            <article><div><span aria-hidden="true">🌟</span><strong>장점 3가지</strong><b>{dashboard.strengthNumbers.length} / {dashboard.participantCount}명</b></div><p><b>작성 완료</b>{numberList(dashboard.strengthNumbers)}</p></article>
            <article><div><span aria-hidden="true">📝</span><strong>이름 삼행시</strong><b>{dashboard.poemNumbers.length} / {dashboard.participantCount}명</b></div><p><b>작성 완료</b>{numberList(dashboard.poemNumbers)}</p></article>
          </div>
          <p className="writing-total"><strong>두 활동 모두 완료</strong> {completedReflectionNumbers.length} / {dashboard.participantCount}명 · <span>아직 완료 전: {numberList(pendingReflections)}</span></p>
          {dashboard.status === "active" && (pendingViewed.length > 0 || pendingReflections.length > 0) && <p className="end-warning">⚠️ 아직 참여를 마치지 않은 학생이 있어요. 종료하기 전에 번호를 확인해 주세요.</p>}
          {dashboard.status === "active" ? <div className="dashboard-actions"><button className="button soft" onClick={() => void refreshDashboard()} disabled={busy}>🔄 현황 새로고침</button><button className="button danger" onClick={handleEndActivity} disabled={busy}>현재 활동 종료</button></div> :
            <div className="end-summary">
              <h3>🌷 활동이 종료되었어요</h3>
              <p>학생은 학생용 화면에서 자신에게 도착한 장점 3가지와 이름 삼행시를 확인할 수 있어요.</p>
              <div className="end-note">💌 누가 나를 지켜본 마니또인지는 공개되지 않아요.</div>
              <button className="button end-share" onClick={shareEndNotice}>📣 학생에게 종료 안내 공유</button>
            </div>}
          <button className="button export-status" onClick={downloadParticipationCsv}>📊 참여 현황 CSV 저장</button>
        </section>
        <div className="dashboard-bottom"><button className="button student-shortcut" onClick={() => openStudent(dashboard.code)}>🐣 이 반의 학생용 화면 보기</button><button className="text-button" onClick={handleDeleteClass}>이 반 기록 삭제</button></div>
        <p className={`message ${error ? "error" : ""}`} aria-live="polite">{message}</p>
      </section>}

      {screen === "student" && <section className="panel student-panel">
        <button className="back-button" onClick={goHome}>← 처음 화면</button>
        <div className="panel-heading"><span>🐣</span><div><p>학생</p><h2>학생용 확인</h2></div></div>
        {!studentResult && <><p className="panel-guide">선생님이 알려 준 반 코드와 내 번호를 입력해 주세요.</p>
          <form onSubmit={(event) => void handleStudentCheck(event).catch(() => undefined)} className="form-stack">
            <label>반 코드<input className="class-code-input" value={studentCode} onChange={(e) => setStudentCode(normalizeCode(e.target.value))} placeholder="예: A7K9P2" maxLength={6} inputMode="text" autoCapitalize="characters" autoCorrect="off" spellCheck={false} enterKeyHint="next" required /></label>
            <label>번호<input value={studentNumber} onChange={(e) => setStudentNumber(e.target.value.replace(/\D/g, "").slice(0, 2))} type="text" inputMode="numeric" pattern="[0-9]*" maxLength={2} enterKeyHint="done" placeholder="예: 12" required /></label>
            <button className="button secondary" disabled={busy}>{busy ? "확인 중…" : "🔍 확인"}</button>
          </form></>}
        {studentResult && !resultRevealed && <div className="privacy-cover">
          <div className="privacy-icon" aria-hidden="true">🙈</div>
          <h3>비밀 화면이 준비됐어요</h3>
          <p>{studentResult.mode === "active" ? "주변 친구가 보지 않도록 휴대폰을 가까이 들고 확인해 주세요." : "친구가 남긴 마음은 나만 조용히 확인해요."}</p>
          <button className="button privacy-open" onClick={() => setResultRevealed(true)}>🔐 혼자 확인하기</button>
        </div>}
        {activeResult && resultRevealed && <div className="student-result">
          <p className="result-label">나의 마니또는</p><p className="result-number"><strong>{activeResult.targetNumber}</strong>번 친구!</p>
          <p className="result-guide">{activeResult.className}의 {activeResult.targetNumber}번 친구를 따뜻하게 지켜봐 주세요. 다른 친구에게는 비밀!</p>
          <div className="mission-box"><p>{activeResult.customMission ? "선생님이 전한 비밀 미션" : "오늘의 마니또 미션"}</p><strong>{chosenMission}</strong></div>
          {!extraMissionVisible ? <button className="button extra" onClick={() => setExtraMissionVisible(true)}>🎁 미션 하나 더 도전하기</button> : <div className="mission-box extra-box"><p>추가 비밀 미션</p><strong>{extraMission}</strong></div>}
          <p className="reflection-intro">마음을 전하는 두 활동을 모두 작성해 주세요. <b>둘 다 필수</b></p>
          <fieldset className="strengths"><legend>🌟 마니또 친구의 장점 3가지</legend><p>친구를 보며 발견한 좋은 점을 하나씩 적어 주세요.</p>{[0, 1, 2].map((index) => <label key={index}>{index + 1}번째 장점<input value={strengths[index]} onChange={(e) => { setStrengths((current) => current.map((strength, strengthIndex) => strengthIndex === index ? e.target.value.slice(0, 50) : strength)); setSaveState(""); }} maxLength={50} placeholder="친구의 좋은 점을 적어 주세요" /></label>)}</fieldset>
          <fieldset className="acrostic"><legend>📝 친구 이름 삼행시</legend><p>친구 이름이 두 글자라면 세 글자 별명을 지어 주세요. 각 글자 뒤에 이어질 말을 적으면 돼요.</p><label>삼행시에 사용할 이름 또는 별명 (3글자)<input value={poemName} onChange={(e) => { setPoemName(Array.from(e.target.value.replace(/\s/g, "")).slice(0, 3).join("")); setSaveState(""); }} placeholder="예: 김민수" maxLength={6} /></label><div className="acrostic-lines">{[0, 1, 2].map((index) => <label key={index}><strong>{poemSyllables[index] || `${index + 1}행`}</strong><input value={poemLines[index]} onChange={(e) => { setPoemLines((current) => current.map((line, lineIndex) => lineIndex === index ? e.target.value.slice(0, 80) : line)); setSaveState(""); }} maxLength={80} placeholder="이 글자 뒤에 이어질 말을 적어 주세요" /></label>)}</div></fieldset>
          <p className="save-state" aria-live="polite">{saveState}</p>
          {!canFinishReflection && <p className="required-guide">장점 3가지와 이름 삼행시 세 줄을 모두 작성하면 다음으로 갈 수 있어요.</p>}
          <button className="privacy-hide" onClick={() => setResultRevealed(false)}>🙈 화면 다시 가리기</button>
          <button className="button quiet" onClick={() => void handleReflectionComplete()} disabled={!canFinishReflection || busy}>{busy ? "저장 중…" : "확인했어요"}</button>
        </div>}
        {studentResult?.mode === "ended" && resultRevealed && <div className="student-result end-reveal">
          <p className="result-label">나에게 도착한</p><h3>친구의 따뜻한 마음 💌</h3><p className="result-guide">누가 남겼는지는 공개되지 않아요.</p>
          <div className="received"><p>친구가 적어 준 나의 장점 3가지</p>{studentResult.received.strengths.some(Boolean) ? <ol>{studentResult.received.strengths.map((strength, index) => <li key={index}>{strength || "아직 작성되지 않았어요."}</li>)}</ol> : <strong>아직 도착한 장점이 없어요.</strong>}</div>
          <div className="received"><p>📝 친구가 적어 준 나의 이름 삼행시</p>{studentResult.received.poemName && studentResult.received.poemLines.every(Boolean) ? <ol className="received-poem">{studentResult.received.poemLines.map((value, index) => <li key={index}><b>{Array.from(studentResult.received.poemName)[index]}</b> {value}</li>)}</ol> : <strong>아직 도착한 삼행시가 없어요.</strong>}</div>
          <button className="privacy-hide" onClick={() => setResultRevealed(false)}>🙈 화면 다시 가리기</button>
          <button className="button quiet" onClick={() => void handleReceivedComplete()} disabled={busy}>{busy ? "확인 저장 중…" : "확인했어요"}</button>
        </div>}
        <p className={`message ${error ? "error" : ""}`} aria-live="polite">{message}</p>
      </section>}

      {screen === "student-complete" && <section className="panel student-panel completion-panel" aria-labelledby="completion-title">
        <div className="completion-icon" aria-hidden="true">{completionMode === "sent" ? "💌" : "🌷"}</div>
        <div className="completion-sparkles" aria-hidden="true"><span>✨</span><span>🌼</span><span>✨</span></div>
        <h2 id="completion-title">{completionMode === "sent" ? "마음을 잘 전했어요!" : "따뜻한 마음을 확인했어요!"}</h2>
        <p>{completionMode === "sent" ? "친구를 따뜻하게 바라보고 좋은 마음을 남겨 줘서 고마워요." : "친구가 전해 준 장점 3가지와 삼행시를 오래 기억해 주세요."}</p>
        <div className="completion-reminder">{completionMode === "sent" ? "🤫 활동이 끝날 때까지 마니또는 우리만의 비밀이에요." : "💗 누가 남겼는지는 공개되지 않지만, 따뜻한 마음은 소중히 간직해요."}</div>
        <button className="button primary" onClick={goHome}>처음 화면으로</button>
      </section>}

      <footer>🌈 서로를 존중하며 즐겁게 참여해요!</footer>
    </main>
  );
}
