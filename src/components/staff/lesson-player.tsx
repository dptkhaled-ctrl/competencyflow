"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Celebration } from "@/components/staff/celebration";
import { useAppStore } from "@/lib/store/app-store";
import { useCurrentOrg, useLessonProgress } from "@/lib/store/hooks";
import type { Lesson } from "@/lib/types";

interface LessonPlayerProps {
  lesson: Lesson;
}

export function LessonPlayer({ lesson }: LessonPlayerProps) {
  const progress = useLessonProgress(lesson.id);
  const startLesson = useAppStore((s) => s.startLesson);
  const advanceSlide = useAppStore((s) => s.advanceSlide);
  const completeQuiz = useAppStore((s) => s.completeQuiz);

  const [phase, setPhase] = useState<"slides" | "quiz" | "done">(
    progress?.status === "completed" ? "done" : "slides"
  );
  const [slideIndex, setSlideIndex] = useState(progress?.currentSlideIndex ?? 0);
  const [quizIndex, setQuizIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});

  const org = useCurrentOrg();
  const showCitations = true; // show sources for healthcare orgs
  const [deeperLoading, setDeeperLoading] = useState(false);
  const [deeperAnswer, setDeeperAnswer] = useState<string | null>(null);
  const [deeperCitations, setDeeperCitations] = useState<any[]>([]);

  const totalSlides = lesson.slides.length;
  const slideProgress = totalSlides > 0 ? ((slideIndex + 1) / totalSlides) * 100 : 100;
  const currentSlide = lesson.slides[slideIndex];

  const handleStart = () => {
    startLesson(lesson.id);
    setSlideIndex(0);
    setPhase("slides");
  };

  const handleNextSlide = () => {
    if (slideIndex < totalSlides - 1) {
      const next = slideIndex + 1;
      setSlideIndex(next);
      advanceSlide(lesson.id);
    } else {
      setPhase("quiz");
    }
  };

  // No longer used for bulk submit; quizzes are now per-question mastery
  // handleSubmitQuiz removed to enforce correct answers before advancing.

  const fetchDeeperDive = async (question: string) => {
    setDeeperLoading(true);
    setDeeperAnswer(null);
    setDeeperCitations([]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: org?.id, question }),
      });
      const data = await res.json();
      setDeeperAnswer(data.answer || "Sorry, no additional explanation available right now.");
      if (showCitations) {
        setDeeperCitations(data.citations || []);
      }
    } catch (e) {
      setDeeperAnswer("Unable to fetch deeper explanation at this time.");
    } finally {
      setDeeperLoading(false);
    }
  };

  if (!progress || progress.status === "not_started") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{lesson.title}</CardTitle>
          <Badge variant="secondary">{lesson.estimatedMinutes} min micro-lesson</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">{lesson.description}</p>
          <p className="text-sm">
            {totalSlides} slides · {lesson.quiz.length} quiz question
            {lesson.quiz.length !== 1 ? "s" : ""}
          </p>
          <Button onClick={handleStart} className="w-full" size="lg">
            Start lesson
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (phase === "done" || progress.status === "completed") {
    return (
      <div className="space-y-4">
        <Celebration score={100} />
        
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-muted-foreground">You answered all questions correctly.</p>
            <Badge variant="secondary" className="mt-2">Lesson complete</Badge>
          </CardContent>
        </Card>

        {/* Deeper dive buttons for every quiz question */}
        {lesson.quiz && lesson.quiz.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-center text-muted-foreground">Want to understand any answer better?</p>
            {lesson.quiz.map((q, idx) => {
              const userChoice = selectedAnswers[q.id];
              const wasCorrect = userChoice === q.correctIndex;
              return (
                <div key={idx} className="rounded-xl border p-3 bg-white text-sm">
                  <p className="font-medium mb-1">{q.prompt}</p>
                  <p className="text-xs text-muted-foreground">
                    Your answer: {userChoice !== undefined ? q.options[userChoice] : "—"} 
                    {wasCorrect ? " ✓" : " (review recommended)"}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    disabled={deeperLoading}
                    onClick={() => {
                      const deeperQ = `Explain this quiz question in more detail and why the correct answer is right: "${q.prompt}". The correct choice is: ${q.options[q.correctIndex]}. ${q.explanation ? 'Explanation from lesson: ' + q.explanation : ''}`;
                      fetchDeeperDive(deeperQ);
                    }}
                  >
                    {deeperLoading ? "Loading..." : "Deeper dive on this question"}
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {deeperAnswer && (
          <div className="mt-2 p-4 rounded-xl bg-white border border-slate-200">
            <div className="flex items-center gap-2 text-sm font-medium mb-2">
              <HelpCircle className="h-4 w-4" /> Deeper explanation
            </div>
            <div className="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">
              {deeperAnswer}
            </div>
            {showCitations && deeperCitations.length > 0 && (
              <div className="mt-3 text-[10px] text-muted-foreground border-t pt-2">
                From: {deeperCitations.map((c: any, i: number) => (
                  <span key={i}>{c.documentTitle} — {c.section}{i < deeperCitations.length-1 ? ", " : ""}</span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (phase === "quiz") {
    const totalQs = lesson.quiz.length;
    const currentQ = lesson.quiz[quizIndex];
    const userChoice = selectedAnswers[currentQ.id];
    const isCorrect = userChoice === currentQ.correctIndex;

    const goToNextQ = () => {
      if (!isCorrect) return; // enforce correct before moving on
      if (quizIndex < totalQs - 1) {
        setQuizIndex(quizIndex + 1);
      } else {
        // Only reached here if this (last) question was answered correctly
        completeQuiz(lesson.id, 100);
        setPhase("done");
        setDeeperAnswer(null);
        setDeeperCitations([]);
      }
    };

    const goToPrevQ = () => {
      if (quizIndex > 0) setQuizIndex(quizIndex - 1);
    };

    const resetCurrentQuestion = () => {
      setSelectedAnswers((prev) => {
        const next = { ...prev };
        delete next[currentQ.id];
        return next;
      });
    };

    return (
      <div className="space-y-4">
        {/* Distinct Quiz Box */}
        <div className="rounded-2xl border-2 border-orange-200 bg-orange-50/50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="rounded-full bg-orange-500 text-white text-xs font-bold px-2.5 py-0.5">QUIZ</div>
            <span className="text-sm font-semibold text-orange-900">Quick check — {lesson.title}</span>
          </div>

          <div className="mb-3 text-xs text-orange-700">
            Question {quizIndex + 1} of {totalQs} — get it right to continue
          </div>

          <p className="font-medium text-base mb-3 text-slate-900">{currentQ.prompt}</p>

          <div className="space-y-2">
            {currentQ.options.map((opt, i) => (
              <button
                key={i}
                type="button"
                onClick={() =>
                  setSelectedAnswers((prev) => ({ ...prev, [currentQ.id]: i }))
                }
                disabled={isCorrect} // lock once correct
                className={`w-full rounded-xl border p-3 text-left text-sm transition-all ${
                  selectedAnswers[currentQ.id] === i
                    ? isCorrect
                      ? "border-emerald-400 bg-emerald-50 ring-2 ring-emerald-200"
                      : "border-red-400 bg-red-50 ring-2 ring-red-200"
                    : "border-slate-200 bg-white hover:border-orange-200 hover:bg-orange-50/30"
                }`}
              >
                <span className="font-semibold mr-2">{String.fromCharCode(65 + i)}.</span> {opt}
              </button>
            ))}
          </div>

          {/* Immediate feedback: explain wrong answers and force retry */}
          {userChoice !== undefined && (
            <div className={`mt-3 p-3 rounded-xl text-sm ${isCorrect ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200"}`}>
              {isCorrect ? (
                <div>
                  <span className="font-semibold text-emerald-800">Correct!</span>
                  {currentQ.explanation && (
                    <p className="mt-1 text-emerald-700">{currentQ.explanation}</p>
                  )}
                </div>
              ) : (
                <div>
                  <span className="font-semibold text-red-800">Not quite.</span>
                  <p className="mt-1 text-red-700">
                    {currentQ.explanation || `The correct answer is: ${currentQ.options[currentQ.correctIndex]}.`}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 border-red-300 text-red-700"
                    onClick={resetCurrentQuestion}
                  >
                    Try again
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Deeper dive available after picking (especially useful on wrong) */}
          {userChoice !== undefined && (
            <div className="mt-3">
              <Button
                size="sm"
                variant="outline"
                disabled={deeperLoading}
                onClick={() => {
                  const choiceText = currentQ.options[userChoice];
                  const correctText = currentQ.options[currentQ.correctIndex];
                  const deeperQ = `Explain why "${choiceText}" is not the best answer for: "${currentQ.prompt}". The correct choice is "${correctText}". ${currentQ.explanation ? currentQ.explanation : ''}`;
                  fetchDeeperDive(deeperQ);
                }}
              >
                {deeperLoading ? "Loading..." : "Deeper dive on this question"}
              </Button>
            </div>
          )}

          <div className="flex gap-3 mt-4">
            <Button
              variant="outline"
              onClick={goToPrevQ}
              disabled={quizIndex === 0}
              className="border-orange-200"
            >
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <Button
              className="flex-1 bg-orange-600 hover:bg-orange-700"
              size="lg"
              onClick={goToNextQ}
              disabled={!isCorrect}  // only let them move forward when this question is correct
            >
              {quizIndex < totalQs - 1 ? "Next question" : "Complete lesson"}
              {quizIndex < totalQs - 1 && <ArrowRight className="h-4 w-4 ml-1" />}
            </Button>
          </div>

          <p className="text-center text-[10px] text-orange-700 mt-2">
            You must select the correct answer to continue. Use "Deeper dive" for extra help on any question.
          </p>
        </div>

        {deeperAnswer && (
          <div className="p-4 rounded-xl bg-white border border-slate-200">
            <div className="flex items-center gap-2 text-sm font-medium mb-2">
              <HelpCircle className="h-4 w-4" /> Deeper explanation (for current question)
            </div>
            <div className="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">
              {deeperAnswer}
            </div>
            {showCitations && deeperCitations.length > 0 && (
              <div className="mt-3 text-[10px] text-muted-foreground border-t pt-2">
                From: {deeperCitations.map((c: any, i: number) => (
                  <span key={i}>{c.documentTitle} — {c.section}{i < deeperCitations.length-1 ? ", " : ""}</span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Separated boxes simple UI for the lesson content (all slides visible as distinct boxes)
  return (
    <div className="space-y-5">
      {lesson.slides.map((slide, idx) => (
        <div
          key={idx}
          className="rounded-2xl border bg-white shadow-sm overflow-hidden"
        >
          <div className="bg-gradient-to-r from-indigo-50 to-white px-4 py-2.5 border-b flex items-center gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-bold">
              {idx + 1}
            </div>
            <div className="font-semibold text-base text-slate-800 tracking-tight">
              {slide.title || `Key point ${idx + 1}`}
            </div>
          </div>
          <div className="p-5">
            {slide.body.includes("•") || slide.body.includes("\n-") || slide.body.includes("\n*") ? (
              <ul className="text-[15px] leading-relaxed text-slate-700 space-y-1 list-disc pl-5">
                {slide.body
                  .split(/\n+/)
                  .map((line, li) => line.trim())
                  .filter(Boolean)
                  .map((line, li) => (
                    <li key={li}>{line.replace(/^[-•*]\s*/, "")}</li>
                  ))}
              </ul>
            ) : (
              <div className="text-[15px] leading-relaxed text-slate-700 whitespace-pre-wrap">{slide.body}</div>
            )}
            <div className="mt-3 text-[10px] uppercase tracking-wider text-indigo-500 font-medium">From your organization&apos;s materials</div>
          </div>
        </div>
      ))}

      {/* Big friendly action to move to the quiz box */}
      <div className="pt-2">
        <Button
          className="w-full h-12 text-base shadow-sm"
          size="lg"
          onClick={() => setPhase("quiz")}
        >
          I&apos;ve reviewed the sections — start the quiz
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
        <p className="text-center text-[10px] text-muted-foreground mt-2">
          Clear, separated content boxes. One focused quiz at the end.
        </p>
      </div>
    </div>
  );
}