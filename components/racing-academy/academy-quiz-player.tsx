"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { submitAcademyQuizV143 } from "@/app/actions/racing-academy";
import type { AcademyQuizAttemptDetailV143 } from "@/lib/racing-academy/quizzes";
import styles from "./academy-quiz-player.module.css";

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

export function AcademyQuizPlayer({ attempt }: { attempt: AcademyQuizAttemptDetailV143 }) {
  const formRef = useRef<HTMLFormElement>(null);
  const deadline = useMemo(() => attempt.timeLimitMinutes > 0
    ? new Date(attempt.startedAt).getTime() + attempt.timeLimitMinutes * 60_000
    : null, [attempt.startedAt, attempt.timeLimitMinutes]);
  const [remaining, setRemaining] = useState(() => deadline ? Math.max(0, Math.floor((deadline - Date.now()) / 1000)) : 0);
  const [selectedCount, setSelectedCount] = useState(0);
  const submittedAtZero = useRef(false);

  useEffect(() => {
    if (!deadline) return;
    const update = () => setRemaining(Math.max(0, Math.floor((deadline - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [deadline]);

  useEffect(() => {
    if (!deadline || remaining > 0 || submittedAtZero.current) return;
    submittedAtZero.current = true;
    formRef.current?.requestSubmit();
  }, [deadline, remaining]);

  return (
    <form ref={formRef} action={submitAcademyQuizV143} className={styles.exam} onChange={(event) => {
      const form = event.currentTarget;
      const answered = new Set<string>();
      new FormData(form).forEach((_value, key) => {
        if (key.startsWith("answer_")) answered.add(key);
      });
      setSelectedCount(answered.size);
    }}>
      <input type="hidden" name="attempt_id" value={attempt.id} />

      <div className={styles.topbar}>
        <div>
          <span>TENTATIVE {attempt.attemptNumber}/{attempt.maxAttempts}</span>
          <strong>{selectedCount}/{attempt.questions.length} réponses</strong>
        </div>
        <div className={`${styles.timer} ${deadline && remaining <= 60 ? styles.timerDanger : ""}`}>
          <span>{deadline ? "TEMPS RESTANT" : "SANS CHRONO"}</span>
          <strong>{deadline ? formatTime(remaining) : "∞"}</strong>
        </div>
        <div>
          <span>OBJECTIF</span>
          <strong>{attempt.passScore}/100</strong>
        </div>
      </div>

      {attempt.instructions && <div className={styles.instructions}>{attempt.instructions}</div>}

      <div className={styles.questions}>
        {attempt.questions.map((question, index) => {
          const options = [
            ["A", question.optionA],
            ["B", question.optionB],
            ["C", question.optionC],
            ["D", question.optionD],
          ].filter((entry): entry is [string, string] => Boolean(entry[1]));
          return (
            <fieldset className={styles.question} key={question.id}>
              <legend><span>QUESTION {index + 1}</span>{question.prompt}</legend>
              <div className={styles.options}>
                {options.map(([letter, label]) => (
                  <label className={styles.option} key={letter}>
                    <input type="radio" name={`answer_${question.id}`} value={letter} />
                    <span className={styles.letter}>{letter}</span>
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          );
        })}
      </div>

      <div className={styles.submitBar}>
        <div><strong>{selectedCount}/{attempt.questions.length}</strong> question(s) répondue(s)<small>Les questions sans réponse seront comptées comme fausses.</small></div>
        <button type="submit">VALIDER MON QUESTIONNAIRE</button>
      </div>
    </form>
  );
}
