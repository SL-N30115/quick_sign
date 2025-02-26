import React, { useEffect, useState, useRef } from "react";
import { pdfjs } from "react-pdf";
import debounce from "lodash/debounce";

interface PDFSidebarProps {
  pdfDocument: pdfjs.PDFDocumentProxy | null;
  currentPage: number;
  onPageSelect: (pageNumber: number) => void;
  numPages: number;
}

const PDFSidebar: React.FC<PDFSidebarProps> = ({
  pdfDocument,
  currentPage,
  onPageSelect,
  numPages,
}) => {
  const [thumbnails, setThumbnails] = useState<Map<number, string>>(new Map());
  const [isLoading, setIsLoading] = useState<Set<number>>(new Set());
  const thumbnailContainerRef = useRef<HTMLDivElement>(null);

  // Generate thumbnail for a specific page
  const generateThumbnail = async (pageNumber: number) => {
    if (
      !pdfDocument ||
      thumbnails.has(pageNumber) ||
      isLoading.has(pageNumber)
    ) {
      return;
    }

    setIsLoading((prev) => new Set([...prev, pageNumber]));

    try {
      const page = await pdfDocument.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 0.2 }); // Small scale for thumbnails

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      if (!context) {
        setIsLoading((prev) => {
          const next = new Set(prev);
          next.delete(pageNumber);
          return next;
        });
        return;
      }

      await page.render({
        canvasContext: context,
        viewport,
      }).promise;

      const dataUrl = canvas.toDataURL("image/png");

      setThumbnails((prev) => {
        const next = new Map(prev);
        next.set(pageNumber, dataUrl);
        return next;
      });
    } catch (error) {
      console.error(
        `Error generating thumbnail for page ${pageNumber}:`,
        error
      );
    } finally {
      setIsLoading((prev) => {
        const next = new Set(prev);
        next.delete(pageNumber);
        return next;
      });
    }
  };

  // Handle going to next page
  const handleNextPage = () => {
    if (currentPage < numPages) {
      onPageSelect(currentPage + 1);
    }
  };

  // Handle going to previous page
  const handlePrevPage = () => {
    if (currentPage > 1) {
      onPageSelect(currentPage - 1);
    }
  };

  // Scroll to current page in sidebar
  useEffect(() => {
    if (thumbnailContainerRef.current) {
      const currentPageElement = thumbnailContainerRef.current.querySelector(
        `[data-page-number="${currentPage}"]`
      );

      if (currentPageElement) {
        currentPageElement.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }
  }, [currentPage]);

  // Generate thumbnails for visible pages and a few around
  useEffect(() => {
    if (!pdfDocument) return;

    const generateVisibleThumbnails = debounce(() => {
      // Always generate current page thumbnail
      generateThumbnail(currentPage);

      // Generate a few pages before and after current page
      const pagesToGenerate = [];
      for (
        let i = Math.max(1, currentPage - 2);
        i <= Math.min(numPages, currentPage + 2);
        i++
      ) {
        pagesToGenerate.push(i);
      }

      pagesToGenerate.forEach(generateThumbnail);
    }, 100);

    generateVisibleThumbnails();

    return () => {
      generateVisibleThumbnails.cancel();
    };
  }, [pdfDocument, currentPage, numPages]);

  return (
    <div className="bg-gray-100 p-2 flex flex-col h-full">
      <div className="flex justify-between mb-4">
        <button
          onClick={handlePrevPage}
          disabled={currentPage <= 1}
          className={`px-3 py-1 rounded ${
            currentPage <= 1
              ? "bg-gray-300 cursor-not-allowed"
              : "bg-blue-500 hover:bg-blue-600 text-white"
          }`}
        >
          Prev
        </button>
        <span className="font-medium">
          {currentPage} / {numPages}
        </span>
        <button
          onClick={handleNextPage}
          disabled={currentPage >= numPages}
          className={`px-3 py-1 rounded ${
            currentPage >= numPages
              ? "bg-gray-300 cursor-not-allowed"
              : "bg-blue-500 hover:bg-blue-600 text-white"
          }`}
        >
          Next
        </button>
      </div>

      <div
        ref={thumbnailContainerRef}
        className="overflow-auto flex-1 space-y-2 scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100"
      >
        {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
          <div
            key={pageNum}
            data-page-number={pageNum}
            className={`cursor-pointer p-1 rounded transition-all ${
              pageNum === currentPage
                ? "ring-2 ring-blue-500 bg-blue-50"
                : "hover:bg-gray-200"
            }`}
            onClick={() => onPageSelect(pageNum)}
          >
            <div className="text-center text-xs mb-1 font-medium">
              Page {pageNum}
            </div>
            {thumbnails.has(pageNum) ? (
              <img
                src={thumbnails.get(pageNum)}
                alt={`Page ${pageNum} thumbnail`}
                className="w-full object-contain bg-white shadow"
              />
            ) : (
              <div className="w-full h-24 bg-gray-200 animate-pulse flex items-center justify-center">
                {isLoading.has(pageNum) ? (
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span className="text-gray-500 text-xs">Loading...</span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PDFSidebar;
