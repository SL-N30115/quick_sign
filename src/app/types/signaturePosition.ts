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
    // New fields to improve accuracy with canvas rendering
    canvasX?: number;    // X coordinate relative to canvas
    canvasY?: number;    // Y coordinate relative to canvas
  }