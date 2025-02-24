'use client'
import dynamic from 'next/dynamic';
import {useSearchParams} from 'next/navigation';
import React, {useRef, useState, useEffect} from 'react';
import SignatureCanvas from 'react-signature-canvas';
import Draggable, { DraggableData } from 'react-draggable';
import { Resizable } from 'react-resizable';
import 'react-resizable/css/styles.css';
import {Document, Page, pdfjs} from "react-pdf";


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

const PDFViewer = dynamic(() => import('@/app/components/PDFViewer'), {
    ssr: false,
    loading: () => <div>Loading PDF viewer...</div>
});

export default function Sign() {
    const searchParams = useSearchParams();
    const id = searchParams.get('id');
    const [selectedPage, setSelectedPage] = useState<number>(1);
    const sigCanvas = useRef<SignatureCanvas>(null);
    const [signatureImage, setSignatureImage] = useState<string | null>(null);
    const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
    const [size, setSize] = useState<Size>({ width: 100, height: 50 });
    const [error, setError] = useState<string | null>(null);
    const [numPages, setNumPages] = useState<number | null>(null);
    const [isClient, setIsClient] = useState(false);
    const [pdfStatus, setPdfStatus] = useState('initial');

    const handleDrag = (e: any, data: DraggableData) => {
        setPosition({ x: data.x, y: data.y });
    };

    const handleResize = (e: any, { size }: { size: Size }) => {
        setSize(size);
    };

    const saveSignature = () => {
        if (sigCanvas.current) {
            const image = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png');
            setSignatureImage(image);
        }
    };

    const clearSignature = () => {
        if (sigCanvas.current) {
            sigCanvas.current.clear();
            setSignatureImage(null);
        }
    };


    const handlePDFLoadSuccess = (numPages: number) => {
        setNumPages(numPages);
        setError(null);
        console.log('PDF loaded successfully with', numPages, 'pages');
    };

    const handlePDFError = (error: Error) => {
        setError(error.message);
        console.error('PDF load error:', error);
    };

    const handleFinalize = async () => {
        if (!signatureImage || !id) {
            alert('請先建立簽名');
            return;
        }

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

            if (!response.ok) {
                throw new Error('文件簽署失敗');
            }

            const data: { signedId: string } = await response.json();
            window.location.href = `/download/${data.signedId}`;
        } catch (error) {
            console.error('簽署文件時發生錯誤:', error);
            alert('文件簽署失敗');
        }
    };

    useEffect(() => {
        setIsClient(true);
    }, []);

    if (!isClient) {
        return <div>Loading...</div>;
    }

    if (!id) return <div>未提供文件 ID</div>;

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">簽署文件</h1>

            {/* PDF 顯示區域 */}
            <div className="mb-4 border rounded">
                <div style={{ border: '1px solid red', minHeight: '500px' }}>
                    <PDFViewer
                        fileId={id}
                        onLoadSuccess={handlePDFLoadSuccess}
                        onError={handlePDFError}
                    />
                </div>
            </div>

            {/* 頁碼選擇器 */}
            {/*{numPages > 0 && (*/}
            {/*    <div className="mb-4">*/}
            {/*        <label className="mr-2">選擇頁碼:</label>*/}
            {/*        <select*/}
            {/*            value={selectedPage}*/}
            {/*            onChange={(e) => setSelectedPage(Number(e.target.value))}*/}
            {/*            className="border rounded p-1"*/}
            {/*        >*/}
            {/*            {Array.from(new Array(numPages), (_, index) => (*/}
            {/*                <option key={index + 1} value={index + 1}>*/}
            {/*                    第 {index + 1} 頁*/}
            {/*                </option>*/}
            {/*            ))}*/}
            {/*        </select>*/}
            {/*    </div>*/}
            {/*)}*/}

            {/*/!* 簽名區域 *!/*/}
            {/*<div className="mb-4 p-4 border rounded bg-white">*/}
            {/*    <h2 className="text-lg font-semibold mb-2">建立簽名</h2>*/}
            {/*    <SignatureCanvas*/}
            {/*        ref={sigCanvas}*/}
            {/*        canvasProps={{*/}
            {/*            width: 500,*/}
            {/*            height: 200,*/}
            {/*            className: "border rounded bg-white"*/}
            {/*        }}*/}
            {/*    />*/}
            {/*    <div className="mt-2 space-x-2">*/}
            {/*        <button*/}
            {/*            onClick={saveSignature}*/}
            {/*            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"*/}
            {/*        >*/}
            {/*            儲存簽名*/}
            {/*        </button>*/}
            {/*        <button*/}
            {/*            onClick={clearSignature}*/}
            {/*            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"*/}
            {/*        >*/}
            {/*            清除*/}
            {/*        </button>*/}
            {/*    </div>*/}
            {/*</div>*/}

            {/*/!* 可拖動的簽名預覽 *!/*/}
            {/*{signatureImage && (*/}
            {/*    <div className="mb-4 relative border rounded p-4">*/}
            {/*        <h2 className="text-lg font-semibold mb-2">調整簽名位置</h2>*/}
            {/*        <div className="relative h-[400px] border">*/}
            {/*            <Draggable position={position} onStop={handleDrag}>*/}
            {/*                <div className="absolute">*/}
            {/*                    <Resizable*/}
            {/*                        width={size.width}*/}
            {/*                        height={size.height}*/}
            {/*                        onResize={handleResize}*/}
            {/*                        minConstraints={[50, 25]}*/}
            {/*                        maxConstraints={[300, 150]}*/}
            {/*                    >*/}
            {/*                        <img*/}
            {/*                            src={signatureImage}*/}
            {/*                            alt="簽名"*/}
            {/*                            style={{*/}
            {/*                                width: size.width,*/}
            {/*                                height: size.height,*/}
            {/*                                cursor: 'move'*/}
            {/*                            }}*/}
            {/*                            className="border border-dashed border-gray-400"*/}
            {/*                        />*/}
            {/*                    </Resizable>*/}
            {/*                </div>*/}
            {/*            </Draggable>*/}
            {/*        </div>*/}
            {/*    </div>*/}
            {/*)}*/}

            {/*/!* 完成按鈕 *!/*/}
            {/*<button*/}
            {/*    onClick={handleFinalize}*/}
            {/*    disabled={!signatureImage}*/}
            {/*    className={`w-full mt-4 px-6 py-3 rounded font-semibold ${*/}
            {/*        signatureImage*/}
            {/*            ? 'bg-green-500 hover:bg-green-600 text-white'*/}
            {/*            : 'bg-gray-300 cursor-not-allowed'*/}
            {/*    }`}*/}
            {/*>*/}
            {/*    完成簽署*/}
            {/*</button>*/}
        </div>
    );
}
