import { FormEvent, useMemo, useState } from "react";
import {
  initialMessages,
  PracticeMessage,
  replySequence,
  rubric,
} from "../data/prototype";

const starter = "That sounds meaningful. What part are you most proud of?";

export function usePracticeSession() {
  const [messages, setMessages] =
    useState<PracticeMessage[]>(initialMessages);
  const [input, setInput] = useState(starter);
  const [userTurns, setUserTurns] = useState(1);
  const [isScored, setIsScored] = useState(false);

  const score = useMemo(() => {
    const total = rubric.reduce((sum, item) => sum + item.score, 0);
    return (total / rubric.length).toFixed(1);
  }, []);

  function submit(event?: FormEvent) {
    event?.preventDefault();
    const body = input.trim();

    if (!body || isScored) {
      return;
    }

    const nextTurn = userTurns + 1;
    const you: PracticeMessage = {
      id: Date.now(),
      speaker: "you",
      body,
    };

    const nextReply = replySequence[nextTurn - 2];
    const additions: PracticeMessage[] = [you];

    if (nextReply) {
      additions.push({
        id: Date.now() + 1,
        speaker: "her",
        body: nextReply,
      });
    }

    setMessages((current) => [...current, ...additions]);
    setUserTurns(nextTurn);
    setInput(
      nextTurn >= 3
        ? ""
        : "I built it because I used to overthink moments like this. Want to trade notes over coffee after the talks?",
    );

    if (nextTurn >= 3) {
      setIsScored(true);
    }
  }

  function reset() {
    setMessages(initialMessages);
    setInput(starter);
    setUserTurns(1);
    setIsScored(false);
  }

  return {
    input,
    isScored,
    messages,
    score,
    setInput,
    submit,
    reset,
    userTurns,
  };
}
