"use client";

import React, { useState, useEffect, useRef } from "react";
import { useInView } from "react-intersection-observer";
import { pdfjs } from "react-pdf";
import debounce from "lodash/debounce";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

interface PDFViewerProps {
  pdfBlob: Blob;
  selectedPage: number;
  onPageChange: (pageNumber: number) => void;
  className?: string;
  signatureImage?: string | null;
  onPageClick?: (e: React.MouseEvent, pageNumber: number) => void;
  saveSignaturePositions?: (positions: SignaturePosition[]) => void;
}

interface SignaturePosition {
  id: string;
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  pageWidth?: number;  // Width of the page as rendered in browser
  pageHeight?: number; // Height of the page as rendered in browser
  pdfWidth?: number;   // Original width of PDF page
  pdfHeight?: number;  // Original height of PDF page
}
const imageCache = new Map<string, string>();

const PDFViewer: React.FC<PDFViewerProps> = ({
  pdfBlob,
  selectedPage,
  onPageChange,
  className,
  signatureImage,
  onPageClick,
  saveSignaturePositions,
}) => {
  const [numPages, setNumPages] = useState(0);
  const [pdfDocument, setPdfDocument] = useState<pdfjs.PDFDocumentProxy | null>(
    null
  );
  const [scale, setScale] = useState(1.5);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const [signatures, setSignatures] = useState<SignaturePosition[]>([]);
  const [activeSignatureId, setActiveSignatureId] = useState<string | null>(
    null
  );

  const [pageDimensions, setPageDimensions] = useState<Map<number, { width: number, height: number, pdfWidth: number, pdfHeight: number }>>(
    new Map()
  );

  const handlePageClick = (e: React.MouseEvent, pageNumber: number) => {
    if (!signatureImage) return;

    // Call the parent's onClick handler if provided
    if (onPageClick) {
      onPageClick(e, pageNumber);
    }

    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Get page dimensions for scaling information
    const dimensions = pageDimensions.get(pageNumber);

    // Default signature size
    const width = 150;
    const height = 80;

    const newSignature: SignaturePosition = {
      id: `sig-${Date.now()}`,
      pageNumber,
      x,
      y,
      width,
      height,
      // Add dimension information for coordinate conversion
      pageWidth: dimensions?.width,
      pageHeight: dimensions?.height,
      pdfWidth: dimensions?.pdfWidth,
      pdfHeight: dimensions?.pdfHeight
    };

    const updatedSignatures = [...signatures, newSignature];
    setSignatures(updatedSignatures);

    // Save signatures if handler provided
    if (saveSignaturePositions) {
      saveSignaturePositions(updatedSignatures);
    }
  };

  useEffect(() => {
    const loadPDF = async () => {
      try {
        const arrayBuffer = await pdfBlob.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
        setPdfDocument(pdf);
        setNumPages(pdf.numPages);
      } catch (error) {
        console.error("Error loading PDF:", error);
      }
    };
    loadPDF();
  }, [pdfBlob]);

  useEffect(() => {
    const handleResize = debounce(() => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    }, 150);

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      handleResize.cancel();
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    return () => {
      clearCache();
    };
  }, [scale]);

  const PDFPageImage = ({ pageNumber }: { pageNumber: number }) => {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const renderTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const { ref, inView } = useInView({
      threshold: 0,
      triggerOnce: false,
      rootMargin: "400px 0px",
      delay: 100,
    });

    const cacheKey = `page_${pageNumber}_scale_${scale}_width_${containerWidth}`;

    const debouncedRenderPage = useRef(
      debounce(async (shouldRender: boolean) => {
        if (!shouldRender || !pdfDocument) return;

        if (imageCache.has(cacheKey)) {
          setImageUrl(imageCache.get(cacheKey)!);
          setIsLoading(false);
          return;
        }

        try {
          const page = await pdfDocument.getPage(pageNumber);
          
          // Get original viewport (scale 1)
          const originalViewport = page.getViewport({ scale: 1 });
          
          // Get scaled viewport for display
          const viewport = page.getViewport({ scale });

          // Store page dimensions for coordinate conversion
          setPageDimensions(prev => {
            const newMap = new Map(prev);
            newMap.set(pageNumber, {
              width: viewport.width,
              height: viewport.height,
              pdfWidth: originalViewport.width,
              pdfHeight: originalViewport.height
            });
            return newMap;
          });

          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          if (!context) return;

          await page.render({
            canvasContext: context,
            viewport: viewport,
          }).promise;

          const blob = await new Promise<Blob>((resolve) => {
            canvas.toBlob((blob) => {
              if (blob) resolve(blob);
            }, "image/png");
          });

          const url = URL.createObjectURL(blob);
          imageCache.set(cacheKey, url);
          setImageUrl(url);
          setIsLoading(false);
        } catch (error) {
          console.error("Error rendering page:", error);
          setIsLoading(false);
        }
      }, 150)
    ).current;

    useEffect(() => {
      setIsLoading(true);
      debouncedRenderPage(inView);

      return () => {
        debouncedRenderPage.cancel();
        if (renderTimeoutRef.current) {
          clearTimeout(renderTimeoutRef.current);
        }
      };
    }, [inView, pageNumber, pdfDocument, scale, containerWidth]);

    return (
      <div
        ref={ref}
        className="flex justify-center mb-4 relative cursor-pointer"
        data-page-number={pageNumber}
        onClick={(e) => handlePageClick(e, pageNumber)}
      >
        {isLoading && (
          <div className="w-full h-[800px] bg-gray-100 animate-pulse rounded-lg" />
        )}
        {imageUrl && (
          <div className="relative">
            <img
              src={imageUrl}
              alt={`Page ${pageNumber}`}
              className={`shadow-lg rounded-lg transition-opacity duration-300 ${
                isLoading ? "opacity-0" : "opacity-100"
              }`}
              loading="lazy"
              //@ts-ignore
              decode="async"
              onLoad={() => setIsLoading(false)}
              style={{ maxWidth: "100%", height: "auto" }}
            />

            {/* Render signatures for this page */}
            {signatureImage &&
              signatures
                .filter((sig) => sig.pageNumber === pageNumber)
                .map((signature) => (
                  <DraggableSignature
                    key={signature.id}
                    signature={signature}
                    signatureImage={signatureImage}
                  />
                ))}
          </div>
        )}
      </div>
    );
  };

  const removeSignature = (id: string) => {
    const updatedSignatures = signatures.filter((sig) => sig.id !== id);
    setSignatures(updatedSignatures);
    if (saveSignaturePositions) {
      saveSignaturePositions(updatedSignatures);
    }
  };

  const DraggableSignature = ({
    signature,
    signatureImage,
  }: {
    signature: SignaturePosition;
    signatureImage: string;
  }) => {
    const [position, setPosition] = useState({
      x: signature.x,
      y: signature.y,
    });
    const [isDragging, setIsDragging] = useState(false);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });

    const handleMouseDown = (e: React.MouseEvent) => {
      setIsDragging(true);
      setStartPos({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
      setActiveSignatureId(signature.id);
      e.stopPropagation();
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const newX = e.clientX - startPos.x;
      const newY = e.clientY - startPos.y;
      setPosition({ x: newX, y: newY });

      e.preventDefault();
    };

    const handleMouseUp = () => {
      if (!isDragging) return;

      setIsDragging(false);

      // Get current page dimensions
      const dimensions = pageDimensions.get(signature.pageNumber);

      // Update signature position in main state
      const updatedSignatures = signatures.map((sig) =>
        sig.id === signature.id ? {
          ...sig,
          x: position.x,
          y: position.y,
          // Update with current page dimensions
          pageWidth: dimensions?.width,
          pageHeight: dimensions?.height,
          pdfWidth: dimensions?.pdfWidth,
          pdfHeight: dimensions?.pdfHeight
        } : sig
      );

      setSignatures(updatedSignatures);
      if (saveSignaturePositions) {
        saveSignaturePositions(updatedSignatures);
      }
    };

    useEffect(() => {
      if (isDragging) {
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
      }

      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }, [isDragging, startPos]);

    return (
      <div
        className={`absolute cursor-move group ${
          activeSignatureId === signature.id
            ? "z-20 ring-2 ring-blue-500"
            : "z-10"
        }`}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: `${signature.width}px`,
          height: `${signature.height}px`,
        }}
        onMouseDown={handleMouseDown}
      >
        <img
          src={signatureImage}
          alt="Signature"
          className="w-full h-full object-contain"
        />

        {/* Delete button */}
        <button
          className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            removeSignature(signature.id);
          }}
        >
          ×
        </button>
      </div>
    );
  };

  const handleZoomIn = () => {
    setScale((s) => Math.min(s + 0.2, 3));
  };

  const handleZoomOut = () => {
    setScale((s) => Math.max(s - 0.2, 0.5));
  };

  const clearCache = () => {
    imageCache.forEach((url) => {
      URL.revokeObjectURL(url);
    });
    imageCache.clear();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="bg-gray-50 p-4 shadow-md flex justify-between items-center sticky top-0 z-10">
        <div className="font-semibold">PDF Viewer</div>
        <div className="flex gap-2">
          <button
            onClick={handleZoomIn}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Zoom In
          </button>
          <button
            onClick={handleZoomOut}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Zoom Out
          </button>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 overflow-auto p-4 bg-gray-100">
        {numPages > 0 ? (
          Array.from({ length: numPages }, (_, i) => (
            <PDFPageImage key={i + 1} pageNumber={i + 1} />
          ))
        ) : (
          <div className="text-center py-8">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent"></div>
            <p className="mt-2">Loading pdf...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PDFViewer;