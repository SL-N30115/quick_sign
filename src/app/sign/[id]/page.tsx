'use client';

import { useParams } from 'next/navigation';
import { Document, Page, pdfjs } from 'react-pdf';
import { Resizable } from 'react-resizable';
import React, { useRef, useState, useEffect, useCallback } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import Draggable from 'react-draggable';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import SignatureArea from "@/app/components/signatureArea";

// 設定常數
const CONFIG = {
    API_BASE_URL: 'http://localhost:5000',
    DEFAULT_PAGE_WIDTH: 800,
    MIN_SIGNATURE_SIZE: [50, 25] as [number, number],
    MAX_SIGNATURE_SIZE: [300, 150] as [number, number],
    INITIAL_SIGNATURE_SIZE: { width: 100, height: 50 }
};

// 設定 PDF worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
    import.meta.url
).toString();

// 介面定義
interface Position { x: number; y: number }
interface Size { width: number; height: number }


export default function Sign() {
    const { id } = useParams();
    const [numPages, setNumPages] = useState<number>(0);
    const [selectedPage, setSelectedPage] = useState<number>(1);
    const [signatureImage, setSignatureImage] = useState<string | null>(null);
    const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
    const [size, setSize] = useState<Size>(CONFIG.INITIAL_SIGNATURE_SIZE);
    const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
    const [error, setError] = useState<string | null>(null);

    const sigCanvas = useRef<SignatureCanvas>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // 取得 PDF
    useEffect(() => {
        const fetchPdf = async () => {
            try {
                const response = await fetch(`${CONFIG.API_BASE_URL}/file/${id}`);
                if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
                const blob = await response.blob();
                setPdfBlob(blob);
            } catch (error) {
                setError('無法載入 PDF 文件');
                console.error('Fetch error:', error);
            }
        };

        if (id) fetchPdf();
    }, [id]);

    // 處理簽名
    const handleSaveSignature = useCallback(() => {
        if (sigCanvas.current) {
            const image = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png');
            setSignatureImage(image);
        }
    }, []);

    // 處理最終提交
    const handleFinalize = async () => {
        if (!signatureImage || !id) return;

        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/sign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
            setError('簽名提交失敗');
            console.error('Error finalizing signature:', error);
        }
    };

    if (error) return <div className="text-red-500">{error}</div>;
    if (!id) return <div>未提供文件 ID</div>;
    if (!pdfBlob) return <div>載入中...</div>;

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">簽署文件</h1>

            {/* 頁面選擇器 */}
            <select
                value={selectedPage}
                onChange={(e) => setSelectedPage(Number(e.target.value))}
                className="border p-2 rounded mb-4"
            >
                {Array.from({ length: numPages }, (_, i) => (
                    <option key={i + 1} value={i + 1}>第 {i + 1} 頁</option>
                ))}
            </select>

            {/* PDF 顯示區域 */}
            <div className="relative mb-4 border min-h-[500px] bg-white">
                <Document
                    file={pdfBlob}
                    onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                    loading={<div>載入 PDF 中...</div>}
                    error={<div>PDF 載入失敗</div>}
                >
                    <Page
                        pageNumber={selectedPage}
                        width={CONFIG.DEFAULT_PAGE_WIDTH}
                        canvasRef={canvasRef}
                    />
                </Document>
            </div>

            {/* 簽名區域 */}
            <SignatureArea
                sigCanvas={sigCanvas}
                onSave={handleSaveSignature}
                onClear={() => sigCanvas.current?.clear()}
            />

            {/* 簽名預覽 */}
            {signatureImage && (
                <Draggable position={position} onStop={(_, data) => setPosition({ x: data.x, y: data.y })}>
                    <Resizable
                        width={size.width}
                        height={size.height}
                        onResize={(_, { size }) => setSize(size)}
                        minConstraints={CONFIG.MIN_SIGNATURE_SIZE}
                        maxConstraints={CONFIG.MAX_SIGNATURE_SIZE}
                    >
                        <img
                            src={signatureImage}
                            alt="簽名"
                            style={{
                                width: size.width,
                                height: size.height,
                                cursor: 'move'
                            }}
                            className="border border-dashed border-gray-400"
                        />
                    </Resizable>
                </Draggable>
            )}

            {/* 確認按鈕 */}
            <button
                onClick={handleFinalize}
                disabled={!signatureImage}
                className={`mt-4 px-6 py-2 rounded ${
                    signatureImage
                        ? 'bg-green-500 text-white hover:bg-green-600'
                        : 'bg-gray-300 cursor-not-allowed'
                }`}
            >
                確認送出
            </button>
        </div>
    );
}
