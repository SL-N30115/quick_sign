"use client";

import React, { useState, useEffect, useRef } from 'react';
import { pdfjs } from 'react-pdf';

interface SimplePDFCanvasProps {
  pdfBlob: Blob;
  pageNumber: number;
  scale?: number;
}

const SimplePDFCanvas: React.FC<SimplePDFCanvasProps> = ({ 
  pdfBlob, 
  pageNumber, 
  scale = 1.5 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const pdfDocRef = useRef<pdfjs.PDFDocumentProxy | null>(null);
  const renderTaskRef = useRef<pdfjs.RenderTask | null>(null);
  const [pdfLoaded, setPdfLoaded] = useState(false);
  
  // Load PDF document just once
  useEffect(() => {
    const loadPDF = async () => {
      try {
        // Convert blob to ArrayBuffer
        const arrayBuffer = await pdfBlob.arrayBuffer();
        
        // Load PDF document
        const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
        pdfDocRef.current = pdf;
        setPdfLoaded(true);
      } catch (error) {
        console.error('Error loading PDF document:', error);
      }
    };
    
    loadPDF();
    
    return () => {
      // Clean up PDF document
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy().catch(console.error);
        pdfDocRef.current = null;
      }
      setPdfLoaded(false);
    };
  }, [pdfBlob]);
  
  // Render specific page when document is loaded or page/scale changes
  useEffect(() => {
    // Skip if document not loaded or canvas not ready
    if (!pdfLoaded || !canvasRef.current) return;
    
    const renderPage = async () => {
      setIsLoading(true);
      
      // Cancel any existing render task
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch (e) {
          console.log('Error cancelling render task:', e);
        }
        renderTaskRef.current = null;
      }
      
      try {
        // Get the page - we can safely access pdfDocRef.current here since pdfLoaded is true
        const page = await pdfDocRef.current!.getPage(pageNumber);
        
        // Create viewport
        const viewport = page.getViewport({ scale });
        
        // Create off-screen canvas
        const offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = viewport.width;
        offscreenCanvas.height = viewport.height;
        const offscreenContext = offscreenCanvas.getContext('2d');
        
        if (!offscreenContext) {
          console.error('Could not get canvas context');
          return;
        }
        
        // Clear with white background
        offscreenContext.fillStyle = 'white';
        offscreenContext.fillRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
        
        // Render PDF page to off-screen canvas
        renderTaskRef.current = page.render({
          canvasContext: offscreenContext,
          viewport: viewport
        });
        
        // Wait for render to complete
        await renderTaskRef.current.promise;
        renderTaskRef.current = null;
        
        // Now copy the off-screen canvas to the visible canvas
        const visibleCanvas = canvasRef.current;
        if (visibleCanvas) {
          visibleCanvas.width = viewport.width;
          visibleCanvas.height = viewport.height;
          const visibleContext = visibleCanvas.getContext('2d');
          
          if (visibleContext) {
            visibleContext.drawImage(offscreenCanvas, 0, 0);
            console.log('PDF rendered successfully');
          }
        }
      } catch (error) {
        console.error('Error rendering PDF:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    renderPage();
    
    return () => {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
    };
  }, [pageNumber, scale, pdfLoaded]); // Use pdfLoaded state instead of the ref
  
  return (
    <div className="flex justify-center relative">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-70">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      )}
      <canvas 
        ref={canvasRef} 
        className="shadow-lg rounded-lg"
      />
    </div>
  );
};

export default SimplePDFCanvas;