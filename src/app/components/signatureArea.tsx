"use client";
import React, { useEffect, useState } from "react";
import SignaturePad from "signature_pad";

interface SignatureAreaProps {
  signaturePadRef: React.RefObject<SignaturePad | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  onSignatureSave: (signatureDataUrl: string) => void;
  onClear: () => void;
}

const SignatureArea: React.FC<SignatureAreaProps> = ({
  signaturePadRef,
  canvasRef,
  onSignatureSave,
  onClear,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const removeBackground = async (dataUrl: string): Promise<string> => {
    setIsProcessing(true);

    try {
      // Create off-screen canvas for processing
      const img = new Image();
      await new Promise((resolve) => {
        img.onload = resolve;
        img.src = dataUrl;
      });

      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error("Couldn't get canvas context");
      }

      // Draw the image to the canvas
      ctx.drawImage(img, 0, 0);

      // Get the image data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Simple background removal based on alpha threshold
      // We consider anything with alpha < 20 as background
      for (let i = 0; i < data.length; i += 4) {
        // If mostly white (RGB all high) and alpha channel exists
        if (data[i] > 240 && data[i + 1] > 240 && data[i + 2] > 240) {
          // Make it transparent
          data[i + 3] = 0;
        }
      }

      // Put the processed image data back
      ctx.putImageData(imageData, 0, 0);

      // Return the processed image
      return canvas.toDataURL("image/png");
    } catch (error) {
      console.error("Error processing signature:", error);
      return dataUrl; // Return original if processing fails
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSave = async () => {
    if (signaturePadRef.current && !signaturePadRef.current.isEmpty()) {
      const originalDataUrl = signaturePadRef.current.toDataURL("image/png");

      // Process the signature to remove background
      const processedDataUrl = await removeBackground(originalDataUrl);

      // Save the processed signature
      onSignatureSave(processedDataUrl);
    }
  };

  useEffect(() => {
    // Ensure canvas element exists
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Initialize SignaturePad
    signaturePadRef.current = new SignaturePad(canvas, {
      backgroundColor: "white",
      penColor: "black",
      velocityFilterWeight: 0.7,
      minWidth: 0.5,
      maxWidth: 2.5,
      throttle: 16,
      minDistance: 5,
    });

    // Handle screen resize
    const resizeCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas || !signaturePadRef.current) return;

      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;

      const context = canvas.getContext("2d");
      if (!context) return;

      context.scale(ratio, ratio);
      signaturePadRef.current.clear();
    };

    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();

    // Cleanup function
    return () => {
      window.removeEventListener("resize", resizeCanvas);
      if (signaturePadRef.current) {
        signaturePadRef.current.off();
      }
    };
  }, [signaturePadRef, canvasRef]);

  return (
    <div className="mb-4 p-4 bg-white rounded-lg shadow-md">
      <div
        className="w-full border border-gray-300 rounded-lg overflow-hidden"
        style={{ touchAction: "none" }}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-[200px] cursor-crosshair"
          style={{ touchAction: "none" }}
        />
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={handleSave}
          disabled={isProcessing}
          className={`px-4 py-2 ${
            isProcessing ? "bg-blue-300" : "bg-blue-500"
          } text-white rounded-md hover:bg-blue-600
                             transition-colors duration-200 focus:outline-none focus:ring-2
                             focus:ring-blue-500 focus:ring-offset-2 flex items-center justify-center`}
        >
          {isProcessing ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Processing...
            </>
          ) : (
            "Save Signature"
          )}
        </button>
        <button
          onClick={onClear}
          className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600
                             transition-colors duration-200 focus:outline-none focus:ring-2
                             focus:ring-gray-500 focus:ring-offset-2"
        >
          Clear
        </button>
      </div>
    </div>
  );
};

export default SignatureArea;
