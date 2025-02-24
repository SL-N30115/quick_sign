'use client'
import React from "react";
import SignatureCanvas from "react-signature-canvas";

interface SignatureAreaProps {
    sigCanvas: React.RefObject<SignatureCanvas | null>;
    onSave: () => void;
    onClear: () => void;
}

const SignatureArea: React.FC<SignatureAreaProps> = ({
                                                         sigCanvas,
                                                         onSave,
                                                         onClear
                                                     }) => (
    <div className="mb-4 p-4 bg-white rounded-lg shadow-md">
        <div className="w-full border border-gray-300 rounded-lg overflow-hidden"
             style={{touchAction: 'none'}}>
            <SignatureCanvas
                ref={sigCanvas as React.RefObject<SignatureCanvas>}
                canvasProps={{
                    className: 'w-full h-[200px] cursor-crosshair',
                    style: {
                        touchAction: 'none',
                        background: 'white'
                    }
                }}
            />
        </div>
        <div className="mt-4 flex gap-2">
            <button
                onClick={onSave}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600
                   transition-colors duration-200 focus:outline-none focus:ring-2
                   focus:ring-blue-500 focus:ring-offset-2"
            >
                儲存簽名
            </button>
            <button
                onClick={onClear}
                className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600
                   transition-colors duration-200 focus:outline-none focus:ring-2
                   focus:ring-gray-500 focus:ring-offset-2"
            >
                清除
            </button>
        </div>
    </div>
)

export default SignatureArea;