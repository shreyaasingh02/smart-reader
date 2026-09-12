const express = require("express");
const multer = require("multer");
const supabase = require("../supabase")
const Book = require("../models/Book")
const authMiddleware = require("../middleware/authMiddleware");


const router = express.Router();



const upload = multer({ storage: multer.memoryStorage() }); // tells when a file arrives temporarily keeps it in a memory

router.post("/", authMiddleware, upload.fields([{ name: "pdf", maxCount: 1 }, { name: "cover", maxCount: 1 }]), async (req, res) => {
  let pdfPath = null;
  let coverPath = null;

  try {
    const pdf = req.files.pdf[0];
    const cover = req.files.cover[0];

    // One unique ID for both files
    const fileId = Date.now();

    const pdfFileName = `${fileId}-${pdf.originalname}`;
    const coverFileName = `${fileId}-${pdf.originalname}.jpg`;

    // 1. Upload PDF to Supabase
    const { data: pdfData, error: pdfError } = await supabase.storage.from("books").upload(`pdfs/${pdfFileName}`, pdf.buffer, { contentType: pdf.mimetype });

    if (pdfError) {
      console.log("PDF upload error:", pdfError);

      return res.status(500).json({ message: "PDF upload failed" });
    }
    pdfPath = pdfData.path;

    // 2. Upload cover to Supabase
    const { data: coverData, error: coverError } = await supabase.storage.from("books").upload(`covers/${coverFileName}`, cover.buffer, { contentType: cover.mimetype });

    if (coverError) {
      console.log("Cover upload error:", coverError);

      // Delete PDF if cover upload failed
      await supabase.storage.from("books").remove([pdfPath]);

      return res.status(500).json({ message: "Cover upload failed" });
    }
    coverPath = coverData.path;

    // 3. Create MongoDB document
    const title = pdf.originalname.replace(/\.pdf$/i, "");

    const book = new Book({
      title: title,
      pdfPath: pdfPath,
      coverPath: coverPath,
      userId: req.userId
    });

    const savedBook = await book.save();

    // 4. Send saved book back to React
    res.status(201).json({ message: "Book uploaded successfully", book: savedBook });
  } catch (error) {
    console.log("Server error:", error);
    // If MongoDB failed after files were uploaded,
    // remove the files from Supabase.
    const filesToDelete = [];

    if (pdfPath) {
      filesToDelete.push(pdfPath);
    }

    if (coverPath) {
      filesToDelete.push(coverPath);
    }

    if (filesToDelete.length > 0) { await supabase.storage.from("books").remove(filesToDelete); }

    res.status(500).json({ message: "Book upload failed" });
  }
});

router.get("/", authMiddleware, async (req, res) => {
  try {
    const books = await Book.find({ userId: req.userId }).sort({ uploadedAt: -1 });

    const booksWithUrls = await Promise.all(
      books.map(async (book) => {

        const { data: coverData, error: coverError } =
          await supabase.storage
            .from("books")
            .createSignedUrl(book.coverPath, 60 * 60);

        const { data: pdfData, error: pdfError } =
          await supabase.storage
            .from("books")
            .createSignedUrl(book.pdfPath, 60 * 60);

        if (coverError) {
          console.log("Cover URL error:", coverError);
        }

        if (pdfError) {
          console.log("PDF URL error:", pdfError);
        }

        return {
          ...book.toObject(),
          coverUrl: coverData?.signedUrl || null,
          pdfUrl: pdfData?.signedUrl || null
        };
      })
    );

    res.json(booksWithUrls);

  } catch (error) {
    console.log("Error fetching books:", error);

    res.status(500).json({
      message: "Failed to fetch books"
    });
  }
});

router.delete("/:id", authMiddleware, async (req, res) => {
  console.log("🔥 NEW DELETE ROUTE HIT");

  try {
    const book = await Book.findOne({
      _id: req.params.id,
      userId: req.userId
    });

    if (!book) {
      return res.status(404).json({
        message: "Book not found"
      });
    }

    console.log("📄 PDF path:", book.pdfPath);
    console.log("🖼️ Cover path:", book.coverPath);

    const filesToDelete = [
      book.pdfPath,
      book.coverPath
    ].filter(Boolean);

    console.log("🗑️ Deleting:", filesToDelete);

    const { data, error } = await supabase.storage
      .from("books")
      .remove(filesToDelete);

    console.log("🗑️ Supabase result:", data);
    console.log("❌ Supabase error:", error);

    if (error) {
      return res.status(500).json({
        message: "Supabase deletion failed",
        error: error.message
      });
    }

    await Book.deleteOne({
      _id: book._id,
      userId: req.userId
    });

    res.json({
      message: "Book, PDF and cover deleted successfully"
    });

  } catch (error) {
    console.error("❌ Delete book error:", error);

    res.status(500).json({
      message: "Failed to delete book",
      error: error.message
    });
  }
});

router.put("/:id/page", authMiddleware, async (req, res) => {
  try {
    const { pageNumber } = req.body;

    const book = await Book.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.userId
      },
      {
        lastPage: pageNumber
      },
      {
        new: true
      }
    );

    if (!book) {
      return res.status(404).json({
        message: "Book not found"
      });
    }
    res.json(book);
  }
  catch (error) {
    console.log("failed updating", error)
  }
})

router.put("/:id/total-pages", authMiddleware, async (req, res) => {
  try {
    const { totalPages } = req.body;

    const book = await Book.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { totalPages: totalPages },
      { new: true }
    );

    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }

    res.json(book);
  } catch (error) {
    console.log("Failed updating total pages:", error);
    res.status(500).json({ message: "Failed to save total pages" });
  }
});

// routes/books.js — POST /:id/highlights
router.post("/:id/highlights", authMiddleware, async (req, res) => {
  try {
    const { text, color, pageNumber, anchor, rects } = req.body;
    const book = await Book.findOne({ _id: req.params.id, userId: req.userId });
    if (!book) return res.status(404).json({ message: "Book not found" });

    book.highlights.push({ text, color, pageNumber, anchor, rects });
    await book.save();

    const savedHighlight = book.highlights[book.highlights.length - 1];
    res.status(201).json({ message: "Highlight saved!", highlight: savedHighlight });
  } catch (error) {
    console.log("Failed to save highlight:", error);
    res.status(500).json({ message: "Failed to save highlight" });
  }
});

router.delete(
  "/:bookId/highlights/:highlightId",
  authMiddleware,
  async (req, res) => {
    console.log("DELETE HIGHLIGHT ROUTE HIT");

    try {
      const book = await Book.findOneAndUpdate(
        {
          _id: req.params.bookId,
          userId: req.userId
        },
        {
          $pull: {
            highlights: {
              _id: req.params.highlightId
            }
          }
        }
      );

      if (!book) {
        return res.status(404).json({
          message: "Book not found"
        });
      }

      res.json({
        message: "Highlight deleted!"
      });

    } catch (error) {
      console.log("can't delete highlight", error);

      res.status(500).json({
        message: "Failed to delete highlight"
      });
    }
  }
);

router.post("/meaning", authMiddleware, async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({
        message: "No word selected"
      });
    }

    const originalWord = text.trim().toLowerCase();

    // For now, meaning lookup is for a single word
    const word = originalWord.split(/\s+/)[0];

    console.log("🔎 Looking up meaning for:", word);

    // --------------------------------------------------
    // STEP 1: Get dictionary meanings from Datamuse
    // --------------------------------------------------

    const dictionaryUrl =
      `https://api.datamuse.com/words?sp=${encodeURIComponent(word)}&md=dp&max=10`;

    const dictionaryResponse = await fetch(dictionaryUrl);
    const dictionaryText = await dictionaryResponse.text();

    let dictionaryData;

    try {
      dictionaryData = JSON.parse(dictionaryText);
    } catch (error) {
      console.error("❌ Datamuse returned invalid JSON");

      return res.status(502).json({
        message: "Dictionary service failed"
      });
    }

    if (
      !dictionaryResponse.ok ||
      !Array.isArray(dictionaryData)
    ) {
      return res.status(404).json({
        message: "Meaning not found"
      });
    }

    // Extract definitions
    const rawMeanings = [];

    dictionaryData.forEach((item) => {
      if (!item.defs || !Array.isArray(item.defs)) {
        return;
      }

      item.defs.forEach((definition) => {
        const parts = definition.split("\t");

        const partOfSpeech = parts[0] || "";
        const definitionText = parts
          .slice(1)
          .join("\t")
          .trim();

        if (definitionText) {
          rawMeanings.push({
            partOfSpeech,
            definition: definitionText
          });
        }
      });
    });

    if (rawMeanings.length === 0) {
      return res.status(404).json({
        message: "Meaning not found"
      });
    }

    console.log(
      "📚 Raw meanings found:",
      rawMeanings.length
    );

    // --------------------------------------------------
    // STEP 2: Simplify meanings using Gemini
    // --------------------------------------------------

    if (!process.env.GEMINI_API_KEY) {
      console.error("❌ GEMINI_API_KEY is missing");

      // If Gemini key is missing, return dictionary meanings
      // instead of breaking the whole feature.
      return res.json({
        word: originalWord,
        baseWord: word,
        meanings: rawMeanings
      });
    }

    const prompt = `
You are helping a student understand words while reading a book.

Word:
"${word}"

Here are dictionary meanings for the word:

${JSON.stringify(rawMeanings)}

Rewrite these meanings into VERY SIMPLE, NATURAL English that a student can understand easily.

IMPORTANT RULES:

1. Keep the meanings accurate.
2. Do NOT invent new meanings.
3. Give the different common meanings/usages of the word.
4. Remove difficult dictionary language.
5. Do not use words that are harder than the original word unless absolutely necessary.
6. Each meaning should be short — preferably one simple sentence.
7. If two definitions mean almost the same thing, combine them.
8. Keep different contexts when they are genuinely different.
9. Keep the correct part of speech.
10. Do NOT include "countable", "uncountable", "transitive", "intransitive", etc.
11. Do NOT include dictionary symbols or abbreviations.
12. Return only the JSON requested by the schema.
`;

    const geminiResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY
        },

        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ],

          generationConfig: {
            response_mime_type: "application/json",

            response_schema: {
              type: "ARRAY",

              items: {
                type: "OBJECT",

                properties: {
                  partOfSpeech: {
                    type: "STRING"
                  },

                  definition: {
                    type: "STRING"
                  }
                },

                required: [
                  "partOfSpeech",
                  "definition"
                ]
              }
            }
          }
        })
      }
    );

    const geminiText = await geminiResponse.text();

    console.log(
      "🤖 Gemini status:",
      geminiResponse.status
    );

    if (!geminiResponse.ok) {
      console.error(
        "❌ Gemini error:",
        geminiText
      );

      // Fallback to dictionary meanings
      return res.json({
        word: originalWord,
        baseWord: word,
        meanings: rawMeanings
      });
    }

    let geminiData;

    try {
      geminiData = JSON.parse(geminiText);
    } catch (error) {
      console.error(
        "❌ Gemini returned invalid JSON:",
        geminiText
      );

      return res.json({
        word: originalWord,
        baseWord: word,
        meanings: rawMeanings
      });
    }

    const generatedText =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      console.error("❌ Gemini returned no text");

      return res.json({
        word: originalWord,
        baseWord: word,
        meanings: rawMeanings
      });
    }

    let simpleMeanings;

    try {
      simpleMeanings = JSON.parse(generatedText);
    } catch (error) {
      console.error(
        "❌ Could not parse Gemini meanings:",
        generatedText
      );

      return res.json({
        word: originalWord,
        baseWord: word,
        meanings: rawMeanings
      });
    }

    if (
      !Array.isArray(simpleMeanings) ||
      simpleMeanings.length === 0
    ) {
      return res.json({
        word: originalWord,
        baseWord: word,
        meanings: rawMeanings
      });
    }

    console.log(
      "✅ Simple meanings generated:",
      simpleMeanings.length
    );

    // --------------------------------------------------
    // STEP 3: Send to React
    // --------------------------------------------------

    return res.json({
      word: originalWord,
      baseWord: word,
      meanings: simpleMeanings
    });

  } catch (error) {
    console.error("❌ Meaning error:", error);

    return res.status(500).json({
      message: "Failed to get meaning"
    });
  }
});


router.post("/:id/notes", authMiddleware, async (req, res) => {
  try {

    const {
      text,
      selectedText,
      pageNumber,
      anchor
    } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({
        message: "Note text is required"
      });
    }

    if (!selectedText || !selectedText.trim()) {
      return res.status(400).json({
        message: "Selected text is required"
      });
    }

    const note = {
      text: text.trim(),
      selectedText: selectedText.trim(),
      pageNumber,
      anchor
    };

    const book = await Book.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.userId
      },
      {
        $push: {
          notes: note
        }
      },
      {
        new: true,
        runValidators: true
      }
    );

    if (!book) {
      return res.status(404).json({
        message: "Book not found"
      });
    }

    const savedNote = book.notes[book.notes.length - 1];

    res.status(201).json({
      message: "Note saved!",
      note: savedNote
    });

  } catch (error) {

    console.log("FAILED TO SAVE NOTE:");
    console.log(error);
    console.log("ERROR MESSAGE:", error.message);

    res.status(500).json({
      message: error.message
    });
  }
});

router.delete(
  "/:bookId/notes/:noteId",
  authMiddleware,
  async (req, res) => {
    console.log("DELETE NOTE ROUTE HIT");

    try {
      const book = await Book.findOneAndUpdate(
        {
          _id: req.params.bookId,
          userId: req.userId
        },
        {
          $pull: {
            notes: {
              _id: req.params.noteId
            }
          }
        }
      );

      if (!book) {
        return res.status(404).json({
          message: "Book not found"
        });
      }

      res.json({
        message: "Note deleted!"
      });

    } catch (error) {
      console.log("Can't delete note:", error);

      res.status(500).json({
        message: "Failed to delete note"
      });
    }
  }
);

module.exports = router; 