export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    const {
      text = "",
      book = "",
      chapter = "",
      fromPage = "",
      toPage = "",
      mode = "summary",
      task = "summary",
      language = "en",
      count = 10,
    } = req.body || {};

    const allowedModes = [
      "book",
      "pages",
      "presentation",
      "summary",
    ];

    const allowedTasks = [
      "summary",
      "quiz",
      "mcq",
      "flashcards",
      "voice",
    ];

    if (!allowedModes.includes(mode)) {
      return res.status(400).json({
        error: "Invalid service mode.",
      });
    }

    if (!allowedTasks.includes(task)) {
      return res.status(400).json({
        error: "Invalid output type.",
      });
    }

    const cleanText = String(text).trim();
    const cleanBook = String(book).trim();
    const cleanChapter = String(chapter).trim();

    if (cleanText.length > 20000) {
      return res.status(400).json({
        error: "Study material is too long. Keep it under 20,000 characters.",
      });
    }

    /*
      التلخيص والـ Quiz والـ Flashcards يجب أن تعتمد على نص فعلي
      حتى لا يخترع النظام محتوى كتاب غير متوفر.
    */
    if (
      mode !== "presentation" &&
      !cleanText
    ) {
      return res.status(400).json({
        error:
          language === "ar"
            ? "ألصق نص الفصل أو الصفحات أولًا حتى ننتج نتيجة دقيقة."
            : "Please paste the chapter or page text first for an accurate result.",
      });
    }

    /*
      العرض التقديمي يمكن إنشاؤه من موضوع أو عنوان كتاب أو محتوى.
    */
    if (
      mode === "presentation" &&
      !cleanText &&
      !cleanBook
    ) {
      return res.status(400).json({
        error:
          language === "ar"
            ? "أضف موضوع العرض أو اسم الكتاب أو رابطًا أو محتوى."
            : "Add a presentation topic, book title, source link, or content.",
      });
    }

    const isArabic = language === "ar";
    const responseLanguage = isArabic
      ? "Write the entire response in Arabic."
      : "Write the entire response in English.";

    const metadata = `
Book or topic: ${cleanBook || "Not provided"}
Chapter or unit: ${cleanChapter || "Not provided"}
Page range: ${
      fromPage || toPage
        ? `${fromPage || "?"} to ${toPage || "?"}`
        : "Not provided"
    }
Service mode: ${mode}
Requested output: ${task}
`;

    let instruction = "";

    if (mode === "presentation") {
      instruction = `
Create a complete professional presentation outline.

Include:
- A strong title slide
- 8 to 12 slides total
- Slide title for every slide
- Clear bullet-point content for every slide
- Suggested image or visual for every slide
- A final conclusion slide
- Speaker notes when useful

The presentation must be practical, organized, and ready to copy into PowerPoint or Google Slides.
If a website link is included, do not claim that you accessed it unless its contents were pasted by the user.
`;
    } else if (task === "summary") {
      instruction = `
Create a clear, structured study summary.

Include:
- A short overview
- Main ideas with headings
- Important definitions
- Key concepts and relationships
- A short "Quick Revision" section at the end

Focus only on the supplied study material. Do not invent missing facts.
`;
    } else if (task === "voice") {
      instruction = `
Create a clear study summary written as a natural narration script.

Requirements:
- Use simple spoken language
- Start with a short introduction
- Explain the main ideas in logical order
- End with a quick revision recap
- Do not mention that this is AI-generated

This returns narration text. Audio generation can be added later through a separate text-to-speech endpoint.
`;
    } else if (task === "quiz" || task === "mcq") {
      const questionCount = [5, 10, 15, 20, 30].includes(Number(count))
        ? Number(count)
        : 10;

      instruction = `
Create exactly ${questionCount} university-level multiple-choice questions.

Requirements:
- Four choices: A, B, C, and D
- State the correct answer after every question
- Add a one-sentence explanation
- Test understanding and application, not only memorization
- Use only supplied material
`;
    } else if (task === "flashcards") {
      instruction = `
Create useful flashcards from the supplied material.

Use exactly this format for every card:

Question: ...
Answer: ...

Create concise, high-value flashcards focused on definitions, concepts, processes, and important relationships.
`;
    }

    const prompt = `
${responseLanguage}

You are StudyVex, an accurate educational assistant.

${instruction}

Context:
${metadata}

User-provided study material:
${cleanText || "No pasted content was supplied. Use only the topic for a general presentation outline."}
`;

    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-5.6-luna",
          input: prompt,
          store: false,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error:
          data.error?.message ||
          "OpenAI API request failed.",
      });
    }

    /*
      REST Responses API returns text inside output[].
      output_text is a convenience property of the official SDK,
      so we extract the text here when using fetch directly.
    */
    const result = (data.output || [])
      .filter(item => item.type === "message")
      .flatMap(item => item.content || [])
      .filter(content => content.type === "output_text")
      .map(content => content.text)
      .join("\n")
      .trim();

    return res.status(200).json({
      result: result || (
        isArabic
          ? "لم يتم إنشاء نتيجة. حاول مرة أخرى."
          : "No result was generated. Please try again."
      ),
    });

  } catch (error) {
    console.error("Generate API error:", error);

    return res.status(500).json({
      error: "Something went wrong while generating the result.",
    });
  }
}
