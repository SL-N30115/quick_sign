export interface SignaturePosition {
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
    signatureImageUrl: string;
    // New fields for normalized coordinates (at 100% scale)
    normalizedX?: number;
    normalizedY?: number;
    normalizedWidth?: number;
    normalizedHeight?: number;
}