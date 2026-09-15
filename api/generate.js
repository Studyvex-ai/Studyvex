export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { text, task } = req.body || {};

    if (!text || !text.trim()) {
      return res.status(400).json({ error: "Please provide study material." });
    }

    let instruction = "";

    if (task === "summary") {
      instruction =
        "Summarize the study material clearly for a university student. Focus on the important concepts, definitions, mechanisms, and relationships. Use headings and bullet points.";
    } else if (task === "mcq") {
      instruction =
        "Create 10 university-level multiple-choice questions from the study material. Each question must have four options (A, B, C, D). Include the correct answer and a short explanation after each question.";
    } else if (task === "flashcards") {
      instruction =
        "Create useful study flashcards from the material. Format each one as Question: followed by Answer:. Focus on important concepts rather than trivial details.";
    } else {
      return res.status(400).json({ error: "Invalid task." });
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-5.6-luna",
        input: `${instruction}\n\nStudy material:\n${text}`,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || "OpenAI API request failed.",
      });
    }

    return res.status(200).json({
      result: data.output_text || "No result was generated.",
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Something went wrong while generating the result.",
    });
  }
}
