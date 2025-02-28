"use client";

import React, { useState, useEffect, useRef } from "react";
import { pdfjs } from "react-pdf";
import { SignaturePosition } from "@/app/types/signaturePosition";
import DraggableSignature from "./DraggableSignature";

interface PDFPageCanvasProps {
  pageNumber: number;
  pdfDocument: pdfjs.PDFDocumentProxy | null;
  scale: number;
  signatureImage: string | null;
  signatures: SignaturePosition[];
  pageDimensions: Map<number, { width: number; height: number; pdfWidth: number; pdfHeight: number }>;
  setPageDimensions: React.Dispatch<React.SetStateAction<Map<number, { width: number; height: number; pdfWidth: number; pdfHeight: number }>>>;
  handlePageClick: (e: React.MouseEvent, pageNumber: number) => void;
  updateSignatures: (updatedSignatures: SignaturePosition[]) => void;
  removeSignature: (id: string) => void;
  activeSignatureId: string | null;
  setActiveSignatureId: React.Dispatch<React.SetStateAction<string | null>>;
  isVisible: boolean;
}

const PDFPageCanvas: React.FC<PDFPageCanvasProps> = ({
  pageNumber,
  pdfDocument,
  scale,
  signatureImage,
  signatures,
  pageDimensions,
  setPageDimensions,
  handlePageClick,
  updateSignatures,
  removeSignature,
  activeSignatureId,
  setActiveSignatureId,
  isVisible,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [renderComplete, setRenderComplete] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<pdfjs.RenderTask | null>(null);
  const isMounted = useRef(true); // Track component mount state

  // Set up mount/unmount tracking
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Render the PDF page directly to canvas
  useEffect(() => {
    if (!pdfDocument || !isVisible) return;

    let renderingPage = pageNumber; // Track which page we're rendering
    let currentScale = scale; // Track the scale we're rendering
    
    const renderPage = async () => {
      if (!isMounted.current) return;
      setIsLoading(true);
      setRenderComplete(false);

      // Cancel any ongoing render task before proceeding
      if (renderTaskRef.current) {
        try {
          await renderTaskRef.current.cancel();
        } catch (e) {
          // Expected error, can be ignored
        } finally {
          renderTaskRef.current = null;
        }
      }

      // Don't continue if the component is unmounted or params changed
      if (!isMounted.current || renderingPage !== pageNumber || currentScale !== scale) {
        return;
      }

      try {
        // Get the page
        const page = await pdfDocument.getPage(pageNumber);

        // Get original viewport for dimensions
        const originalViewport = page.getViewport({ scale: 1 });

        // Create a scaled viewport for display
        const viewport = page.getViewport({ scale });

        // Store page dimensions for signature positioning
        if (isMounted.current) {
          setPageDimensions((prev) => {
            const newMap = new Map(prev);
            newMap.set(pageNumber, {
              width: viewport.width,
              height: viewport.height,
              pdfWidth: originalViewport.width,
              pdfHeight: originalViewport.height,
            });
            return newMap;
          });
        }

        // Create off-screen canvas for rendering
        const offscreenCanvas = document.createElement("canvas");
        offscreenCanvas.width = viewport.width;
        offscreenCanvas.height = viewport.height;
        const offscreenContext = offscreenCanvas.getContext("2d");

        if (!offscreenContext) {
          console.error("Could not get offscreen canvas context");
          return;
        }

        // Fill with white background first
        offscreenContext.fillStyle = "white";
        offscreenContext.fillRect(
          0,
          0,
          offscreenCanvas.width,
          offscreenCanvas.height
        );

        // Don't continue if the component is unmounted or params changed
        if (!isMounted.current || renderingPage !== pageNumber || currentScale !== scale) {
          return;
        }

        // Render PDF page to off-screen canvas
        renderTaskRef.current = page.render({
          canvasContext: offscreenContext,
          viewport: viewport,
        });

        try {
          // Wait for render to complete
          await renderTaskRef.current.promise;
        } catch (error: any) {
          // Handle rendering canceled exception
          if (error?.name === "RenderingCancelledException" || 
              error?.message?.includes("Rendering cancelled")) {
            return; // Just return, don't log as an error
          }
          throw error; // Re-throw any other errors
        }

        // Don't continue if the component is unmounted or params changed
        if (!isMounted.current || renderingPage !== pageNumber || currentScale !== scale) {
          return;
        }

        renderTaskRef.current = null;

        // Now copy the rendered content to the visible canvas
        const visibleCanvas = canvasRef.current;
        if (visibleCanvas && isMounted.current) {
          visibleCanvas.width = viewport.width;
          visibleCanvas.height = viewport.height;
          const visibleContext = visibleCanvas.getContext("2d");

          if (visibleContext) {
            visibleContext.drawImage(offscreenCanvas, 0, 0);
            if (isMounted.current) {
              setRenderComplete(true);
            }
          }
        }
      } catch (error: any) {
        if (isMounted.current) {
          // Only log errors that aren't cancellation errors
          if (error?.name !== "RenderingCancelledException" && 
              !error?.message?.includes("Rendering cancelled")) {
            console.error("Error rendering PDF page:", error);
          }
        }
      } finally {
        if (isMounted.current && renderingPage === pageNumber && currentScale === scale) {
          setIsLoading(false);
        }
      }
    };

    renderPage();

    return () => {
        // Clean up on unmount or when dependencies change
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch (e) {
            // Ignore any errors during cancellation
          }
          renderTaskRef.current = null;
        }
      };
  }, [pdfDocument, pageNumber, scale, isVisible, setPageDimensions]);

  return (
    <div
      ref={containerRef}
      className="relative flex justify-center mb-4"
      data-page-number={pageNumber}
    >
      {isLoading && !renderComplete && (
        <div className="w-full h-[800px] bg-gray-100 animate-pulse rounded-lg" />
      )}

      <div className="relative">
        <canvas
          ref={canvasRef}
          className="shadow-lg rounded-lg"
          onClick={(e) => handlePageClick(e, pageNumber)}
        />

        {/* Render signatures for this page */}
        {signatureImage &&
          pageDimensions.has(pageNumber) &&
          signatures
            .filter((sig) => sig.pageNumber === pageNumber)
            .map((signature) => (
              <DraggableSignature
                key={signature.id}
                signature={signature}
                signatureImage={signatureImage}
                activeSignatureId={activeSignatureId}
                setActiveSignatureId={setActiveSignatureId}
                pageDimensions={pageDimensions}
                updateSignatures={updateSignatures}
                allSignatures={signatures}
                removeSignature={removeSignature}
                scale={scale}
              />
            ))}
      </div>
    </div>
  );
};

export default PDFPageCanvas;