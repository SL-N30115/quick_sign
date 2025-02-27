"use client";

import React, { useEffect, useState } from "react";
import SignatureArea from "../signatureArea";
import SignaturePad from "signature_pad";
import SignatureGallery from "./signatureGallery";

interface SignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  signaturePadRef: React.RefObject<SignaturePad | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  onSignatureSave: (signatureDataUrl: string) => void;
  onClear: () => void;
  savedSignatures: string[];
  onDeleteSignature: (index: number) => void;
  onAddToDocument: (signatureDataUrl: string) => void;
}

const SignatureModal: React.FC<SignatureModalProps> = ({
  isOpen,
  onClose,
  signaturePadRef,
  canvasRef,
  onSignatureSave,
  onClear,
  savedSignatures,
  onDeleteSignature,
  onAddToDocument,
}) => {
  const [localSignature, setLocalSignature] = useState<string | null>(null);
  const [isDrawingMode, setIsDrawingMode] = useState<boolean>(
    savedSignatures.length === 0
  );

  const handleSaveClick = () => {
    if (localSignature) {
      onSignatureSave(localSignature);
      setIsDrawingMode(false); // Go back to gallery view after saving
    }
  };

  const handleAddToDocument = (signature: string) => {
    onAddToDocument(signature);
    onClose();
  };

  const handleLocalSignatureSave = (signature: string) => {
    setLocalSignature(signature);
  };

  // Reset local signature when modal opens
  useEffect(() => {
    if (isOpen) {
      if (isDrawingMode) {
        setLocalSignature(null);
        if (signaturePadRef.current) {
          signaturePadRef.current.clear();
        }
      }
    }
  }, [isOpen, isDrawingMode, signaturePadRef]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
        <div className="p-4 border-b">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">
              {isDrawingMode ? "Draw Your Signature" : "Select a Signature"}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>

          {!isDrawingMode && savedSignatures.length > 0 && (
            <div className="flex mt-2">
              <button
                onClick={() => setIsDrawingMode(true)}
                className="px-3 py-1 text-sm bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
              >
                Draw New Signature
              </button>
            </div>
          )}
        </div>

        <div>
          {isDrawingMode ? (
            <div className="p-4">
              <SignatureArea
                signaturePadRef={signaturePadRef}
                canvasRef={canvasRef}
                onSignatureSave={handleLocalSignatureSave}
                onClear={onClear}
              />

              {localSignature && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <h3 className="font-medium mb-2">Preview</h3>
                  <div className="border rounded p-2 flex justify-center">
                    <img
                      src={localSignature}
                      alt="Your signature"
                      className="max-h-24"
                    />
                  </div>
                </div>
              )}

              <div className="mt-4 border-t pt-4 flex justify-between">
                {savedSignatures.length > 0 && (
                  <button
                    onClick={() => setIsDrawingMode(false)}
                    className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                  >
                    Back to Gallery
                  </button>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={onClear}
                    className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                  >
                    Clear
                  </button>
                  <button
                    onClick={handleSaveClick}
                    disabled={!localSignature}
                    className={`px-4 py-2 rounded text-white ${
                      localSignature
                        ? "bg-blue-600 hover:bg-blue-700"
                        : "bg-blue-300 cursor-not-allowed"
                    }`}
                  >
                    Save Signature
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <SignatureGallery
                savedSignatures={savedSignatures}
                onSelectSignature={handleAddToDocument}
                onCreateNew={() => setIsDrawingMode(true)}
                onDeleteSignature={onDeleteSignature}
              />

              <div className="p-4 border-t flex justify-end">
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SignatureModal;
