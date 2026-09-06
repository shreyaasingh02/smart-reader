import React, { memo, useEffect, useRef, useState } from "react";
import { Document, Page } from "react-pdf";

export const PDFViewer = memo(function PDFViewer({
  pdfUrl,
  pageNumber,
  pdfPageRef,
  onDocumentLoadSuccess,
  onMouseUp,
  restoreHighlights
}) {

  const [pageWidth, setPageWidth] = useState(1000);
  const [scale, setScale] = useState(1);

  const pinchStartDistance = useRef(null);
  const pinchStartScale = useRef(1);

  useEffect(() => {
    const updatePageWidth = () => {
      if (window.innerWidth < 768) {
        // Mobile
        setPageWidth(window.innerWidth - 20);
      } else {
        // Desktop
        setPageWidth(1000);
      }
    };

    updatePageWidth();

    window.addEventListener("resize", updatePageWidth);

    return () => {
      window.removeEventListener("resize", updatePageWidth);
    };
  }, []);

  const getDistance = (touch1, touch2) => {
    const x = touch1.clientX - touch2.clientX;
    const y = touch1.clientY - touch2.clientY;

    return Math.sqrt(x * x + y * y);
  };

  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      const distance = getDistance(
        e.touches[0],
        e.touches[1]
      );

      pinchStartDistance.current = distance;
      pinchStartScale.current = scale;
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length !== 2) return;

    e.preventDefault();

    const currentDistance = getDistance(
      e.touches[0],
      e.touches[1]
    );

    if (!pinchStartDistance.current) return;

    const zoomRatio =
      currentDistance / pinchStartDistance.current;

    const newScale =
      pinchStartScale.current * zoomRatio;

    setScale(
      Math.min(
        Math.max(newScale, 1),
        3
      )
    );
  };

  const handleTouchEnd = () => {
    pinchStartDistance.current = null;
  };

  return (
    <div
      className="relative overflow-auto"
      ref={pdfPageRef}
      onMouseUp={onMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        touchAction: "pan-y"
      }}
    >
      <Document
        file={pdfUrl}
        onLoadSuccess={onDocumentLoadSuccess}
      >
        <Page
          pageNumber={pageNumber}
          width={pageWidth}
          scale={scale}
          onRenderTextLayerSuccess={restoreHighlights}
        />
      </Document>
    </div>
  );
});