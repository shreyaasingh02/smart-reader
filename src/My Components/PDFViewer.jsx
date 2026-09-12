import React, { memo, useEffect, useState } from "react";
import { Document, Page } from "react-pdf";

export const PDFViewer = memo(function PDFViewer({
  pdfUrl,
  pageNumber,
  pdfPageRef,
  onDocumentLoadSuccess,
  onMouseUp,
  restoreHighlights,
  onTouchEnd
}) {

  const [pageWidth, setPageWidth] = useState(1000);

  useEffect(() => {
    const updatePageWidth = () => {
      if (window.innerWidth < 768) {
        // Mobile
        setPageWidth(window.innerWidth - 20);
      } else {
        // Desktop — keep your existing size
        setPageWidth(1000);
      }
    };

    updatePageWidth();

    window.addEventListener("resize", updatePageWidth);

    return () => {
      window.removeEventListener("resize", updatePageWidth);
    };
  }, []);

  return (
    <div
      className="relative"
      ref={pdfPageRef}
      onMouseUp={onMouseUp}
      onTouchEnd={onMouseUp}
    >
      <Document
        file={pdfUrl}
        onLoadSuccess={onDocumentLoadSuccess}
      >
        <Page
          pageNumber={pageNumber}
          width={pageWidth}
          onRenderTextLayerSuccess={restoreHighlights}
        />
      </Document>
    </div>
  );
});