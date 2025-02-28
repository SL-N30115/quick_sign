"use client";

import { useParams } from "next/navigation";
import { pdfjs } from "react-pdf";
import React, { useRef, useState, useEffect } from "react";
import SignaturePad from "signature_pad";
import PDFViewer from "@/app/components/PDFViewer";
import SignatureToolbar from "@/app/components/signature/signatureToolbar";
import SignatureModal from "@/app/components/signature/signatureModal";
import { SignaturePosition } from "@/app/types/signaturePosition";

const CONFIG = {
  API_BASE_URL: "http://localhost:5000",
  DEFAULT_PAGE_WIDTH: 800,
  INITIAL_SIGNATURE_SIZE: { width: 150, height: 80 },
  // Add a sample PDF for development/testing when API fails
  SAMPLE_PDF_URL: "/sample.pdf",
};

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

const SAVED_SIGNATURES_KEY = "quicksign_saved_signatures";

export default function Sign() {
  const { id } = useParams();
  const [selectedPage, setSelectedPage] = useState<number>(1);
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [savedSignatures, setSavedSignatures] = useState<string[]>([]);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [apiWarning, setApiWarning] = useState<string | null>(null);
  const signaturePadRef = useRef<SignaturePad | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isProcessingSignature, setIsProcessingSignature] =
    useState<boolean>(false);
  const [isSignatureModalOpen, setIsSignatureModalOpen] =
    useState<boolean>(false);
  const [pdfPageDimensions, setPdfPageDimensions] = useState<
    Map<
      number,
      {
        width: number;
        height: number;
        pdfWidth: number;
        pdfHeight: number;
      }
    >
  >(new Map());

  const pdfViewerRef = useRef<any>(null);

  useEffect(() => {
    try {
      const savedData = localStorage.getItem(SAVED_SIGNATURES_KEY);
      if (savedData) {
        const parsed = JSON.parse(savedData);
        if (Array.isArray(parsed)) {
          setSavedSignatures(parsed);
        }
      }
    } catch (error) {
      console.error("Error loading saved signatures:", error);
    }
  }, []);

  useEffect(() => {
    if (savedSignatures.length > 0) {
      try {
        localStorage.setItem(
          SAVED_SIGNATURES_KEY,
          JSON.stringify(savedSignatures)
        );
      } catch (error) {
        console.error("Error saving signatures:", error);
      }
    }
  }, [savedSignatures]);

  // Use the same structure as expected by PDFViewer
  const [signatures, setSignatures] = useState<SignaturePosition[]>([]);

  // Handle signature save from SignatureModal component
  const handleSignatureSave = (signatureDataUrl: string) => {
    setIsProcessingSignature(true);

    // Add to saved signatures if it's not already there
    if (!savedSignatures.includes(signatureDataUrl)) {
      setSavedSignatures((prev) => [...prev, signatureDataUrl]);
    }

    // Set as active signature
    setSignatureImage(signatureDataUrl);
    setIsProcessingSignature(false);
  };

  useEffect(() => {
    const fetchPdf = async () => {
      try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/file/${id}`);
        if (!response.ok) {
          throw new Error("Failed to fetch document");
        }

        const blob = await response.blob();
        setPdfBlob(blob);
      } catch (error) {
        console.error("Error fetching PDF:", error);

        // Instead of failing, try to load a sample PDF for testing/development
        try {
          setApiWarning(
            "API connection failed. Using sample PDF for demo purposes."
          );
          const sampleResponse = await fetch(CONFIG.SAMPLE_PDF_URL);
          if (sampleResponse.ok) {
            const sampleBlob = await sampleResponse.blob();
            setPdfBlob(sampleBlob);
          } else {
            setError("Failed to load document. Please try again.");
          }
        } catch (fallbackError) {
          setError("Failed to load document. Please try again.");
        }
      }
    };

    if (id) fetchPdf();
  }, [id]);

  const handleClear = () => {
    if (signaturePadRef.current) {
      signaturePadRef.current.clear();
    }
  };

  const handleFinalize = async () => {
    if (!pdfBlob || signatures.length === 0) {
      setError("Please add your signature to the document before finalizing.");
      return;
    }

    try {
      // Create the properly formatted signature objects
      const formattedSignatures = signatures.map((sig) => {
        // Extract the base64 data if needed - some browsers may include a data URL prefix
        let signatureData = sig.signatureImageUrl;

        // Ensure we have the full data URL format for the server
        if (!signatureData.startsWith("data:image/")) {
          signatureData = `data:image/png;base64,${signatureData}`;
        }

        return {
          signatureImage: signatureData, // Use each signature's own image URL
          page: sig.pageNumber,
          position: { x: sig.x, y: sig.y },
          size: { width: sig.width, height: sig.height },
          pageWidth: sig.pageWidth || 800, // Provide default value if undefined
          pageHeight: sig.pageHeight || 1100, // Provide default value if undefined
          pdfWidth: sig.pdfWidth || 612, // Provide default value if undefined
          pdfHeight: sig.pdfHeight || 792, // Provide default value if undefined
        };
      });

      console.log("Sending signatures to backend:", formattedSignatures);

      // If we're in development mode with a sample PDF, show demo alert instead
      if (apiWarning) {
        alert(
          "In demo mode - backend API not available. This would send the signed document to the server."
        );
        return;
      }

      // Send data in the format expected by the backend
      const response = await fetch(`${CONFIG.API_BASE_URL}/sign-batch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          documentId: id,
          signatures: formattedSignatures,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();
      if (data.signedId) {
        window.location.href = `/download/${data.signedId}`;
      } else {
        throw new Error("No signed document ID returned");
      }
    } catch (error) {
      setError("Failed to finalize document. Please try again.");
      console.error("Error finalizing signature:", error);
    }
  };

  const getPageDimensions = () => {
    // Try to get dimensions from the stored page dimensions map
    const pageDim = pdfPageDimensions.get(selectedPage);
    if (pageDim) {
      return pageDim;
    }

    // Fallback to default dimensions
    return {
      width: 800,
      height: 1100,
      pdfWidth: 612,
      pdfHeight: 792,
    };
  };

  const saveSignaturePositions = (positions: SignaturePosition[]) => {
    // Only update the signatures state if it actually changed
    if (JSON.stringify(signatures) !== JSON.stringify(positions)) {
      setSignatures(positions);
      console.log("Updated signatures:", positions);
    }
  };

  const handleAddSignatureToDocument = (signatureDataUrl: string) => {
    console.log("Adding signature to document:", signatureDataUrl.substring(0, 50) + "...");
    
    // Set as active signature (for new signatures)
    setSignatureImage(signatureDataUrl);
    
    // Get page dimensions
    const pageDim = getPageDimensions();
    if (!pageDim) {
      console.error("No page dimensions available");
      return;
    }
    
    // Calculate center position
    const centerX = pageDim.width / 2 - 75;
    const centerY = pageDim.height / 2 - 40;
    
    // Create new signature
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
      signatureImageUrl: signatureDataUrl,
    };
    
    console.log("Created signature:", newSignature);
    
    // Update signatures state - IMPORTANT: No setTimeout here, it can cause race conditions
    setSignatures(prevSignatures => [...prevSignatures, newSignature]);
  };

  const handleDeleteSignature = (index: number) => {
    setSavedSignatures((prev) => {
      const updated = [...prev];
      updated.splice(index, 1);
      return updated;
    });
  };

  if (error) return <div className="text-red-500">{error}</div>;
  if (!id) return <div>No document ID</div>;
  if (!pdfBlob) return <div>Loading...</div>;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Sign Document</h1>

      {apiWarning && (
        <div className="mb-4 p-2 bg-yellow-100 border border-yellow-300 text-yellow-700 rounded">
          ⚠️ {apiWarning}
        </div>
      )}

      <SignatureToolbar
        onSignButtonClick={() => setIsSignatureModalOpen(true)}
        signatureImage={signatureImage}
        handleFinalize={handleFinalize}
        signaturesCount={signatures.length}
      />

      <PDFViewer
        pdfBlob={pdfBlob}
        selectedPage={selectedPage}
        onPageChange={setSelectedPage}
        signatureImage={signatureImage}
        signatures={signatures} // Pass signatures
        setSignatures={setSignatures} // Pass setter
        onPageDimensionsChange={setPdfPageDimensions}
      />

      {/* Signature Modal */}
      {/* Updated Signature Modal */}
      <SignatureModal
        isOpen={isSignatureModalOpen}
        onClose={() => setIsSignatureModalOpen(false)}
        signaturePadRef={signaturePadRef}
        canvasRef={canvasRef}
        onSignatureSave={handleSignatureSave}
        onClear={handleClear}
        savedSignatures={savedSignatures}
        onDeleteSignature={handleDeleteSignature}
        onAddToDocument={handleAddSignatureToDocument}
      />
    </div>
  );
}
