'use client';

import {useParams} from 'next/navigation';
import {pdfjs} from 'react-pdf';
import React, {useRef, useState, useEffect} from 'react';
import SignaturePad from "signature_pad";
import PDFViewer from "@/app/components/PDFViewer";
import SignatureArea from "@/app/components/signatureArea";

const CONFIG = {
    API_BASE_URL: 'http://localhost:5000',
    DEFAULT_PAGE_WIDTH: 800,
    INITIAL_SIGNATURE_SIZE: {width: 150, height: 80}
};

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
    import.meta.url
).toString();

// This should match the interface in PDFViewer.tsx
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

export default function Sign() {
    const {id} = useParams();
    const [selectedPage, setSelectedPage] = useState<number>(1);
    const [signatureImage, setSignatureImage] = useState<string | null>(null);
    const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
    const [error, setError] = useState<string | null>(null);
    const signaturePadRef = useRef<SignaturePad | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    
    // Use the same structure as expected by PDFViewer
    const [signatures, setSignatures] = useState<SignaturePosition[]>([]);

    // Handle signature save from SignatureArea component
    const handleSignatureSave = (signatureDataUrl: string) => {
        setSignatureImage(signatureDataUrl);
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
                if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
                const blob = await response.blob();
                setPdfBlob(blob);
            } catch (error) {
                setError(`Can't load PDF`);
                console.error('Fetch error:', error);
            }
        };

        if (id) fetchPdf();
    }, [id]);

    const handleClear = () => {
        if (signaturePadRef.current) {
            signaturePadRef.current.clear();
            setSignatureImage(null);
        }
    };

    const handleFinalize = async () => {
        if (signatures.length === 0 || !id || !signatureImage) {
            setError("Please add at least one signature to finalize the document");
            return;
        }
        
        // Add loading state
        setError(null);
        
        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/sign-batch`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    documentId: id,
                    signatures: signatures.map(sig => ({
                        signatureImage,
                        page: sig.pageNumber,
                        position: { x: sig.x, y: sig.y },
                        size: { width: sig.width, height: sig.height },
                        // Include page dimension information for better coordinate conversion
                        pageWidth: sig.pageWidth,
                        pageHeight: sig.pageHeight,
                        pdfWidth: sig.pdfWidth,
                        pdfHeight: sig.pdfHeight
                    }))
                })
            });
    
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Server returned ${response.status}`);
            }
    
            const data = await response.json();
            if (data.signedId) {
                window.location.href = `/download/${data.signedId}`;
            } else {
                throw new Error("No signed document ID returned");
            }
        } catch (error) {
            setError('Failed to finalize document. Please try again.');
            console.error('Error finalizing signature:', error);
        }
    };

    if (error) return <div className="text-red-500">{error}</div>;
    if (!id) return <div>No document ID</div>;
    if (!pdfBlob) return <div>Loading...</div>;

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">Sign Document</h1>

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
                    
                    {signatures.length > 0 && signatureImage && (
                        <button 
                            onClick={handleFinalize}
                            className="mt-6 w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                        >
                            Finalize Document
                        </button>
                    )}
                    
                    {signatures.length > 0 && (
                        <div className="mt-4">
                            <h3 className="font-semibold">Signature Placements</h3>
                            <ul className="text-sm mt-2">
                                {signatures.map(sig => (
                                    <li key={sig.id} className="mb-1 text-gray-700">
                                        Page {sig.pageNumber} - Position: ({Math.round(sig.x)}, {Math.round(sig.y)})
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}