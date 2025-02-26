import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useInView } from "react-intersection-observer";
import { pdfjs } from "react-pdf";
import debounce from "lodash/debounce";
import DraggableSignature from "./DraggableSignature";
import { SignaturePosition } from "@/app/types/signaturePosition";
import PDFPageImage from "@/app/components/pdfPageImage";
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

const imageCache = new Map<string, string>();

// Number of pages to preload before and after the current page
const PRE_LOAD_PAGES = 40;

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

  // Keep track of rendered pages
  const [renderedPages, setRenderedPages] = useState<Set<number>>(new Set([selectedPage]));

  const [pageDimensions, setPageDimensions] = useState<Map<number, { 
    width: number, 
    height: number, 
    pdfWidth: number, 
    pdfHeight: number 
  }>>(new Map());

  // Pre-render surrounding pages when selectedPage changes
  useEffect(() => {
    if (numPages === 0) return;
    
    // Add current page to rendered pages
    setRenderedPages(prev => {
      const newSet = new Set(prev);
      newSet.add(selectedPage);
      
      // Add pages around the current page
      for (let i = 1; i <= PRE_LOAD_PAGES; i++) {
        if (selectedPage + i <= numPages) {
          newSet.add(selectedPage + i);
        }
        if (selectedPage - i >= 1) {
          newSet.add(selectedPage - i);
        }
      }
      
      return newSet;
    });
  }, [selectedPage, numPages]);

  const handlePageClick = (e: React.MouseEvent, pageNumber: number) => {
    if (!signatureImage) return;
  
    // IMPORTANT: Always use the selectedPage instead of pageNumber parameter
    // This ensures signatures are placed on the visible page regardless of which page element was clicked
    const actualPageNumber = selectedPage;
    console.log(`Adding signature to page ${actualPageNumber} (clicked on element with page ${pageNumber})`);
    // Call the parent's onClick handler if provided
    if (onPageClick) {
      onPageClick(e, actualPageNumber);
    }
  
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
  
    // Get page dimensions for the SELECTED page (not the clicked page)
    const dimensions = pageDimensions.get(actualPageNumber);
    
    if (!dimensions) {
      console.error(`No dimensions found for page ${actualPageNumber}`);
      return;
    }
  
    // Default signature size
    const width = 150;
    const height = 80;
  
    const newSignature: SignaturePosition = {
      id: `sig-${Date.now()}`,
      pageNumber: actualPageNumber,  // Use the selected page number
      x,
      y,
      width,
      height,
      // Add dimension information for coordinate conversion
      pageWidth: dimensions.width,
      pageHeight: dimensions.height,
      pdfWidth: dimensions.pdfWidth,
      pdfHeight: dimensions.pdfHeight
    };
  
    const updatedSignatures = [...signatures, newSignature];
    setSignatures(updatedSignatures);
  
    // Save signatures if handler provided
    if (saveSignaturePositions) {
      saveSignaturePositions(updatedSignatures);
    }
  };

  // Function to update signatures - passed to DraggableSignature component
  const updateSignatures = useCallback((updatedSignatures: SignaturePosition[]) => {
    // First update local state
    setSignatures(updatedSignatures);
  }, []);
  
  // Add this useEffect to handle parent updates separately
  useEffect(() => {
    // Only call saveSignaturePositions when signatures change
    // and not during the initial render
    if (signatures.length > 0 && saveSignaturePositions) {
      saveSignaturePositions(signatures);
    }
  }, [signatures, saveSignaturePositions]);

  // Function to remove a signature - passed to DraggableSignature component
  const removeSignature = (id: string) => {
    const updatedSignatures = signatures.filter((sig) => sig.id !== id);
    setSignatures(updatedSignatures);
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

  // Pre-render all pages but only show the current one
  // This uses CSS to hide/show pages instead of unmounting/remounting them
  const pageComponents = useMemo(() => {
    if (!numPages) return [];
    
    return Array.from(renderedPages).map(pageNum => (
      <div 
        key={pageNum} 
        className={`pdf-page-wrapper transition-opacity duration-150 ${
          pageNum === selectedPage ? 'opacity-100 z-10' : 'opacity-0 absolute top-0 left-0 z-0'
        }`}
      >
        <PDFPageImage
          key={`page-${pageNum}-scale-${scale}`}
          pageNumber={pageNum}
          pdfDocument={pdfDocument}
          scale={scale}
          containerWidth={containerWidth}
          signatureImage={signatureImage ?? null}
          signatures={signatures}
          pageDimensions={pageDimensions}
          setPageDimensions={setPageDimensions}
          handlePageClick={handlePageClick}
          updateSignatures={updateSignatures}
          removeSignature={removeSignature}
          activeSignatureId={activeSignatureId}
          setActiveSignatureId={setActiveSignatureId}
        />
      </div>
    ));
  }, [
    numPages, 
    renderedPages, 
    selectedPage, 
    pdfDocument, 
    scale, 
    containerWidth, 
    signatureImage, 
    signatures,
    pageDimensions,
    activeSignatureId
  ]);

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
  
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-48 border-r border-gray-200 h-full">
          <PDFSidebar
            pdfDocument={pdfDocument}
            currentPage={selectedPage}
            onPageSelect={(page) => {
              onPageChange(page);
            }}
            numPages={numPages}
          />
        </div>
  
        {/* Main PDF content - Only show current selected page */}
        <div ref={containerRef} className="flex-1 overflow-auto p-4 bg-gray-100 flex justify-center relative">
          {numPages > 0 ? (
            <div className="pdf-page-container relative">
              {pageComponents}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent"></div>
              <p className="mt-2">Loading pdf...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PDFViewer;