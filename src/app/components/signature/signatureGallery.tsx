"use client";

import React, { useState } from 'react';

interface SignatureGalleryProps {
  savedSignatures: string[];
  onSelectSignature: (signatureDataUrl: string) => void;
  onCreateNew: () => void;
  onDeleteSignature: (index: number) => void;
}

const SignatureGallery: React.FC<SignatureGalleryProps> = ({
  savedSignatures,
  onSelectSignature,
  onCreateNew,
  onDeleteSignature
}) => {
  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-3">My Signatures</h3>
      
      <div className="grid grid-cols-2 gap-3">
        {savedSignatures.map((signature, index) => (
          <div key={index} className="group relative border rounded-lg p-2 hover:border-blue-500">
            <img 
              src={signature} 
              alt={`Signature ${index + 1}`} 
              className="h-16 mx-auto object-contain cursor-pointer"
              onClick={() => onSelectSignature(signature)}
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteSignature(index);
              }}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 
                         flex items-center justify-center text-xs opacity-0 group-hover:opacity-100"
            >
              ×
            </button>
          </div>
        ))}
        
        <div 
          onClick={onCreateNew}
          className="flex items-center justify-center border border-dashed rounded-lg p-2 
                   hover:border-blue-500 cursor-pointer h-[68px]"
        >
          <div className="text-center text-gray-500 hover:text-blue-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span className="text-xs">Draw New</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignatureGallery;