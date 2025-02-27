"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import debounce from "lodash/debounce";
import { SignaturePosition } from "@/app/types/signaturePosition";

interface DraggableSignatureProps {
  signature: SignaturePosition;
  signatureImage: string;
  activeSignatureId: string | null;
  setActiveSignatureId: (id: string) => void;
  pageDimensions: Map<
    number,
    {
      width: number;
      height: number;
      pdfWidth: number;
      pdfHeight: number;
    }
  >;
  updateSignatures: (updatedSignatures: SignaturePosition[]) => void;
  allSignatures: SignaturePosition[];
  removeSignature: (id: string) => void;
}

const DraggableSignature: React.FC<DraggableSignatureProps> = ({
  signature,
  signatureImage,
  activeSignatureId,
  setActiveSignatureId,
  pageDimensions,
  updateSignatures,
  allSignatures,
  removeSignature,
}) => {
  // Use refs to track position and size during drag/resize operations
  // without causing re-renders
  const positionRef = useRef({ x: signature.x, y: signature.y });
  const sizeRef = useRef({ width: signature.width, height: signature.height });

  // State for UI rendering - update these less frequently
  const [position, setPosition] = useState({ x: signature.x, y: signature.y });
  const [size, setSize] = useState({
    width: signature.width,
    height: signature.height,
  });

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [resizeStartPos, setResizeStartPos] = useState({ x: 0, y: 0 });

  // Update the internal refs when signature props change
  useEffect(() => {
    positionRef.current = { x: signature.x, y: signature.y };
    sizeRef.current = { width: signature.width, height: signature.height };
    setPosition({ x: signature.x, y: signature.y });
    setSize({ width: signature.width, height: signature.height });
  }, [signature.x, signature.y, signature.width, signature.height]);

  // Memoized update function to reduce state updates
  const updateSignatureInParent = useCallback(
    debounce(() => {
      // Get current page dimensions
      const dimensions = pageDimensions.get(signature.pageNumber);
      if (!dimensions) return; // Don't update if dimensions aren't available

      // Create a new array only if there's an actual change
      const updatedSignatures = allSignatures.map((sig) =>
        sig.id === signature.id
          ? {
              ...sig,
              x: positionRef.current.x,
              y: positionRef.current.y,
              width: sizeRef.current.width,
              height: sizeRef.current.height,
              pageWidth: dimensions.width,
              pageHeight: dimensions.height,
              pdfWidth: dimensions.pdfWidth,
              pdfHeight: dimensions.pdfHeight,
            }
          : sig
      );

      updateSignatures(updatedSignatures);
    }, 100),
    [
      signature.id,
      signature.pageNumber,
      pageDimensions,
      allSignatures,
      updateSignatures,
    ]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      setIsDragging(true);
      setStartPos({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
      setActiveSignatureId(signature.id);

      // Stop event propagation to prevent parent handlers from firing
      e.stopPropagation();
      e.preventDefault(); // Add this to prevent any default browser actions
    },
    [position.x, position.y, setActiveSignatureId, signature.id]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;

      // Update ref directly without state update during continuous movement
      positionRef.current = {
        x: e.clientX - startPos.x,
        y: e.clientY - startPos.y,
      };

      // Update visual position (less frequently)
      setPosition(positionRef.current);

      e.preventDefault();
    },
    [isDragging, startPos.x, startPos.y]
  );

  const handleMouseUp = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);

    // Final update to visual state
    setPosition(positionRef.current);

    // Make sure to call this to update the parent component with the final position
    updateSignatureInParent();
  }, [isDragging, updateSignatureInParent]);

  // Resize handlers
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      setIsResizing(true);
      setResizeStartPos({ x: e.clientX, y: e.clientY });
      setActiveSignatureId(signature.id);

      // Stop event propagation to prevent parent handlers from firing
      e.stopPropagation();
      e.preventDefault(); // Add this to prevent any default browser actions
    },
    [setActiveSignatureId, signature.id]
  );

  const handleResizeMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return;

      const deltaX = e.clientX - resizeStartPos.x;
      const deltaY = e.clientY - resizeStartPos.y;

      // Update size ref directly
      sizeRef.current = {
        width: Math.max(50, size.width + deltaX),
        height: Math.max(30, size.height + deltaY),
      };

      // Update visual size (less frequently to avoid re-renders)
      setSize(sizeRef.current);

      // Reset resize start position to avoid cumulative changes
      setResizeStartPos({ x: e.clientX, y: e.clientY });

      e.preventDefault();
    },
    [isResizing, resizeStartPos.x, resizeStartPos.y, size.width, size.height]
  );

  const handleResizeEnd = useCallback(() => {
    if (!isResizing) return;
    setIsResizing(false);

    // Update size state with the final values
    setSize(sizeRef.current);

    // Make sure to call this to update the parent component
    updateSignatureInParent();
  }, [isResizing, updateSignatureInParent]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    if (isResizing) {
      window.addEventListener("mousemove", handleResizeMove);
      window.addEventListener("mouseup", handleResizeEnd);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("mousemove", handleResizeMove);
      window.removeEventListener("mouseup", handleResizeEnd);
    };
  }, [
    isDragging,
    isResizing,
    handleMouseMove,
    handleMouseUp,
    handleResizeMove,
    handleResizeEnd,
  ]);

  // Use memo to avoid unnecessary re-renders
  return useMemo(
    () => (
      <div
        className={`absolute cursor-move group ${
          activeSignatureId === signature.id
            ? "z-20 ring-2 ring-blue-500"
            : "z-10"
        }`}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: `${size.width}px`,
          height: `${size.height}px`,
        }}
        onMouseDown={handleMouseDown}
      >
        <img
          src={signatureImage}
          alt="Signature"
          className="w-full h-full object-contain"
          draggable={false}
        />

        {/* Delete button */}
        <button
          className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-30"
          onMouseDown={(e) => {
            // Stop the event from triggering parent handlers
            e.stopPropagation();
            e.preventDefault();
          }}
          onClick={(e) => {
            // Prevent any event bubbling entirely
            e.stopPropagation();
            e.preventDefault();

            // Call the remove function directly
            removeSignature(signature.id);

            // Return false to ensure no more handlers are called
            return false;
          }}
        >
          ×
        </button>

        {/* Resize handle */}
        <div
          className="absolute bottom-0 right-0 w-4 h-4 bg-blue-500 opacity-0 group-hover:opacity-100 cursor-se-resize"
          onMouseDown={(e) => handleResizeStart(e)}
        />
      </div>
    ),
    [
      position,
      size,
      activeSignatureId,
      signature.id,
      handleMouseDown,
      handleResizeStart,
      removeSignature,
      signatureImage,
    ]
  );
};

export default DraggableSignature;
