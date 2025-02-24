'use client';

import React, {useState, useEffect, useRef} from 'react';
import {useInView} from 'react-intersection-observer';
import {pdfjs} from 'react-pdf';

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface PDFViewerProps {
    pdfBlob: Blob;
    selectedPage: number;
    onPageChange: (pageNumber: number) => void;
}

const PDFViewer: React.FC<PDFViewerProps> = ({pdfBlob, selectedPage, onPageChange}) => {
    const [numPages, setNumPages] = useState(0);
    const [pdfDocument, setPdfDocument] = useState<pdfjs.PDFDocumentProxy | null>(null);
    const [scale, setScale] = useState(1.5); // Initial scale
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState(0); // Track container width

    // Load PDF document
    useEffect(() => {
        const loadPDF = async () => {
            const arrayBuffer = await pdfBlob.arrayBuffer();
            const pdf = await pdfjs.getDocument({data: arrayBuffer}).promise;
            setPdfDocument(pdf);
            setNumPages(pdf.numPages);
        };
        loadPDF();
    }, [pdfBlob]);

    // Get container width on mount and resize
    useEffect(() => {
        const handleResize = () => {
            setContainerWidth(containerRef.current ? containerRef.current.offsetWidth : 0);
        };

        handleResize(); // Initial measurement
        window.addEventListener('resize', handleResize);

        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const PDFPageImage = ({pageNumber}: { pageNumber: number }) => {
        const [imageUrl, setImageUrl] = useState<string | null>(null);
        const {ref, inView} = useInView({
            threshold: 0,
            triggerOnce: false,
            rootMargin: '200px 0px',
        });

        useEffect(() => {
            const renderPage = async () => {
                if (!inView || !pdfDocument) return;

                try {
                    const page = await pdfDocument.getPage(pageNumber);
                    const viewport = page.getViewport({scale});

                    // Create canvas
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;

                    if (!context) return;

                    // Render PDF page to canvas
                    await page.render({
                        canvasContext: context,
                        viewport: viewport,
                    }).promise;

                    // Convert canvas to blob URL
                    const blob = await new Promise<Blob>((resolve) => {
                        canvas.toBlob((blob) => {
                            if (blob) resolve(blob);
                        }, 'image/png');
                    });

                    const url = URL.createObjectURL(blob);
                    setImageUrl(url);

                    // Cleanup
                    return () => URL.revokeObjectURL(url);
                } catch (error) {
                    console.error('Error rendering page:', error);
                }
            };

            renderPage();
        }, [inView, pageNumber, pdfDocument, scale]);

        return (
            <div
                ref={ref}
                className="flex justify-center mb-4"
                data-page-number={pageNumber}
            >
                {imageUrl ? (
                    <img
                        src={imageUrl}
                        alt={`Page ${pageNumber}`}
                        className="shadow-lg rounded-lg"
                        loading="lazy"
                        style={{maxWidth: '100%', height: 'auto'}} // Ensure image fits container
                    />
                ) : (
                    <div className="w-full h-[800px] bg-gray-100 animate-pulse rounded-lg"/>
                )}
            </div>
        );
    };

    const handleZoomIn = () => {
        setScale(s => Math.min(s + 0.2, 3));
    };

    const handleZoomOut = () => {
        setScale(s => Math.max(s - 0.2, 0.5));
    };

    return (
        <div className="flex flex-col h-full">
            {/* Toolbar */}
            <div className="bg-gray-50 p-4 shadow-md flex justify-between items-center">
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

            {/* PDF Pages */}
            <div ref={containerRef} className="flex-1 overflow-auto p-4">
                {numPages > 0 ? (
                    Array.from({length: numPages}, (_, i) => (
                        <PDFPageImage key={i + 1} pageNumber={i + 1}/>
                    ))
                ) : (
                    <div className="text-center">Loading PDF...</div>
                )}
            </div>
        </div>
    );
};

export default PDFViewer;