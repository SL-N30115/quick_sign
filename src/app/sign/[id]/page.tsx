'use client';

import {useParams} from 'next/navigation';
import {Document, Page, pdfjs} from 'react-pdf';
import {Resizable} from 'react-resizable';
import React, {useRef, useState, useEffect, useCallback} from 'react';
import SignatureCanvas from 'react-signature-canvas';
import Draggable from 'react-draggable';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import SignatureArea from "@/app/components/signatureArea";
import SignaturePad from "signature_pad";


const CONFIG = {
    API_BASE_URL: 'http://localhost:5000',
    DEFAULT_PAGE_WIDTH: 800,
    MIN_SIGNATURE_SIZE: [50, 25] as [number, number],
    MAX_SIGNATURE_SIZE: [300, 150] as [number, number],
    INITIAL_SIGNATURE_SIZE: {width: 100, height: 50}
};


pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
    import.meta.url
).toString();


interface Position {
    x: number;
    y: number
}

interface Size {
    width: number;
    height: number
}


export default function Sign() {
    const {id} = useParams();
    const [numPages, setNumPages] = useState<number>(0);
    const [selectedPage, setSelectedPage] = useState<number>(1);
    const [signatureImage, setSignatureImage] = useState<string | null>(null);
    const [position, setPosition] = useState<Position>({x: 0, y: 0});
    const [size, setSize] = useState<Size>(CONFIG.INITIAL_SIGNATURE_SIZE);
    const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
    const [error, setError] = useState<string | null>(null);
    const signaturePadRef = useRef<SignaturePad | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);


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


    const handleSave = () => {
        if (signaturePadRef.current && !signaturePadRef.current.isEmpty()) {
            const dataUrl = signaturePadRef.current.toDataURL('image/png');
            // 處理簽名圖片
            console.log(dataUrl);
        }
    };

    const handleClear = () => {
        if (signaturePadRef.current) {
            signaturePadRef.current.clear();
        }
    };


    const handleFinalize = async () => {
        if (!signatureImage || !id) return;

        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/sign`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    documentId: id,
                    signatureImage,
                    page: selectedPage,
                    position,
                    size
                })
            });

            const data = await response.json();
            if (data.signedId) {
                window.location.href = `/download/${data.signedId}`;
            }
        } catch (error) {
            setError('sign submit error');
            console.error('Error finalizing signature:', error);
        }
    };

    if (error) return <div className="text-red-500">{error}</div>;
    if (!id) return <div>No document ID</div>;
    if (!pdfBlob) return <div>Loading...</div>;

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">Sign Document</h1>

            <select
                value={selectedPage}
                onChange={(e) => setSelectedPage(Number(e.target.value))}
                className="border p-2 rounded mb-4"
            >
                {Array.from({length: numPages}, (_, i) => (
                    <option key={i + 1} value={i + 1}>第 {i + 1} 頁</option>
                ))}
            </select>

            <div className="relative mb-4 border min-h-[500px] bg-white">
                <Document
                    file={pdfBlob}
                    onLoadSuccess={({numPages}) => setNumPages(numPages)}
                    loading={<div>Loading PDF...</div>}
                    error={<div>PDF Load failed</div>}
                >
                    <Page
                        pageNumber={selectedPage}
                        width={CONFIG.DEFAULT_PAGE_WIDTH}
                        canvasRef={canvasRef}
                    />
                </Document>
            </div>

            <SignatureArea
                signaturePadRef={signaturePadRef}
                canvasRef={canvasRef}
                onSave={handleSave}
                onClear={handleClear}
            />

            {signatureImage && (
                <div className="mt-4">
                    <Draggable
                        position={position}
                        onStop={(_, data) => setPosition({x: data.x, y: data.y})}
                    >
                        <div> {/* 添加一個包裝 div */}
                            <Resizable
                                width={size.width}
                                height={size.height}
                                onResize={(_, {size}) => setSize(size)}
                                minConstraints={CONFIG.MIN_SIGNATURE_SIZE}
                                maxConstraints={CONFIG.MAX_SIGNATURE_SIZE}
                                handle={
                                    <div className="absolute right-0 bottom-0 w-4 h-4 bg-[#5865f2]
                          cursor-se-resize rounded-bl-md"/>
                                }
                            >
                                <div
                                    style={{
                                        width: size.width,
                                        height: size.height,
                                        position: 'relative'
                                    }}
                                >
                                    <img
                                        src={signatureImage}
                                        alt="Signature"
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'contain'
                                        }}
                                        className="border-2 border-dashed border-[#4f545c] rounded-md"
                                    />
                                </div>
                            </Resizable>
                        </div>
                    </Draggable>
                </div>
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
                submit
            </button>
        </div>
    );
}
