// components/PDFViewer.tsx
'use client';

import {Document, Page, pdfjs} from 'react-pdf';
import React, {useState, useEffect, useRef} from 'react';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
    import.meta.url
).toString();

interface PDFViewerProps {
    pdfBlob: Blob;
    selectedPage: number;
    onPageChange: (pageNumber: number) => void;
    className?: string;
}

const PDFViewer: React.FC<PDFViewerProps> = ({
                                                 pdfBlob,
                                                 selectedPage,
                                                 onPageChange,
                                                 className
                                             }) => {
    const [numPages, setNumPages] = useState<number>(0);
    const [scale, setScale] = useState(1);
    const [pageWidth, setPageWidth] = useState(800); // Default width
    const containerRef = useRef<HTMLDivElement>(null);

    const handleZoomIn = () => setScale(prev => Math.min(prev + 0.2, 2));
    const handleZoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.5));
    const handleZoomFit = () => {
        if (containerRef.current) {
            const newWidth = containerRef.current.offsetWidth - 48;
            setPageWidth(newWidth);
            setScale(1);
        }
    };

    useEffect(() => {
        handleZoomFit();
        window.addEventListener('resize', handleZoomFit);
        return () => window.removeEventListener('resize', handleZoomFit);
    }, []);

    return (
        <div className={className}>
            {/* Controls */}
            <div className="flex items-center justify-between mb-4 bg-white p-4 rounded-lg shadow">
                {/* Page Navigation */}
                <div className="flex items-center space-x-2">
                    <button
                        onClick={() => onPageChange(Math.max(selectedPage - 1, 1))}
                        disabled={selectedPage === 1}
                        className="px-3 py-1 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50
                                 disabled:cursor-not-allowed transition-colors"
                    >
                        Previous
                    </button>
                    <select
                        value={selectedPage}
                        onChange={(e) => onPageChange(Number(e.target.value))}
                        className="border border-gray-200 px-2 py-1 rounded-md focus:outline-none
                                 focus:ring-2 focus:ring-blue-500"
                    >
                        {Array.from({length: numPages}, (_, i) => (
                            <option key={i + 1} value={i + 1}>
                                Page {i + 1} of {numPages}
                            </option>
                        ))}
                    </select>
                    <button
                        onClick={() => onPageChange(Math.min(selectedPage + 1, numPages))}
                        disabled={selectedPage === numPages}
                        className="px-3 py-1 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50
                                 disabled:cursor-not-allowed transition-colors"
                    >
                        Next
                    </button>
                </div>

                {/* Zoom Controls */}
                <div className="flex items-center space-x-2">
                    <button
                        onClick={handleZoomOut}
                        className="p-2 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4"/>
                        </svg>
                    </button>
                    <span className="text-sm font-medium">{Math.round(scale * 100)}%</span>
                    <button
                        onClick={handleZoomIn}
                        className="p-2 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
                        </svg>
                    </button>
                    <button
                        onClick={handleZoomFit}
                        className="px-3 py-1 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                    >
                        Fit
                    </button>
                </div>
            </div>

            {/* PDF Viewer */}
            <div
                ref={containerRef}
                className="relative bg-gray-50 rounded-lg shadow-lg overflow-auto"
                style={{height: 'calc(100vh - 250px)'}}
            >
                <Document
                    file={pdfBlob}
                    onLoadSuccess={({numPages}) => setNumPages(numPages)}
                    loading={
                        <div className="flex items-center justify-center h-full">
                            <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200
                                          border-t-blue-500"/>
                        </div>
                    }
                    error={
                        <div className="flex items-center justify-center h-full text-red-500">
                            Failed to load PDF
                        </div>
                    }
                >
                    <div className="p-6">
                        <Page
                            pageNumber={selectedPage}
                            width={pageWidth * scale}
                            className="shadow-lg mx-auto"
                            renderAnnotationLayer={false}
                            renderTextLayer={true}
                        />
                    </div>
                </Document>
            </div>
        </div>
    );
};

export default PDFViewer;
