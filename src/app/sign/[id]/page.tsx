'use client';

import { useParams } from 'next/navigation';
import { Document, Page, pdfjs } from 'react-pdf';
import { Resizable } from 'react-resizable';
import React, { useRef, useState, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import Draggable, { DraggableData } from 'react-draggable';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
    import.meta.url,
).toString();

interface Position {
    x: number;
    y: number;
}

interface Size {
    width: number;
    height: number;
}

export default function Sign() {
    const params = useParams();
    const id = params.id as string;
    console.log('Document ID:', id);
    const [numPages, setNumPages] = useState<number | null>(null);
    const [selectedPage, setSelectedPage] = useState<number>(1);
    const sigCanvas = useRef<SignatureCanvas>(null);
    const [signatureImage, setSignatureImage] = useState<string | null>(null);
    const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
    const [size, setSize] = useState<Size>({ width: 100, height: 50 });
    const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const fileUrl = `http://localhost:5000/file/${id}`;
    console.log('Fetching PDF from:', fileUrl);

    useEffect(() => {
        let mounted = true;
        const fetchPdf = async () => {
            try {
                const response = await fetch(fileUrl);
                if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
                const blob = await response.blob();
                if (mounted) {
                    setPdfBlob(blob);
                    console.log('PDF Blob set:', blob);
                }
            } catch (error) {
                console.error('Fetch error:', error);
            }
        };
        fetchPdf();
        return () => {
            mounted = false;
        };
    }, [fileUrl]);

    useEffect(() => {
        if (canvasRef.current) {
            console.log('Canvas element created:', canvasRef.current);
        } else {
            console.log('Canvas ref is null');
        }
    }, [pdfBlob]);

    const handleDrag = (e: any, data: DraggableData) => {
        setPosition({ x: data.x, y: data.y });
    };

    const handleResize = (e: any, { size }: { size: Size }) => {
        setSize(size);
    };

    const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
        setNumPages(numPages);
        console.log('PDF loaded with', numPages, 'pages');
    };

    const saveSignature = () => {
        if (sigCanvas.current) {
            const image = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png');
            setSignatureImage(image);
        }
    };

    const handleFinalize = async () => {
        if (!signatureImage || !id) return;
        try {
            const response = await fetch('http://localhost:5000/sign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    documentId: id,
                    signatureImage,
                    page: selectedPage,
                    position,
                    size,
                }),
            });
            const data: { signedId: string } = await response.json();
            window.location.href = `/download/${data.signedId}`;
        } catch (error) {
            console.error('Error finalizing signature:', error);
        }
    };

    if (!id) return <p>No document ID provided</p>;
    if (!pdfBlob) return <div>Fetching PDF...</div>;

    console.log('Rendering Document with file:', pdfBlob);

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">Sign Document</h1>
            <div className="mb-4">
                <select
                    value={selectedPage}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                        setSelectedPage(parseInt(e.target.value))
                    }
                    className="border p-2 rounded"
                >
                    {numPages
                        ? Array.from({ length: numPages }, (_, i) => (
                            <option key={i + 1} value={i + 1}>
                                Page {i + 1}
                            </option>
                        ))
                        : <option>Loading pages...</option>}
                </select>
            </div>

            <div className="mb-4" style={{ position: 'relative', width: '100%', height: 'auto', border: '1px solid red', minHeight: '500px', backgroundColor: '#fff' }}>
                <Document
                    key={pdfBlob.size + pdfBlob.type}
                    file={pdfBlob}
                    onLoadSuccess={onDocumentLoadSuccess}
                    onLoadError={(error) => console.error('PDF load error:', error)}
                    onSourceSuccess={() => console.log('PDF source loaded successfully')}
                    onSourceError={(error) => console.error('PDF source error:', error)}
                    loading={<div>Loading PDF...</div>}
                    error={<div>Failed to load PDF</div>}
                    className="border p-4"
                >
                    <Page
                        pageNumber={1}
                        renderTextLayer={true}
                        renderAnnotationLayer={true}
                        width={800}
                        canvasRef={canvasRef}
                        onRenderSuccess={() => console.log('Page rendered successfully')}
                        onRenderError={(error) => console.error('Page render error:', error)}
                        onLoadSuccess={() => console.log('Page loaded successfully')}
                    />
                </Document>
            </div>

            <div className="mb-4 border p-4">
                <SignatureCanvas
                    ref={sigCanvas}
                    canvasProps={{
                        width: 500,
                        height: 200,
                        className: 'border',
                    }}
                />
                <div className="mt-2">
                    <button
                        onClick={saveSignature}
                        className="bg-blue-500 text-white px-4 py-2 rounded mr-2"
                    >
                        Save Signature
                    </button>
                    <button
                        onClick={() => sigCanvas.current?.clear()}
                        className="bg-gray-500 text-white px-4 py-2 rounded"
                    >
                        Clear
                    </button>
                </div>
            </div>

            {signatureImage && (
                <Draggable position={position} onStop={handleDrag}>
                    <Resizable
                        width={size.width}
                        height={size.height}
                        onResize={handleResize}
                        minConstraints={[50, 25]}
                        maxConstraints={[300, 150]}
                    >
                        <img
                            src={signatureImage}
                            alt="Signature"
                            style={{
                                width: size.width,
                                height: size.height,
                                cursor: 'move',
                            }}
                            className="border border-dashed border-gray-400"
                        />
                    </Resizable>
                </Draggable>
            )}

            <button
                onClick={handleFinalize}
                disabled={!signatureImage}
                className={`mt-4 px-6 py-2 rounded ${
                    signatureImage
                        ? 'bg-green-500 text-white hover:bg-green-600'
                        : 'bg-gray-300 cursor-not-allowed'
                }`}
            >
                Finalize
            </button>
        </div>
    );
}