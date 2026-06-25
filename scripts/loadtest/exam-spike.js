// k6 load test for the CBT student exam flow — exercises the login→answer→
// autosave→submit journey at high concurrency to validate the 5,000-student
// spike (nginx + PHP-FPM + Redis + queued grading).
//
//   1. Seed data + credentials (on a box with the DB):
//        php artisan loadtest:seed-exam --students=5000 --force
//   2. Run against the offline server (IS_OFFLINE_SERVER=true):
//        k6 run -e BASE_URL=http://<host>:8000 -e VUS=5000 scripts/loadtest/exam-spike.js
//
// See scripts/loadtest/README.md for the full guide (OS limits, distributed k6).

import http from "k6/http";
import { check, sleep } from "k6";
import { SharedArray } from "k6/data";
import exec from "k6/execution";
import { Trend } from "k6/metrics";

// ── Config (all overridable with -e KEY=value) ──────────────────────────────
const BASE_URL = (__ENV.BASE_URL || "http://localhost:8000").replace(/\/$/, "");
const CREDENTIALS = __ENV.CREDENTIALS || "./credentials.json";
const ANSWERS = Number(__ENV.ANSWERS || 10); // questions answered per student
const THINK = Number(__ENV.THINK ?? 0.3); // seconds between answers (0 = pure spike)

// Credentials are loaded once and shared across all VUs (not copied per-VU).
const creds = new SharedArray("creds", () => JSON.parse(open(CREDENTIALS)).credentials);

const VUS = Number(__ENV.VUS || 200);
// One iteration == one student's full journey, and each iteration consumes a
// unique credential, so never run more iterations than we have credentials
// (codes can't be submitted twice).
const ITERATIONS = Math.min(Number(__ENV.ITERATIONS || creds.length), creds.length);

// Per-stage latency so you can see where time goes under load.
const loginTrend = new Trend("exam_login_duration", true);
const submitTrend = new Trend("exam_submit_duration", true);

export const options = {
  scenarios: {
    // shared-iterations: VUS workers drain ITERATIONS journeys. Set VUS=5000 for
    // a true 5k-concurrent spike; lower VUS to model steady throughput instead.
    exam_spike: {
      executor: "shared-iterations",
      vus: VUS,
      iterations: ITERATIONS,
      maxDuration: __ENV.MAX_DURATION || "15m",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"], // <1% errors
    checks: ["rate>0.99"],
    "http_req_duration{endpoint:login}": ["p(95)<1500"],
    "http_req_duration{endpoint:answer}": ["p(95)<800"],
    "http_req_duration{endpoint:autosave}": ["p(95)<1000"],
    "http_req_duration{endpoint:submit}": ["p(95)<1500"],
  },
};

export function setup() {
  const res = http.get(`${BASE_URL}/api/health`);
  const body = res.json();
  check(res, { "health ok": (r) => r.status === 200 });
  if (!body || body.offline_server !== true) {
    // Student exam routes only exist on the offline server (EnsureOfflineMode).
    throw new Error(
      `Target ${BASE_URL} is not an offline server (IS_OFFLINE_SERVER must be true). /api/health => ${res.body}`,
    );
  }
  console.log(`Loaded ${creds.length} credentials; running ${ITERATIONS} journeys with ${VUS} VUs.`);
}

export default function () {
  const cred = creds[exec.scenario.iterationInTest];
  if (!cred) return; // safety: more iterations than credentials

  // ── 1. Login ──────────────────────────────────────────────────────────────
  const loginRes = http.post(
    `${BASE_URL}/api/student/exam/login`,
    JSON.stringify({ matric_number: cred.matric_number, exam_code: cred.exam_code }),
    { headers: { "Content-Type": "application/json", Accept: "application/json" }, tags: { endpoint: "login" } },
  );
  loginTrend.add(loginRes.timings.duration);

  const ok = check(loginRes, {
    "login 200": (r) => r.status === 200,
    "login returns token": (r) => !!r.json("token"),
  });
  if (!ok) return;

  const token = loginRes.json("token");
  const questions = loginRes.json("questions") || [];
  const authHeaders = {
    headers: { "Content-Type": "application/json", Accept: "application/json", "X-Exam-Token": token },
  };

  // ── 2. Answer the first N questions (single debounced-style saves) ─────────
  const toAnswer = questions.slice(0, ANSWERS);
  const batch = [];
  for (const q of toAnswer) {
    const answer = answerFor(q);
    batch.push({ question_id: q.id, answer });

    const ans = http.post(
      `${BASE_URL}/api/student/exam/answer`,
      JSON.stringify({ question_id: q.id, answer, order_index: q.position }),
      { ...authHeaders, tags: { endpoint: "answer" } },
    );
    check(ans, { "answer 200": (r) => r.status === 200 });
    if (THINK > 0) sleep(THINK);
  }

  // ── 3. Bulk autosave (the periodic background save) ────────────────────────
  if (batch.length) {
    const auto = http.post(
      `${BASE_URL}/api/student/exam/autosave`,
      JSON.stringify({ answers: batch }),
      { ...authHeaders, tags: { endpoint: "autosave" } },
    );
    check(auto, { "autosave 200": (r) => r.status === 200 });
  }

  // ── 4. Submit (returns immediately; grading is queued) ─────────────────────
  const submitRes = http.post(
    `${BASE_URL}/api/student/exam/submit`,
    JSON.stringify({ auto_submitted: false }),
    { ...authHeaders, tags: { endpoint: "submit" } },
  );
  submitTrend.add(submitRes.timings.duration);
  check(submitRes, {
    "submit 200": (r) => r.status === 200,
    "submit acknowledged": (r) => r.json("submitted_at") !== undefined,
  });
}

// A valid answer for the question's type: option label for choice questions,
// a plain string for fill-in-the-blank. Correctness doesn't matter for load.
function answerFor(q) {
  if (q.question_type === "fill_blank" || !q.options || q.options.length === 0) {
    return "answer";
  }
  return q.options[0].label;
}
