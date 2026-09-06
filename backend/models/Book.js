const mongoose = require("mongoose");


const highlightSchema = new mongoose.Schema({
    text: { type: String, required: true },
    color: { type: String, required: true },
    pageNumber: { type: Number, required: true },
    anchor: {
        pageNumber: { type: Number, required: true },
        text: { type: String, required: true },
        beforeContext: { type: String, default: "" },
        afterContext: { type: String, default: "" }
    },
    rects: [{
  x: Number, // % from left
  y: Number, // % from top
  w: Number, // % width
  h: Number, // % height
}]
}, { _id: true });

const noteSchema = new mongoose.Schema({

    text: {
        type: String,
        required: true
    },

    selectedText: {
        type: String,
        default: ""
    },

    pageNumber: {
        type: Number,
        required: true
    },

    anchor: {
        pageNumber: {
            type: Number,
            required: true
        },

        text: {
            type: String,
            required: true
        },

        beforeContext: {
            type: String,
            default: ""
        },

        afterContext: {
            type: String,
            default: ""
        }
    },

    createdAt: {
        type: Date,
        default: Date.now
    }

}, { _id: true });

// showing what to actually produce!
const bookSchema = new mongoose.Schema({
    title: { type: String, required: true },
    pdfPath: { type: String, required: true },
    coverPath: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
    lastPage: { type: Number, default: 1 },
    totalPages: { type: Number, default: 0 },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    highlights: { type: [highlightSchema], default: [] },
    notes: { type: [noteSchema], default: [] }
});

console.log("BOOK SCHEMA PATHS:", Object.keys(bookSchema.paths));
const Book = mongoose.model("Book", bookSchema);

module.exports = Book;