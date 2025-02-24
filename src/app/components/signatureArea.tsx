'use client'
import React, { useEffect } from "react";
import SignaturePad from "signature_pad";

interface SignatureAreaProps {
    signaturePadRef: React.RefObject<SignaturePad | null>;
    canvasRef: React.RefObject<HTMLCanvasElement | null>;
    onSave: () => void;
    onClear: () => void;
}

const SignatureArea: React.FC<SignatureAreaProps> = ({
                                                         signaturePadRef,
                                                         canvasRef,
                                                         onSave,
                                                         onClear
                                                     }) => {
    useEffect(() => {
        // Ensure canvas element exists
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Initialize SignaturePad
        signaturePadRef.current = new SignaturePad(canvas, {
            backgroundColor: 'white',
            penColor: 'black',
            velocityFilterWeight: 0.7,
            minWidth: 0.5,
            maxWidth: 2.5,
            throttle: 16,
            minDistance: 5
        });

        // Handle screen resize
        const resizeCanvas = () => {
            const canvas = canvasRef.current;
            if (!canvas || !signaturePadRef.current) return;

            const ratio = Math.max(window.devicePixelRatio || 1, 1);
            canvas.width = canvas.offsetWidth * ratio;
            canvas.height = canvas.offsetHeight * ratio;

            const context = canvas.getContext('2d');
            if (!context) return;

            context.scale(ratio, ratio);
            signaturePadRef.current.clear();
        };

        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();

        // Cleanup function
        return () => {
            window.removeEventListener('resize', resizeCanvas);
            if (signaturePadRef.current) {
                signaturePadRef.current.off();
            }
        };
    }, [signaturePadRef, canvasRef]);

    return (
        <div className="mb-4 p-4 bg-white rounded-lg shadow-md">
            <div
                className="w-full border border-gray-300 rounded-lg overflow-hidden"
                style={{ touchAction: 'none' }}
            >
                <canvas
                    ref={canvasRef}
                    className="w-full h-[200px] cursor-crosshair"
                    style={{ touchAction: 'none' }}
                />
            </div>

            <div className="mt-4 flex gap-2">
                <button
                    onClick={onSave}
                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600
                             transition-colors duration-200 focus:outline-none focus:ring-2
                             focus:ring-blue-500 focus:ring-offset-2"
                >
                    Save Signature
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
