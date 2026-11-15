import { QUESTIONS } from "../_lib/content"

// "Questions people ask first": the title on the left, the questions and answers on the right
export function Questions() {
  return (
    <section className="sect wrap faq" id="questions" aria-labelledby="faq-title">
      <div className="head">
        <p className="eyebrow">{QUESTIONS.eyebrow}</p>
        <h2 className="h2" id="faq-title">
          {QUESTIONS.title}
        </h2>
      </div>
      <div className="faq-list">
        {QUESTIONS.items.map((item) => (
          <div key={item.question}>
            <h3>{item.question}</h3>
            <p>{item.answer}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
