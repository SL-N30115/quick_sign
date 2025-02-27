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

export default function Sign() {
  const { id } = useParams();
  const [selectedPage, setSelectedPage] = useState<number>(1);
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [apiWarning, setApiWarning] = useState<string | null>(null);
  const signaturePadRef = useRef<SignaturePad | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isProcessingSignature, setIsProcessingSignature] = useState<boolean>(false);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState<boolean>(false);

  // Use the same structure as expected by PDFViewer
  const [signatures, setSignatures] = useState<SignaturePosition[]>([]);

  // Handle signature save from SignatureModal component
  const handleSignatureSave = async (signatureDataUrl: string) => {
    setIsProcessingSignature(true);
    setSignatureImage(signatureDataUrl);
    setIsProcessingSignature(false);
  };

  // Save signature positions from PDFViewer
  const saveSignaturePositions = (positions: SignaturePosition[]) => {
    setSignatures(positions);
    console.log("Updated signatures:", positions);
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
    if (!pdfBlob || !signatureImage || signatures.length === 0) {
      setError("Please add your signature to the document before finalizing.");
      return;
    }
  
    try {
      const formData = new FormData();
      formData.append("pdfFile", pdfBlob);
      
      // Create the properly formatted signature objects
      const formattedSignatures = signatures.map(sig => ({
        signatureImage,
        page: sig.pageNumber,
        position: { x: sig.x, y: sig.y },
        size: { width: sig.width, height: sig.height },
        pageWidth: sig.pageWidth,
        pageHeight: sig.pageHeight,
        pdfWidth: sig.pdfWidth,
        pdfHeight: sig.pdfHeight
      }));
      
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
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentId: id,
          signatures: formattedSignatures
        })
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
        saveSignaturePositions={saveSignaturePositions}
      />

      {/* Signature Modal */}
      <SignatureModal
        isOpen={isSignatureModalOpen}
        onClose={() => setIsSignatureModalOpen(false)}
        signaturePadRef={signaturePadRef}
        canvasRef={canvasRef}
        onSignatureSave={handleSignatureSave}
        onClear={handleClear}
      />
    </div>
  );
}