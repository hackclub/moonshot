// @ts-nocheck
// Vanilla version without animation libraries
import { useState } from "react";

export default function FaqDisclosure() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = [
    { question: "What is this?", answer: "A simple FAQ example with two questions." },
    { question: "How does it work?", answer: "Click a question to expand or collapse its answer." }
  ];

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="p-4 space-y-4">
      {faqs.map((faq, index) => (
        <div key={index} className="not-last:border-b border-dark-brown">
          <button
            onClick={() => toggle(index)}
            className="w-full text-left text-dark-brown/60 hover:text-dark-brown transition py-2 font-semibold flex justify-between"
          >
            <span>{faq.question}</span>
            <span>{openIndex === index ? '➖' : '➕'}</span>
          </button>
          {openIndex === index && (
            <div className="text-dark-brown">
              <p className="py-2 text-sm md:text-base">{faq.answer}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}