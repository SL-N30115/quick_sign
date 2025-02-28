import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
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
  signatures: SignaturePosition[]; // Make signatures a prop from parent
  setSignatures: React.Dispatch<React.SetStateAction<SignaturePosition[]>>; // Add setter
  onPageDimensionsChange?: (
    dimensions: Map<
      number,
      {
        width: number;
        height: number;
        pdfWidth: number;
        pdfHeight: number;
        scale?: number;
      }
    >
  ) => void;
}

const PDFViewer: React.FC<PDFViewerProps> = ({
  pdfBlob,
  selectedPage,
  onPageChange,
  className,
  signatureImage,
  signatures, // Use signatures from props
  setSignatures, // Use setter from props
  onPageDimensionsChange,
}) => {
  const [numPages, setNumPages] = useState(0);
  const [pdfDocument, setPdfDocument] = useState<pdfjs.PDFDocumentProxy | null>(
    null
  );
  const [scale, setScale] = useState(1.5);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [activeSignatureId, setActiveSignatureId] = useState<string | null>(
    null
  );
  const [pageDimensions, setPageDimensions] = useState<
    Map<
      number,
      {
        width: number;
        height: number;
        pdfWidth: number;
        pdfHeight: number;
        scale?: number;
      }
    >
  >(new Map());

  const addSignature = useCallback(
    (signatureImageUrl: string) => {
      // Get dimensions of current page
      const pageDim = pageDimensions.get(selectedPage);
      if (!pageDim) return;

      // Calculate center position
      const centerX = pageDim.width / 2 - 75; // Half of default width (150px)
      const centerY = pageDim.height / 2 - 40; // Half of default height (80px)

      // Create new signature at center of current page
      const newSignature: SignaturePosition = {
        id: `sig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        pageNumber: selectedPage,
        x: centerX,
        y: centerY,
        width: 150,
        height: 80,
        pageWidth: pageDim.width,
        pageHeight: pageDim.height,
        pdfWidth: pageDim.pdfWidth,
        pdfHeight: pageDim.pdfHeight,
        signatureImageUrl: signatureImageUrl, // Use the signature image URL passed
      };

      // Add signature to the list
      setSignatures((prev) => [...prev, newSignature]);
      setActiveSignatureId(newSignature.id);
    },
    [selectedPage, pageDimensions]
  );

  // Add this to useEffect to expose the method through a ref
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).addSignatureToPDF = addSignature;
    }
  }, [addSignature]);

    // Add this to PDFViewer where you update pageDimensions
  useEffect(() => {
      // When scale changes, update the pageDimensions with the new scale
      setPageDimensions(prevDimensions => {
          const newDimensions = new Map(prevDimensions);
          
          // Update each page's dimensions with the current scale
          prevDimensions.forEach((dim, pageNum) => {
              newDimensions.set(pageNum, {
                  ...dim,
                  scale: scale
              });
          });
          
          return newDimensions;
      });
  }, [scale]);

  const handlePageClick = (e: React.MouseEvent, pageNumber: number) => {
    // if ((e.target as HTMLElement).closest("button")) return;
    return;
    // if (!signatureImage) return; // Don't proceed if there's no signature image
    // if (onPageClick) onPageClick(e, pageNumber);

    // IMPORTANT: Always use the selectedPage instead of pageNumber parameter
    // const actualPageNumber = selectedPage;

    // const target = e.currentTarget as HTMLElement;
    // const rect = target.getBoundingClientRect();
    // const x = e.clientX - rect.left;
    // const y = e.clientY - rect.top;

    // const pageDim = pageDimensions.get(actualPageNumber);
    // if (!pageDim) return;

    // // Ensure signatureImage is actually a string before creating a signature
    // if (typeof signatureImage !== "string" || !signatureImage.trim()) {
    //   console.error("Cannot create signature: Invalid signature image");
    //   return;
    // }

    // const newSignature: SignaturePosition = {
    //   id: `sig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    //   pageNumber: actualPageNumber,
    //   x: x,
    //   y: y,
    //   width: 150,
    //   height: 80,
    //   pageWidth: pageDim.width,
    //   pageHeight: pageDim.height,
    //   pdfWidth: pageDim.pdfWidth,
    //   pdfHeight: pageDim.pdfHeight,
    //   signatureImageUrl: signatureImage,
    // };

    // setSignatures((prev) => [...prev, newSignature]);
    // setActiveSignatureId(newSignature.id);
  };

  // Function to update signatures - passed to DraggableSignature component
  const updateSignatures = useCallback(
    (updatedSignatures: SignaturePosition[]) => {
      setSignatures(updatedSignatures);
    },
    []
  );


  // Function to remove a signature - passed to DraggableSignature component
  const removeSignature = (id: string) => {
    setSignatures((prev) => prev.filter((sig) => sig.id !== id));
    if (activeSignatureId === id) {
      setActiveSignatureId(null);
    }
  };

  useEffect(() => {
    if (onPageDimensionsChange) {
      onPageDimensionsChange(pageDimensions);
    }
  }, [pageDimensions, onPageDimensionsChange]);

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

  return (
    <div className={`pdf-viewer ${className || ""}`}>
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
