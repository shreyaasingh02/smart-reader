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
  try {
    const book = await Book.findByIdAndDelete({ _id: req.params.id, userId: req.userId });

    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }
    res.json({ message: "Book deleted successfully" });
  }
  catch (error) {
    console.error(error);
  }
})

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

    // Try the original word first
    const wordsToTry = [originalWord];

    // Basic plural → singular fallbacks
    if (originalWord.endsWith("ies")) {
      wordsToTry.push(
        originalWord.slice(0, -3) + "y"
      );
    }

    if (originalWord.endsWith("ves")) {
      wordsToTry.push(
        originalWord.slice(0, -3) + "f"
      );

      wordsToTry.push(
        originalWord.slice(0, -3) + "fe"
      );
    }

    if (originalWord.endsWith("es")) {
      wordsToTry.push(
        originalWord.slice(0, -2)
      );
    }

    if (originalWord.endsWith("s")) {
      wordsToTry.push(
        originalWord.slice(0, -1)
      );
    }

    let dictionaryData = null;
    let searchedWord = originalWord;

    for (const word of wordsToTry) {

      console.log("Trying dictionary word:", word);

      const response = await fetch(
        `https://api.quickpronounce.site/v1/dictionary/${encodeURIComponent(word)}`
      );

      const data = await response.json();

      if (response.ok && data.success) {
        dictionaryData = data;
        searchedWord = word;
        break;
      }
    }

    if (!dictionaryData) {
      return res.status(404).json({
        message: "Meaning not found"
      });
    }

    const meanings = [];

    dictionaryData.data.entries.forEach((entry) => {
      entry.definitions.forEach((definition) => {

        meanings.push({
          partOfSpeech: entry.partOfSpeech,
          definition: definition
        });

      });
    });

    if (meanings.length === 0) {
      return res.status(404).json({
        message: "Meaning not found"
      });
    }

    res.json({
      word: originalWord,
      baseWord: searchedWord,
      meanings: meanings
    });

  } catch (error) {

    console.error("Meaning error:", error);

    res.status(500).json({
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