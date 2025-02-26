import React, { useState, useEffect, useRef } from "react";
import { useInView } from "react-intersection-observer";
import debounce from "lodash/debounce";
import { pdfjs } from "react-pdf";
import { SignaturePosition } from "@/app/types/signaturePosition";
import DraggableSignature from "./DraggableSignature";

interface PDFPageImageProps {
  pageNumber: number;
  pdfDocument: pdfjs.PDFDocumentProxy | null;
  scale: number;
  containerWidth: number;
  signatureImage: string | null;
  signatures: SignaturePosition[];
  pageDimensions: Map<number, { width: number; height: number; pdfWidth: number; pdfHeight: number }>;
  setPageDimensions: React.Dispatch<React.SetStateAction<Map<number, { width: number; height: number; pdfWidth: number; pdfHeight: number }>>>;
  handlePageClick: (e: React.MouseEvent, pageNumber: number) => void;
  updateSignatures: (updatedSignatures: SignaturePosition[]) => void;
  removeSignature: (id: string) => void;
  activeSignatureId: string | null;
  setActiveSignatureId: React.Dispatch<React.SetStateAction<string | null>>;
}

const imageCache = new Map<string, string>();

const PDFPageImage: React.FC<PDFPageImageProps> = ({
  pageNumber,
  pdfDocument,
  scale,
  containerWidth,
  signatureImage,
  signatures,
  pageDimensions,
  setPageDimensions,
  handlePageClick,
  updateSignatures,
  removeSignature,
  activeSignatureId,
  setActiveSignatureId,
}) => {
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
          {signatureImage && pageDimensions.has(pageNumber) &&
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
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default PDFPageImage;