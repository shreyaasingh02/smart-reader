import React, { useEffect, useRef, useCallback } from "react";
import { useState } from "react";
import { FiPlus, FiBookmark, FiArrowRight, FiArrowLeft, FiSearch, FiSun, FiPenTool, FiUser } from "react-icons/fi";
import { RiDeleteBin6Line } from "react-icons/ri";
import { PiHighlighterCircleBold } from "react-icons/pi";
import { PiNotePencilBold } from "react-icons/pi";
import { MdOutlineRecordVoiceOver } from "react-icons/md";
import { LuNotebookText } from "react-icons/lu";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import { Highlight } from "./Highlight";
import { Notes } from "./Notes";
import { Link, useNavigate } from "react-router-dom";
import { PDFViewer } from "./PDFViewer";
import { useSearchParams } from "react-router-dom";
import { FiChevronUp, FiChevronDown } from "react-icons/fi";

pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

// taking the first page and converting it into cover page
const generateCover = async (file) => {
  const arrayBuffer = await file.arrayBuffer();

  const pdf = await pdfjs.getDocument({
    data: arrayBuffer,
  }).promise;

  const page = await pdf.getPage(1);

  const viewport = page.getViewport({ scale: 1 });

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({
    canvasContext: context,
    viewport: viewport,
  }).promise;

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.8);
  });
};

export const Book = () => {
  const [searchParams] = useSearchParams();
  const page = searchParams.get("page");

  const [search, setSearch] = useState("");
  const [books, setBooks] = useState([]);
  const [selectedBook, setSelectedBook] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState(null);
  const [pageInput, setPageInput] = useState("1");
  const [activeTab, setActiveTab] = useState("highlight");
  const selectedTextRef = useRef("");
  const selectedRangeRef = useRef(null);
  const highlightAnchorRef = useRef(null);
  const [showColors, setShowColors] = useState(false);
  const [highlights, setHighlights] = useState([]);
  const [profileMenu, setProfileMenu] = useState(false);
  const navigate = useNavigate();
  const [showMeaning, setShowMeaning] = useState(false);
  const [meaningLoading, setMeaningLoading] = useState(false);
  const [selectedMeaningText, setSelectedMeaningText] = useState("");
  const [meanings, setMeanings] = useState([]);
  const [notes, setNotes] = useState([]);
  const [showNoteBox, setShowNoteBox] = useState(false);
  const [noteText, setNoteText] = useState("");

  useEffect(() => {
    const fetchBooks = async () => {
      try {
        const response = await fetch("http://localhost:5000/api/books", {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });

        const data = await response.json();

        setBooks(data);

        const lastBookId = localStorage.getItem("lastBookId");

        const lastBook = data.find((book) => book._id === lastBookId);

        if (lastBook) {
          // Open the last book
          setSelectedBook(lastBook);

          const page = lastBook.lastPage || 1;

          setPageNumber(page);
          setPageInput(String(page));
        } else if (data.length > 0) {
          // If there is no previous book,
          // open the first book
          const firstBook = data[0];

          setSelectedBook(firstBook);

          const page = firstBook.lastPage || 1;

          setPageNumber(page);
          setPageInput(String(page));

          localStorage.setItem("lastBookId", firstBook._id);
        }
      } catch (error) {
        console.log("Failed to fetch books:", error);
      }
    };

    fetchBooks();
  }, []);

  const pdfPageRef = useRef(null);
  const highlightsRef = useRef([]);
  const restoredPageRef = useRef(null);

  useEffect(() => {
    if (!selectedBook) return;

    const savedHighlights = selectedBook.highlights || [];
    const savedNotes = selectedBook.notes || [];

    highlightsRef.current = savedHighlights;

    setHighlights(savedHighlights);
    setNotes(savedNotes);
  }, [selectedBook]);

  const handleSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      selectedTextRef.current = "";
      selectedRangeRef.current = null;
      highlightAnchorRef.current = null;
      return;
    }

    const text = selection.toString().trim();
    if (!text) {
      selectedTextRef.current = "";
      selectedRangeRef.current = null;
      highlightAnchorRef.current = null;
      return;
    }

    const range = selection.getRangeAt(0);
    const startElement = range.startContainer.parentElement;
    const endElement = range.endContainer.parentElement;

    const textLayer = startElement.closest(".textLayer");
    if (!textLayer) {
      console.log("Text layer not found");
      return;
    }

    // Get all text before the selection
    const beforeRange = document.createRange();
    beforeRange.setStart(textLayer, 0);
    beforeRange.setEnd(range.startContainer, range.startOffset);

    // Get all text after the selection
    const afterRange = document.createRange();
    afterRange.setStart(range.endContainer, range.endOffset);
    afterRange.setEnd(textLayer, textLayer.childNodes.length);

    const beforeText = beforeRange.toString();
    const afterText = afterRange.toString();

    // Keep only a small amount of surrounding text
    const beforeContext = beforeText.slice(-100);
    const afterContext = afterText.slice(0, 100);

    const anchor = {
      pageNumber: pageNumber,
      text: text,
      beforeContext: beforeContext,
      afterContext: afterContext,
    };

    selectedTextRef.current = text;
    selectedRangeRef.current = range.cloneRange();
    highlightAnchorRef.current = anchor;

    console.log("Highlight anchor:", anchor);
  };

  const applyHighlight = async (color) => {
    if (!selectedRangeRef.current || !pdfPageRef.current) {
      console.log("No text selected");
      return;
    }

    const range = selectedRangeRef.current.cloneRange();

    // pdfPageRef should point to the *page wrapper* (position: relative),
    // the same element that contains both the canvas and .textLayer
    const pageRect = pdfPageRef.current.getBoundingClientRect();

    const rects = Array.from(range.getClientRects()).map((r) => ({
      x: ((r.left - pageRect.left) / pageRect.width) * 100,
      y: ((r.top - pageRect.top) / pageRect.height) * 100,
      w: (r.width / pageRect.width) * 100,
      h: (r.height / pageRect.height) * 100,
    }));

    const highlightData = {
      text: selectedTextRef.current,
      color,
      pageNumber,
      anchor: highlightAnchorRef.current,
      rects,
    };

    try {
      const response = await fetch(`http://localhost:5000/api/books/${selectedBook._id}/highlights`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(highlightData),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to save highlight");

      const savedHighlight = data.highlight; // now includes rects

      setHighlights((prev) => {
        const updated = [...prev, savedHighlight];
        highlightsRef.current = updated;
        return updated;
      });

      setSelectedBook((prev) =>
        prev ? { ...prev, highlights: [...(prev.highlights || []), savedHighlight] } : prev
      );

      setBooks((prevBooks) =>
        prevBooks.map((book) =>
          book._id === selectedBook._id
            ? { ...book, highlights: [...(book.highlights || []), savedHighlight] }
            : book
        )
      );
    } catch (error) {
      console.log("Failed to save highlight:", error);
    }

    setShowColors(false);
    window.getSelection()?.removeAllRanges();
    selectedRangeRef.current = null;
    selectedTextRef.current = "";
    highlightAnchorRef.current = null;
  };

  const restoreHighlights = useCallback(() => {
    if (!pdfPageRef.current) return;
    const restoreKey = `${selectedBook._id}-${pageNumber}`;

    if (restoredPageRef.current === restoreKey) {
      return;
    }

    const textLayer = pdfPageRef.current.querySelector(".textLayer");

    if (!textLayer) {
      console.log("Text layer not ready");
      return;
    }

    const pageHighlights = highlightsRef.current.filter((highlight) => highlight.pageNumber === pageNumber);

    if (pageHighlights.length === 0) return;

    pageHighlights.forEach((savedHighlight) => {
      const targetText = savedHighlight.text;

      const textNodes = [];

      const walker = document.createTreeWalker(textLayer, NodeFilter.SHOW_TEXT);

      let node;

      while ((node = walker.nextNode())) {
        textNodes.push(node);
      }

      /*
       * Build a normalized character map.
       *
       * Each character in normalizedText remembers
       * exactly which DOM text node + offset it came from.
       */
      let normalizedText = "";
      const charMap = [];

      let previousChar = "";

      textNodes.forEach((textNode, nodeIndex) => {
        const text = textNode.textContent;

        for (let i = 0; i < text.length; i++) {
          const char = text[i];

          if (/\s/.test(char)) {
            if (!normalizedText.endsWith(" ")) {
              normalizedText += " ";

              charMap.push({
                node: textNode,
                offset: i,
              });
            }

            continue;
          }

          /*
           * PDF.js can split text across different text nodes.
           * If the previous node ended with a normal character
           * and this node starts with a normal character,
           * preserve a space between them.
           */
          if (
            normalizedText.length > 0 &&
            previousChar &&
            !/\s/.test(previousChar) &&
            i === 0 &&
            !normalizedText.endsWith(" ")
          ) {
            normalizedText += " ";

            charMap.push({
              node: textNode,
              offset: i,
            });
          }

          normalizedText += char;

          charMap.push({
            node: textNode,
            offset: i,
          });

          previousChar = char;
        }
      });

      const normalizedTarget = targetText.replace(/\s+/g, " ").trim();

      normalizedText = normalizedText.trim();

      let startIndex = normalizedText.indexOf(normalizedTarget);
      let endIndex = -1;
      console.log("TARGET LENGTH:", normalizedTarget.length);

      console.log("TARGET:", JSON.stringify(normalizedTarget));

      console.log("TARGET INDEX:", startIndex);

      const targetFirstPart = normalizedTarget.slice(0, 30);

      console.log("FIRST PART INDEX:", normalizedText.indexOf(targetFirstPart));

      if (startIndex === -1) {
        console.log("Exact match failed, using start + end markers...");

        const startMarker = normalizedTarget.slice(0, 30);

        const endMarker = normalizedTarget.slice(-30);

        console.log("START MARKER:", JSON.stringify(startMarker));

        console.log("END MARKER:", JSON.stringify(endMarker));

        const markerStart = normalizedText.indexOf(startMarker);

        const markerEnd = normalizedText.indexOf(endMarker, markerStart + startMarker.length);

        console.log("START MARKER INDEX:", markerStart);

        console.log("END MARKER INDEX:", markerEnd);

        if (markerStart === -1 || markerEnd === -1) {
          console.log("Could not restore:", targetText);

          return;
        }

        startIndex = markerStart;

        endIndex = markerEnd + endMarker.length - 1;
      } else {
        endIndex = startIndex + normalizedTarget.length - 1;
      }

      const startInfo = charMap[startIndex];
      const endInfo = charMap[endIndex];

      if (!startInfo || !endInfo) {
        console.log("Could not map:", targetText);
        return;
      }

      const startNode = startInfo.node;
      const startOffset = startInfo.offset;

      const endNode = endInfo.node;
      const endOffset = endInfo.offset + 1;

      /*
       * Create the same Range that the user originally selected.
       */
      const range = document.createRange();

      range.setStart(startNode, startOffset);

      range.setEnd(endNode, endOffset);

      /*
       * IMPORTANT:
       * Don't wrap the whole multi-line Range in one span.
       *
       * Instead, split and wrap each affected text node.
       */
      const affectedNodes = [];

      const walker2 = document.createTreeWalker(textLayer, NodeFilter.SHOW_TEXT);

      let currentNode;

      while ((currentNode = walker2.nextNode())) {
        if (range.intersectsNode(currentNode)) {
          affectedNodes.push(currentNode);
        }
      }

      affectedNodes.forEach((textNode) => {
        let start = 0;
        let end = textNode.length;

        if (textNode === startNode) {
          start = startOffset;
        }

        if (textNode === endNode) {
          end = endOffset;
        }

        if (start >= end) {
          return;
        }

        let selectedNode = textNode;

        // Split before selected part
        if (start > 0) {
          selectedNode = textNode.splitText(start);
        }

        // Split after selected part
        if (end - start < selectedNode.length) {
          selectedNode.splitText(end - start);
        }

        const highlight = document.createElement("span");

        highlight.dataset.highlightId = savedHighlight._id;

        highlight.style.backgroundColor = savedHighlight.color;

        highlight.style.color = "#000";

        highlight.style.borderRadius = "3px";

        highlight.style.padding = "1px 0";

        highlight.style.display = "inline";

        highlight.style.boxDecorationBreak = "clone";

        highlight.style.webkitBoxDecorationBreak = "clone";

        selectedNode.parentNode.insertBefore(highlight, selectedNode);

        highlight.appendChild(selectedNode);
      });

      console.log("Restored:", targetText);
    });
    restoredPageRef.current = restoreKey;
  }, [pageNumber]);

  const speakSelectedText = () => {
    const text = selectedTextRef.current;

    if (!text) {
      console.log("Please select some text first!");
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    const hasHindi = /[\u0900-\u097F]/.test(text);

    utterance.lang = hasHindi ? "hi-IN" : "en-IN";
    utterance.rate = 0.9;
    utterance.pitch = 1;

    window.speechSynthesis.speak(utterance);
  };

  const getMeaning = async () => {
    const text = selectedTextRef.current.trim();

    if (!text) {
      console.log("Please select some text first!");
      return;
    }

    setSelectedMeaningText(text);
    setShowMeaning(true);
    setMeaningLoading(true);
    setMeanings("");

    try {
      const response = await fetch("http://localhost:5000/api/books/meaning", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },

        body: JSON.stringify({
          text: text,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to get meaning");
      }

      setMeanings(data.meanings);
    } catch (error) {
      console.log("Meaning error:", error);

      setMeanings([]);
    } finally {
      setMeaningLoading(false);
    }
  };

  const saveNote = async () => {
    console.log("SAVE NOTE CLICKED");
    const selectedText = selectedTextRef.current.trim();
    console.log("Selected text:", selectedText);
    console.log("Note text:", noteText);
    console.log("Page:", pageNumber);
    console.log("Anchor:", highlightAnchorRef.current);
    console.log("Book:", selectedBook?._id);

    if (!selectedText) {
      console.log("Please select some text first!");
      return;
    }

    if (!noteText.trim()) {
      console.log("Please write a note!");
      return;
    }

    const noteData = {
      text: noteText.trim(),
      selectedText: selectedText,
      pageNumber: pageNumber,
      anchor: highlightAnchorRef.current || {
        pageNumber: pageNumber,
        text: selectedText,
        beforeContext: "",
        afterContext: "",
      },
    };

    try {
      const response = await fetch(`http://localhost:5000/api/books/${selectedBook._id}/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(noteData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to save note");
      }

      const savedNote = data.note;

      // Update notes
      setNotes((prev) => [...prev, savedNote]);

      // Update selected book
      setSelectedBook((prev) => ({
        ...prev,
        notes: [...(prev.notes || []), savedNote],
      }));

      // Update books
      setBooks((prevBooks) =>
        prevBooks.map((book) =>
          book._id === selectedBook._id
            ? {
              ...book,
              notes: [...(book.notes || []), savedNote],
            }
            : book,
        ),
      );

      // Clear everything
      setNoteText("");
      setShowNoteBox(false);

      window.getSelection()?.removeAllRanges();

      selectedRangeRef.current = null;
      selectedTextRef.current = "";
      highlightAnchorRef.current = null;

      console.log("Note saved:", savedNote);
    } catch (error) {
      console.log("Failed to save note:", error);
    }
  };

  const deleteNote = async (noteId) => {
    const token = localStorage.getItem("token");

    try {
      const response = await fetch(`http://localhost:5000/api/books/${selectedBook._id}/notes/${noteId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to delete note");
      }

      console.log(data.message);

      // Remove from notes state
      setNotes((prevNotes) => prevNotes.filter((note) => note._id !== noteId));

      // Remove from selected book
      setSelectedBook((prev) => {
        if (!prev) return prev;

        return {
          ...prev,
          notes: (prev.notes || []).filter((note) => note._id !== noteId),
        };
      });

      // Remove from books array
      setBooks((prevBooks) =>
        prevBooks.map((book) =>
          book._id === selectedBook._id
            ? {
              ...book,
              notes: (book.notes || []).filter((note) => note._id !== noteId),
            }
            : book,
        ),
      );
    } catch (error) {
      console.log("Error deleting note:", error);
    }
  };

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);

    if (selectedBook) {
      saveTotalPages(numPages);
    }
  };
  const saveTotalPages = async (totalPages) => {
    if (!selectedBook) return;

    try {
      const response = await fetch(`http://localhost:5000/api/books/${selectedBook._id}/total-pages`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ totalPages }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to save total pages");
      }

      setSelectedBook((prev) => (prev ? { ...prev, totalPages } : prev));

      setBooks((prevBooks) =>
        prevBooks.map((book) => (book._id === selectedBook._id ? { ...book, totalPages } : book)),
      );
    } catch (error) {
      console.log("Failed to save total pages:", error);
    }
  };

  const filterBook = books.filter((book) => {
    return book.title.toLowerCase().includes(search.toLowerCase());
  });

  const handleChange = (value) => {
    setSearch(value);
  };

  const fileInputRef = useRef(null);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = "";

    try {
      const coverBlob = await generateCover(file);
      const formData = new FormData();
      formData.append("pdf", file);
      formData.append("cover", coverBlob, `${file.name}.jpg`);

      console.log("PDF:", file);
      console.log("Cover:", coverBlob);

      const response = await fetch("http://localhost:5000/api/books", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: formData,
      });

      const data = await response.json();

      console.log("Backend response:", data);
      const booksResponse = await fetch("http://localhost:5000/api/books", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      const booksData = await booksResponse.json();

      setBooks(booksData);
    } catch (error) {
      console.log("Upload failed!", error);
    }
  };

  const savePage = async (page) => {
    if (!selectedBook) return;

    try {
      const response = await fetch(`http://localhost:5000/api/books/${selectedBook._id}/page`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ pageNumber: page }),
      });

      const data = await response.json();
      console.log("Page saved:", data);

      setBooks((prevBooks) =>
        prevBooks.map((book) => (book._id === data._id ? { ...book, lastPage: data.lastPage } : book)),
      );

      setSelectedBook((prev) => (prev?._id === data._id ? { ...prev, lastPage: data.lastPage } : prev));
    } catch (error) {
      console.log("Failed to save page:", error);
    }
  };

  const handleFileOpen = (book) => {
    restoredPageRef.current = null;
    setSelectedBook(book);
    localStorage.setItem("lastBookId", book._id);
    const page = book.lastPage || 1;
    setPageNumber(page);
    setPageInput(String(page));
  };

  const goToHighlightPage = (page) => {
    restoredPageRef.current = null;

    // Only temporarily change the displayed page
    setPageNumber(page);
    setPageInput(String(page));
  };

  const goToPage = () => {
    const page = Number(pageInput);
    restoredPageRef.current = null;

    if (page >= 1 && page <= numPages) {
      setPageNumber(page);
      savePage(page);
    }
  };
  const prevBtn = () => {
    if (pageNumber === 1) return;
    const prevPage = pageNumber - 1;

    restoredPageRef.current = null;

    setPageNumber(prevPage);
    setPageInput(prevPage.toString());
    savePage(prevPage);
  };

  const nextBtn = () => {
    if (pageNumber === numPages) return;

    const nextPage = pageNumber + 1;

    restoredPageRef.current = null;

    setPageNumber(nextPage);
    setPageInput(nextPage.toString());
    savePage(nextPage);
  };

  const deleteBook = async (id) => {
    try {
      const response = await fetch(`http://localhost:5000/api/books/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      console.log("delete status:", response.status);
      const data = await response.json();
      console.log("Delete response", data);

      if (!response.ok) {
        throw new Error(data.message || "Error deleting book");
      }

      const index = books.findIndex((book) => book._id === id);

      const updateBooks = books.filter((book) => book._id !== id);

      setBooks(updateBooks);

      if (selectedBook?._id == id) {
        if (updateBooks.length > 0) {
          const nextBook = updateBooks[index] || updateBooks[index - 1];
          setSelectedBook(nextBook);
          setPageNumber(1);
          setPageInput("1");
        } else {
          setSelectedBook(null);
        }
      }
    } catch (error) {
      console.log(error);
    }
  };

  const logout = () => {
    localStorage.clear("token");
    navigate("/login");
  };

  const removeHighlightFromPdf = (highlightId) => {
    if (!pdfPageRef.current) return;

    const highlightElements = pdfPageRef.current.querySelectorAll("[data-highlight-id]");

    highlightElements.forEach((element) => {
      if (element.dataset.highlightId === highlightId) {
        const parent = element.parentNode;

        while (element.firstChild) {
          parent.insertBefore(element.firstChild, element);
        }

        element.remove();
      }
    });
  };

  const handlePdfClick = () => {
    if (showMeaning) {
      setShowMeaning(false);
    }
    setShowColors(false);
    setShowNoteBox(false);
  };

  const user = JSON.parse(localStorage.getItem("user"));
  const [showSelectionTools, setShowSelectionTools] = useState(true);

  return (
    <div className="h-screen bg-[#151515] font-serif text-white overflow-hidden">
      <div className="flex h-full gap-5">
        <aside className="hidden md:flex w-[340px] h-full bg-[#202020] flex-col shrink-0">
          <div className="flex flex-col m-3 gap-6 ">
            <div className="flex items-center gap-2">
              <img src="/reader-logo.png" alt="My Library" className="w-8 h-8 object-cover" />
              <h1 className="text-lg font-lora font-medium"> {user?.name ? `${user.name}'s Library` : "My Library"}</h1>
            </div>

            <div className="relative flex  bg-[#2D2D2D] h-11 items-center flex-wrap rounded-[10px]">
              <FiSearch className=" text-[#D9B26F] text-xl w-10 " />
              <input
                className="text-lg text-[#B4B4B4] flex-1 outline-none font-inter"
                id="text"
                type="search"
                placeholder="Search your books..."
                value={search}
                onChange={(e) => {
                  handleChange(e.target.value);
                }}
              />
              {search.trim() !== "" && (
                <div className="absolute top-full mt-2 w-full bg-[#2D2D2D] p-3 left-0 rounded-lg shadow-lg z-10 font-inter">
                  {filterBook.map((book) => (
                    <p key={book._id} className="p-2 hover:bg-[#202020] hover:rounded-xl cursor-pointer">
                      {book.title}
                    </p>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3 font-inter">
              <button className="px-5 py-2 rounded-full cursor-pointer hover:bg-[#2E2E2E] text-[#D9B26F] shadow-md">
                All
              </button>
              <button className="px-5 py-2 rounded-full cursor-pointer hover:bg-[#2E2E2E] text-[#D9B26F] shadow-md">
                PDFs
              </button>
              <button className="hidden px-5 py-2 rounded-full cursor-pointer hover:bg-[#2E2E2E] text-[#D9B26F] shadow-md">
                Notes
              </button>
            </div>
          </div>

          <div className="flex-1 flex flex-col gap-2 overflow-y-auto p-3">
            {books &&
              books.map((book) => {
                const totalPages = book.totalPages || (selectedBook?._id === book._id ? numPages : null);
                const progress = totalPages ? Math.min(Math.round(((book.lastPage || 1) / totalPages) * 100), 100) : 0;

                return (
                  <div
                    key={book._id}
                    className={`${selectedBook?._id === book._id ? "bg-[#3A3A3A]" : ""} relative group rounded-xl p-3 cursor-pointer hover:bg-[#3A3A3A] transition flex gap-3 items-center`}
                    onClick={() => {
                      handleFileOpen(book);
                    }}
                  >
                    <img src={book.coverUrl} alt={book.title} className="w-12 h-16 object-cover rounded-md" />
                    <div className="flex-1 min-w-0">
                      <h2 className="text-[#F5E6C8] text-base font-lora leading-5 flex-1 min-w-0 break-words">
                        {book.title}
                      </h2>
                      <div className="mt-2">
                        <div className="w-full h-[3px] bg-[#151515] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#D9B26F] rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-[#D9B26F] font-inter text-right mt-1"> {progress}% </p>
                      </div>
                    </div>
                    <RiDeleteBin6Line
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteBook(book._id);
                      }}
                      className="absolute top-1 right-2 opacity-0 group-hover:opacity-100 text-lg text-gray-500 hover:text-red-400 cursor-pointer transition"
                    />
                  </div>
                );
              })}
          </div>

          <div className="p-3 mb-5">
            <div className="flex items-center justify-center">
              <input
                className="hidden"
                type="file"
                accept="application/pdf"
                ref={fileInputRef}
                onChange={handleUpload}
              />
              <div
                className="flex text-[#D9B26F] items-center  rounded-[10px] bg-[#2D2D2D] h-11 w-fit p-4 hover:bg-[#2E2E2E] cursor-pointer"
                onClick={() => fileInputRef.current.click()}
              >
                <FiPlus className=" text-[#D9B26F] text-xl w-10 " />
                <button className="cursor-pointer font-inter">Add New Book</button>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <div className="hidden md:flex m-4 ">
            <div className="flex flex-1 items-center ">
              <FiBookmark
                className="bg-[#2E2E2E] rounded-[50%] text-[#D9B26F] text-xl w-12 h-full p-3 cursor-pointer"
                title="Bookmark"
              />
            </div>

            <div className="flex flex-1 bg-[#202020] font-inter justify-around h-12 rounded-[50px]">
              <button className="text-[#D9B26F] flex items-center gap-2 cursor-pointer" onClick={prevBtn}>
                <FiArrowLeft className=" text-[#D9B26F] text-xl w-5 h-full" />
                <span>Prev</span>
              </button>

              <div className="bg-[#151515] flex w-[30%] justify-center items-center rounded-[50px] m-1">
                <div className="font-mono items-center flex">
                  <input
                    className="w-8 items-center flex"
                    type="number"
                    value={pageInput}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        goToPage();
                      }
                    }}
                    onChange={(e) => setPageInput(e.target.value)}
                  />
                  <span>/ {numPages}</span>
                </div>
              </div>

              <button className=" text-[#D9B26F] flex items-center gap-2 cursor-pointer" onClick={nextBtn}>
                <span>Next</span>
                <FiArrowRight className=" text-[#D9B26F] text-xl w-5 h-full" />
              </button>
            </div>

            <div className="flex-1 text-[#D9B26F] justify-end flex items-center gap-4">
              <FiSun
                className="bg-[#2E2E2E] rounded-[50%] text-[#D9B26F] text-xl w-12 h-full p-3 cursor-pointer"
                title="Brightness"
              />
              <div className="relative">
                <FiUser
                  className="bg-[#2E2E2E] rounded-[50%] text-[#D9B26F] text-xl w-12 h-full p-3 cursor-pointer"
                  onClick={() => setProfileMenu(!profileMenu)}
                  title="profile"
                />
                {profileMenu && (
                  <div className="absolute right-0 font-inter top-14 w-40 bg-[#2D2D2D] rounded-xl shadow-lg p-2 z-50">
                    <button className="w-full text-left p-2 rounded-lg hover:bg-[#202020] cursor-pointer">
                      {" "}
                      <Link to="/login">Login</Link>{" "}
                    </button>
                    <button
                      className="w-full text-left p-2 rounded-lg hover:bg-[#202020] cursor-pointer"
                      onClick={logout}
                    >
                      {" "}
                      Logout{" "}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="md:hidden flex items-center justify-between px-4 py-3 bg-[#202020]">

            <button
              className="w-10 h-10 rounded-full bg-[#2E2E2E] flex items-center justify-center"
            >
              ☰
            </button>

            <h1 className="text-[#F5E6C8] font-lora text-base truncate max-w-[220px]">
              {selectedBook?.title || "My Library"}
            </h1>

            <FiUser
              className="bg-[#2E2E2E] rounded-full text-[#D9B26F] w-10 h-10 p-2 cursor-pointer"
              onClick={() => setProfileMenu(!profileMenu)}
            />

          </div>

          <div className="md:hidden flex items-center justify-center px-4 py-2 bg-[#151515]">

  <div className="flex items-center justify-between w-full max-w-[320px] bg-[#202020] rounded-full px-3 py-1">

    <button
      onClick={prevBtn}
      className="text-[#D9B26F] p-2"
    >
      <FiArrowLeft className="text-xl" />
    </button>

    <div className="flex items-center gap-1 font-mono text-sm">

      <input
        className="w-8 text-center bg-transparent outline-none text-white"
        type="number"
        value={pageInput}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            goToPage();
          }
        }}
        onChange={(e) => setPageInput(e.target.value)}
      />

      <span className="text-gray-400">
        / {numPages}
      </span>

    </div>

    <button
      onClick={nextBtn}
      className="text-[#D9B26F] p-2"
    >
      <FiArrowRight className="text-xl" />
    </button>

  </div>

</div>

          <div className="relative flex-1 overflow-y-auto flex justify-center mb-2" onMouseDown={handlePdfClick}>
            {selectedBook && (
              <PDFViewer
                pdfUrl={selectedBook.pdfUrl}
                pageNumber={pageNumber}
                pdfPageRef={pdfPageRef}
                onDocumentLoadSuccess={onDocumentLoadSuccess}
                onMouseUp={handleSelection}
                restoreHighlights={restoreHighlights}
              />
            )}
          </div>
          {!showSelectionTools && (
            <button
              onClick={() => setShowSelectionTools(true)}
              className="fixed bottom-3 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-[#2D2D2D] text-[#D9B26F] shadow-lg z-10 flex items-center justify-center hover:bg-[#3A3A3A] transition cursor-pointer"
              title="Show selection tools"
            >
              <FiChevronUp className="text-xl" />
            </button>
          )}
          {showSelectionTools && (
            <div
              className=" flex fixed bg-[#2D2D2D] font-inter p-1 px-5 rounded-[20px] shadow-lg z-10 gap-9 items-center justify-center"
              style={{ bottom: 20, left: "50%", transform: "translateX(-50%)" }}
            >
              <button
                onClick={() => setShowSelectionTools(false)}
                className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-[#3A3A3A] text-[#D9B26F] flex items-center justify-center hover:bg-[#444] transition cursor-pointer"
              >
                <FiChevronDown className="text-sm" />
              </button>

              <div className="relative">
                <button className="cursor-pointer" onClick={getMeaning} onMouseDown={(e) => e.preventDefault()}>
                  <LuNotebookText className="hover:bg-[#202020] rounded-[50%] text-[#D9B26F] w-12 h-full p-3 cursor-pointer" />
                  <h2 className="text-s">Meaning</h2>
                </button>

                {showMeaning && (
                  <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-80 max-h-72 bg-[#242424] border border-[#3A3A3A] rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.45)] z-50 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-[#353535]">
                      <h3 className="text-[#D9B26F] text-base font-semibold">Meaning</h3>
                      <button
                        onClick={() => setShowMeaning(false)}
                        className="text-gray-500 hover:text-gray-200 text-lg transition-colors cursor-pointer"
                      >
                        {" "}
                        ×{" "}
                      </button>
                    </div>

                    <div className="px-4 py-3 overflow-y-auto max-h-60 custom-scrollbar">
                      <div className="mb-4">
                        <span className="inline-block px-2.5 py-1 rounded-md bg-[#303030] border border-[#444] text-[#E6E6E6] text-sm font-medium">
                          {selectedMeaningText}
                        </span>
                      </div>

                      {meaningLoading ? (
                        <div className="flex items-center gap-2 text-gray-400 text-sm py-3">
                          <span className="animate-pulse">Finding meaning...</span>
                        </div>
                      ) : meanings.length === 0 ? (
                        <p className="text-gray-400 text-sm">Meaning not found.</p>
                      ) : (
                        <div className="space-y-4">
                          {meanings.map((item, index) => (
                            <div key={index} className="border-l-2 border-[#D9B26F] pl-3">
                              <p className="text-[#D9B26F] text-xs font-medium italic mb-1">{item.partOfSpeech}</p>
                              <p className="text-gray-200 text-sm leading-relaxed">{item.definition}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="relative">
                <button
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.preventDefault();
                    if (!selectedRangeRef.current) {
                      console.log("please select some text!");
                      return;
                    }
                    setShowColors(true);
                    console.log("Highlight button clicked");
                  }}
                >
                  <PiHighlighterCircleBold className="hover:bg-[#202020] rounded-[50%] text-[#D9B26F] w-12 h-full p-3 cursor-pointer" />
                  <h2 className="text-s">Highlight</h2>
                </button>

                {showColors && (
                  <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 bg-[#202020] p-2 rounded-xl flex gap-2 shadow-lg">
                    <button
                      className="w-7 h-7 rounded-full bg-yellow-300 cursor-pointer"
                      onClick={() => applyHighlight("#FFF176")}
                    ></button>
                    <button
                      className="w-7 h-7 rounded-full bg-green-300 cursor-pointer"
                      onClick={() => applyHighlight("#A5D6A7")}
                    ></button>
                    <button
                      className="w-7 h-7 rounded-full bg-blue-300 cursor-pointer"
                      onClick={() => applyHighlight("#90CAF9")}
                    ></button>
                    <button
                      className="w-7 h-7 rounded-full bg-pink-300 cursor-pointer"
                      onClick={() => applyHighlight("#F48FB1")}
                    ></button>
                  </div>
                )}
              </div>
              <button
                className="cursor-pointer"
                onClick={() => {
                  if (!selectedRangeRef.current) {
                    console.log("Please select some text first!");
                    return;
                  }
                  setShowNoteBox(true);
                }}
                onMouseDown={(e) => e.preventDefault()}
              >
                <PiNotePencilBold className="hover:bg-[#202020] rounded-[50%] text-[#D9B26F] w-12 h-full p-3 cursor-pointer" />
                <h2 className="text-s">Notes</h2>
              </button>
              {showNoteBox && (
                <div className=" absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-80 bg-[#242424] border border-[#3A3A3A] rounded-xl shadow-lg z-50 p-4 ">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[#D9B26F] font-semibold">Add Note</h3>
                    <button
                      onClick={() => setShowNoteBox(false)}
                      className="text-gray-500 hover:text-white text-lg cursor-pointer"
                    >
                      {" "}
                      ×{" "}
                    </button>
                  </div>

                  <div className="mb-3">
                    <p className="text-xs text-gray-400 mb-1">Selected text</p>
                    <p className=" text-sm text-gray-200 bg-[#303030] border border-[#444] rounded-lg p-2 ">
                      {" "}
                      {selectedTextRef.current}{" "}
                    </p>
                  </div>

                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Write your note..."
                    className=" w-full h-24 resize-none bg-[#303030] border border-[#444] rounded-lg p-2 text-sm text-white outline-none focus:border-[#D9B26F] "
                  />

                  <button
                    onClick={saveNote}
                    className=" w-full mt-3 py-2 rounded-lg bg-[#D9B26F] text-[#202020] font-medium cursor-pointer hover:opacity-90 "
                  >
                    {" "}
                    Save Note{" "}
                  </button>
                </div>
              )}

              <button className="cursor-pointer" onClick={speakSelectedText}>
                <MdOutlineRecordVoiceOver className="hover:bg-[#202020] rounded-[50%] text-[#D9B26F] w-12 h-full p-3 cursor-pointer" />
                <h2 className="text-s">Speak</h2>
              </button>
            </div>
          )}
        </main>

        <aside className="hidden md:block w-82 mbs-18 mr-2 mb-2 rounded-[20px] bg-[#202020]">
          <div className="flex flex-col m-5 gap-6">
            <h1 className="text-lg font-lora font-semibold">Highlights & Notes</h1>
            <div className="flex gap-9">
              <button
                className="px-9 py-2 rounded-full cursor-pointer hover:bg-[#2E2E2E] text-[#D9B26F] shadow-md font-inter"
                onClick={() => {
                  setActiveTab("highlight");
                }}
              >
                Highlights
              </button>
              <button
                className="px-9 py-2 rounded-full cursor-pointer hover:bg-[#2E2E2E] text-[#D9B26F] shadow-md font-inter"
                onClick={() => {
                  setActiveTab("notes");
                }}
              >
                Notes
              </button>
            </div>

            {activeTab == "highlight" ? (
              <Highlight
                highlights={highlights}
                bookId={selectedBook?._id}
                onDeleteHighlight={(highlightId) => {
                  const currentBookId = selectedBook?._id;
                  setHighlights((prev) => prev.filter((highlight) => highlight._id !== highlightId));
                  setSelectedBook((prev) => {
                    if (!prev) return prev;
                    return {
                      ...prev,
                      highlights: (prev.highlights || []).filter((highlight) => highlight._id !== highlightId),
                    };
                  });

                  setBooks((prevBooks) =>
                    prevBooks.map((book) => {
                      if (book._id !== currentBookId) {
                        return book;
                      }
                      return {
                        ...book,
                        highlights: (book.highlights || []).filter((highlight) => highlight._id !== highlightId),
                      };
                    }),
                  );
                }}
                onRemoveHighlightFromPdf={removeHighlightFromPdf}
                onGoToPage={goToHighlightPage}
                pageNumber={pageNumber}
              />
            ) : (
              <Notes notes={notes} onGoToPage={goToHighlightPage} onDeleteNote={deleteNote} />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};

export default Book;
