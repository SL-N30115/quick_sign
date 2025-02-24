// components/PDFViewer.tsx
'use client';

import { Document, Page } from 'react-pdf';
import { pdfjs } from 'react-pdf';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
    import.meta.url,
).toString();

interface PDFViewerProps {
    fileId: string;
    onLoadSuccess: (numPages: number) => void;
    onError: (error: Error) => void;
}

export default function PDFViewer({ fileId, onLoadSuccess, onError }: PDFViewerProps) {
    return (
        <Document
            file={`http://localhost:5000/file/${fileId}`}
            onLoadSuccess={({ numPages }) => onLoadSuccess(numPages)}
            onLoadError={onError}
        >
            {/*{({ numPages }) =>*/}
            {/*    numPages &&*/}
            {/*    Array.from(new Array(numPages), (el, index) => (*/}
            {/*        <Page*/}
            {/*            key={`page_${index + 1}`}*/}
            {/*            pageNumber={index + 1}*/}
            {/*            width={800}*/}
            {/*            renderTextLayer={false}*/}
            {/*            renderAnnotationLayer={false}*/}
            {/*        />*/}
            {/*    ))*/}
            {/*}*/}
        </Document>
    );
}