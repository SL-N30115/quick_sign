export interface SignaturePosition {
  id: string;
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  pageWidth: number;
  pageHeight: number;
  pdfWidth: number;
  pdfHeight: number;
  signatureImageUrl: string;
  normalizedX?: number; // Add these optional properties
  normalizedY?: number;
  normalizedWidth?: number;
  normalizedHeight?: number;
  scale?: number;
}
