import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { pdfjs } from "react-pdf";
import debounce from "lodash/debounce";
import { SignaturePosition } from "@/app/types/signaturePosition";
import PDFPageCanvas from "@/app/components/PDFCanvas";
import PDFSidebar from "./PDFSidebar";

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
  const [pdfDocument, setPdfDocument] = useState<pdfjs.PDFDocumentProxy | null>(null);
  const [scale, setScale] = useState(1.5);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const [signatures, setSignatures] = useState<SignaturePosition[]>([]);
  const [activeSignatureId, setActiveSignatureId] = useState<string | null>(null);
  const [pageDimensions, setPageDimensions] = useState<Map<number, { 
    width: number, 
    height: number, 
    pdfWidth: number, 
    pdfHeight: number 
  }>>(new Map());

  const handlePageClick = (e: React.MouseEvent, pageNumber: number) => {
    if (!signatureImage) return;
    if (onPageClick) onPageClick(e, pageNumber);

    // IMPORTANT: Always use the selectedPage instead of pageNumber parameter
    // This ensures signatures are placed on the visible page regardless of which page element was clicked
    const actualPageNumber = selectedPage;
    
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Get the page dimensions for coordinate conversion
    const pageDim = pageDimensions.get(actualPageNumber);
    
    if (!pageDim) return;
    
    const newSignature: SignaturePosition = {
      id: `sig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      pageNumber: actualPageNumber,
      x: x,
      y: y,
      width: 150,
      height: 80,
      pageWidth: pageDim.width,
      pageHeight: pageDim.height,
      pdfWidth: pageDim.pdfWidth,
      pdfHeight: pageDim.pdfHeight,
    };
    
    setSignatures(prev => [...prev, newSignature]);
    setActiveSignatureId(newSignature.id);
  };

  // Function to update signatures - passed to DraggableSignature component
  const updateSignatures = useCallback((updatedSignatures: SignaturePosition[]) => {
    setSignatures(updatedSignatures);
  }, []);
  
  // Add this useEffect to handle parent updates separately
  useEffect(() => {
    if (saveSignaturePositions) {
      saveSignaturePositions(signatures);
    }
  }, [signatures, saveSignaturePositions]);

  // Function to remove a signature - passed to DraggableSignature component
  const removeSignature = (id: string) => {
    setSignatures(prev => prev.filter(sig => sig.id !== id));
    if (activeSignatureId === id) {
      setActiveSignatureId(null);
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

  const handleZoomIn = () => {
    setScale((s) => Math.min(s + 0.2, 3));
  };

  const handleZoomOut = () => {
    setScale((s) => Math.max(s - 0.2, 0.5));
  };

  return  (
    <div className={`pdf-viewer ${className || ''}`}>
      <div className="flex flex-col md:flex-row h-full">
        {/* Sidebar */}
        <div className="md:w-1/5 md:min-w-[180px] border-r border-gray-200 overflow-auto">
          <PDFSidebar
            pdfDocument={pdfDocument}
            currentPage={selectedPage}
            onPageSelect={onPageChange}
            numPages={numPages}
          />
        </div>
        
        {/* Main PDF View */}
        <div className="flex-1 overflow-auto" ref={containerRef}>
          <div className="sticky top-0 z-20 bg-white p-2 border-b flex justify-between items-center">
            <div>
              <span className="font-medium">
                Page {selectedPage} of {numPages}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleZoomOut}
                className="p-2 bg-gray-100 hover:bg-gray-200 rounded"
                title="Zoom Out"
              >
                -
              </button>
              <span className="mx-1">{Math.round(scale * 100)}%</span>
              <button
                onClick={handleZoomIn}
                className="p-2 bg-gray-100 hover:bg-gray-200 rounded"
                title="Zoom In"
              >
                +
              </button>
            </div>
          </div>
          
          {/* Only render the current visible page for better performance */}
          <div className="p-4">
            {pdfDocument && (
              <PDFPageCanvas
                key={`page-${selectedPage}-scale-${scale}`}
                pageNumber={selectedPage}
                pdfDocument={pdfDocument}
                scale={scale}
                signatureImage={signatureImage ?? null}
                signatures={signatures}
                pageDimensions={pageDimensions}
                setPageDimensions={setPageDimensions}
                handlePageClick={handlePageClick}
                updateSignatures={updateSignatures}
                removeSignature={removeSignature}
                activeSignatureId={activeSignatureId}
                setActiveSignatureId={setActiveSignatureId}
                isVisible={true}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PDFViewer;