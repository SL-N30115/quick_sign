"use client";

import { useParams } from "next/navigation";
import { pdfjs } from "react-pdf";
import React, { useRef, useState, useEffect } from "react";
import SignaturePad from "signature_pad";
import PDFViewer from "@/app/components/PDFViewer";
import SignatureArea from "@/app/components/signatureArea";
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

  // Use the same structure as expected by PDFViewer
  const [signatures, setSignatures] = useState<SignaturePosition[]>([]);

  // Handle signature save from SignatureArea component
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

      <div className="flex flex-col md:flex-row gap-4">
        {/* PDF Viewer Column - takes 2/3 of the space */}
        <div className="md:w-2/3">
          <PDFViewer
            pdfBlob={pdfBlob}
            selectedPage={selectedPage}
            onPageChange={setSelectedPage}
            signatureImage={signatureImage}
            saveSignaturePositions={saveSignaturePositions}
          />
        </div>

        {/* Signature Tools Column - takes 1/3 of the space */}
        <div className="md:w-1/3 bg-white p-4 shadow rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Signature Tools</h2>

          <SignatureArea
            signaturePadRef={signaturePadRef}
            canvasRef={canvasRef}
            onSignatureSave={handleSignatureSave}
            onClear={handleClear}
          />

          {signatureImage && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <h3 className="font-medium mb-2">Your Signature</h3>
              <div className="border rounded p-2 flex justify-center">
                <img
                  src={signatureImage}
                  alt="Your signature"
                  className="max-h-24"
                />
              </div>
              <div className="mt-4">
                <p className="text-sm text-gray-600 mb-2">
                  Click on the document to place your signature.
                </p>
                <button
                  onClick={handleFinalize}
                  className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700"
                  disabled={signatures.length === 0}
                >
                  Finalize Document
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}