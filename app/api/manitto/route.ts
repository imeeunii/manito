import { env } from "cloudflare:workers";

type ClassRow = {
  id: number;
  code: string;
  name: string;
  student_count: number;
  excluded_numbers: string;
  assignments: string;
  custom_missions: string;
  teacher_pin_hash: string;
  status: "active" | "ended";
};

type EntryRow = {
  student_number: number;
  viewed_at: string | null;
  letter: string;
  strength_one: string;
  strength_two: string;
};

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function getDatabase() {
  if (!env.DB) {
    throw new Error("온라인 저장소를 사용할 수 없습니다.");
  }
  return env.DB;
}

function cleanCode(value: unknown) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}

function cleanText(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function makeClassCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
}

async function digestPin(pin: string, salt: string) {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function createPinHash(pin: string) {
  const salt = crypto.randomUUID();
  return `${salt}$${await digestPin(pin, salt)}`;
}

async function verifyPin(pin: string, stored: string) {
  const [salt, expected] = stored.split("$");
  if (!salt || !expected) return false;
  return (await digestPin(pin, salt)) === expected;
}

function createAssignments(numbers: number[]) {
  const targets = [...numbers];
  for (let index = targets.length - 1; index > 0; index -= 1) {
    const randomIndex = crypto.getRandomValues(new Uint32Array(1))[0] % index;
    [targets[index], targets[randomIndex]] = [targets[randomIndex], targets[index]];
  }
  return Object.fromEntries(numbers.map((number, index) => [number, targets[index]]));
}

async function findClass(code: string) {
  return getDatabase()
    .prepare(
      "SELECT id, code, name, student_count, excluded_numbers, assignments, custom_missions, teacher_pin_hash, status FROM classes WHERE code = ?"
    )
    .bind(code)
    .first<ClassRow>();
}

function participantsFor(row: ClassRow) {
  const excluded = new Set(parseJson<number[]>(row.excluded_numbers, []));
  return Array.from({ length: row.student_count }, (_, index) => index + 1).filter(
    (number) => !excluded.has(number)
  );
}

async function requireTeacher(codeValue: unknown, pinValue: unknown) {
  const code = cleanCode(codeValue);
  const pin = String(pinValue ?? "");
  const row = await findClass(code);
  if (!row || !(await verifyPin(pin, row.teacher_pin_hash))) {
    throw new Response("반 코드 또는 비밀번호를 확인해 주세요.", { status: 401 });
  }
  return row;
}

async function teacherDashboard(row: ClassRow) {
  const entries = await getDatabase()
    .prepare(
      "SELECT student_number, viewed_at, letter, strength_one, strength_two FROM student_entries WHERE class_id = ? ORDER BY student_number"
    )
    .bind(row.id)
    .all<EntryRow>();
  const participantNumbers = participantsFor(row);
  const viewedNumbers = entries.results
    .filter((entry) => entry.viewed_at)
    .map((entry) => entry.student_number);
  const letterNumbers = entries.results
    .filter((entry) => entry.letter.trim())
    .map((entry) => entry.student_number);
  const strengthNumbers = entries.results
    .filter((entry) => entry.strength_one.trim() && entry.strength_two.trim())
    .map((entry) => entry.student_number);
  const dashboard: Record<string, unknown> = {
    code: row.code,
    className: row.name,
    studentCount: row.student_count,
    excludedNumbers: parseJson<number[]>(row.excluded_numbers, []),
    participantCount: participantNumbers.length,
    viewedNumbers,
    letterNumbers,
    strengthNumbers,
    status: row.status,
  };

  return dashboard;
}

async function createClass(payload: Record<string, unknown>) {
  const className = cleanText(payload.className, 40);
  const studentCount = Number(payload.studentCount);
  const pin = String(payload.pin ?? "");
  const rawExcluded = Array.isArray(payload.excludedNumbers) ? payload.excludedNumbers : [];
  const excludedNumbers = [
    ...new Set(rawExcluded.map(Number).filter((number) => Number.isInteger(number))),
  ].sort((a, b) => a - b);

  if (!className) throw new Response("반 이름을 입력해 주세요.", { status: 400 });
  if (!Number.isInteger(studentCount) || studentCount < 2 || studentCount > 50) {
    throw new Response("학생 수는 2명부터 50명까지 입력해 주세요.", { status: 400 });
  }
  if (!/^\d{4}$/.test(pin)) {
    throw new Response("교사용 비밀번호는 숫자 4자리로 정해 주세요.", { status: 400 });
  }
  if (excludedNumbers.some((number) => number < 1 || number > studentCount)) {
    throw new Response("제외 번호는 학생 수 안에서 입력해 주세요.", { status: 400 });
  }

  const participants = Array.from({ length: studentCount }, (_, index) => index + 1).filter(
    (number) => !excludedNumbers.includes(number)
  );
  if (participants.length < 2) {
    throw new Response("참여 학생이 최소 2명은 있어야 해요.", { status: 400 });
  }

  const submittedMissions =
    payload.customMissions && typeof payload.customMissions === "object"
      ? (payload.customMissions as Record<string, unknown>)
      : {};
  const customMissions = Object.fromEntries(
    Object.entries(submittedMissions)
      .map(([number, mission]) => [String(Number(number)), cleanText(mission, 80)] as const)
      .filter(([number, mission]) => participants.includes(Number(number)) && mission)
  );
  const assignments = createAssignments(participants);
  const teacherPinHash = await createPinHash(pin);
  const database = getDatabase();

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = makeClassCode();
    try {
      await database
        .prepare(
          "INSERT INTO classes (code, name, student_count, excluded_numbers, assignments, custom_missions, teacher_pin_hash, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'active')"
        )
        .bind(
          code,
          className,
          studentCount,
          JSON.stringify(excludedNumbers),
          JSON.stringify(assignments),
          JSON.stringify(customMissions),
          teacherPinHash
        )
        .run();
      const row = await findClass(code);
      if (!row) throw new Error("생성한 반을 찾을 수 없습니다.");
      return teacherDashboard(row);
    } catch (error) {
      if (!String(error).includes("UNIQUE")) throw error;
    }
  }
  throw new Error("반 코드를 만들지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
}

async function studentCheck(payload: Record<string, unknown>) {
  const code = cleanCode(payload.code);
  const studentNumber = Number(payload.studentNumber);
  const row = await findClass(code);
  if (!row) throw new Response("반 코드를 확인해 주세요.", { status: 404 });
  if (!Number.isInteger(studentNumber) || !participantsFor(row).includes(studentNumber)) {
    throw new Response("참여하는 번호를 정확히 입력해 주세요.", { status: 400 });
  }

  const assignments = parseJson<Record<string, number>>(row.assignments, {});
  if (row.status === "ended") {
    const sender = Object.entries(assignments).find(([, target]) => target === studentNumber)?.[0];
    const entry = sender
      ? await getDatabase()
          .prepare(
            "SELECT student_number, viewed_at, letter, strength_one, strength_two FROM student_entries WHERE class_id = ? AND student_number = ?"
          )
          .bind(row.id, Number(sender))
          .first<EntryRow>()
      : null;
    return {
      mode: "ended",
      className: row.name,
      received: {
        letter: entry?.letter ?? "",
        strengths: [entry?.strength_one ?? "", entry?.strength_two ?? ""].filter(Boolean),
      },
    };
  }

  await getDatabase()
    .prepare(
      "INSERT INTO student_entries (class_id, student_number, viewed_at, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT(class_id, student_number) DO UPDATE SET viewed_at = COALESCE(student_entries.viewed_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP"
    )
    .bind(row.id, studentNumber)
    .run();
  const entry = await getDatabase()
    .prepare(
      "SELECT student_number, viewed_at, letter, strength_one, strength_two FROM student_entries WHERE class_id = ? AND student_number = ?"
    )
    .bind(row.id, studentNumber)
    .first<EntryRow>();
  const missions = parseJson<Record<string, string>>(row.custom_missions, {});
  return {
    mode: "active",
    className: row.name,
    targetNumber: assignments[String(studentNumber)],
    customMission: missions[String(studentNumber)] ?? "",
    reflection: {
      letter: entry?.letter ?? "",
      strengths: [entry?.strength_one ?? "", entry?.strength_two ?? ""],
    },
  };
}

async function saveReflection(payload: Record<string, unknown>) {
  const code = cleanCode(payload.code);
  const studentNumber = Number(payload.studentNumber);
  const row = await findClass(code);
  if (!row) throw new Response("반 코드를 확인해 주세요.", { status: 404 });
  if (row.status !== "active") {
    throw new Response("종료된 활동에는 내용을 저장할 수 없어요.", { status: 409 });
  }
  if (!Number.isInteger(studentNumber) || !participantsFor(row).includes(studentNumber)) {
    throw new Response("참여하는 번호를 정확히 입력해 주세요.", { status: 400 });
  }
  const reflectionType = String(payload.reflectionType ?? "");
  const strengths = Array.isArray(payload.strengths) ? payload.strengths : [];
  const letter = reflectionType === "letter" ? cleanText(payload.letter, 200) : "";
  const strengthOne = reflectionType === "strengths" ? cleanText(strengths[0], 50) : "";
  const strengthTwo = reflectionType === "strengths" ? cleanText(strengths[1], 50) : "";
  if (reflectionType === "letter" && !letter) {
    throw new Response("비밀 편지를 작성해 주세요.", { status: 400 });
  }
  if (reflectionType === "strengths" && (!strengthOne || !strengthTwo)) {
    throw new Response("마니또의 장점 두 가지를 모두 작성해 주세요.", { status: 400 });
  }
  if (reflectionType !== "letter" && reflectionType !== "strengths") {
    throw new Response("비밀 편지 또는 장점 2가지 중 하나를 선택해 주세요.", { status: 400 });
  }
  await getDatabase()
    .prepare(
      "INSERT INTO student_entries (class_id, student_number, viewed_at, letter, strength_one, strength_two, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(class_id, student_number) DO UPDATE SET letter = excluded.letter, strength_one = excluded.strength_one, strength_two = excluded.strength_two, updated_at = CURRENT_TIMESTAMP"
    )
    .bind(row.id, studentNumber, letter, strengthOne, strengthTwo)
    .run();
  return { saved: true };
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const action = String(payload.action ?? "");
    if (action === "createClass") return Response.json(await createClass(payload), { status: 201 });
    if (action === "teacherOpen") {
      const row = await requireTeacher(payload.code, payload.pin);
      return Response.json(await teacherDashboard(row));
    }
    if (action === "studentCheck") return Response.json(await studentCheck(payload));
    if (action === "saveReflection") return Response.json(await saveReflection(payload));
    if (action === "endActivity") {
      const row = await requireTeacher(payload.code, payload.pin);
      await getDatabase().prepare("UPDATE classes SET status = 'ended' WHERE id = ?").bind(row.id).run();
      const updated = await findClass(row.code);
      return Response.json(await teacherDashboard(updated!));
    }
    if (action === "deleteClass") {
      const row = await requireTeacher(payload.code, payload.pin);
      await getDatabase().prepare("DELETE FROM student_entries WHERE class_id = ?").bind(row.id).run();
      await getDatabase().prepare("DELETE FROM classes WHERE id = ?").bind(row.id).run();
      return Response.json({ deleted: true });
    }
    throw new Response("알 수 없는 요청입니다.", { status: 400 });
  } catch (error) {
    if (error instanceof Response) {
      return Response.json({ error: await error.text() }, { status: error.status });
    }
    console.error(error);
    return Response.json(
      { error: error instanceof Error ? error.message : "잠시 뒤 다시 시도해 주세요." },
      { status: 500 }
    );
  }
}
