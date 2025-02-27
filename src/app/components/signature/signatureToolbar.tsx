"use client";

import React from "react";

interface SignatureToolbarProps {
  onSignButtonClick: () => void;
  signatureImage: string | null;
  handleFinalize: () => void;
  signaturesCount: number;
}

const SignatureToolbar: React.FC<SignatureToolbarProps> = ({
  onSignButtonClick,
  signatureImage,
  handleFinalize,
  signaturesCount,
}) => {
  return (
    <div className="bg-white shadow-md rounded-lg p-3 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            onClick={onSignButtonClick}
            className="flex items-center space-x-1 bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700"
          >
            <svg 
              className="w-5 h-5" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24">
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" 
              />
            </svg>
            <span>Sign</span>
          </button>
        </div>

        {signatureImage && (
          <div className="flex items-center space-x-3">
            <div className="hidden sm:flex items-center space-x-2">
              <span className="text-sm text-gray-600">
                {signaturesCount} {signaturesCount === 1 ? "signature" : "signatures"} placed
              </span>
              {signatureImage && (
                <div className="h-8 w-16 border rounded overflow-hidden">
                  <img 
                    src={signatureImage} 
                    alt="Your signature" 
                    className="h-full w-full object-contain" 
                  />
                </div>
              )}
            </div>
            <button
              onClick={handleFinalize}
              className={`px-3 py-2 rounded text-white ${
                signaturesCount > 0
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-green-300 cursor-not-allowed"
              }`}
              disabled={signaturesCount === 0}
            >
              Finalize
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SignatureToolbar;