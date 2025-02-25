'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useInView } from 'react-intersection-observer';
import { pdfjs } from 'react-pdf';
import debounce from 'lodash/debounce';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
    import.meta.url,
).toString();

interface PDFViewerProps {
    pdfBlob: Blob;
    selectedPage: number;
    onPageChange: (pageNumber: number) => void;
}

const imageCache = new Map<string, string>();

const PDFViewer: React.FC<PDFViewerProps> = ({ pdfBlob, selectedPage, onPageChange }) => {
    const [numPages, setNumPages] = useState(0);
    const [pdfDocument, setPdfDocument] = useState<pdfjs.PDFDocumentProxy | null>(null);
    const [scale, setScale] = useState(1.5);
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState(0);

    useEffect(() => {
        const loadPDF = async () => {
            try {
                const arrayBuffer = await pdfBlob.arrayBuffer();
                const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
                setPdfDocument(pdf);
                setNumPages(pdf.numPages);
            } catch (error) {
                console.error('Error loading PDF:', error);
                // Display user-friendly error message
                // You could set an error state and display a message like:
                // setError("Failed to load PDF. Please try again.");
            }
        };
        loadPDF();
    }, [pdfBlob]);

    useEffect(() => {
        const handleResize = debounce(() => {
            if (containerRef.current) {
                setContainerWidth(containerRef.current.offsetWidth);
            }
        }, 150);

        handleResize();
        window.addEventListener('resize', handleResize);

        return () => {
            handleResize.cancel();
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    useEffect(() => {
        return () => {
            clearCache();
        };
    }, [scale]);

    const PDFPageImage = ({ pageNumber }: { pageNumber: number }) => {
        const [imageUrl, setImageUrl] = useState<string | null>(null);
        const [isLoading, setIsLoading] = useState(true);
        const renderTimeoutRef = useRef<NodeJS.Timeout>(null);

        const { ref, inView } = useInView({
            threshold: 0,
            triggerOnce: false,
            rootMargin: '400px 0px',
            delay: 100,
        });

        const cacheKey = `page_${pageNumber}_scale_${scale}_width_${containerWidth}`; // Include containerWidth

        const debouncedRenderPage = useRef(
            debounce(async (shouldRender: boolean) => {
                if (!shouldRender || !pdfDocument) return;

                if (imageCache.has(cacheKey)) {
                    setImageUrl(imageCache.get(cacheKey)!);
                    setIsLoading(false);
                    return;
                }

                try {
                    const page = await pdfDocument.getPage(pageNumber);
                    const viewport = page.getViewport({ scale });

                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;

                    if (!context) return;

                    await page.render({
                        canvasContext: context,
                        viewport: viewport,
                    }).promise;

                    const blob = await new Promise<Blob>((resolve) => {
                        canvas.toBlob((blob) => {
                            if (blob) resolve(blob);
                        }, 'image/png');
                    });

                    const url = URL.createObjectURL(blob);
                    imageCache.set(cacheKey, url);
                    setImageUrl(url);
                    setIsLoading(false);

                } catch (error) {
                    console.error('Error rendering page:', error);
                    setIsLoading(false);
                    // Display user-friendly error message for page rendering
                }
            }, 150)
        ).current;

        useEffect(() => {
            setIsLoading(true);
            debouncedRenderPage(inView);

            return () => {
                debouncedRenderPage.cancel();
                if (renderTimeoutRef.current) {
                    clearTimeout(renderTimeoutRef.current);
                }
            };
        }, [inView, pageNumber, pdfDocument, scale, containerWidth]); // Add containerWidth as a dependency

        // @ts-ignore
        return (
            <div
                ref={ref}
                className="flex justify-center mb-4 relative"
                data-page-number={pageNumber}
            >
                {isLoading && (
                    <div className="w-full h-[800px] bg-gray-100 animate-pulse rounded-lg" />
                )}
                {imageUrl && (
                    <img
                        src={imageUrl}
                        alt={`Page ${pageNumber}`}
                        className={`shadow-lg rounded-lg transition-opacity duration-300 ${
                            isLoading ? 'opacity-0' : 'opacity-100'
                        }`}
                        loading="lazy"
                        // @ts-ignore
                        decode="async"
                        onLoad={() => setIsLoading(false)}
                        style={{ maxWidth: '100%', height: 'auto' }}
                    />
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

    const clearCache = () => {
        imageCache.forEach((url) => {
            URL.revokeObjectURL(url);
        });
        imageCache.clear();
    };



    return (
        <div className="flex flex-col h-full">
            <div className="bg-gray-50 p-4 shadow-md flex justify-between items-center sticky top-0 z-10">
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

            <div
                ref={containerRef}
                className="flex-1 overflow-auto p-4 bg-gray-100"
            >
                {numPages > 0 ? (
                    Array.from({ length: numPages }, (_, i) => (
                        <PDFPageImage key={i + 1} pageNumber={i + 1} />
                    ))
                ) : (
                    <div className="text-center py-8">
                        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent"></div>
                        <p className="mt-2">Loading pdf...</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PDFViewer;