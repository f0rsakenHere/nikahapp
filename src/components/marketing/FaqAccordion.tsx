"use client";

import { useState } from "react";

type FaqItem = { readonly q: string; readonly a: string };

export function FaqAccordion({ items }: { items: readonly FaqItem[] }) {
  const [active, setActive] = useState<number | null>(0);

  return (
    <div className="landing-faq-list">
      {items.map((item, index) => {
        const expanded = active === index;
        const questionId = `landing-faq-question-${index}`;
        const answerId = `landing-faq-answer-${index}`;

        return (
          <div className="landing-faq-item" data-open={expanded} key={item.q}>
            <h3 className="landing-faq-question-heading">
              <button
                type="button"
                id={questionId}
                className="landing-faq-trigger"
                aria-expanded={expanded}
                aria-controls={answerId}
                onClick={() => setActive((current) => current === index ? null : index)}
              >
                <span className="landing-faq-question">{item.q}</span>
                <span className="landing-faq-toggle" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                </span>
              </button>
            </h3>
            <div
              id={answerId}
              className="landing-faq-answer"
              role="region"
              aria-labelledby={questionId}
              aria-hidden={!expanded}
              inert={!expanded}
            >
              <div className="landing-faq-answer-inner"><p>{item.a}</p></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
